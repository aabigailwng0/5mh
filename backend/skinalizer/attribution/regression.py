"""Distributed-lag linear attribution (the stretch goal).

Treats a skin axis as a "price" and decomposes its movements into exogenous
drivers (product loads, sleep, weather, diet ...) at several lags. We keep the
model **linear on purpose**: the coefficients *are* the user-facing product
("dairy at lag-2 pushes acne up").

Attribution uses the closed-form SHAP value for linear models —
``phi_i = beta_i * (x_i - E[x_i])`` — which is exact for a linear predictor and
needs no extra dependency. Ridge regularisation keeps coefficients stable on the
short series a hackathon user will realistically have.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from ..models import SkinAxis

# Outcome columns (never used as predictors) vs. everything else (drivers).
_AXIS_COLS = {a.value for a in SkinAxis}


class AttributionEngine:
    """Fits a per-axis distributed-lag Ridge model and attributes drivers."""

    def __init__(self, min_entries: int = 10, max_lag: int = 3, ridge_alpha: float = 1.0):
        self._min_entries = min_entries
        self._max_lag = max_lag
        self._alpha = ridge_alpha

    def analyze(self, df: pd.DataFrame, target_axis: str) -> dict[str, Any]:
        """Attribute movements in ``target_axis`` to lagged drivers."""
        n = len(df)
        if n < self._min_entries:
            return {
                "status": "insufficient_data",
                "entries": n,
                "entries_needed": self._min_entries,
                "message": (
                    f"Need at least {self._min_entries} daily entries before "
                    f"attribution is meaningful (have {n})."
                ),
            }
        if target_axis not in df.columns:
            return {"status": "no_target", "message": f"No history for axis '{target_axis}'."}

        design, feature_names = self._build_lagged_design(df, target_axis)
        y = df[target_axis].to_numpy(dtype=float)[self._max_lag :]

        if design.shape[0] < 4 or design.shape[1] == 0:
            return {"status": "insufficient_data", "entries": n,
                    "message": "Not enough overlapping days after lagging."}

        # Standardise features so Ridge penalises them comparably and so the
        # SHAP contributions are expressed per-standard-deviation of each driver.
        scaler = StandardScaler()
        x_std = scaler.fit_transform(design)

        model = Ridge(alpha=self._alpha)
        model.fit(x_std, y)
        r2 = float(model.score(x_std, y))

        # Linear SHAP: contribution of feature i on day t = beta_i * (x_std - mean).
        # mean of x_std is ~0 after scaling, so phi = beta_i * x_std.
        phi = model.coef_ * x_std  # (days, features)
        mean_abs = np.abs(phi).mean(axis=0)

        drivers = []
        for name, coef, contrib in zip(feature_names, model.coef_, mean_abs):
            drivers.append(
                {
                    "driver": name,
                    "coefficient": round(float(coef), 3),
                    "mean_abs_contribution": round(float(contrib), 3),
                    "direction": "increases" if coef > 0 else "decreases",
                }
            )
        drivers.sort(key=lambda d: d["mean_abs_contribution"], reverse=True)

        return {
            "status": "ok",
            "target_axis": target_axis,
            "entries": n,
            "r2": round(r2, 3),
            "intercept": round(float(model.intercept_), 3),
            "max_lag": self._max_lag,
            "drivers": drivers,
            "narrative": self._narrative(target_axis, drivers),
        }

    # ------------------------------------------------------------------ helpers
    def _build_lagged_design(
        self, df: pd.DataFrame, target_axis: str
    ) -> tuple[np.ndarray, list[str]]:
        """Construct the lagged predictor matrix (lags 0..max_lag)."""
        driver_cols = [
            c
            for c in df.columns
            if c not in _AXIS_COLS and c != "entry_date" and pd.api.types.is_numeric_dtype(df[c])
        ]
        columns: dict[str, np.ndarray] = {}
        for col in driver_cols:
            series = df[col].to_numpy(dtype=float)
            for lag in range(self._max_lag + 1):
                shifted = np.roll(series, lag)
                # Trim the wrapped-around head so only valid lagged rows remain.
                columns[f"{col} (lag-{lag})"] = shifted[self._max_lag :]
        if not columns:
            return np.empty((0, 0)), []
        feature_names = list(columns.keys())
        matrix = np.column_stack([columns[name] for name in feature_names])
        # Drop zero-variance columns (a driver the user never changed).
        keep = matrix.std(axis=0) > 1e-9
        matrix = matrix[:, keep]
        feature_names = [n for n, k in zip(feature_names, keep) if k]
        return matrix, feature_names

    @staticmethod
    def _narrative(target_axis: str, drivers: list[dict]) -> list[str]:
        """Plain-English summary of the top few drivers."""
        lines = []
        for d in drivers[:3]:
            if d["mean_abs_contribution"] < 0.05:
                continue
            lines.append(
                f"{d['driver']} {d['direction']} {target_axis} "
                f"(coef {d['coefficient']:+.2f})."
            )
        if not lines:
            lines.append(f"No driver shows a clear effect on {target_axis} yet.")
        return lines
