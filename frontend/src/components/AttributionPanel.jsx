import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getAttribution, getHistory } from "../api";
import ImpactChart from "./ImpactChart";
import TrendChart from "./TrendChart";

const AXES = ["acne", "redness", "hyperpigmentation", "hydration"];
const LEVELS = [
  { id: "aggregate", label: "Loads" },
  { id: "ingredient", label: "Ingredients" },
];

// How much we trust the fit, mapped to a colour + copy. Mirrors the backend's
// `reliability` label so the UI never overstates a noisy, few-day regression.
const RELIABILITY = {
  exploratory: { color: "#dc5000", text: "Exploratory — early signal, treat as a hint" },
  suggestive: { color: "#a855f7", text: "Suggestive — a pattern is forming" },
  solid: { color: "#16a34a", text: "Solid — well-supported by your history" },
};

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-display text-heading-sm font-medium leading-none">{value}</div>
      <div className="mt-1 text-caption uppercase tracking-wide text-ink/55">{label}</div>
    </div>
  );
}

// Dense per-driver row (effect, CI, p-value, importance bar) — lives in the
// collapsible "Stats details" section for users who want the raw regression.
function DriverRow({ d }) {
  const raises = d.direction === "increases";
  const sign = d.effect > 0 ? "+" : "";
  const [lo, hi] = d.effect_ci;
  const fill = d.significant ? "#7c3aed" : "#c4b5fd";
  const textColor = d.significant ? "text-ink" : "text-ink/45";

  return (
    <div className="space-y-1.5 border-t border-ink/12 py-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-sans text-body font-medium ${textColor}`}>{d.label}</span>
        <span className={`whitespace-nowrap font-display text-body ${textColor}`}>
          {sign}
          {d.effect} <span className="text-caption text-ink/50">pts {raises ? "↑" : "↓"}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden bg-ink/10">
          <div
            className="spectrum-fill h-full"
            style={{ width: `${Math.round(d.importance * 100)}%`, backgroundColor: fill }}
          />
        </div>
        <span className="w-28 text-right text-caption uppercase tracking-wide text-ink/55">
          p={d.p_value}
          {d.significant ? " ✓" : ""}
        </span>
      </div>
      <div className="flex justify-between text-caption text-ink/50">
        <span className="uppercase tracking-wide">{d.unit}</span>
        <span>
          95% CI {lo} … {hi}
        </span>
      </div>
    </div>
  );
}

export default function AttributionPanel() {
  const [axis, setAxis] = useState("acne");
  const [level, setLevel] = useState("aggregate");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const run = async (nextAxis = axis, nextLevel = level) => {
    setAxis(nextAxis);
    setLevel(nextLevel);
    setLoading(true);
    try {
      const [attr, hist] = await Promise.all([
        getAttribution(nextAxis, nextLevel),
        history.length ? Promise.resolve(history) : getHistory(),
      ]);
      setResult(attr);
      setHistory(hist);
    } catch {
      setResult({ status: "error", message: "Could not run attribution." });
    } finally {
      setLoading(false);
    }
  };

  const fit = result?.fit;
  const reliability = fit && (RELIABILITY[fit.reliability] || RELIABILITY.exploratory);

  return (
    <div className="panel">
      {/* Header: kicker + axis picker (text, marked active) */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h3 className="kicker">driver attribution</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {AXES.map((a) => (
            <button
              key={a}
              onClick={() => run(a, level)}
              className={`font-mono text-caption uppercase tracking-[0.08em] transition-colors ${
                axis === a && result ? "marker text-ink" : "text-ink/45 hover:text-ink"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Level toggle as a typeset slash-switch */}
      <div className="mb-5 flex items-center gap-2 font-mono text-caption uppercase tracking-[0.08em]">
        {LEVELS.map((l, idx) => (
          <React.Fragment key={l.id}>
            {idx > 0 && <span className="text-ink/25">/</span>}
            <button
              onClick={() => run(axis, l.id)}
              className={level === l.id ? "marker text-ink" : "text-ink/45 hover:text-ink"}
            >
              {l.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {!result && (
        <p className="font-sans text-body text-ink/60">
          See what's driving your skin over time and which factors matter most (needs ~10 logged
          days). Switch between aggregate <span className="text-ink">loads</span> and individual{" "}
          <span className="text-ink">ingredients</span>.
        </p>
      )}
      {loading && <p className="font-sans text-body italic text-ink/60">Crunching the regression…</p>}

      {result?.status === "insufficient_data" && (
        <p className="font-sans text-body text-ink/60">{result.message}</p>
      )}
      {result?.status === "no_target" && <p className="font-sans text-body text-ink/60">{result.message}</p>}
      {result?.status === "error" && <p className="font-sans text-body text-purple-700">{result.message}</p>}

      {result?.status === "ok" && (
        <div className="space-y-6">
          {/* Reliability badge */}
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: reliability.color }} />
            <span className="text-caption uppercase tracking-wide" style={{ color: reliability.color }}>
              {fit.reliability}
            </span>
            <span className="text-caption text-black/55">· {reliability.text}</span>
          </div>

          {/* Punchline */}
          <ul className="space-y-1.5">
            {result.narrative.map((line, i) => (
              <li key={i} className="font-display text-subheading italic leading-snug text-ink/80">
                {line}
              </li>
            ))}
          </ul>

          {/* PRIMARY VISUALS */}
          <ImpactChart drivers={result.drivers} axis={axis} />

          <div>
            <h4 className="kicker mb-3">over time</h4>
            <TrendChart history={history} axis={axis} drivers={result.drivers} />
          </div>

          {/* Collapsible dense stats ("dev mode") */}
          <div className="border-t border-ink/15 pt-3">
            <button
              onClick={() => setShowStats((s) => !s)}
              className="flex items-center gap-1.5 font-mono text-caption uppercase tracking-wide text-ink/55 hover:text-ink"
            >
              {showStats ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Stats details
            </button>

            {showStats && (
              <div className="mt-4 space-y-5">
                {/* Honest fit summary: CV R² headline, in-sample for contrast */}
                <div className="grid grid-cols-4 gap-3 border-y border-ink/15 py-4">
                  <Stat label="CV R²" value={fit.r2_cv_mean} />
                  <Stat label="in-sample R²" value={fit.r2_in_sample} />
                  <Stat label="days" value={result.entries} />
                  <Stat label="drivers" value={fit.n_features} />
                </div>

                <div>
                  {result.drivers.slice(0, 12).map((d) => (
                    <DriverRow key={d.driver} d={d} />
                  ))}
                </div>

                {result.caveats?.length > 0 && (
                  <ul className="list-inside list-disc space-y-1 border-t border-ink/15 pt-4 text-caption text-ink/50">
                    {result.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
