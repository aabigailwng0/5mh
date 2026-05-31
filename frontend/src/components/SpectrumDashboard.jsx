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

function AxisCard({ axisKey, data }) {
  const meta = AXIS_META[axisKey];
  const Icon = meta.icon;
  const color = barColor(data.value, meta.goodIsHigh);
  const contributions = Object.entries(data.contributions || {});

  return (
    <div className="panel">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-black/70" strokeWidth={1.5} />
          <div>
            <div className="text-body font-medium leading-tight text-black">{meta.title}</div>
            <div className="text-caption uppercase tracking-wide text-black/60">
              {meta.subtitle}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-heading-sm font-medium" style={{ color }}>
            {data.value.toFixed(0)}%
          </div>
          <div className="text-caption uppercase tracking-wide text-black/60">{data.label}</div>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-purple-200">
        <div
          className="spectrum-fill h-full rounded-full"
          style={{ width: `${data.value}%`, backgroundColor: color }}
        />
      </div>

      {contributions.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {contributions.map(([name, val]) => (
            <div
              key={name}
              className="flex items-center justify-between text-caption uppercase tracking-wide"
            >
              <span className="text-grey-brown">{name}</span>
              <span className={val < 0 ? "text-black/50" : "text-black"}>
                {val > 0 ? "+" : ""}
                {val}
              </span>
            </div>
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-heading-sm font-medium tracking-tight">Skin Quality</h2>
        <span className="text-caption uppercase tracking-[0.18em] text-black/60">
          scored using {analysis.source}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {order.map((key) => (
          <AxisCard key={key} axisKey={key} data={analysis.axes[key]} />
        ))}
      </div>
      {analysis.notes?.length > 0 && (
        <ul className="mt-4 list-inside list-disc text-caption text-black/60">
          {analysis.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
