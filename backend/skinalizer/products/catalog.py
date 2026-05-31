"""Sephora reference catalogue loader.

Parses the shipped ``Sephora products.csv`` (1,000 products with INCI lists and
"similar product" recommendations) into :class:`Product` objects. The CSV packs
JSON inside cells and frequently leaves ``name`` empty, so we parse defensively
and fall back to deriving a name from the product URL slug.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

from ..models import Product

# Keyword -> normalised product category, checked against breadcrumbs/name/url.
# Order matters: more specific terms first.
_CATEGORY_KEYWORDS = [
    ("sunscreen", ["spf", "sunscreen", "solaire", "protection solaire"]),
    ("cleanser", ["cleanser", "nettoyant", "gel nettoyant", "face wash", "demaquillant", "cleansing"]),
    ("toner", ["toner", "lotion tonique", "essence", "tonique"]),
    ("exfoliant", ["exfoliant", "peeling", "gommage", "scrub", "exfolian"]),
    ("serum", ["serum", "sérum", "ampoule", "concentre"]),
    ("eye cream", ["eye", "yeux", "contour des yeux"]),
    ("mask", ["mask", "masque"]),
    ("face oil", ["face oil", "huile visage", "huile"]),
    ("moisturiser", ["moisturiser", "moisturizer", "cream", "creme", "crème", "hydratant", "lotion", "baume", "soin"]),
]


class SephoraCatalog:
    """In-memory, searchable view of the Sephora product sample."""

    def __init__(self, csv_path: Path):
        self._products: list[Product] = []
        self._load(csv_path)

    def _load(self, csv_path: Path) -> None:
        # Portability: the catalogue is optional. If the CSV is missing (e.g. a
        # lightweight clone), run with an empty catalogue — Open Beauty Facts
        # lookups and manual entry still work.
        if not Path(csv_path).exists():
            print(
                f"[SephoraCatalog] catalogue not found at {csv_path} — "
                "product search will rely on Open Beauty Facts / manual entry only."
            )
            return
        df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
        for _, row in df.iterrows():
            product = self._row_to_product(row)
            if product is not None:
                self._products.append(product)

    def _row_to_product(self, row: pd.Series) -> Product | None:
        raw_ing = (row.get("ingredients") or "").strip()
        if not raw_ing or raw_ing.lower() in ("null", "none"):
            # No ingredient list = useless for our scoring, skip it.
            return None

        name = (row.get("name") or "").strip()
        if not name:
            name = self._name_from_url(row.get("url", ""))
        brand = self._parse_brand(row.get("brand", ""))
        category = self._infer_category(row)

        return Product(
            name=name,
            brand=brand,
            product_id=(row.get("id") or "").strip(),
            barcode=(row.get("sku") or "").strip(),
            category=category,
            use_time="any",
            raw_ingredients=self._split_ingredients(raw_ing),
            price=self._first_price(row.get("regular_price", "")),
            image=self._first_image(row.get("images", "")),
            source="sephora",
        )

    # ----------------------------------------------------------- field parsers
    @staticmethod
    def _split_ingredients(raw: str) -> list[str]:
        # INCI lists use commas; multilingual synonyms use backslashes
        # ("Water\\Aqua\\Eau"). Split on both, drop empties.
        tokens = re.split(r"[,\\/]", raw)
        return [t.strip() for t in tokens if t.strip()]

    @staticmethod
    def _name_from_url(url: str) -> str:
        m = re.search(r"/p/(.+?)(?:-\d+)?\.html", url)
        if not m:
            return "Unknown product"
        slug = m.group(1).replace("---", " ").replace("-", " ")
        return slug.strip().title()

    @staticmethod
    def _parse_brand(raw: str) -> str:
        try:
            data = json.loads(raw)
            return (data.get("name") or "").strip()
        except (json.JSONDecodeError, AttributeError, TypeError):
            return ""

    @staticmethod
    def _first_image(raw: str) -> str:
        try:
            imgs = json.loads(raw)
            return imgs[0] if isinstance(imgs, list) and imgs else ""
        except (json.JSONDecodeError, IndexError, TypeError):
            return ""

    @staticmethod
    def _first_price(raw: str) -> str:
        return raw.replace('"', "").strip()

    def _infer_category(self, row: pd.Series) -> str:
        haystack = " ".join(
            [
                row.get("breadcrumbs", ""),
                row.get("name", ""),
                row.get("url", ""),
                row.get("tags", ""),
            ]
        ).lower()
        for category, keywords in _CATEGORY_KEYWORDS:
            if any(k in haystack for k in keywords):
                return category
        return "treatment"

    # ------------------------------------------------------------------ search
    def search(self, query: str, limit: int = 10) -> list[Product]:
        """Case-insensitive substring search over name + brand."""
        q = query.lower().strip()
        if not q:
            return []
        scored: list[tuple[int, Product]] = []
        for p in self._products:
            hay = f"{p.brand} {p.name}".lower()
            if q in hay:
                # Prefer matches where the query starts the name.
                rank = 0 if p.name.lower().startswith(q) else 1
                scored.append((rank, p))
        scored.sort(key=lambda t: (t[0], len(t[1].name)))
        return [p for _, p in scored[:limit]]

    def all_products(self) -> list[Product]:
        return list(self._products)

    def __len__(self) -> int:
        return len(self._products)
