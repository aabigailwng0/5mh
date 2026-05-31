"""Curated ingredient knowledge base with INCI matching.

Loads ``ingredient_properties.csv`` once and exposes lookup by raw INCI token.
Matching is intentionally simple and transparent (normalised exact + alias +
substring) so that *why* an ingredient matched is always inspectable — no
opaque fuzzy-distance scoring that could silently mis-tag a risky ingredient.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

from ..models import Ingredient


def normalize(text: str) -> str:
    """Lower-case, strip punctuation/whitespace noise from an INCI token.

    e.g. "  Sodium Hyaluronate*  " -> "sodium hyaluronate".
    """
    text = text.lower().strip()
    # Drop trailing markers vendors add (asterisks, percentages, parentheticals).
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[*†+]", " ", text)
    text = re.sub(r"\b\d+(\.\d+)?\s*%\b", " ", text)
    text = re.sub(r"[^a-z0-9\s\-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class IngredientKnowledgeBase:
    """In-memory index of curated ingredient properties."""

    def __init__(self, csv_path: Path):
        self._by_norm_name: dict[str, Ingredient] = {}
        # alias -> canonical Ingredient (longest aliases matched first)
        self._alias_index: dict[str, Ingredient] = {}
        # Benefit metadata kept off the public model: norm_name -> (axis, strength)
        self._benefit: dict[str, tuple[str, float]] = {}
        self._load(csv_path)

    def _load(self, csv_path: Path) -> None:
        with open(csv_path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                ing = Ingredient(
                    inci_name=row["inci_name"].strip(),
                    comedogenic_rating=_to_float(row.get("comedogenic_rating")),
                    irritant_weight=_to_float(row.get("irritant_weight")),
                    category=row.get("category", "other").strip(),
                    is_active=row.get("is_active", "0").strip() in ("1", "true", "True"),
                    function=row.get("function", "").strip(),
                    notes=row.get("notes", "").strip(),
                )
                # Store benefit metadata on the dataclass via a side dict so we
                # don't bloat the public model; recommenders read it back.
                self._benefit[normalize(ing.inci_name)] = (
                    row.get("benefit_axis", "").strip(),
                    _to_float(row.get("benefit_strength")),
                )

                key = normalize(ing.inci_name)
                self._by_norm_name[key] = ing
                self._alias_index[key] = ing
                for alias in (row.get("aliases") or "").split("|"):
                    alias_norm = normalize(alias)
                    if alias_norm:
                        self._alias_index[alias_norm] = ing

    def match(self, raw_token: str) -> Ingredient | None:
        """Resolve a raw INCI token to a known :class:`Ingredient`, or ``None``.

        Strategy (most-specific first):
          1. exact normalised name / alias match
          2. token appears as a whole phrase inside the raw string
        """
        norm = normalize(raw_token)
        if not norm:
            return None
        if norm in self._alias_index:
            return self._alias_index[norm]

        # Substring match: prefer the longest alias contained in the token so
        # "sodium lauryl sulfate" wins over a hypothetical "lauryl" entry.
        best: Ingredient | None = None
        best_len = 0
        for alias, ing in self._alias_index.items():
            if len(alias) >= 4 and alias in norm and len(alias) > best_len:
                best, best_len = ing, len(alias)
        return best

    def benefit_for(self, ingredient: Ingredient) -> tuple[str, float]:
        """Return ``(benefit_axis, strength)`` for an ingredient (axis may be "")."""
        return self._benefit.get(normalize(ingredient.inci_name), ("", 0.0))

    def all_ingredients(self) -> list[Ingredient]:
        return list(self._by_norm_name.values())

    def beneficial_for_axis(self, axis: str) -> list[Ingredient]:
        """All ingredients whose curated benefit targets ``axis``, strongest first."""
        out = [
            (ing, self._benefit.get(norm, ("", 0.0))[1])
            for norm, ing in self._by_norm_name.items()
            if self._benefit.get(norm, ("", 0.0))[0] == axis
        ]
        out.sort(key=lambda t: t[1], reverse=True)
        return [ing for ing, _ in out]


def _to_float(value: str | None) -> float:
    try:
        return float(value) if value not in (None, "") else 0.0
    except (TypeError, ValueError):
        return 0.0
