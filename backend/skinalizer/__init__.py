"""Skinalizer — a transparent skincare analysis engine.

The package treats the face as a "market price" tracked over time: weather,
products and lifestyle are exogenous signals, and we attribute changes in skin
quality to their likely drivers.

Design philosophy (see the master prompt): we deliberately prefer *transparent,
explainable* models over black boxes. Every score the engine produces can be
traced back to a labelled feature or a documented coefficient.

Public entry point: :class:`skinalizer.engine.SkinalizerEngine`.
"""

from .engine import SkinalizerEngine

__all__ = ["SkinalizerEngine"]
__version__ = "0.1.0"
