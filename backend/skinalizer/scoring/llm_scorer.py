"""LLM vision scorer — score a face photo with Claude or Gemini.

This is a *drop-in alternative* to the transparent OpenCV :class:`SkinScorer`.
It sends the photo to a multimodal LLM with a tightly-specified rubric and asks
it to return a strict JSON object matching the exact same :class:`SkinAnalysis`
shape the rest of the app already consumes (four axes, each with a 0–100 value,
a label, named contributions and a short explanation).

Why keep the same contract?
    * the frontend renders ``axes.{acne,redness,hyperpigmentation,hydration}``
      generically — no UI change needed;
    * the ingredient/product factoring, warnings and attribution layers all keep
      working unchanged on top of whatever produced the bare-skin reading.

Design mirrors :class:`ClassifierBackend`: the provider (Anthropic / Gemini) is
hidden behind one ``score`` method, and heavy SDKs are imported lazily so the
package never hard-depends on them. If no API key / SDK is available the scorer
reports ``available == False`` and the engine transparently falls back to the
CV scorer.
"""

from __future__ import annotations

import base64
import io
import json
import os
from typing import Any

from ..models import AxisScore, SkinAnalysis, SkinAxis
from .features import SkinFeatures
from .scorer import SkinScorer

# --------------------------------------------------------------------- contract
# The four axes the model must score, with the human-readable "driver" names we
# want back as contributions. These names are what the UI shows under each bar,
# so they intentionally match the CV scorer's vocabulary for a seamless swap.
AXIS_SPECS: dict[SkinAxis, dict[str, Any]] = {
    SkinAxis.ACNE: {
        "good_is_high": False,
        "drivers": ["inflamed-spot density", "local inflammation"],
        "explanation": "Higher = more inflamed breakout activity.",
        "guidance": "Active pimples, pustules, papules, cysts and inflamed "
        "comedones. 0 = perfectly clear, 100 = widespread active breakout.",
    },
    SkinAxis.REDNESS: {
        "good_is_high": False,
        "drivers": ["redness_a* (skin)", "red dominance (R-G)"],
        "explanation": "Higher = more visible flushing / inflammation across skin.",
        "guidance": "Diffuse flushing, rosacea-like erythema, irritation. "
        "0 = even calm tone, 100 = strong widespread redness.",
    },
    SkinAxis.HYPERPIGMENTATION: {
        "good_is_high": False,
        "drivers": ["tone unevenness", "dark-spot coverage"],
        "explanation": "Higher = more uneven tone and dark spots.",
        "guidance": "Dark spots, post-inflammatory marks, melasma, sun damage and "
        "uneven tone. 0 = perfectly even tone, 100 = heavy spotting / unevenness.",
    },
    SkinAxis.HYDRATION: {
        "good_is_high": True,
        "drivers": ["smoothness (low roughness)", "healthy glow"],
        "explanation": "0% = very dry / flaky, 100% = well hydrated and supple.",
        "guidance": "This axis is INVERTED vs the others: HIGH is GOOD. "
        "0 = very dry, flaky, tight, dull; 100 = plump, smooth, dewy, well hydrated.",
    },
}

_DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "gemini": "gemini-2.0-flash",
}


def _build_prompt() -> str:
    """Construct the rubric + strict-JSON instruction sent with the image."""
    axis_lines = []
    for axis, spec in AXIS_SPECS.items():
        drivers = ", ".join(f'"{d}"' for d in spec["drivers"])
        axis_lines.append(
            f"- {axis.value}: {spec['guidance']}\n"
            f"    contributions keys (must be exactly these two): {drivers}"
        )
    axes_doc = "\n".join(axis_lines)

    # An explicit example pins the output schema so parsing is reliable.
    example = {
        "axes": {
            "acne": {
                "value": 57.0,
                "contributions": {"inflamed-spot density": 50.9, "local inflammation": 6.1},
                "explanation": "A few inflamed papules along the jawline.",
            },
            "redness": {
                "value": 45.0,
                "contributions": {"redness_a* (skin)": 14.6, "red dominance (R-G)": 30.4},
                "explanation": "Mild flushing across the cheeks.",
            },
            "hyperpigmentation": {
                "value": 30.0,
                "contributions": {"tone unevenness": 18.0, "dark-spot coverage": 12.0},
                "explanation": "Light unevenness, a couple of faint marks.",
            },
            "hydration": {
                "value": 72.0,
                "contributions": {"smoothness (low roughness)": 44.0, "healthy glow": 28.0},
                "explanation": "Skin looks smooth and supple with healthy reflectance.",
            },
        },
        "notes": ["Good lighting; face fills the frame."],
    }

    return (
        "You are a board-certified-dermatologist-level skin image analyst. You are "
        "looking at a single close-up photo of one person's face. Assess the BARE "
        "SKIN ONLY (ignore makeup intent, hair, background, jewellery).\n\n"
        "Score these four axes, each as a number from 0 to 100:\n"
        f"{axes_doc}\n\n"
        "Rules:\n"
        "1. For each axis, the two contributions are how much each driver pushed the "
        "score; they must be non-negative and sum to approximately the axis value "
        "(within ~2 points).\n"
        "2. Be calibrated and honest. Most normal skin sits in the 10–50 range for "
        "the problem axes; reserve 75+ for genuinely severe cases.\n"
        "3. If the photo is blurry, poorly lit, too far away, or not a face, add a "
        "short string to `notes` explaining the limitation and score conservatively.\n"
        "4. Keep each `explanation` to one short, specific sentence about THIS face.\n\n"
        "Respond with ONLY a single JSON object, no prose, no markdown fences, in "
        "exactly this shape:\n"
        f"{json.dumps(example, indent=2)}"
    )


def _media_type(image_bytes: bytes) -> str:
    """Best-effort image MIME type from the raw bytes (defaults to JPEG)."""
    try:
        from PIL import Image  # noqa: PLC0415

        fmt = (Image.open(io.BytesIO(image_bytes)).format or "JPEG").upper()
    except Exception:
        fmt = "JPEG"
    return {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp", "GIF": "image/gif"}.get(
        fmt, "image/jpeg"
    )


class LLMVisionScorer:
    """Scores a photo into a four-axis :class:`SkinAnalysis` via an LLM.

    Parameters
    ----------
    provider:
        ``"anthropic"`` (Claude) or ``"gemini"``.
    model:
        Override the per-provider default model id.
    api_key:
        Explicit key; otherwise read from the provider's standard env var
        (``ANTHROPIC_API_KEY`` / ``GEMINI_API_KEY`` or ``GOOGLE_API_KEY``), with
        ``SKINALIZER_LLM_API_KEY`` as a provider-agnostic override.
    """

    def __init__(
        self,
        provider: str = "anthropic",
        model: str | None = None,
        api_key: str | None = None,
        max_tokens: int = 1024,
    ):
        self.provider = (provider or "anthropic").lower().strip()
        self.model = model or _DEFAULT_MODELS.get(self.provider, "")
        self.max_tokens = max_tokens
        self._prompt = _build_prompt()
        self._client: Any = None
        self._init_error: str | None = None
        self._api_key = api_key or self._resolve_key()
        self._init_client()

    # ------------------------------------------------------------------ wiring
    def _resolve_key(self) -> str | None:
        override = os.environ.get("SKINALIZER_LLM_API_KEY")
        if override:
            return override
        if self.provider == "anthropic":
            return os.environ.get("ANTHROPIC_API_KEY")
        if self.provider == "gemini":
            return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        return None

    def _init_client(self) -> None:
        if not self._api_key:
            self._init_error = f"no API key for provider '{self.provider}'"
            return
        try:
            if self.provider == "anthropic":
                import anthropic  # noqa: PLC0415

                self._client = anthropic.Anthropic(api_key=self._api_key)
            elif self.provider == "gemini":
                import google.generativeai as genai  # noqa: PLC0415

                genai.configure(api_key=self._api_key)
                self._client = genai.GenerativeModel(self.model)
            else:
                self._init_error = f"unknown provider '{self.provider}'"
        except Exception as exc:  # SDK missing / bad key shape
            self._init_error = str(exc)
            self._client = None

    @property
    def available(self) -> bool:
        return self._client is not None

    # ------------------------------------------------------------------- score
    def score(self, image_bytes: bytes, features: SkinFeatures | None = None) -> SkinAnalysis:
        """Return a four-axis analysis for ``image_bytes``.

        ``features`` is accepted for signature-parity with the CV path (and to
        let us still surface a low-skin-coverage note) but is not sent to the LLM.
        """
        if not self.available:
            raise RuntimeError(f"LLMVisionScorer unavailable: {self._init_error}")
        raw = self._call_model(image_bytes)
        analysis = self._parse(raw)

        if features is not None and features.skin_pixel_fraction < 0.15:
            analysis.notes.append(
                "Low skin coverage detected — make sure the face fills the frame "
                "in good lighting for the most reliable reading."
            )
        return analysis

    def _call_model(self, image_bytes: bytes) -> str:
        b64 = base64.b64encode(image_bytes).decode("ascii")
        media_type = _media_type(image_bytes)

        if self.provider == "anthropic":
            message = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": self._prompt},
                        ],
                    }
                ],
            )
            return "".join(block.text for block in message.content if block.type == "text")

        # gemini
        response = self._client.generate_content(
            [self._prompt, {"mime_type": media_type, "data": image_bytes}]
        )
        return response.text or ""

    # ------------------------------------------------------------------- parse
    def _parse(self, raw: str) -> SkinAnalysis:
        """Turn the model's JSON text into a validated :class:`SkinAnalysis`."""
        payload = _loads_lenient(raw)
        axes_in = payload.get("axes", {}) if isinstance(payload, dict) else {}

        axes: dict[SkinAxis, AxisScore] = {}
        for axis, spec in AXIS_SPECS.items():
            node = axes_in.get(axis.value, {}) if isinstance(axes_in, dict) else {}
            value = _clamp(node.get("value", 0.0))
            contributions = _coerce_contributions(node.get("contributions"), spec["drivers"], value)
            explanation = str(node.get("explanation") or spec["explanation"])
            # Reuse the CV scorer's bands so both paths label identically and
            # can never drift apart if the thresholds are retuned in one place.
            label = (
                SkinScorer._label_hydration(value)  # noqa: SLF001 (shared single source of truth)
                if spec["good_is_high"]
                else SkinScorer._label_problem(value)  # noqa: SLF001
            )
            axes[axis] = AxisScore(
                axis=axis,
                value=value,
                label=label,
                contributions=contributions,
                explanation=explanation,
            )

        notes = payload.get("notes") if isinstance(payload, dict) else None
        if not isinstance(notes, list):
            notes = []
        notes = [str(n) for n in notes]

        return SkinAnalysis(axes=axes, source=f"llm:{self.provider}", notes=notes)


# ----------------------------------------------------------------- parse helpers
def _loads_lenient(raw: str) -> dict[str, Any]:
    """Parse JSON, tolerating ```json fences or surrounding prose."""
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        # drop an optional leading language tag like "json\n"
        if "\n" in text:
            first, rest = text.split("\n", 1)
            if first.strip().lower() in ("json", ""):
                text = rest
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if 0 <= start < end:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    raise ValueError(f"LLM did not return valid JSON: {raw[:200]!r}")


def _clamp(value: Any) -> float:
    try:
        return round(max(0.0, min(100.0, float(value))), 1)
    except (TypeError, ValueError):
        return 0.0


def _coerce_contributions(
    raw: Any, drivers: list[str], axis_value: float
) -> dict[str, float]:
    """Keep the two expected driver keys; if missing, split the value evenly."""
    out: dict[str, float] = {}
    raw = raw if isinstance(raw, dict) else {}
    for driver in drivers:
        if driver in raw:
            out[driver] = _clamp(raw[driver])
    if len(out) != len(drivers):
        # Fall back to an even, value-preserving split so the bars still add up.
        share = round(axis_value / len(drivers), 1) if drivers else 0.0
        out = {driver: share for driver in drivers}
    return out
