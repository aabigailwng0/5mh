"""Pydantic request schemas for the JSON endpoints.

Responses are plain dicts produced by the engine's dataclasses (each has a
``to_dict``), so we only need to validate *inputs* here.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProductRef(BaseModel):
    """A lightweight client-side reference to a product.

    Provide whichever the user gave us; the resolver figures out the rest:
      * ``barcode``                 -> Open Beauty Facts / Sephora SKU lookup
      * ``name`` + ``ingredients``  -> manual entry
      * ``name`` only               -> catalogue search (best match)
    """

    name: str = ""
    barcode: str = ""
    ingredients: str = ""
    category: str = "treatment"


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = 10


class BarcodeRequest(BaseModel):
    barcode: str = Field(..., min_length=1)
