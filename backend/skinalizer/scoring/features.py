"""Explainable image features for skin-quality scoring.

Rather than a black-box CNN, the primary scorer reads a handful of classic,
*interpretable* computer-vision features from the face photo. Each one has a
clear dermatological rationale and can be shown to the user:

    redness_a            CIELab a* lift over neutral in skin pixels  -> redness
    redness_ratio        (R-G)/(R+G) red dominance                   -> redness
    tone_unevenness      spread of luminance across skin             -> hyperpigmentation
    dark_spot_fraction   share of notably-dark skin pixels           -> hyperpigmentation
    texture_energy       high-frequency roughness (Laplacian var)    -> dryness
    specular_fraction    glossy highlight share (skin "glow")        -> hydration
    spot_density         reddish raised-spot blobs per skin area     -> acne

All threshold constants live here as named, documented values — there are no
hidden magic numbers in the math.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, asdict
from typing import Any

import cv2
import numpy as np
from PIL import Image


@dataclass
class SkinFeatures:
    """Raw, interpretable measurements extracted from one photo."""

    redness_a: float
    redness_ratio: float
    tone_unevenness: float
    dark_spot_fraction: float
    texture_energy: float
    specular_fraction: float
    spot_density: float
    skin_pixel_fraction: float  # how much of the frame read as skin (quality cue)

    def to_dict(self) -> dict[str, Any]:
        return {k: round(float(v), 5) for k, v in asdict(self).items()}


class FeatureExtractor:
    """Extracts :class:`SkinFeatures` from raw image bytes or arrays."""

    # --- Skin-detection thresholds (YCrCb), standard values from the literature ---
    _CR_MIN, _CR_MAX = 133, 173
    _CB_MIN, _CB_MAX = 77, 127

    # Resize longest side to this so feature scales are comparable across photos.
    _TARGET_LONG_EDGE = 512

    @staticmethod
    def decode(data: bytes) -> np.ndarray:
        """Decode arbitrary image bytes (jpeg/png/...) to a BGR uint8 array."""
        image = Image.open(io.BytesIO(data)).convert("RGB")
        rgb = np.asarray(image)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    def extract_from_bytes(self, data: bytes) -> SkinFeatures:
        """Decode arbitrary image bytes (jpeg/png/...) and extract features."""
        return self.extract(self.decode(data))

    def extract(self, bgr: np.ndarray) -> SkinFeatures:
        """Extract features from a BGR uint8 image array."""
        bgr = self._resize(bgr)
        mask = self._skin_mask(bgr)
        skin_fraction = float(mask.mean()) if mask.size else 0.0

        # Fall back to the whole frame if too little skin was detected, so we
        # never divide by zero or return garbage on an unusual crop.
        if mask.sum() < 0.02 * mask.size:
            mask = np.ones(bgr.shape[:2], dtype=bool)

        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        l_chan, a_chan, _ = cv2.split(lab)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)

        skin = mask.astype(bool)
        l_skin = l_chan[skin]
        a_skin = a_chan[skin]

        redness_a = float(a_skin.mean() - 128.0)  # 128 = neutral a* in OpenCV Lab

        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        red_ratio_map = (r - g) / (r + g + 1.0)
        redness_ratio = float(red_ratio_map[skin].mean())

        # Tone evenness: spread of luminance among skin pixels.
        tone_unevenness = float(l_skin.std())
        # Dark spots: skin pixels notably darker than the local median.
        median_l = float(np.median(l_skin))
        dark_thresh = median_l - 1.0 * float(l_skin.std())
        dark_spot_fraction = float((l_skin < dark_thresh).mean())

        # Texture / dryness: Laplacian energy inside the skin region.
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
        texture_energy = float(lap[skin].var())

        # Specular glow: bright + low-saturation skin pixels = healthy reflectance.
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
        s_chan, v_chan = hsv[..., 1], hsv[..., 2]
        glow = (v_chan > 200) & (s_chan < 60)
        specular_fraction = float(glow[skin].mean())

        spot_density = self._spot_density(a_chan, skin)

        return SkinFeatures(
            redness_a=redness_a,
            redness_ratio=redness_ratio,
            tone_unevenness=tone_unevenness,
            dark_spot_fraction=dark_spot_fraction,
            texture_energy=texture_energy,
            specular_fraction=specular_fraction,
            spot_density=spot_density,
            skin_pixel_fraction=skin_fraction,
        )

    # ------------------------------------------------------------------ helpers
    def _resize(self, bgr: np.ndarray) -> np.ndarray:
        h, w = bgr.shape[:2]
        long_edge = max(h, w)
        if long_edge <= self._TARGET_LONG_EDGE:
            return bgr
        scale = self._TARGET_LONG_EDGE / long_edge
        return cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    def _skin_mask(self, bgr: np.ndarray) -> np.ndarray:
        """Boolean skin mask via YCrCb chroma thresholds (lighting-robust)."""
        ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
        _, cr, cb = cv2.split(ycrcb)
        mask = (
            (cr >= self._CR_MIN)
            & (cr <= self._CR_MAX)
            & (cb >= self._CB_MIN)
            & (cb <= self._CB_MAX)
        )
        # Morphological clean-up to drop speckle and fill small holes.
        mask_u8 = (mask.astype(np.uint8)) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_OPEN, kernel)
        mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE, kernel)
        return mask_u8 > 0

    def _spot_density(self, a_chan: np.ndarray, skin: np.ndarray) -> float:
        """Reddish raised-spot blobs per unit skin area (acne proxy).

        A spot is a small cluster of skin pixels whose redness rises sharply
        above the *local* background — i.e. a localised inflamed lesion rather
        than overall flushing (which the redness features already capture).
        """
        # Local background = heavily blurred a* channel.
        bg = cv2.GaussianBlur(a_chan, (0, 0), sigmaX=15)
        excess = a_chan - bg
        # Spot pixels: locally much redder than surroundings AND on skin.
        spot_pixels = (excess > 8.0) & skin
        spot_u8 = (spot_pixels.astype(np.uint8)) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        spot_u8 = cv2.morphologyEx(spot_u8, cv2.MORPH_OPEN, kernel)

        n_labels, _, stats, _ = cv2.connectedComponentsWithStats(spot_u8, connectivity=8)
        # Count blobs in a plausible lesion size range (ignore single pixels and
        # huge regions that are really lighting gradients).
        skin_area = max(int(skin.sum()), 1)
        blob_count = 0
        for i in range(1, n_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if 4 <= area <= 0.01 * skin_area:
                blob_count += 1
        # Normalise to "blobs per 100k skin pixels" for resolution independence.
        return float(blob_count) / (skin_area / 100_000.0)
