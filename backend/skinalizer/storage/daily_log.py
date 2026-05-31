"""JSON-backed store for daily entries.

A deliberately tiny persistence layer (one JSON file). Each day is keyed by ISO
date so re-logging a day overwrites it. The store flattens entries into a tidy
table for the attribution regression — that wide/long conversion is the only
"smart" thing it does.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from ..models import SkinAxis


class DailyLogStore:
    """Persists and queries the per-day signal history."""

    def __init__(self, storage_dir: Path):
        self._path = Path(storage_dir) / "daily_log.json"
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._entries: dict[str, dict] = self._load()

    def _load(self) -> dict[str, dict]:
        if self._path.exists():
            try:
                rows = json.loads(self._path.read_text(encoding="utf-8"))
                return {r["entry_date"]: r for r in rows}
            except (json.JSONDecodeError, OSError, KeyError):
                return {}
        return {}

    def _flush(self) -> None:
        rows = [self._entries[k] for k in sorted(self._entries)]
        self._path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    # --------------------------------------------------------------- public API
    def upsert(self, entry_dict: dict[str, Any]) -> None:
        """Insert or replace the entry for its date."""
        self._entries[entry_dict["entry_date"]] = entry_dict
        self._flush()

    def all_entries(self) -> list[dict]:
        return [self._entries[k] for k in sorted(self._entries)]

    def count(self) -> int:
        return len(self._entries)

    # Prefix marking a per-ingredient presence column, so downstream code can
    # tell ingredient drivers apart from aggregate/lifestyle ones by name alone.
    INGREDIENT_PREFIX = "ing:"

    def to_dataframe(self, include_ingredients: bool = False) -> pd.DataFrame:
        """Flatten entries into one row per day with numeric columns.

        Columns produced (when present):
            entry_date, <axis> for each SkinAxis, comedogenic_load,
            irritant_load, active_interaction_flag, plus any numeric lifestyle
            keys (sleep_hours, temp_c, humidity, dairy, ...).

        When ``include_ingredients`` is True, each ingredient ever matched gets
        an extra binary "presence" column named ``ing:<INCI name>`` (1 on days it
        was used, 0 otherwise). These power ingredient-level attribution, where a
        coefficient reads as "points attributable to using this one ingredient".
        """
        records: list[dict[str, Any]] = []
        # Union of every ingredient seen across history, so all days share the
        # same column set (absent ⇒ 0, never NaN — keeps the design matrix dense).
        all_ingredients: set[str] = set()
        if include_ingredients:
            for row in self.all_entries():
                ing = row.get("ingredient_score") or {}
                all_ingredients.update(ing.get("matched_ingredients") or [])

        for row in self.all_entries():
            rec: dict[str, Any] = {"entry_date": row["entry_date"]}
            analysis = row.get("analysis") or {}
            for axis in SkinAxis:
                axis_data = (analysis.get("axes") or {}).get(axis.value)
                if axis_data:
                    rec[axis.value] = axis_data["value"]
            ing = row.get("ingredient_score") or {}
            if ing:
                rec["comedogenic_load"] = ing.get("comedogenic_load", 0.0)
                rec["irritant_load"] = ing.get("irritant_load", 0.0)
                rec["active_interaction_flag"] = int(bool(ing.get("active_interaction_flag")))
            if include_ingredients:
                used_today = set(ing.get("matched_ingredients") or [])
                for name in all_ingredients:
                    rec[f"{self.INGREDIENT_PREFIX}{name}"] = int(name in used_today)
            for key, val in (row.get("lifestyle") or {}).items():
                if isinstance(val, (int, float)) and not isinstance(val, bool):
                    rec[key] = val
            records.append(rec)
        df = pd.DataFrame.from_records(records)
        if not df.empty:
            df["entry_date"] = pd.to_datetime(df["entry_date"])
            df = df.sort_values("entry_date").reset_index(drop=True)
        return df
