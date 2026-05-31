"""Central configuration and filesystem paths.

Keeping every tunable path / knob in one place means the rest of the codebase
never hard-codes a location, which keeps the engine portable and testable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Repository layout (everything the engine needs ships *inside the package*, so
# it works after a plain clone without the large startingplace-datasets folder):
#   <repo>/backend/skinalizer/config.py   <- this file
#   <repo>/backend/skinalizer/data/       <- seeded KBs + bundled Sephora catalogue
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
PACKAGE_DIR = Path(__file__).resolve().parent
DATA_DIR = PACKAGE_DIR / "data"


def _path_env(var: str, default: Path) -> Path:
    """Resolve a path from an env var, falling back to a bundled default."""
    value = os.environ.get(var)
    return Path(value).expanduser() if value else default


# The Sephora catalogue is bundled in the package (≈8 MB) so product search
# works out of the box. Override with SKINALIZER_SEPHORA_CSV to point elsewhere.
SEPHORA_CSV = _path_env("SKINALIZER_SEPHORA_CSV", DATA_DIR / "sephora_products.csv")

# The Kaggle skincare products dataset (optional). Download from:
# https://www.kaggle.com/datasets/eward96/skincare-products-clean-dataset
# and rename the file to skincare_products_clean.csv, then place it in DATA_DIR.
KAGGLE_CSV = _path_env("SKINALIZER_KAGGLE_CSV", DATA_DIR / "skincare_products_clean.csv")

# Seeded knowledge bases (curated, version-controlled, always present).
INGREDIENT_PROPERTIES_CSV = DATA_DIR / "ingredient_properties.csv"
INGREDIENT_INTERACTIONS_CSV = DATA_DIR / "ingredient_interactions.csv"
ROUTINE_RULES_JSON = DATA_DIR / "routine_rules.json"

# Runtime storage (daily entries, OBF cache). Kept out of the package dir so it
# can be pointed at a volume in deployment via SKINALIZER_STORAGE.
STORAGE_DIR = _path_env("SKINALIZER_STORAGE", BACKEND_DIR / "storage_data")


@dataclass
class EngineConfig:
    """Tunable knobs for a :class:`~skinalizer.engine.SkinalizerEngine` instance.

    Everything here is a deliberate, inspectable default — there are no magic
    numbers buried in the algorithms.
    """

    # --- Data sources ---
    sephora_csv: Path = SEPHORA_CSV
    kaggle_csv: Path = KAGGLE_CSV
    ingredient_properties_csv: Path = INGREDIENT_PROPERTIES_CSV
    ingredient_interactions_csv: Path = INGREDIENT_INTERACTIONS_CSV
    routine_rules_json: Path = ROUTINE_RULES_JSON
    storage_dir: Path = STORAGE_DIR

    # --- Open Beauty Facts client ---
    # Set SKINALIZER_OFFLINE=1 to disable all network calls (fully offline demo).
    enable_open_beauty_facts: bool = field(
        default_factory=lambda: os.environ.get("SKINALIZER_OFFLINE", "") not in ("1", "true", "True")
    )
    obf_timeout_seconds: float = 6.0

    # --- Optional pretrained CNN backend ---
    # Path to dermafyr's shipped Keras model. Left unset by default: the engine
    # is fully functional on explainable features alone.
    keras_model_path: Path | None = None
    # How much weight the CNN's acne probability gets when blended with the
    # transparent feature score (0 = ignore CNN, 1 = trust CNN fully).
    classifier_blend_weight: float = 0.45

    # --- Attribution (stretch) ---
    # Minimum number of daily entries before we attempt regression attribution.
    min_entries_for_attribution: int = 10
    max_lag_days: int = 3

    def ensure_dirs(self) -> None:
        """Create runtime directories if they don't exist yet."""
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        (self.storage_dir / "obf_cache").mkdir(parents=True, exist_ok=True)
        (self.storage_dir / "uploads").mkdir(parents=True, exist_ok=True)
