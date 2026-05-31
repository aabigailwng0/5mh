"""FastAPI application exposing the Skinalizer engine.

Endpoints:
    GET  /api/health                  liveness + capability report
    GET  /api/products/search?q=      product autocomplete
    POST /api/products/barcode        barcode lookup
    POST /api/analyze                 photo + products -> full analysis bundle
    POST /api/log                     persist a day (photo optional) + analysis
    GET  /api/attribution?axis=       driver decomposition (stretch)
    GET  /api/history                 raw daily-entry history

The web layer is intentionally thin: it parses inputs, calls the engine, and
returns the engine's dicts unchanged.
"""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ..config import EngineConfig
from ..engine import SkinalizerEngine
from .schemas import BarcodeRequest, ProductRef


def _build_engine() -> SkinalizerEngine:
    """Construct the singleton engine, honouring optional env configuration."""
    config = EngineConfig()
    # Optionally plug in dermafyr's pretrained Keras model if the path exists.
    model_env = os.environ.get("SKINALIZER_KERAS_MODEL")
    if model_env and Path(model_env).exists():
        config.keras_model_path = Path(model_env)
    return SkinalizerEngine(config)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Skinalizer Engine",
        version="0.1.0",
        description="Transparent skincare analysis: spectrum scoring + attribution.",
    )
    # Allow the Vite dev server (and any local origin during the hackathon).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    engine = _build_engine()

    # ---------------------------------------------------------------- meta
    @app.get("/api/health")
    def health() -> dict:
        classifier = engine.skin_scorer._classifier  # noqa: SLF001
        vision = engine.vision_scorer
        return {
            "status": "ok",
            "catalog_products": len(engine.catalog),
            "kaggle_products": len(engine.kaggle_catalog),
            "ingredients_known": len(engine.knowledge_base.all_ingredients()),
            "classifier_backend": bool(classifier and classifier.available),
            "llm_scorer": (f"{vision.provider}:{vision.model}" if vision else None),
            "entries_logged": engine.log_store.count(),
        }

    # ---------------------------------------------------------------- products
    @app.get("/api/products/search")
    def search_products(q: str = Query(..., min_length=1), limit: int = 10) -> dict:
        products = engine.search_products(q, limit=limit)
        return {"results": [p.to_dict() for p in products]}

    @app.post("/api/products/barcode")
    def barcode(req: BarcodeRequest) -> dict:
        product = engine.resolver.by_barcode(req.barcode)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        return product.to_dict()

    # ---------------------------------------------------------------- analyse
    @app.post("/api/analyze")
    async def analyze(
        image: UploadFile = File(...),
        products: str = Form("[]"),
    ) -> dict:
        refs = _parse_product_refs(products)
        resolved = engine.resolve_products(refs)
        image_bytes = await image.read()
        try:
            return engine.analyze(image_bytes, resolved)
        except Exception as exc:  # surface decode/scoring errors as 400
            raise HTTPException(status_code=400, detail=f"Analysis failed: {exc}") from exc

    # ---------------------------------------------------------------- log day
    @app.post("/api/log")
    async def log_day(
        entry_date: str = Form(""),
        products: str = Form("[]"),
        lifestyle: str = Form("{}"),
        image: UploadFile | None = File(None),
    ) -> dict:
        refs = _parse_product_refs(products)
        resolved = engine.resolve_products(refs)
        try:
            lifestyle_data = json.loads(lifestyle or "{}")
        except json.JSONDecodeError:
            lifestyle_data = {}
        day = date.fromisoformat(entry_date) if entry_date else date.today()
        image_bytes = await image.read() if image is not None else None
        return engine.log_day(day, image_bytes, resolved, lifestyle_data)

    # ---------------------------------------------------------------- attribution
    @app.get("/api/attribution")
    def attribution(axis: str = "acne", level: str = "aggregate") -> dict:
        if level not in ("aggregate", "ingredient"):
            level = "aggregate"
        return engine.attribution(axis, level=level)

    @app.get("/api/history")
    def history() -> dict:
        return {"entries": engine.history()}

    return app


def _parse_product_refs(raw: str) -> list[dict]:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    # Validate each entry through the schema, dropping malformed ones.
    refs: list[dict] = []
    for item in data:
        try:
            refs.append(ProductRef(**item).model_dump())
        except (TypeError, ValueError):
            continue
    return refs


# Module-level app for `uvicorn skinalizer.api.app:app`.
app = create_app()
