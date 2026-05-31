"""Interaction-warning service.

Thin orchestration around the ingredient scorer / interaction table: resolves
the day's products to ingredients, finds clashes, and annotates each warning
with the products that triggered it (so the UI can say *which* two products
clash, not just which ingredients).
"""

from __future__ import annotations

from ..ingredients.knowledge_base import IngredientKnowledgeBase
from ..ingredients.interactions import InteractionTable
from ..models import InteractionWarning, Product


class WarningService:
    """Produces user-facing interaction warnings for a set of products."""

    def __init__(self, knowledge_base: IngredientKnowledgeBase, interactions: InteractionTable):
        self._kb = knowledge_base
        self._interactions = interactions

    def warnings_for(self, products: list[Product]) -> list[InteractionWarning]:
        resolved = []
        # Track which products contain each ingredient for attribution.
        owner: dict[str, set[str]] = {}
        for product in products:
            for raw in product.raw_ingredients:
                ing = self._kb.match(raw)
                if ing is not None:
                    resolved.append(ing)
                    owner.setdefault(ing.inci_name, set()).add(product.name)

        warnings = self._interactions.find_clashes(resolved)
        for w in warnings:
            involved: set[str] = set()
            for name in (w.ingredient_a + ", " + w.ingredient_b).split(", "):
                involved |= owner.get(name.strip(), set())
            w.products_involved = sorted(involved)
        return warnings
