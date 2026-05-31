"""Open Beauty Facts API client (barcode / name lookup).

Open Beauty Facts is a free, open product database. We use it for barcode and
name lookups that the local Sephora sample can't satisfy. Responses are cached
to disk so repeated lookups (and offline demos) are instant, and every network
call degrades gracefully to ``None`` rather than throwing.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import requests

from ..models import Product

_BARCODE_URL = "https://world.openbeautyfacts.org/api/v2/product/{barcode}.json"
_SEARCH_URL = "https://world.openbeautyfacts.org/cgi/search.pl"
_HEADERS = {"User-Agent": "Skinalizer/0.1 (hackathon skincare engine)"}

# Skincare-only category keywords (blocks makeup, fragrance, etc.)
_SKINCARE_KEYWORDS = [
    "sunscreen", "spf", "cleanser", "toner", "essence", "exfoliant", "peeling",
    "serum", "ampoule", "eye cream", "eye care", "mask", "face oil", "moisturizer",
    "moisturiser", "cream", "lotion", "hydrating", "treatment", "care", "skincare"
]
_NONSKINCARE_KEYWORDS = [
    "makeup", "lipstick", "foundation", "concealer", "mascara", "eyeshadow", "blush",
    "bronzer", "highlighter", "primer", "bb cream", "cc cream", "fragrance", "perfume",
    "cologne", "bath", "shower", "soap", "hair care", "shampoo", "conditioner",
    "nail", "tools", "accessories"
]


class OpenBeautyFactsClient:
    """Thin, cached wrapper around the Open Beauty Facts REST API."""

    def __init__(self, cache_dir: Path, enabled: bool = True, timeout: float = 6.0):
        self._cache_dir = cache_dir
        self._enabled = enabled
        self._timeout = timeout
        cache_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------------- public API
    def lookup_barcode(self, barcode: str) -> Product | None:
        """Fetch a product by barcode, or ``None`` if not found / offline."""
        barcode = re.sub(r"\D", "", barcode or "")
        if not barcode:
            return None

        cached = self._read_cache(f"barcode_{barcode}")
        if cached is not None:
            return self._parse_product(cached, barcode)

        if not self._enabled:
            return None
        try:
            resp = requests.get(
                _BARCODE_URL.format(barcode=barcode),
                headers=_HEADERS,
                timeout=self._timeout,
            )
            resp.raise_for_status()
            payload = resp.json()
        except (requests.RequestException, ValueError):
            return None

        if payload.get("status") != 1:
            return None
        self._write_cache(f"barcode_{barcode}", payload)
        return self._parse_product(payload, barcode)

    def search_by_name(self, name: str, limit: int = 5) -> list[Product]:
        """Search OBF by product name. Returns up to ``limit`` products."""
        if not self._enabled or not name.strip():
            return []
        try:
            resp = requests.get(
                _SEARCH_URL,
                headers=_HEADERS,
                params={
                    "search_terms": name,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": limit,
                },
                timeout=self._timeout,
            )
            resp.raise_for_status()
            payload = resp.json()
        except (requests.RequestException, ValueError):
            return []

        out: list[Product] = []
        for prod in payload.get("products", [])[:limit]:
            parsed = self._parse_product({"product": prod}, prod.get("code", ""))
            if parsed is not None:
                out.append(parsed)
        return out

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _is_skincare_product(prod: dict) -> bool:
        """Check if a product is skincare-focused (not makeup/fragrance/hair)."""
        # Check categories and name for non-skincare keywords
        categories = (prod.get("categories") or "").lower()
        name = (prod.get("product_name") or "").lower()
        combined = f"{categories} {name}"
        
        # Reject if any non-skincare keyword is present
        for keyword in _NONSKINCARE_KEYWORDS:
            if keyword in combined:
                return False
        
        # Accept if any skincare keyword is present
        for keyword in _SKINCARE_KEYWORDS:
            if keyword in combined:
                return True
        
        # Default: accept if has ingredient list (likely a skincare product)
        ingredients = prod.get("ingredients") or prod.get("ingredients_text") or ""
        return bool(ingredients)

    def _parse_product(self, payload: dict, barcode: str) -> Product | None:
        prod = payload.get("product", {})
        if not self._is_skincare_product(prod):
            return None
        ingredients = self._extract_ingredients(prod)
        if not ingredients:
            return None
        name = (
            prod.get("product_name")
            or prod.get("generic_name")
            or "Unknown product"
        ).strip()
        return Product(
            name=name,
            brand=(prod.get("brands") or "").split(",")[0].strip(),
            product_id=barcode,
            barcode=barcode,
            category=(prod.get("categories") or "").split(",")[-1].strip().lower(),
            raw_ingredients=ingredients,
            image=prod.get("image_front_url", ""),
            source="open_beauty_facts",
        )

    @staticmethod
    def _extract_ingredients(prod: dict) -> list[str]:
        # Prefer the structured list; fall back to the raw text field.
        structured = prod.get("ingredients")
        if isinstance(structured, list) and structured:
            names = [i.get("text", "").strip() for i in structured if i.get("text")]
            if names:
                return names
        text = prod.get("ingredients_text") or prod.get("ingredients_text_en") or ""
        return [t.strip() for t in re.split(r"[,\\/]", text) if t.strip()]

    def _cache_path(self, key: str) -> Path:
        safe = re.sub(r"[^a-zA-Z0-9_]", "_", key)
        return self._cache_dir / f"{safe}.json"

    def _read_cache(self, key: str) -> dict | None:
        path = self._cache_path(key)
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return None
        return None

    def _write_cache(self, key: str, payload: dict) -> None:
        try:
            self._cache_path(key).write_text(json.dumps(payload), encoding="utf-8")
        except OSError:
            pass
