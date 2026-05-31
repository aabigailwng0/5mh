"""Ingredient-interaction detection.

The seeded ``ingredient_interactions.csv`` is written in terms of *families*
(``retinoid``, ``aha``, ``bha`` ...) rather than every individual INCI name, so
a single well-established rule (e.g. "retinoid + AHA") covers retinol,
retinaldehyde, tretinoin, etc. without inventing per-molecule pairs.
"""

from __future__ import annotations

import csv
from pathlib import Path

from ..models import Ingredient, InteractionWarning
from .knowledge_base import normalize

# Maps concrete INCI ingredients to the interaction "families" used in the CSV.
# Only well-established groupings — nothing speculative.
FAMILY_MEMBERS: dict[str, set[str]] = {
    "retinoid": {
        "retinol",
        "retinaldehyde",
        "tretinoin",
        "adapalene",
        "retinyl palmitate",
    },
    "aha": {"glycolic acid", "lactic acid", "mandelic acid"},
    "bha": {"salicylic acid"},
    "benzoyl peroxide": {"benzoyl peroxide"},
    "ascorbic acid": {"ascorbic acid"},
}


class InteractionTable:
    """Loads interaction rules and finds clashes among a set of ingredients."""

    def __init__(self, csv_path: Path):
        self._rules: list[dict[str, str]] = []
        self._load(csv_path)

    def _load(self, csv_path: Path) -> None:
        with open(csv_path, newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                self._rules.append(
                    {
                        "a": row["ingredient_a"].strip().lower(),
                        "b": row["ingredient_b"].strip().lower(),
                        "problem": row["problem_when_combined"].strip(),
                        "severity": row.get("severity", "moderate").strip(),
                        "recommendation": row.get("recommendation", "").strip(),
                    }
                )

    @staticmethod
    def families_of(ingredient: Ingredient) -> set[str]:
        """Return the interaction families an ingredient belongs to."""
        norm = normalize(ingredient.inci_name)
        fams = {fam for fam, members in FAMILY_MEMBERS.items() if norm in members}
        return fams

    def find_clashes(
        self, ingredients: list[Ingredient]
    ) -> list[InteractionWarning]:
        """Detect every rule whose two families are both present.

        ``ingredients`` should be the *combined* set across all logged products
        for a single day (clashes are about same-day stacking).
        """
        present: dict[str, list[str]] = {}
        for ing in ingredients:
            for fam in self.families_of(ing):
                present.setdefault(fam, []).append(ing.inci_name)

        warnings: list[InteractionWarning] = []
        seen: set[frozenset[str]] = set()
        for rule in self._rules:
            fa, fb = rule["a"], rule["b"]
            key = frozenset((fa, fb))
            if fa in present and fb in present and key not in seen:
                # Guard self-pairs (e.g. retinoid+retinoid) needing >=2 members.
                if fa == fb and len(present[fa]) < 2:
                    continue
                seen.add(key)
                warnings.append(
                    InteractionWarning(
                        ingredient_a=", ".join(sorted(set(present[fa]))),
                        ingredient_b=", ".join(sorted(set(present[fb]))),
                        problem=rule["problem"],
                        severity=rule["severity"],
                        recommendation=rule["recommendation"],
                    )
                )
        return warnings
