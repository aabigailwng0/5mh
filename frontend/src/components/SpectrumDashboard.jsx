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
    subtitle: "inflamed breakout activity",
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

function barColor(value, goodIsHigh) {
  const severity = (goodIsHigh ? 100 - value : value) / 100; // 0 calm -> 1 hot
  return lerpHex("6c5f51", "dc5000", Math.max(0, Math.min(1, severity)));
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
          <Icon className="h-4 w-4 text-warm-cream/70" strokeWidth={1.5} />
          <div>
            <div className="text-body font-medium leading-tight text-warm-cream">{meta.title}</div>
            <div className="text-caption uppercase tracking-wide text-grey-brown">
              {meta.subtitle}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-heading-sm font-medium" style={{ color }}>
            {data.value.toFixed(0)}%
          </div>
          <div className="text-caption uppercase tracking-wide text-grey-brown">{data.label}</div>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cork-shadow">
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
              <span className={val < 0 ? "text-warm-cream/50" : "text-warm-cream"}>
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
        <h2 className="font-display text-heading-sm font-medium tracking-tight">Skin spectrum</h2>
        <span className="text-caption uppercase tracking-[0.18em] text-grey-brown">
          scored from: {analysis.source}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {order.map((key) => (
          <AxisCard key={key} axisKey={key} data={analysis.axes[key]} />
        ))}
      </div>
      {analysis.notes?.length > 0 && (
        <ul className="mt-4 list-inside list-disc text-caption text-grey-brown">
          {analysis.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
