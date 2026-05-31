"""Transparent feature -> spectrum scorer.

Every axis score is a documented linear combination of normalised features.
The coefficients live in :data:`SkinScorer.RANGES` / :data:`SkinScorer.WEIGHTS`
as named constants so they can be shown to the user and tuned without touching
the algorithm. This is the deliberate "coefficients are the product" design.
"""

from __future__ import annotations

from ..models import AxisScore, IngredientScore, SkinAnalysis, SkinAxis
from .classifier_backend import ClassifierBackend
from .features import SkinFeatures


def _norm(value: float, low: float, high: float) -> float:
    """Clamp ``value`` to a documented [low, high] range, return 0..1."""
    if high <= low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


class SkinScorer:
    """Maps :class:`SkinFeatures` to a four-axis :class:`SkinAnalysis`."""

    # Documented normalisation ranges: (low -> 0%, high -> 100%) for each feature.
    RANGES = {
        "redness_a": (8.0, 30.0),
        "redness_ratio": (0.02, 0.18),
        "tone_unevenness": (6.0, 26.0),
        "dark_spot_fraction": (0.02, 0.20),
        "texture_energy": (80.0, 1200.0),
        "specular_fraction": (0.0, 0.06),
        "spot_density": (2.0, 40.0),
    }

    # Per-axis feature weights (sum to 1.0 within each axis).
    WEIGHTS = {
        SkinAxis.REDNESS: {"redness_a": 0.6, "redness_ratio": 0.4},
        SkinAxis.HYPERPIGMENTATION: {"tone_unevenness": 0.6, "dark_spot_fraction": 0.4},
        SkinAxis.ACNE: {"spot_density": 0.75, "redness_a": 0.25},
        # Hydration is special: built from *dryness* (inverted texture) + glow.
        SkinAxis.HYDRATION: {"texture_energy": 0.6, "specular_fraction": 0.4},
    }

    def __init__(self, classifier: ClassifierBackend | None = None, blend_weight: float = 0.45):
        self._classifier = classifier
        self._blend_weight = blend_weight

    def score(self, features: SkinFeatures) -> SkinAnalysis:
        """Produce the four bare-skin spectrum readings (before products)."""
        axes = {
            SkinAxis.REDNESS: self._score_redness(features),
            SkinAxis.HYPERPIGMENTATION: self._score_pigmentation(features),
            SkinAxis.ACNE: self._score_acne(features),
            SkinAxis.HYDRATION: self._score_hydration(features),
        }
        source = "features"
        notes: list[str] = []

        # Optionally refine the acne axis with the pretrained CNN backend.
        if self._classifier is not None and self._classifier.available:
            cnn_acne = self._classifier.acne_probability()
            if cnn_acne is not None:
                blended = (
                    (1 - self._blend_weight) * axes[SkinAxis.ACNE].value
                    + self._blend_weight * cnn_acne * 100.0
                )
                axes[SkinAxis.ACNE].contributions["cnn_acne_prob"] = round(cnn_acne * 100, 1)
                axes[SkinAxis.ACNE].value = round(blended, 1)
                axes[SkinAxis.ACNE].label = self._label_problem(blended)
                source = "features+classifier"

        if features.skin_pixel_fraction < 0.15:
            notes.append(
                "Low skin coverage detected — make sure the face fills the frame "
                "in good lighting for the most reliable reading."
            )

        return SkinAnalysis(axes=axes, source=source, notes=notes)

    # ------------------------------------------------------------- axis scorers
    def _score_redness(self, f: SkinFeatures) -> AxisScore:
        c_a = _norm(f.redness_a, *self.RANGES["redness_a"]) * self.WEIGHTS[SkinAxis.REDNESS]["redness_a"]
        c_r = _norm(f.redness_ratio, *self.RANGES["redness_ratio"]) * self.WEIGHTS[SkinAxis.REDNESS]["redness_ratio"]
        value = round((c_a + c_r) * 100, 1)
        return AxisScore(
            axis=SkinAxis.REDNESS,
            value=value,
            label=self._label_problem(value),
            contributions={
                "redness_a* (skin)": round(c_a * 100, 1),
                "red dominance (R-G)": round(c_r * 100, 1),
            },
            explanation="Higher = more visible flushing / inflammation across skin.",
        )

    def _score_pigmentation(self, f: SkinFeatures) -> AxisScore:
        c_t = _norm(f.tone_unevenness, *self.RANGES["tone_unevenness"]) * self.WEIGHTS[SkinAxis.HYPERPIGMENTATION]["tone_unevenness"]
        c_d = _norm(f.dark_spot_fraction, *self.RANGES["dark_spot_fraction"]) * self.WEIGHTS[SkinAxis.HYPERPIGMENTATION]["dark_spot_fraction"]
        value = round((c_t + c_d) * 100, 1)
        return AxisScore(
            axis=SkinAxis.HYPERPIGMENTATION,
            value=value,
            label=self._label_problem(value),
            contributions={
                "tone unevenness": round(c_t * 100, 1),
                "dark-spot coverage": round(c_d * 100, 1),
            },
            explanation="Higher = more uneven tone and dark spots.",
        )

    def _score_acne(self, f: SkinFeatures) -> AxisScore:
        c_s = _norm(f.spot_density, *self.RANGES["spot_density"]) * self.WEIGHTS[SkinAxis.ACNE]["spot_density"]
        c_r = _norm(f.redness_a, *self.RANGES["redness_a"]) * self.WEIGHTS[SkinAxis.ACNE]["redness_a"]
        value = round((c_s + c_r) * 100, 1)
        return AxisScore(
            axis=SkinAxis.ACNE,
            value=value,
            label=self._label_problem(value),
            contributions={
                "inflamed-spot density": round(c_s * 100, 1),
                "local inflammation": round(c_r * 100, 1),
            },
            explanation="Higher = more inflamed breakout activity.",
        )

    def _score_hydration(self, f: SkinFeatures) -> AxisScore:
        # texture_energy is a *dryness* signal -> invert it for hydration.
        dryness = _norm(f.texture_energy, *self.RANGES["texture_energy"])
        glow = _norm(f.specular_fraction, *self.RANGES["specular_fraction"])
        w = self.WEIGHTS[SkinAxis.HYDRATION]
        value = round((w["texture_energy"] * (1 - dryness) + w["specular_fraction"] * glow) * 100, 1)
        return AxisScore(
            axis=SkinAxis.HYDRATION,
            value=value,
            label=self._label_hydration(value),
            contributions={
                "smoothness (low roughness)": round(w["texture_energy"] * (1 - dryness) * 100, 1),
                "healthy glow": round(w["specular_fraction"] * glow * 100, 1),
            },
            explanation="0% = very dry / flaky, 100% = well hydrated and supple.",
        )

    # --------------------------------------------------------- product factoring
    def factor_in_products(
        self,
        analysis: SkinAnalysis,
        ingredient_score: IngredientScore,
        benefit_by_axis: dict[str, float],
    ) -> SkinAnalysis:
        """Adjust the bare-skin reading for the user's current products.

        Transparent rules (documented, not learned — until the regression layer
        has enough data to replace them):
          * comedogenic load nudges the ACNE axis up
          * irritant load nudges the REDNESS axis up
          * a same-day active clash adds a small redness penalty
          * curated beneficial ingredients pull their target axis the good way
        """
        axes = analysis.axes

        # --- adverse pushes ---
        acne_push = min(20.0, ingredient_score.comedogenic_load * 0.8)
        redness_push = min(20.0, ingredient_score.irritant_load * 0.8)
        if ingredient_score.active_interaction_flag:
            redness_push = min(25.0, redness_push + 5.0)

        # --- beneficial pulls (per axis, capped) ---
        def pull(axis_key: str) -> float:
            return min(15.0, benefit_by_axis.get(axis_key, 0.0) * 2.0)

        self._adjust(axes[SkinAxis.ACNE], +acne_push, -pull("acne"), "products")
        self._adjust(axes[SkinAxis.REDNESS], +redness_push, -pull("redness"), "products")
        self._adjust(axes[SkinAxis.HYPERPIGMENTATION], 0.0, -pull("hyperpigmentation"), "products")
        # Hydration is a "good" axis, so beneficial humectants push it UP.
        self._adjust(axes[SkinAxis.HYDRATION], +pull("hydration"), 0.0, "products")

        for axis in axes.values():
            axis.label = (
                self._label_hydration(axis.value)
                if axis.axis == SkinAxis.HYDRATION
                else self._label_problem(axis.value)
            )
        analysis.notes.append("Scores adjusted for currently-logged products.")
        return analysis

    @staticmethod
    def _adjust(axis: AxisScore, up: float, down: float, source: str) -> None:
        delta = up + down  # down is already negative
        if abs(delta) < 0.05:
            return
        axis.value = round(max(0.0, min(100.0, axis.value + delta)), 1)
        axis.contributions[f"{source} adjustment"] = round(delta, 1)

    # ------------------------------------------------------------------ labels
    @staticmethod
    def _label_problem(value: float) -> str:
        if value < 15:
            return "clear"
        if value < 35:
            return "minimal"
        if value < 55:
            return "mild"
        if value < 75:
            return "moderate"
        return "significant"

    @staticmethod
    def _label_hydration(value: float) -> str:
        if value < 25:
            return "very dry"
        if value < 45:
            return "dry"
        if value < 65:
            return "balanced"
        if value < 85:
            return "hydrated"
        return "very hydrated"
