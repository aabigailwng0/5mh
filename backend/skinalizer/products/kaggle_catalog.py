"""Kaggle skincare products catalogue loader.

Parses the ``skincare_products_clean.csv`` from the Kaggle Skincare Products
Clean Dataset (https://www.kaggle.com/datasets/eward96/skincare-products-clean-dataset)
into :class:`Product` objects. The CSV contains over 1000 cleaned skincare products
with standardized ingredient lists (water removed, duplicates normalized).
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pandas as pd

from ..models import Product

# Keyword -> normalised product category, checked against product type field.
# Order matters: more specific terms first.
_CATEGORY_KEYWORDS = [
    ("sunscreen", ["sunscreen", "spf", "sun", "protection"]),
    ("cleanser", ["cleanser", "cleansingwash", "facewash", "face wash", "cleansing"]),
    ("toner", ["toner", "essence", "lotion"]),
    ("exfoliant", ["exfoliant", "peeling", "scrub"]),
    ("serum", ["serum"]),
    ("eye cream", ["eye", "contour"]),
    ("mask", ["mask", "masque"]),
    ("face oil", ["oil"]),
    ("moisturiser", ["moisturiser", "moisturizer", "cream", "hydrating", "treatment"]),
]


class KaggleCatalog:
    """In-memory, searchable view of the Kaggle skincare products sample."""

    def __init__(self, csv_path: Path):
        self._products: list[Product] = []
        self._load(csv_path)

    def _load(self, csv_path: Path) -> None:
        # The Kaggle CSV is optional. If missing, continue with just Sephora data.
        if not Path(csv_path).exists():
            print(
                f"[KaggleCatalog] catalogue not found at {csv_path} — "
                "product search will rely on Sephora and Open Beauty Facts only."
            )
            return
        try:
            df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
        except Exception as e:
            print(f"[KaggleCatalog] failed to load {csv_path}: {e}")
            return

        for idx, row in df.iterrows():
            product = self._row_to_product(row, idx)
            if product is not None:
                self._products.append(product)

    def _row_to_product(self, row: pd.Series, idx: int) -> Product | None:
        raw_ing = (row.get("clean_ingreds") or row.get("ingredients") or "").strip()
        if not raw_ing or raw_ing.lower() in ("null", "none", ""):
            # No ingredient list = useless for our scoring, skip it.
            return None

        name = (row.get("product_name") or row.get("Product_name") or "").strip()
        if not name:
            # Fallback: derive from URL if available
            url = (row.get("product_url") or row.get("Product_url") or "").strip()
            name = self._name_from_url(url)
        if not name:
            return None

        product_type = (row.get("product_type") or row.get("Product_type") or "").strip()
        category = self._infer_category(product_type)
        price = (row.get("price") or row.get("Price") or "").strip()

        return Product(
            name=name,
            brand="",  # Kaggle dataset doesn't include brand info
            product_id=f"kaggle_{idx}",
            barcode="",  # No barcode in Kaggle dataset
            category=category,
            use_time="any",
            raw_ingredients=self._split_ingredients(raw_ing),
            price=price,
            image="",  # No image URLs in Kaggle dataset
            source="kaggle",
        )

    # ----------------------------------------------------------- field parsers
    @staticmethod
    def _split_ingredients(raw: str) -> list[str]:
        # Kaggle data stores ingredients as Python list string format: "['ing1', 'ing2']"
        # Try to parse as Python list first; fall back to comma-split if that fails
        try:
            parsed = ast.literal_eval(raw)
            if isinstance(parsed, list):
                return [str(ing).strip() for ing in parsed if ing]
        except (ValueError, SyntaxError):
            pass
        # Fallback: split on commas
        tokens = [t.strip() for t in raw.split(",") if t.strip()]
        return tokens

    @staticmethod
    def _name_from_url(url: str) -> str:
        """Extract product name from URL if available."""
        if not url:
            return ""
        # Try to extract from URL path
        m = re.search(r"/([^/]+)/?$", url)
        if m:
            slug = m.group(1).replace("-", " ").replace("_", " ")
            return slug.strip().title()
        return ""

    def _infer_category(self, product_type: str) -> str:
        """Infer category from the product_type field."""
        haystack = product_type.lower() if product_type else ""
        for category, keywords in _CATEGORY_KEYWORDS:
            if any(k in haystack for k in keywords):
                return category
        return "treatment"

    # ------------------------------------------------------------------ search
    def search(self, query: str, limit: int = 10) -> list[Product]:
        """Case-insensitive substring search over name."""
        q = query.lower().strip()
        if not q:
            return []
        scored: list[tuple[int, Product]] = []
        for p in self._products:
            hay = p.name.lower()
            if q in hay:
                # Prefer matches where the query starts the name.
                rank = 0 if hay.startswith(q) else 1
                scored.append((rank, p))
        scored.sort(key=lambda t: (t[0], len(t[1].name)))
        return [p for _, p in scored[:limit]]

    def all_products(self) -> list[Product]:
        """Return all products in the catalog."""
        return list(self._products)

    def __len__(self) -> int:
        return len(self._products)
