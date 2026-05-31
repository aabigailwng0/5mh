"""Product layer: catalogue, Open Beauty Facts client, and lookup resolver."""

from .catalog import SephoraCatalog
from .open_beauty_facts import OpenBeautyFactsClient
from .resolver import ProductResolver

__all__ = ["SephoraCatalog", "OpenBeautyFactsClient", "ProductResolver"]
