"""Turns logged products into the three daily ingredient numbers.

We keep three *separate* values (not one blended score) on purpose:

    comedogenic_load        sum of comedogenic ratings (0-5) of matched ingredients
    irritant_load           sum of irritant / barrier-disruptor weights
    active_interaction_flag True if a same-day active clash exists

This separation maps cleanly onto the spectrum (comedogenic -> acne,
irritant -> redness) and lets each earn its own regression coefficient later.
"""

from __future__ import annotations

from ..models import Ingredient, IngredientScore, Product
from .interactions import InteractionTable
from .knowledge_base import IngredientKnowledgeBase


class IngredientScorer:
    """Computes :class:`IngredientScore` from a day's products."""

    def __init__(
        self,
        knowledge_base: IngredientKnowledgeBase,
        interactions: InteractionTable,
    ):
        self._kb = knowledge_base
        self._interactions = interactions

    def resolve(self, products: list[Product]) -> list[Ingredient]:
        """Flatten products' raw INCI strings into matched Ingredient objects."""
        resolved: list[Ingredient] = []
        for product in products:
            for raw in product.raw_ingredients:
                ing = self._kb.match(raw)
                if ing is not None:
                    resolved.append(ing)
        return resolved

    def score(self, products: list[Product]) -> IngredientScore:
        """Compute the three daily numbers for a set of products."""
        comedogenic = 0.0
        irritant = 0.0
        matched: list[str] = []
        unmatched: list[str] = []
        per_ingredient: list[dict] = []
        resolved: list[Ingredient] = []

        for product in products:
            for raw in product.raw_ingredients:
                ing = self._kb.match(raw)
                if ing is None:
                    unmatched.append(raw.strip())
                    continue
                resolved.append(ing)
                matched.append(ing.inci_name)
                comedogenic += ing.comedogenic_rating
                irritant += ing.irritant_weight
                if ing.comedogenic_rating or ing.irritant_weight:
                    per_ingredient.append(
                        {
                            "ingredient": ing.inci_name,
                            "comedogenic": ing.comedogenic_rating,
                            "irritant": ing.irritant_weight,
                            "product": product.name,
                        }
                    )

        clashes = self._interactions.find_clashes(resolved)

        return IngredientScore(
            comedogenic_load=round(comedogenic, 2),
            irritant_load=round(irritant, 2),
            active_interaction_flag=bool(clashes),
            matched_ingredients=sorted(set(matched)),
            unmatched_ingredients=sorted(set(unmatched)),
            detail={
                "per_ingredient": per_ingredient,
                "n_clashes": len(clashes),
            },
        )

    def find_clashes(self, products: list[Product]):
        """Convenience pass-through used by the warnings layer."""
        return self._interactions.find_clashes(self.resolve(products))
