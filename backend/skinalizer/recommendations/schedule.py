"""Builds an ordered AM / PM routine from logged products.

Ordering follows the canonical "thin → thick, sunscreen last" layering rule set
in ``routine_rules.json``. Active timing (retinoids at night, vitamin C in the
morning, SPF AM-only) is applied from the same rules file so the logic stays
data-driven and easy to tweak.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..ingredients.knowledge_base import IngredientKnowledgeBase, normalize
from ..models import Product, RoutineStep


class ScheduleBuilder:
    """Turns a product list into ``{"am": [...], "pm": [...]}`` routines."""

    def __init__(self, rules_path: Path, knowledge_base: IngredientKnowledgeBase):
        self._kb = knowledge_base
        rules = json.loads(Path(rules_path).read_text(encoding="utf-8"))
        self._step_order: list[str] = rules["step_order"]
        self._category_to_step: dict[str, str] = rules["category_to_step"]
        self._active_timing: dict[str, str] = rules["active_timing"]
        self._step_labels: dict[str, str] = rules["step_labels"]

    def build(self, products: list[Product]) -> dict[str, list[dict]]:
        am: list[RoutineStep] = []
        pm: list[RoutineStep] = []

        for product in products:
            step_type = self._step_for(product)
            timing = self._timing_for(product, step_type)
            note = self._note_for(product, step_type)
            step = RoutineStep(
                order=self._order_index(step_type),
                step_type=step_type,
                product_name=product.name,
                note=note,
            )
            if timing in ("am", "any"):
                am.append(step)
            if timing in ("pm", "any"):
                pm.append(step)

        return {
            "am": [s.to_dict() for s in self._sequence(am)],
            "pm": [s.to_dict() for s in self._sequence(pm)],
        }

    # ------------------------------------------------------------------ helpers
    def _step_for(self, product: Product) -> str:
        cat = (product.category or "").lower()
        return self._category_to_step.get(cat, "treatment")

    def _timing_for(self, product: Product, step_type: str) -> str:
        if step_type == "sunscreen":
            return "am"  # SPF is morning-only
        # Inspect actives to decide AM vs PM vs anytime.
        timings = set()
        for raw in product.raw_ingredients:
            ing = self._kb.match(raw)
            if ing and ing.is_active:
                t = self._active_timing.get(normalize(ing.inci_name))
                if t:
                    timings.add(t)
        if "pm" in timings:
            return "pm"
        if "am" in timings:
            return "am"
        return "any"

    def _note_for(self, product: Product, step_type: str) -> str:
        for raw in product.raw_ingredients:
            ing = self._kb.match(raw)
            if ing and ing.is_active:
                t = self._active_timing.get(normalize(ing.inci_name))
                if t == "pm":
                    return f"Contains {ing.inci_name} — use at night, follow with SPF next day."
                if t == "am":
                    return f"Contains {ing.inci_name} — best in the morning."
        return self._step_labels.get(step_type, "")

    def _order_index(self, step_type: str) -> int:
        try:
            return self._step_order.index(step_type)
        except ValueError:
            return len(self._step_order)

    def _sequence(self, steps: list[RoutineStep]) -> list[RoutineStep]:
        steps.sort(key=lambda s: s.order)
        return steps
