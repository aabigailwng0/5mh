import React from "react";

// SVG canvas geometry (drawn in a fixed viewBox, scaled responsively by CSS).
const W = 540;
const H = 200;
const PAD = { left: 30, right: 14, top: 14, bottom: 28 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const AXIS_COLOR = "#161412"; // the skin-axis trend line (bold ink)
const LOAD_COLOR = "#7c3aed"; // the relevant ingredient load (purple accent, dashed)

// Which aggregate load is most relevant to overlay for a given axis.
const LOAD_FOR_AXIS = {
  acne: "comedogenic_load",
  redness: "irritant_load",
  hyperpigmentation: "comedogenic_load",
  hydration: "irritant_load",
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function xAt(i, n) {
  if (n <= 1) return PAD.left + PLOT_W / 2;
  return PAD.left + (i / (n - 1)) * PLOT_W;
}

// Pick up to two ingredients to show usage strips for: prefer the most impactful
// ingredient drivers; otherwise fall back to whichever ingredients vary the most
// across the logged days (so the chart is useful even in aggregate mode).
function pickIngredients(history, drivers) {
  const fromDrivers = drivers
    .filter((d) => d.kind === "ingredient" && d.ingredient)
    .sort((a, b) => b.importance - a.importance)
    .map((d) => d.ingredient);
  const unique = [...new Set(fromDrivers)];
  if (unique.length > 0) return unique.slice(0, 2);

  // Fallback: ingredients used on some-but-not-all days (highest variability).
  const counts = {};
  history.forEach((e) => {
    (e.ingredient_score?.matched_ingredients || []).forEach((n) => {
      counts[n] = (counts[n] || 0) + 1;
    });
  });
  const n = history.length;
  return Object.entries(counts)
    .filter(([, c]) => c > 0 && c < n)
    .sort((a, b) => Math.abs(n / 2 - a[1]) - Math.abs(n / 2 - b[1]))
    .slice(0, 2)
    .map(([name]) => name);
}

// Trend over time: the selected skin axis (primary line) against the relevant
// ingredient load (secondary line) and per-day usage strips for key ingredients.
export default function TrendChart({ history, axis, drivers = [] }) {
  // Keep only days that actually have a reading for this axis.
  const points = history
    .map((e) => ({
      date: e.entry_date,
      value: e.analysis?.axes?.[axis]?.value ?? null,
      load: e.ingredient_score?.[LOAD_FOR_AXIS[axis]] ?? null,
      used: new Set(e.ingredient_score?.matched_ingredients || []),
    }))
    .filter((p) => p.value !== null);

  if (points.length < 2) {
    return (
      <p className="font-display text-body italic text-ink/55">
        Log at least two days to see your {axis} trend over time.
      </p>
    );
  }

  const n = points.length;
  const yAxis = (v) => PAD.top + (1 - v / 100) * PLOT_H;

  // Secondary axis: scale the load to its own observed range.
  const loads = points.map((p) => p.load).filter((v) => v !== null);
  const loadMax = loads.length ? Math.max(...loads) : 0;
  const loadMin = loads.length ? Math.min(...loads) : 0;
  const yLoad = (v) =>
    loadMax === loadMin ? PAD.top + PLOT_H / 2 : PAD.top + (1 - (v - loadMin) / (loadMax - loadMin)) * PLOT_H;

  const axisPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i, n)} ${yAxis(p.value)}`).join(" ");
  const loadPath = loads.length
    ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i, n)} ${yLoad(p.load ?? loadMin)}`).join(" ")
    : null;

  const ingredients = pickIngredients(history, drivers);
  const stripColors = ["#7c3aed", "#bd7a2c"];

  return (
    <div>
      <div className="graph-paper border border-ink/10 px-1 py-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${axis} over time`}>
          {/* Horizontal gridlines at 0 / 50 / 100 */}
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line
                x1={PAD.left}
                y1={yAxis(g)}
                x2={W - PAD.right}
                y2={yAxis(g)}
                stroke="#16141233"
                strokeDasharray="1 4"
              />
              <text
                x={PAD.left - 6}
                y={yAxis(g) + 3}
                textAnchor="end"
                fontSize="9"
                fill="#16141288"
                fontFamily="'Space Mono', monospace"
              >
                {g}
              </text>
            </g>
          ))}

          {/* Secondary: relevant load (dashed) */}
          {loadPath && (
            <path
              d={loadPath}
              fill="none"
              stroke={LOAD_COLOR}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.7"
              style={{ filter: "url(#sketch)" }}
            />
          )}

          {/* Primary: the skin-axis trend */}
          <path
            d={axisPath}
            fill="none"
            stroke={AXIS_COLOR}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: "url(#sketch)" }}
          />
          {points.map((p, i) => (
            <circle key={i} cx={xAt(i, n)} cy={yAxis(p.value)} r="2.4" fill={AXIS_COLOR} />
          ))}

          {/* X labels: first, middle, last date */}
          {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
            <text
              key={i}
              x={xAt(i, n)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#16141288"
              fontFamily="'Space Mono', monospace"
            >
              {fmtDate(points[i].date)}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-caption uppercase tracking-wide text-ink/55">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: AXIS_COLOR }} />
          {axis}
        </span>
        {loadPath && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t border-dashed" style={{ borderColor: LOAD_COLOR }} />
            {LOAD_FOR_AXIS[axis].replace("_", " ")}
          </span>
        )}
      </div>

      {/* Per-day ingredient usage strips, aligned under the chart */}
      {ingredients.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {ingredients.map((name, idx) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate font-mono text-caption uppercase tracking-wide text-ink/55">
                {name}
              </span>
              <div className="flex flex-1 gap-0.5">
                {points.map((p, i) => (
                  <div
                    key={i}
                    title={`${fmtDate(p.date)} · ${p.used.has(name) ? "used" : "not used"}`}
                    className="h-3 flex-1"
                    style={{
                      backgroundColor: p.used.has(name) ? stripColors[idx % 2] : "#16141212",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
