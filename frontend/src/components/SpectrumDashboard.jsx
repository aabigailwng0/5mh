import React from "react";
import { Droplet, Sun, Sparkles, Flame } from "lucide-react";

// Display metadata per axis. `goodIsHigh` flips the severity scale for hydration
// (where a high score is good) versus the problem axes (where low is good).
const AXIS_META = {
  hyperpigmentation: {
    title: "Hyperpigmentation",
    subtitle: "dark spots & uneven tone",
    icon: Sun,
    goodIsHigh: false,
  },
  hydration: {
    title: "Dryness ↔ Hydration",
    subtitle: "0% dry · 100% hydrated",
    icon: Droplet,
    goodIsHigh: true,
  },
  acne: {
    title: "Acne",
    subtitle: "Breakout activity",
    icon: Sparkles,
    goodIsHigh: false,
  },
  redness: {
    title: "Redness",
    subtitle: "flushing & inflammation",
    icon: Flame,
    goodIsHigh: false,
  },
};

// Warm severity ramp: grey-brown (calm) -> burnt-sienna (concerning). Staying on
// the ORYZO palette — no off-brand greens/reds.
function lerpHex(a, b, t) {
  const ah = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const bh = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  const out = ah.map((v, i) => Math.round(v + (bh[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function problemColor(value) {
  if (value < 25) return "#22c55e"; 
  if (value < 50) return "#eab308"; 
  if (value < 75) return "#f97316"; 
  return "#ef4444";
}

function hydrationColor(value) {
  if (value < 25) return "#ef4444"; 
  if (value < 50) return "#f97316";
  if (value < 75) return "#eab308";
  return "#22c55e"; 
}

function barColor(value, goodIsHigh) {
  if (goodIsHigh) { 
    return hydrationColor(value); 
  }
  return problemColor(value); 
}

function AxisRow({ axisKey, data }) {
  const meta = AXIS_META[axisKey];
  const Icon = meta.icon;
  const color = barColor(data.value, meta.goodIsHigh);
  const contributions = Object.entries(data.contributions || {});

  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-ink/70" strokeWidth={1.5} />
          <div>
            <div className="font-sans text-body font-medium leading-tight text-ink">{meta.title}</div>
            <div className="text-caption uppercase tracking-wide text-ink/55">{meta.subtitle}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-heading-sm font-medium leading-none" style={{ color }}>
            {data.value.toFixed(0)}%
          </div>
          <div className="mt-1 text-caption uppercase tracking-wide text-ink/55">{data.label}</div>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden bg-ink/10">
        <div
          className="spectrum-fill h-full"
          style={{ width: `${data.value}%`, backgroundColor: color }}
        />
      </div>

      {contributions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {contributions.map(([name, val]) => (
            <span key={name} className="font-mono text-caption uppercase tracking-wide text-ink/55">
              {name}{" "}
              <span className={val < 0 ? "text-ink/40" : "text-ink"}>
                {val > 0 ? "+" : ""}
                {val}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SpectrumDashboard({ analysis }) {
  if (!analysis) return null;
  const order = ["acne", "redness", "hyperpigmentation", "hydration"];
  return (
    <div className="panel">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="kicker">skin quality</h2>
        <span className="eyebrow">scored · {analysis.source}</span>
      </div>
      <div className="divide-y divide-ink/10">
        {order.map((key) => (
          <AxisRow key={key} axisKey={key} data={analysis.axes[key]} />
        ))}
      </div>
      {analysis.notes?.length > 0 && (
        <ul className="mt-4 list-inside list-disc font-sans text-caption text-ink/60">
          {analysis.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
