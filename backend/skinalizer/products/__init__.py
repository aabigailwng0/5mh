"""Product layer: catalogue, Open Beauty Facts client, and lookup resolver."""

from .catalog import SephoraCatalog
from .kaggle_catalog import KaggleCatalog
from .open_beauty_facts import OpenBeautyFactsClient
from .resolver import ProductResolver

__all__ = ["SephoraCatalog", "KaggleCatalog", "OpenBeautyFactsClient", "ProductResolver"]
