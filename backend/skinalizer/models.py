"""Domain types shared across the engine.

These are plain dataclasses (not Pydantic) so the core engine has no web-layer
dependency. The API layer (``skinalizer.api``) translates them to/from Pydantic
schemas at the boundary. Every dataclass implements ``to_dict`` so it can be
serialised without coupling to a specific framework.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date
from enum import Enum
from typing import Any


class SkinAxis(str, Enum):
    """The four skin-quality spectrums we score.

    We store each as a 0–100 % position on a *spectrum* rather than a single
    grade. Note ``HYDRATION`` is the dryness↔hydration axis: 0 % = very dry,
    100 % = well hydrated. The other three are "amount of problem present":
    0 % = none, 100 % = severe.
    """

    HYPERPIGMENTATION = "hyperpigmentation"
    HYDRATION = "hydration"  # dryness (0%) <-> hydration (100%)
    ACNE = "acne"
    REDNESS = "redness"


@dataclass
class AxisScore:
    """A single spectrum reading with its supporting evidence.

    ``contributions`` maps a human-readable feature name to the value it pushed
    into the score — this is what makes the model explainable on screen.
    """

    axis: SkinAxis
    value: float  # 0–100 position on the spectrum
    label: str  # e.g. "mild redness", "well hydrated"
    contributions: dict[str, float] = field(default_factory=dict)
    explanation: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["axis"] = self.axis.value
        return d


@dataclass
class SkinAnalysis:
    """Full four-axis reading for one photo."""

    axes: dict[SkinAxis, AxisScore]
    source: str = "features"  # "features" or "features+classifier"
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "notes": self.notes,
            "axes": {a.value: s.to_dict() for a, s in self.axes.items()},
        }


@dataclass
class Ingredient:
    """A single INCI ingredient with its curated risk properties."""

    inci_name: str
    comedogenic_rating: float = 0.0  # 0–5, pore-clogging potential
    irritant_weight: float = 0.0  # 0–5, barrier-disruption / irritation potential
    category: str = "other"  # active | humectant | occlusive | surfactant | fragrance | ...
    function: str = ""
    is_active: bool = False  # retinoids, acids, BPO, vitamin C ...
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Product:
    """A skincare product and its (best-effort) ingredient list."""

    name: str
    brand: str = ""
    product_id: str = ""
    barcode: str = ""
    category: str = ""  # cleanser | moisturiser | serum | sunscreen | treatment | ...
    use_time: str = "any"  # am | pm | any
    raw_ingredients: list[str] = field(default_factory=list)
    price: str = ""
    image: str = ""
    source: str = "manual"  # sephora | open_beauty_facts | manual

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class IngredientScore:
    """The three daily ingredient numbers for a set of logged products.

    Deliberately kept as *three separate* values (not one blended score) so each
    can map onto a spectrum axis and earn its own regression coefficient:
        comedogenic_load -> acne axis
        irritant_load    -> redness axis
        active_interaction_flag -> warnings / both axes
    """

    comedogenic_load: float = 0.0
    irritant_load: float = 0.0
    active_interaction_flag: bool = False
    matched_ingredients: list[str] = field(default_factory=list)
    unmatched_ingredients: list[str] = field(default_factory=list)
    detail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class InteractionWarning:
    """A clash between two ingredients found in the logged products."""

    ingredient_a: str
    ingredient_b: str
    problem: str
    severity: str = "moderate"  # low | moderate | high
    recommendation: str = ""
    products_involved: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RoutineStep:
    """One ordered step in the AM or PM routine."""

    order: int
    step_type: str  # cleanser | treatment | moisturiser | sunscreen | ...
    product_name: str
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Recommendation:
    """A suggested product or ingredient to add to the routine."""

    kind: str  # "ingredient" | "product"
    title: str
    reason: str
    target_axis: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DailyEntry:
    """One day's worth of tracked signals — the unit the engine stores.

    Over time these rows become the time series the attribution layer regresses
    on. ``lifestyle`` holds optional exogenous signals (sleep, weather, diet).
    """

    entry_date: date
    photo_path: str = ""
    product_names: list[str] = field(default_factory=list)
    analysis: SkinAnalysis | None = None
    ingredient_score: IngredientScore | None = None
    lifestyle: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "entry_date": self.entry_date.isoformat(),
            "photo_path": self.photo_path,
            "product_names": self.product_names,
            "analysis": self.analysis.to_dict() if self.analysis else None,
            "ingredient_score": (
                self.ingredient_score.to_dict() if self.ingredient_score else None
            ),
            "lifestyle": self.lifestyle,
        }
