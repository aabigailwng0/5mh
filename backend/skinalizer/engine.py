"""SkinalizerEngine — the public façade that wires every component together.

This is the single object the API (or a notebook, or a test) talks to. It owns
the knowledge bases, the scorer, the product resolver, the recommender and the
attribution model, and exposes a small task-oriented API:

    engine.search_products(query)         -> product autocomplete
    engine.resolve_products(refs)         -> turn refs into Product objects
    engine.analyze(image_bytes, products) -> full daily analysis bundle
    engine.log_day(...)                   -> persist a day and return its analysis
    engine.attribution(axis)              -> driver decomposition (stretch)

Keeping all orchestration here means the web layer stays a thin translation
shell and the engine can be reused head-less.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from .attribution import AttributionEngine
from .config import EngineConfig
from .ingredients import IngredientKnowledgeBase, IngredientScorer, InteractionTable
from .models import Product, SkinAxis
from .products import KaggleCatalog, OpenBeautyFactsClient, ProductResolver, SephoraCatalog
from .recommendations import Recommender, ScheduleBuilder, WarningService
from .scoring import FeatureExtractor, KerasClassifierBackend, SkinScorer
from .storage import DailyLogStore


class SkinalizerEngine:
    """Top-level orchestrator for skin analysis, products and attribution."""

    def __init__(self, config: EngineConfig | None = None):
        self.config = config or EngineConfig()
        self.config.ensure_dirs()

        # --- ingredient intelligence ---
        self.knowledge_base = IngredientKnowledgeBase(self.config.ingredient_properties_csv)
        self.interactions = InteractionTable(self.config.ingredient_interactions_csv)
        self.ingredient_scorer = IngredientScorer(self.knowledge_base, self.interactions)

        # --- products ---
        self.catalog = SephoraCatalog(self.config.sephora_csv)
        self.kaggle_catalog = KaggleCatalog(self.config.kaggle_csv)
        self.obf = OpenBeautyFactsClient(
            self.config.storage_dir / "obf_cache",
            enabled=self.config.enable_open_beauty_facts,
            timeout=self.config.obf_timeout_seconds,
        )
        self.resolver = ProductResolver(self.catalog, self.obf, self.kaggle_catalog)

        # --- skin scoring ---
        self.feature_extractor = FeatureExtractor()
        classifier = None
        if self.config.keras_model_path is not None:
            classifier = KerasClassifierBackend(self.config.keras_model_path)
        self.skin_scorer = SkinScorer(classifier, self.config.classifier_blend_weight)

        # --- recommendations ---
        self.schedule_builder = ScheduleBuilder(self.config.routine_rules_json, self.knowledge_base)
        self.warning_service = WarningService(self.knowledge_base, self.interactions)
        self.recommender = Recommender(self.knowledge_base, self.catalog, self.kaggle_catalog)

        # --- attribution + storage ---
        self.attribution_engine = AttributionEngine(
            min_entries=self.config.min_entries_for_attribution,
            max_lag=self.config.max_lag_days,
        )
        self.log_store = DailyLogStore(self.config.storage_dir)

    # ----------------------------------------------------------------- products
    def search_products(self, query: str, limit: int = 10) -> list[Product]:
        return self.resolver.search(query, limit=limit)

    def resolve_products(self, references: list[dict]) -> list[Product]:
        """Turn lightweight product references from the client into Products.

        Each reference is a dict with one of:
          {"barcode": "..."} | {"name": "...", "ingredients": "..."} | {"name": "..."}
        """
        products: list[Product] = []
        for ref in references:
            if ref.get("barcode"):
                product = self.resolver.by_barcode(ref["barcode"])
                if product:
                    products.append(product)
                    continue
            if ref.get("ingredients"):
                products.append(
                    self.resolver.from_manual(
                        ref.get("name", ""),
                        ref["ingredients"],
                        ref.get("category", "treatment"),
                    )
                )
                continue
            if ref.get("name"):
                hits = self.resolver.search(ref["name"], limit=1)
                if hits:
                    products.append(hits[0])
        return products

    # ------------------------------------------------------------------ analyse
    def analyze(self, image_bytes: bytes, products: list[Product]) -> dict[str, Any]:
        """Run the full daily pipeline for one photo + product set."""
        bgr = self.feature_extractor.decode(image_bytes)
        features = self.feature_extractor.extract(bgr)

        # Let the optional CNN see the same frame before scoring.
        classifier = self.skin_scorer._classifier  # noqa: SLF001 (internal handoff)
        if classifier is not None and classifier.available:
            classifier.prepare(bgr)

        analysis = self.skin_scorer.score(features)
        ingredient_score = self.ingredient_scorer.score(products)
        benefit_by_axis = self._benefit_by_axis(products)
        analysis = self.skin_scorer.factor_in_products(analysis, ingredient_score, benefit_by_axis)

        warnings = self.warning_service.warnings_for(products)
        schedule = self.schedule_builder.build(products)
        recommendations = self.recommender.recommend(analysis, products)

        return {
            "analysis": analysis.to_dict(),
            "features": features.to_dict(),
            "ingredient_score": ingredient_score.to_dict(),
            "warnings": [w.to_dict() for w in warnings],
            "schedule": schedule,
            "recommendations": [r.to_dict() for r in recommendations],
            "products": [p.to_dict() for p in products],
        }

    def _benefit_by_axis(self, products: list[Product]) -> dict[str, float]:
        """Sum curated beneficial strengths per axis across unique ingredients."""
        totals: dict[str, float] = {}
        seen: set[str] = set()
        for product in products:
            for raw in product.raw_ingredients:
                ing = self.knowledge_base.match(raw)
                if not ing or ing.inci_name in seen:
                    continue
                seen.add(ing.inci_name)
                axis, strength = self.knowledge_base.benefit_for(ing)
                if axis:
                    totals[axis] = totals.get(axis, 0.0) + strength
        return totals

    # ------------------------------------------------------------------ logging
    def log_day(
        self,
        entry_date: date,
        image_bytes: bytes | None,
        products: list[Product],
        lifestyle: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Analyse (if a photo is given) and persist one day's entry."""
        result: dict[str, Any] = {}

        if image_bytes:
            result = self.analyze(image_bytes, products)
            ingredient_score = result["ingredient_score"]
        else:
            ingredient_score = self.ingredient_scorer.score(products).to_dict()

        entry = {
            "entry_date": entry_date.isoformat(),
            "photo_path": "",
            "product_names": [p.name for p in products],
            "analysis": result.get("analysis"),
            "ingredient_score": ingredient_score,
            "lifestyle": lifestyle or {},
        }
        self.log_store.upsert(entry)
        result["entry_saved"] = True
        result["entries_total"] = self.log_store.count()
        if not image_bytes:
            result["ingredient_score"] = ingredient_score
        return result

    # -------------------------------------------------------------- attribution
    def attribution(self, axis: str | None = None) -> dict[str, Any]:
        """Run distributed-lag attribution for one axis (default: acne)."""
        axis = axis or SkinAxis.ACNE.value
        df = self.log_store.to_dataframe()
        return self.attribution_engine.analyze(df, axis)

    def history(self) -> list[dict]:
        return self.log_store.all_entries()
