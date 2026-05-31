"""Unified product lookup across all sources.

Resolution order is chosen for hackathon reliability: local catalogues (instant,
always available) first, then Open Beauty Facts (broad, networked), then a manual
fallback so the user can always type an ingredient list by hand.
"""

from __future__ import annotations

import re

from ..models import Product
from .catalog import SephoraCatalog
from .kaggle_catalog import KaggleCatalog
from .open_beauty_facts import OpenBeautyFactsClient


class ProductResolver:
    """Resolves a barcode / name / manual entry into a :class:`Product`."""

    def __init__(
        self,
        sephora_catalog: SephoraCatalog,
        obf: OpenBeautyFactsClient,
        kaggle_catalog: KaggleCatalog | None = None,
    ):
        self._catalogs = [sephora_catalog]
        if kaggle_catalog is not None:
            self._catalogs.append(kaggle_catalog)
        self._obf = obf

    def search(self, query: str, limit: int = 10) -> list[Product]:
        """Search all local catalogues first, then top up from OBF."""
        results: list[Product] = []
        seen = set()

        # Search all local catalogues
        for catalog in self._catalogs:
            for p in catalog.search(query, limit=limit - len(results)):
                if p.name.lower() not in seen:
                    results.append(p)
                    seen.add(p.name.lower())
                if len(results) >= limit:
                    break
            if len(results) >= limit:
                break

        # Top up from OBF if needed
        if len(results) < limit:
            for p in self._obf.search_by_name(query, limit=limit - len(results)):
                if p.name.lower() not in seen:
                    results.append(p)
                    seen.add(p.name.lower())

        return results

    def by_barcode(self, barcode: str) -> Product | None:
        """Barcode lookup: OBF (real barcodes), then local catalogues SKU match."""
        barcode = (barcode or "").strip()
        if not barcode:
            return None
        product = self._obf.lookup_barcode(barcode)
        if product is not None:
            return product
        digits = re.sub(r"\D", "", barcode)
        for catalog in self._catalogs:
            for p in catalog.all_products():
                if p.barcode and re.sub(r"\D", "", p.barcode) == digits:
                    return p
        return None

    @staticmethod
    def from_manual(name: str, ingredients_text: str, category: str = "treatment") -> Product:
        """Build a product directly from a typed ingredient list."""
        tokens = [t.strip() for t in re.split(r"[,\\/\n]", ingredients_text) if t.strip()]
        return Product(
            name=name.strip() or "Manual entry",
            category=category,
            raw_ingredients=tokens,
            source="manual",
        )
