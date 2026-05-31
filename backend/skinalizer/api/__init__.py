"""HTTP API layer (FastAPI). Thin translation shell over the engine."""

from .app import create_app, app

__all__ = ["create_app", "app"]
