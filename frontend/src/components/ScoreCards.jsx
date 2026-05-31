import React from "react";
import { Droplet, Sun, Sparkles, Flame } from "lucide-react";
import { axisImprovement } from "../lib/insights";

// The four headline values. Compact on purpose — the deep breakdown
// (contributions, explanations, raw features) lives in the full report page.
const AXIS_META = {
  acne: { title: "Acne", icon: Sparkles, goodIsHigh: false },
  redness: { title: "Redness", icon: Flame, goodIsHigh: false },
  hyperpigmentation: { title: "Pigmentation", icon: Sun, goodIsHigh: false },
  hydration: { title: "Hydration", icon: Droplet, goodIsHigh: true },
};
const ORDER = ["acne", "redness", "hyperpigmentation", "hydration"];

function problemColor(v) {
  if (v < 25) return "#16a34a";
  if (v < 50) return "#eab308";
  if (v < 75) return "#f97316";
  return "#ef4444";
}
function barColor(v, goodIsHigh) {
  const scale = goodIsHigh ? 100 - v : v;
  return problemColor(scale);
}

function DeltaChip({ improvement }) {
  if (improvement == null || Math.abs(improvement) < 0.5) {
    return <span className="text-caption uppercase tracking-wide text-black/35">—</span>;
  }
  const better = improvement > 0;
  return (
    <span
      className="text-caption font-medium uppercase tracking-wide"
      style={{ color: better ? "#16a34a" : "#dc5000" }}
    >
      {better ? "▲" : "▼"} {Math.abs(Math.round(improvement))} vs last
    </span>
  );
}

export default function ScoreCards({ axes, previousAxes }) {
  if (!axes) return null;
  return (
    <div className="panel">
      <h3 className="kicker mb-4">the four readings</h3>
      <div className="divide-y divide-ink/10">
        {ORDER.map((key) => {
          const data = axes[key];
          if (!data) return null;
          const meta = AXIS_META[key];
          const Icon = meta.icon;
          const color = barColor(data.value, meta.goodIsHigh);
          const improvement = axisImprovement(key, data.value, previousAxes?.[key]?.value);
          return (
            <div key={key} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex w-32 shrink-0 items-center gap-2">
                <Icon className="h-4 w-4 text-ink/70" strokeWidth={1.5} />
                <span className="font-sans text-body">{meta.title}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-1.5 w-full overflow-hidden bg-ink/10">
                  <div
                    className="spectrum-fill h-full"
                    style={{ width: `${data.value}%`, backgroundColor: color }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-caption uppercase tracking-wide text-ink/55">{data.label}</span>
                  <DeltaChip improvement={improvement} />
                </div>
              </div>
              <span
                className="w-12 shrink-0 text-right font-display text-heading-sm font-medium"
                style={{ color }}
              >
                {Math.round(data.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
