"""Unified product lookup across all sources.

Resolution order is chosen for hackathon reliability: the local Sephora sample
(instant, always available) first, then Open Beauty Facts (broad, networked),
then a manual fallback so the user can always type an ingredient list by hand.
"""

from __future__ import annotations

import re

from ..models import Product
from .catalog import SephoraCatalog
from .open_beauty_facts import OpenBeautyFactsClient


class ProductResolver:
    """Resolves a barcode / name / manual entry into a :class:`Product`."""

    def __init__(self, catalog: SephoraCatalog, obf: OpenBeautyFactsClient):
        self._catalog = catalog
        self._obf = obf

    def search(self, query: str, limit: int = 10) -> list[Product]:
        """Search the local catalogue first, then top up from OBF."""
        results = self._catalog.search(query, limit=limit)
        if len(results) < limit:
            seen = {p.name.lower() for p in results}
            for p in self._obf.search_by_name(query, limit=limit - len(results)):
                if p.name.lower() not in seen:
                    results.append(p)
        return results

    def by_barcode(self, barcode: str) -> Product | None:
        """Barcode lookup: OBF (real barcodes), then Sephora SKU match."""
        barcode = (barcode or "").strip()
        if not barcode:
            return None
        product = self._obf.lookup_barcode(barcode)
        if product is not None:
            return product
        digits = re.sub(r"\D", "", barcode)
        for p in self._catalog.all_products():
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
