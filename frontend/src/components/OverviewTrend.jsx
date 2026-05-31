import React, { useState } from "react";
import { overallHealth } from "../lib/insights";

// Geometry (fixed viewBox, scaled responsively by CSS).
const W = 560;
const H = 230;
const PAD = { left: 30, right: 14, top: 14, bottom: 28 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// The unified score is bold; the four contributing axes are thinner context lines
// in their dashboard colours. All share the 0–100 scale.
const SERIES = [
  { key: "overall", label: "Skin health", color: "#7c3aed", width: 3, dots: true },
  { key: "acne", label: "Acne", color: "#ef4444", width: 1.5 },
  { key: "redness", label: "Redness", color: "#f97316", width: 1.5 },
  { key: "hyperpigmentation", label: "Pigmentation", color: "#d946ef", width: 1.5 },
  { key: "hydration", label: "Hydration", color: "#06b6d4", width: 1.5 },
];

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function xAt(i, n) {
  if (n <= 1) return PAD.left + PLOT_W / 2;
  return PAD.left + (i / (n - 1)) * PLOT_W;
}

// One unified time-series: the overall 0–100 score synthesised from the four
// axes, drawn over those same four axes for context. Legend toggles each line.
export default function OverviewTrend({ reports }) {
  const [hidden, setHidden] = useState({});

  // Oldest → newest, keeping only days that actually have a reading.
  const days = [...reports]
    .filter((r) => r.result?.analysis?.axes)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => {
      const axes = r.result.analysis.axes;
      return {
        date: r.date,
        overall: overallHealth(axes),
        acne: axes.acne?.value ?? null,
        redness: axes.redness?.value ?? null,
        hyperpigmentation: axes.hyperpigmentation?.value ?? null,
        hydration: axes.hydration?.value ?? null,
      };
    });

  if (days.length < 2) {
    return (
      <div className="panel">
        <h3 className="mb-2 text-caption uppercase tracking-[0.2em] text-black/70">Overall trend</h3>
        <p className="text-body text-black/55">
          Log at least two days to see your overall skin-health trend.
        </p>
      </div>
    );
  }

  const n = days.length;
  const y = (v) => PAD.top + (1 - v / 100) * PLOT_H;
  const pathFor = (key) =>
    days
      .filter((d) => d[key] != null)
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(days.indexOf(d), n)} ${y(d[key])}`)
      .join(" ");

  const latest = days[n - 1];

  return (
    <div className="panel">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-caption uppercase tracking-[0.2em] text-black/70">Overall trend</h3>
        <span className="text-caption uppercase tracking-wide text-black/50">
          now {latest.overall}/100 · {n} days
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Overall skin health over time">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.left} y1={y(g)} x2={W - PAD.right} y2={y(g)} stroke="#00000010" />
            <text x={PAD.left - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#00000066">
              {g}
            </text>
          </g>
        ))}

        {SERIES.map((s) => {
          if (hidden[s.key]) return null;
          return (
            <g key={s.key}>
              <path d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={s.width} opacity={s.key === "overall" ? 1 : 0.55} />
              {s.dots &&
                days.map((d, i) =>
                  d[s.key] == null ? null : (
                    <circle key={i} cx={xAt(i, n)} cy={y(d[s.key])} r="3" fill={s.color} />
                  )
                )}
            </g>
          );
        })}

        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={xAt(i, n)} y={H - 8} textAnchor="middle" fontSize="9" fill="#00000066">
            {fmtDate(days[i].date)}
          </text>
        ))}
      </svg>

      {/* Clickable legend toggles each line */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
            className={`flex items-center gap-1.5 text-caption uppercase tracking-wide transition-opacity ${
              hidden[s.key] ? "opacity-35" : "opacity-100"
            }`}
          >
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: s.color, height: s.key === "overall" ? 3 : 2 }}
            />
            <span className="text-black/65">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
