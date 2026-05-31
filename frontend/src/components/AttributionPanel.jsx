import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import { getAttribution } from "../api";

const AXES = ["acne", "redness", "hyperpigmentation", "hydration"];

// Stretch feature: once enough days are logged, decompose an axis into its
// lagged drivers. Surfaces the linear coefficients — the "coefficients are the
// product" idea — plus a plain-English narrative.
export default function AttributionPanel() {
  const [axis, setAxis] = useState("acne");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async (a) => {
    setAxis(a);
    setLoading(true);
    try {
      setResult(await getAttribution(a));
    } catch {
      setResult({ status: "error", message: "Could not run attribution." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-warm-cream/70" strokeWidth={1.5} />
          <h3 className="text-caption uppercase tracking-[0.2em] text-grey-brown">
            Driver attribution
          </h3>
        </div>
        <div className="flex gap-2">
          {AXES.map((a) => (
            <button
              key={a}
              onClick={() => run(a)}
              className={`rounded-rounded border px-2.5 py-1 text-caption uppercase tracking-wide transition-colors ${
                axis === a && result
                  ? "border-burnt-sienna text-burnt-sienna"
                  : "border-cork-shadow text-grey-brown hover:border-warm-cream/60"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {!result && (
        <p className="text-body text-warm-cream/50">
          Pick an axis to decompose your skin changes into likely drivers (needs ~10 logged days).
        </p>
      )}
      {loading && <p className="text-body text-grey-brown">Crunching the regression…</p>}

      {result?.status === "insufficient_data" && (
        <p className="text-body text-warm-cream/60">{result.message}</p>
      )}
      {result?.status === "error" && <p className="text-body text-burnt-sienna">{result.message}</p>}

      {result?.status === "ok" && (
        <div>
          <div className="mb-3 text-caption uppercase tracking-wide text-grey-brown">
            Fit R² = {result.r2} · {result.entries} days · max lag {result.max_lag}
          </div>
          <ul className="mb-4 space-y-1.5">
            {result.narrative.map((line, i) => (
              <li key={i} className="text-body text-warm-cream/80">
                — {line}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            {result.drivers.slice(0, 6).map((d, i) => {
              const mag = Math.min(100, Math.abs(d.coefficient) * 18);
              const pos = d.coefficient > 0;
              return (
                <div key={i} className="flex items-center gap-3 text-caption">
                  <span className="w-44 truncate uppercase tracking-wide text-grey-brown">
                    {d.driver}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-cork-shadow">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${mag}%`, backgroundColor: pos ? "#dc5000" : "#6c5f51" }}
                    />
                  </div>
                  <span className={`w-12 text-right ${pos ? "text-burnt-sienna" : "text-warm-cream/60"}`}>
                    {d.coefficient}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
