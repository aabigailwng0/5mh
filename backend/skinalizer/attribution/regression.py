"""Distributed-lag attribution: decompose a skin axis into its likely drivers.

We treat a skin axis (e.g. ``acne``) like a "price" and decompose its day-to-day
movements into exogenous drivers — product loads, individual ingredients, sleep,
weather, diet — measured at several time **lags** (today, yesterday, ...).

The model is **linear on purpose**: a linear coefficient is exactly the
user-facing product ("using salicylic acid is worth −4 acne points the next
day"). That directness is the whole point, so we don't reach for a black box.

This module layers three things on top of a plain regression so the numbers are
trustworthy and legible:

1. Ingredient-level drivers
   Beyond the aggregate comedogenic / irritant loads, each individual ingredient
   can be a binary "used today" driver, so attribution can name a single
   ingredient rather than only a lumped load.

2. Statistical rigor
   We report **cross-validated** R² (honest out-of-sample fit) next to the
   optimistic in-sample R² so the overfitting gap is visible, and we attach a
   **bootstrap confidence interval + p-value** to every coefficient. Bootstrap
   is used (rather than closed-form OLS inference) because it stays well-defined
   on the short, wide, collinear series a real user will have, where an OLS
   design matrix is often singular.

3. Real units
   Coefficients are reported in the driver's own units (acne points per hour of
   sleep, per unit of comedogenic load, or per day-of-use for an ingredient),
   not in standardised z-scores, and each driver gets a plain-English sentence.

Ridge regularisation underlies the fit to keep coefficients stable; ranking
across drivers uses the standardised effect size (comparable across units) while
the reported effect stays in real units.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold, cross_val_score
from sklearn.preprocessing import StandardScaler

from ..models import SkinAxis

# Outcome columns (never used as predictors) vs. everything else (drivers).
_AXIS_COLS = {a.value for a in SkinAxis}
_INGREDIENT_PREFIX = "ing:"

# Significance threshold for flagging a driver as a "clear" effect.
_ALPHA = 0.05

# Sentinel "lag" for the sustained / long-term bucket (an average over the days
# beyond the explicit short-term lags), distinguishing it from real day lags.
_SUSTAINED = -1
_SUSTAINED_SUFFIX = " (sustained)"


class AttributionEngine:
    """Fits a per-axis distributed-lag Ridge model and attributes drivers.

    Parameters
    ----------
    min_entries:
        Minimum logged days before attribution is attempted at all.
    max_lag:
        Largest short-term lag (in days) to build for each driver
        (0..max_lag inclusive).
    long_window:
        If greater than ``max_lag + 1``, add one extra "sustained" driver per
        column: the average exposure over the days lagged ``max_lag+1 ..
        long_window``. This captures longer-term trends with a single, smoothed
        predictor instead of many noisy individual lags. Set to 0 to disable.
    ridge_alpha:
        L2 penalty strength; larger = more shrinkage / more stable coefficients.
    n_bootstrap:
        Resamples used for confidence intervals and p-values.
    random_state:
        Seed for reproducible cross-validation folds and bootstrap draws.
    """

    def __init__(
        self,
        min_entries: int = 10,
        max_lag: int = 2,
        long_window: int = 7,
        ridge_alpha: float = 1.0,
        n_bootstrap: int = 500,
        random_state: int = 7,
    ):
        self._min_entries = min_entries
        self._max_lag = max_lag
        self._long_window = long_window
        self._alpha = ridge_alpha
        self._n_bootstrap = n_bootstrap
        self._random_state = random_state

    @property
    def _has_sustained(self) -> bool:
        """Whether a long-term bucket is configured and wider than the lags."""
        return self._long_window > self._max_lag + 1

    # --------------------------------------------------------------- public API
    def analyze(
        self, df: pd.DataFrame, target_axis: str, level: str = "aggregate"
    ) -> dict[str, Any]:
        """Attribute movements in ``target_axis`` to lagged drivers.

        ``level`` selects which drivers to consider:
            "aggregate"  -> comedogenic/irritant loads, clash flag, lifestyle.
            "ingredient" -> individual ingredient presence + lifestyle.
        The caller is responsible for passing a DataFrame that actually contains
        the requested columns (see ``DailyLogStore.to_dataframe``).
        """
        n = len(df)
        if n < self._min_entries:
            return {
                "status": "insufficient_data",
                "level": level,
                "entries": n,
                "entries_needed": self._min_entries,
                "message": (
                    f"Need at least {self._min_entries} daily entries before "
                    f"attribution is meaningful (have {n})."
                ),
            }
        if target_axis not in df.columns:
            return {
                "status": "no_target",
                "level": level,
                "message": f"No history for axis '{target_axis}'.",
            }

        design, feature_names = self._build_lagged_design(df, target_axis, level)
        y = df[target_axis].to_numpy(dtype=float)[self._max_lag :]

        if design.shape[0] < 4 or design.shape[1] == 0:
            return {
                "status": "insufficient_data",
                "level": level,
                "entries": n,
                "message": "Not enough varying drivers / overlapping days after lagging.",
            }

        fit = self._fit(design, y)
        drivers = self._attribute(design, y, feature_names, target_axis)

        return {
            "status": "ok",
            "target_axis": target_axis,
            "level": level,
            "entries": n,
            "max_lag": self._max_lag,
            "long_window": self._long_window if self._has_sustained else None,
            "fit": fit,
            "drivers": drivers,
            "narrative": self._narrative(target_axis, drivers),
            "caveats": self._caveats(n, fit, design.shape[1]),
        }

    # --------------------------------------------------------------- design step
    def _build_lagged_design(
        self, df: pd.DataFrame, target_axis: str, level: str
    ) -> tuple[np.ndarray, list[str]]:
        """Construct the lagged predictor matrix (lags 0..max_lag) plus, when
        configured, one "sustained" long-term bucket per driver.

        Returns the design matrix in **raw units** (not yet standardised) plus
        the matching feature names, with zero-variance columns dropped.
        """
        driver_cols = self._driver_columns(df, level)
        columns: dict[str, np.ndarray] = {}
        for col in driver_cols:
            series = df[col].to_numpy(dtype=float)
            for lag in range(self._max_lag + 1):
                shifted = np.roll(series, lag)
                # Trim the wrapped-around head so only valid lagged rows remain.
                columns[f"{col} (lag-{lag})"] = shifted[self._max_lag :]
            if self._has_sustained:
                columns[f"{col}{_SUSTAINED_SUFFIX}"] = self._sustained_column(series)
        if not columns:
            return np.empty((0, 0)), []

        feature_names = list(columns.keys())
        matrix = np.column_stack([columns[name] for name in feature_names])
        # Drop zero-variance columns (a driver the user never changed — it can
        # carry no information and would only destabilise the fit).
        keep = matrix.std(axis=0) > 1e-9
        matrix = matrix[:, keep]
        feature_names = [n for n, k in zip(feature_names, keep) if k]
        return matrix, feature_names

    def _sustained_column(self, series: np.ndarray) -> np.ndarray:
        """Average exposure over the *longer* tail (lags max_lag+1 .. long_window).

        This is the long-term driver: rather than spending a separate coefficient
        on each distant day (noisy and degrees-of-freedom hungry on short series),
        we summarise sustained use with one smoothed predictor. Early rows simply
        average whatever prior days exist (``min_periods=1``); days before logging
        began count as no exposure (filled with 0). Aligned to the same trimmed
        rows as the lag columns.
        """
        window = self._long_window - self._max_lag
        s = pd.Series(series)
        # Shift past the explicit lags, then average across the remaining window
        # so row r sees the mean of days r-long_window .. r-(max_lag+1).
        tail = s.shift(self._max_lag + 1).rolling(window=window, min_periods=1).mean()
        return tail.fillna(0.0).to_numpy()[self._max_lag :]

    def _driver_columns(self, df: pd.DataFrame, level: str) -> list[str]:
        """Pick which numeric columns act as drivers for the requested level."""
        numeric = [
            c
            for c in df.columns
            if c not in _AXIS_COLS
            and c != "entry_date"
            and pd.api.types.is_numeric_dtype(df[c])
        ]
        is_ingredient = lambda c: c.startswith(_INGREDIENT_PREFIX)  # noqa: E731
        if level == "ingredient":
            # Individual ingredients + lifestyle, but NOT the aggregate loads
            # (they are collinear sums of the ingredient columns).
            aggregate = {"comedogenic_load", "irritant_load", "active_interaction_flag"}
            return [c for c in numeric if is_ingredient(c) or c not in aggregate]
        # "aggregate": everything except the per-ingredient presence columns.
        return [c for c in numeric if not is_ingredient(c)]

    # ------------------------------------------------------------------ fit step
    def _fit(self, design: np.ndarray, y: np.ndarray) -> dict[str, Any]:
        """Fit quality: in-sample vs cross-validated R² (the honesty check)."""
        x_std = StandardScaler().fit_transform(design)
        model = Ridge(alpha=self._alpha).fit(x_std, y)
        r2_in = float(model.score(x_std, y))

        # Cross-validated R² is the trustworthy number. Use as many folds as the
        # data sensibly allows (capped at 5), shuffling for stability on tiny n.
        n_splits = max(2, min(5, len(y)))
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=self._random_state)
        cv_scores = cross_val_score(
            Ridge(alpha=self._alpha), x_std, y, cv=cv, scoring="r2"
        )
        return {
            "r2_in_sample": round(r2_in, 3),
            "r2_cv_mean": round(float(np.mean(cv_scores)), 3),
            "r2_cv_std": round(float(np.std(cv_scores)), 3),
            "n_features": int(design.shape[1]),
            "cv_folds": n_splits,
            "reliability": self._reliability(len(y), float(np.mean(cv_scores))),
        }

    # ------------------------------------------------------------ attribution step
    def _attribute(
        self,
        design: np.ndarray,
        y: np.ndarray,
        feature_names: list[str],
        target_axis: str,
    ) -> list[dict[str, Any]]:
        """Per-driver real-unit effect with a bootstrap CI and p-value.

        For each driver we report:
          * ``effect`` — change in the axis (points) per one *raw unit* of the
            driver, e.g. per hour of sleep, or per day-of-use for an ingredient;
          * ``effect_ci`` — 2.5/97.5 bootstrap percentile interval (real units);
          * ``p_value`` — two-sided bootstrap p-value (sign-stability based);
          * ``importance`` — |standardised coefficient|, comparable across drivers
            with different units (used for ranking and bar length).
        """
        # Point estimates: raw-unit effect (for the sentence) and standardised
        # coefficient (for cross-unit importance ranking) from a single fit.
        point_raw, point_std = self._ridge_real_units(design, y)
        boot_raw = self._bootstrap(design, y)
        max_importance = float(np.max(np.abs(point_std))) or 1.0

        drivers: list[dict[str, Any]] = []
        for i, name in enumerate(feature_names):
            effect = float(point_raw[i])
            lo, hi = np.percentile(boot_raw[:, i], [2.5, 97.5])
            p_value = self._bootstrap_p_value(boot_raw[:, i])
            importance = float(abs(point_std[i]))
            direction = "increases" if effect > 0 else "decreases"
            base_name, lag = self._split_lag(name)
            drivers.append(
                {
                    "driver": name,
                    "label": self._humanize(base_name, lag),
                    # Pre-split fields so the UI never has to parse driver strings.
                    "name": self._pretty_name(base_name),
                    "when": self._when(lag),
                    "kind": self._kind(base_name),
                    "ingredient": (
                        base_name[len(_INGREDIENT_PREFIX) :]
                        if base_name.startswith(_INGREDIENT_PREFIX)
                        else None
                    ),
                    "unit": self._unit(base_name),
                    "lag_days": None if lag == _SUSTAINED else lag,
                    "effect": round(effect, 3),
                    "effect_ci": [round(float(lo), 3), round(float(hi), 3)],
                    "p_value": round(p_value, 3),
                    "significant": bool(p_value < _ALPHA),
                    "importance": round(importance / max_importance, 3),
                    "direction": direction,
                    "sentence": self._sentence(
                        base_name, lag, effect, (float(lo), float(hi)), target_axis
                    ),
                }
            )

        # Sort by significance first, then by ranked importance.
        drivers.sort(key=lambda d: (not d["significant"], -d["importance"]))
        return drivers

    def _ridge_real_units(
        self, design: np.ndarray, y: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        """Fit Ridge on standardised X, return ``(raw_units, standardised)`` coefs.

        If ``x_std = (x - mean) / scale`` then ``y = b0 + Σ βstd · x_std`` implies
        a raw-unit slope of ``βraw = βstd / scale`` — i.e. effect per real unit.
        The standardised coefficient is kept for cross-unit importance ranking.
        """
        scaler = StandardScaler().fit(design)
        model = Ridge(alpha=self._alpha).fit(scaler.transform(design), y)
        beta_std = model.coef_
        beta_raw = beta_std / scaler.scale_
        return beta_raw, beta_std

    def _bootstrap(self, design: np.ndarray, y: np.ndarray) -> np.ndarray:
        """Resample days with replacement to get raw-unit coefficient draws.

        Standardisation is refit inside each resample so the uncertainty reflects
        the full pipeline. Returns an array of shape ``(n_bootstrap, n_features)``
        of raw-unit coefficients.
        """
        rng = np.random.default_rng(self._random_state)
        n = design.shape[0]
        raw = np.empty((self._n_bootstrap, design.shape[1]))
        for b in range(self._n_bootstrap):
            idx = rng.integers(0, n, size=n)
            xb, yb = design[idx], y[idx]
            scaler = StandardScaler().fit(xb)
            model = Ridge(alpha=self._alpha).fit(scaler.transform(xb), yb)
            raw[b] = model.coef_ / scaler.scale_
        return raw

    @staticmethod
    def _bootstrap_p_value(samples: np.ndarray) -> float:
        """Two-sided bootstrap p-value from the fraction crossing zero.

        Proportion of resamples landing on the opposite side of zero from the
        point estimate, doubled for a two-sided test and clamped to [0, 1].
        """
        point = float(np.mean(samples))
        if point == 0:
            return 1.0
        opposite = np.mean(samples <= 0) if point > 0 else np.mean(samples >= 0)
        return float(min(1.0, 2.0 * opposite))

    # ------------------------------------------------------------------ wording
    @staticmethod
    def _split_lag(feature_name: str) -> tuple[str, int]:
        """Split a feature name into ``(base_column, lag)``.

        ``"sleep_hours (lag-2)"`` -> ``("sleep_hours", 2)`` and
        ``"sleep_hours (sustained)"`` -> ``("sleep_hours", _SUSTAINED)``.
        """
        if feature_name.endswith(_SUSTAINED_SUFFIX):
            return feature_name[: -len(_SUSTAINED_SUFFIX)], _SUSTAINED
        if " (lag-" in feature_name:
            base, tail = feature_name.split(" (lag-", 1)
            return base, int(tail.rstrip(")"))
        return feature_name, 0

    @staticmethod
    def _pretty_name(base_name: str) -> str:
        """Turn a raw column name into something readable for the UI."""
        if base_name.startswith(_INGREDIENT_PREFIX):
            return base_name[len(_INGREDIENT_PREFIX) :]
        return base_name.replace("_", " ")

    def _when(self, lag: int) -> str:
        """Human phrasing for a lag, e.g. 0 -> 'same day', 2 -> '2 days later',
        sustained -> 'sustained (prior week)'."""
        if lag == _SUSTAINED:
            return f"sustained ({self._sustained_span()})"
        return "same day" if lag == 0 else f"{lag} day{'s' if lag > 1 else ''} later"

    def _sustained_span(self) -> str:
        """Readable span covered by the sustained bucket, e.g. 'prior 3–7 days'."""
        start = self._max_lag + 1
        end = self._long_window
        if start == end:
            return f"{start} days earlier"
        return f"prior {start}\u2013{end} days"

    @staticmethod
    def _kind(base_name: str) -> str:
        """Coarse driver category, used by the UI to group / label factors."""
        if base_name.startswith(_INGREDIENT_PREFIX):
            return "ingredient"
        if base_name in ("comedogenic_load", "irritant_load"):
            return "load"
        if base_name == "active_interaction_flag":
            return "interaction"
        return "lifestyle"

    def _humanize(self, base_name: str, lag: int) -> str:
        """Short label: pretty driver name + when it acted."""
        return f"{self._pretty_name(base_name)} · {self._when(lag)}"

    @staticmethod
    def _unit(base_name: str) -> str:
        """Human description of one raw unit of the driver."""
        if base_name.startswith(_INGREDIENT_PREFIX):
            return "per day used"
        if base_name == "active_interaction_flag":
            return "when an active clash is present"
        if base_name in ("comedogenic_load", "irritant_load"):
            return f"per unit {base_name.replace('_', ' ')}"
        return f"per unit {base_name.replace('_', ' ')}"

    def _sentence(
        self,
        base_name: str,
        lag: int,
        effect: float,
        ci: tuple[float, float],
        target_axis: str,
    ) -> str:
        """One plain-English, real-units sentence describing the effect."""
        name = self._pretty_name(base_name)
        verb = "raises" if effect > 0 else "lowers"
        mag = abs(effect)
        lo, hi = ci
        ci_txt = f"95% CI {lo:+.1f} to {hi:+.1f}"

        # The sustained bucket reads as a longer-term trend, not a single-day lag.
        if lag == _SUSTAINED:
            span = self._sustained_span()
            if base_name.startswith(_INGREDIENT_PREFIX):
                return (
                    f"Sustained use of {name} (averaged over the {span}) {verb} "
                    f"{target_axis} by about {mag:.1f} points ({ci_txt})."
                )
            if base_name == "active_interaction_flag":
                return (
                    f"Sustained active-ingredient clashes (over the {span}) {verb} "
                    f"{target_axis} by about {mag:.1f} points ({ci_txt})."
                )
            return (
                f"A sustained level of {name} (over the {span}) {verb} "
                f"{target_axis} by about {mag:.2f} points ({ci_txt})."
            )

        when = "the same day" if lag == 0 else f"{lag} day{'s' if lag > 1 else ''} later"
        if base_name.startswith(_INGREDIENT_PREFIX):
            return (
                f"Using {name} {verb} {target_axis} by about {mag:.1f} points "
                f"{when} ({ci_txt})."
            )
        if base_name == "active_interaction_flag":
            return (
                f"An active-ingredient clash {verb} {target_axis} by about "
                f"{mag:.1f} points {when} ({ci_txt})."
            )
        return (
            f"Each unit of {name} {verb} {target_axis} by about {mag:.2f} points "
            f"{when} ({ci_txt})."
        )

    # ------------------------------------------------------------------ summary
    @staticmethod
    def _reliability(n: int, cv_r2: float) -> str:
        """Coarse trust label from sample size and cross-validated fit."""
        if n < 14 or cv_r2 < 0.2:
            return "exploratory"
        if n < 30 or cv_r2 < 0.5:
            return "suggestive"
        return "solid"

    def _narrative(self, target_axis: str, drivers: list[dict]) -> list[str]:
        """Plain-English summary leading with statistically clear drivers."""
        significant = [d for d in drivers if d["significant"]]
        chosen = significant[:3] if significant else drivers[:2]
        lines = [d["sentence"] for d in chosen if d["importance"] > 0.05]
        if not lines:
            lines.append(f"No driver shows a clear effect on {target_axis} yet.")
        elif not significant:
            lines.insert(
                0,
                "No effect is statistically clear yet — the strongest *associations* "
                "so far (treat as hints, not conclusions):",
            )
        return lines

    @staticmethod
    def _caveats(n: int, fit: dict[str, Any], n_features: int) -> list[str]:
        """Honest health warnings about what the numbers can and can't say."""
        caveats: list[str] = []
        if fit["r2_in_sample"] - fit["r2_cv_mean"] > 0.25:
            caveats.append(
                "Large gap between in-sample and cross-validated R² — the model is "
                "overfitting; log more days for trustworthy effects."
            )
        if n_features >= n:
            caveats.append(
                "There are about as many drivers as days — coefficients are heavily "
                "regularised and individual effects are uncertain."
            )
        if fit["r2_cv_mean"] < 0:
            caveats.append(
                "Cross-validated R² is negative: drivers don't yet predict this axis "
                "out-of-sample better than its average."
            )
        caveats.append("Associations are correlational, not proof of cause.")
        return caveats
