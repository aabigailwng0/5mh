"""Pluggable pretrained-CNN backend (optional).

The engine is fully functional on explainable features alone. This module lets
you *optionally* plug in dermafyr's shipped MobileNetV2 Keras model (23 Dermnet
classes) to refine the acne axis. TensorFlow is imported lazily so the package
never hard-depends on it.

Design: the backend is an interface (:class:`ClassifierBackend`). Swap in any
model — ACNE04-finetuned, ONNX, a REST call — by implementing the same two
methods. The scorer only ever sees the interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np


class ClassifierBackend(ABC):
    """Interface every CNN backend must satisfy."""

    @property
    @abstractmethod
    def available(self) -> bool:
        """True if the backend loaded successfully and can predict."""

    @abstractmethod
    def prepare(self, bgr: np.ndarray) -> None:
        """Run inference on an image and cache the result for this frame."""

    @abstractmethod
    def acne_probability(self) -> float | None:
        """Return the cached acne probability in [0, 1], or None if unavailable."""


# dermafyr's MobileNetV2 was trained on the 23-class Dermnet taxonomy. We only
# need the index of the acne-related class to derive an acne probability.
DERMNET_LABELS = [
    "Acne and Rosacea Photos",
    "Actinic Keratosis Basal Cell Carcinoma and other Malignant Lesions",
    "Atopic Dermatitis Photos",
    "Bullous Disease Photos",
    "Cellulitis Impetigo and other Bacterial Infections",
    "Eczema Photos",
    "Exanthems and Drug Eruptions",
    "Hair Loss Photos Alopecia and other Hair Diseases",
    "Herpes HPV and other STDs Photos",
    "Light Diseases and Disorders of Pigmentation",
    "Lupus and other Connective Tissue diseases",
    "Melanoma Skin Cancer Nevi and Moles",
    "Nail Fungus and other Nail Disease",
    "Poison Ivy Photos and other Contact Dermatitis",
    "Psoriasis pictures Lichen Planus and related diseases",
    "Scabies Lyme Disease and other Infestations and Bites",
    "Seborrheic Keratoses and other Benign Tumors",
    "Systemic Disease",
    "Tinea Ringworm Candidiasis and other Fungal Infections",
    "Urticaria Hives",
    "Vascular Tumors",
    "Vasculitis Photos",
    "Warts Molluscum and other Viral Infections",
]
_ACNE_INDEX = 0  # "Acne and Rosacea Photos"


class KerasClassifierBackend(ClassifierBackend):
    """Loads dermafyr's ``tf_model.keras`` (MobileNetV2) if TensorFlow is present.

    Fixes the two bugs from the original repo: uses the correct MobileNetV2
    ``preprocess_input`` (the repo used ``/255`` which mismatched training) and
    actually feeds the prediction back into the pipeline.
    """

    def __init__(self, model_path: Path):
        self._model = None
        self._preprocess = None
        self._last_probs: np.ndarray | None = None
        self._load(model_path)

    def _load(self, model_path: Path) -> None:
        try:
            import tensorflow as tf  # noqa: PLC0415 (lazy on purpose)
            from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

            self._model = tf.keras.models.load_model(str(model_path))
            self._preprocess = preprocess_input
        except Exception as exc:  # broad: TF missing, bad file, version skew...
            print(f"[KerasClassifierBackend] disabled ({exc!s})")
            self._model = None

    @property
    def available(self) -> bool:
        return self._model is not None

    def prepare(self, bgr: np.ndarray) -> None:
        if not self.available:
            return
        import cv2

        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (224, 224)).astype("float32")
        batch = self._preprocess(np.expand_dims(resized, axis=0))
        self._last_probs = self._model.predict(batch, verbose=0)[0]

    def acne_probability(self) -> float | None:
        if self._last_probs is None:
            return None
        return float(self._last_probs[_ACNE_INDEX])
