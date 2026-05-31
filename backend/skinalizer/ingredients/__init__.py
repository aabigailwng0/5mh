"""Ingredient intelligence: knowledge base, interactions, and daily scoring."""

from .knowledge_base import IngredientKnowledgeBase
from .interactions import InteractionTable
from .scorer import IngredientScorer

__all__ = ["IngredientKnowledgeBase", "InteractionTable", "IngredientScorer"]
