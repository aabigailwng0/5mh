"""Ingredient & product recommendations driven by the skin analysis.

The recommender is intentionally rule-based and explainable: it looks at which
spectrum axes need help, suggests curated beneficial ingredients the user isn't
already using, and surfaces catalogue products rich in those ingredients (while
penalising high comedogenic / irritant loads).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..ingredients.knowledge_base import IngredientKnowledgeBase
from ..models import Product, Recommendation, SkinAnalysis, SkinAxis

if TYPE_CHECKING:
    from ..products.catalog import SephoraCatalog
    from ..products.kaggle_catalog import KaggleCatalog

# An axis "needs help" past these thresholds. Hydration is inverted (low = bad).
_PROBLEM_THRESHOLD = 40.0
_HYDRATION_THRESHOLD = 50.0


class Recommender:
    """Suggests ingredients and products to improve weak axes."""

    def __init__(
        self,
        knowledge_base: IngredientKnowledgeBase,
        sephora_catalog: SephoraCatalog,
        kaggle_catalog: KaggleCatalog | None = None,
    ):
        self._kb = knowledge_base
        self._catalogs = [sephora_catalog]
        if kaggle_catalog is not None:
            self._catalogs.append(kaggle_catalog)

    def recommend(
        self,
        analysis: SkinAnalysis,
        current_products: list[Product],
        max_products: int = 3,
    ) -> list[Recommendation]:
        target_axes = self._axes_needing_help(analysis)
        current = self._current_ingredient_names(current_products)

        recs: list[Recommendation] = []
        wanted_ingredients: list[str] = []

        # --- ingredient suggestions ---
        for axis in target_axes:
            for ing in self._kb.beneficial_for_axis(axis.value)[:4]:
                if ing.inci_name.lower() in current:
                    continue
                wanted_ingredients.append(ing.inci_name.lower())
                recs.append(
                    Recommendation(
                        kind="ingredient",
                        title=ing.inci_name,
                        reason=f"Targets {self._axis_label(axis)} ({ing.notes or ing.function}).",
                        target_axis=axis.value,
                    )
                )
                if len([r for r in recs if r.kind == "ingredient" and r.target_axis == axis.value]) >= 2:
                    break

        # --- product suggestions (catalogue products rich in wanted ingredients) ---
        for product in self._best_products(wanted_ingredients, current, max_products):
            recs.append(
                Recommendation(
                    kind="product",
                    title=f"{product.brand} {product.name}".strip(),
                    reason="Contains beneficial actives for your weakest axes with a low irritant load.",
                    target_axis=target_axes[0].value if target_axes else "",
                )
            )

        if not target_axes:
            recs.append(
                Recommendation(
                    kind="ingredient",
                    title="Maintain current routine",
                    reason="All four axes look healthy — keep doing what you're doing.",
                )
            )
        return recs

    # ------------------------------------------------------------------ helpers
    def _axes_needing_help(self, analysis: SkinAnalysis) -> list[SkinAxis]:
        scored: list[tuple[float, SkinAxis]] = []
        for axis, score in analysis.axes.items():
            if axis == SkinAxis.HYDRATION:
                if score.value < _HYDRATION_THRESHOLD:
                    scored.append((_HYDRATION_THRESHOLD - score.value, axis))
            elif score.value > _PROBLEM_THRESHOLD:
                scored.append((score.value, axis))
        scored.sort(key=lambda t: t[0], reverse=True)
        return [axis for _, axis in scored]

    def _current_ingredient_names(self, products: list[Product]) -> set[str]:
        names: set[str] = set()
        for p in products:
            for raw in p.raw_ingredients:
                ing = self._kb.match(raw)
                if ing:
                    names.add(ing.inci_name.lower())
        return names

    def _best_products(
        self, wanted: list[str], current: set[str], limit: int
    ) -> list[Product]:
        wanted_set = set(wanted)
        if not wanted_set:
            return []
        scored: list[tuple[float, Product]] = []
        for catalog in self._catalogs:
            for product in catalog.all_products():
                benefit = 0
                penalty = 0.0
                for raw in product.raw_ingredients:
                    ing = self._kb.match(raw)
                    if not ing:
                        continue
                    if ing.inci_name.lower() in wanted_set:
                        benefit += 1
                    penalty += ing.comedogenic_rating * 0.3 + ing.irritant_weight * 0.5
                if benefit:
                    scored.append((benefit - penalty, product))
        scored.sort(key=lambda t: t[0], reverse=True)
        return [p for _, p in scored[:limit]]

    @staticmethod
    def _axis_label(axis: SkinAxis) -> str:
        return {
            SkinAxis.HYPERPIGMENTATION: "hyperpigmentation / dark spots",
            SkinAxis.HYDRATION: "dryness / hydration",
            SkinAxis.ACNE: "acne",
            SkinAxis.REDNESS: "redness",
        }[axis]
