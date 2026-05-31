import React from "react";

// Colour language: a factor either pushes the axis UP (warm terracotta) or
// DOWN (muted sage). Significant factors are saturated; uncertain ones fade.
const UP = "#b1402f";
const DOWN = "#3f6b63";

// "Most impactful factors" — a diverging bar chart centred on zero. Bar length is
// the driver's relative importance; side/colour is the direction it moves the axis.
// This is the at-a-glance answer to "what is actually moving my skin?".
export default function ImpactChart({ drivers, axis }) {
  // Rank purely by impact for this view and keep the few that actually register.
  const top = [...drivers]
    .filter((d) => d.importance > 0.04)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6);

  if (top.length === 0) {
    return (
      <p className="font-display text-body italic text-ink/55">
        No factor is moving your {axis} enough to chart yet — keep logging.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between font-mono text-caption uppercase tracking-wide text-ink/55">
        <span style={{ color: DOWN }}>↓ lowers {axis}</span>
        <span className="text-ink/35">most impactful factors</span>
        <span style={{ color: UP }}>raises {axis} ↑</span>
      </div>

      <div className="space-y-2.5">
        {top.map((d) => {
          const raises = d.direction === "increases";
          const color = raises ? UP : DOWN;
          const half = Math.max(4, Math.round(d.importance * 48)); // % of full width
          const sign = d.effect > 0 ? "+" : "";
          return (
            <div key={d.driver} className="flex items-center gap-3">
              {/* Factor name + timing */}
              <div className="w-40 shrink-0 text-right">
                <div className={`truncate font-sans text-body ${d.significant ? "text-ink" : "text-ink/45"}`}>
                  {d.name}
                </div>
                <div className="font-mono text-caption uppercase tracking-wide text-ink/40">{d.when}</div>
              </div>

              {/* Diverging bar around a centre line */}
              <div className="relative h-5 flex-1">
                <div className="absolute left-1/2 top-0 h-full w-px bg-ink/20" />
                <div
                  className="spectrum-fill absolute top-1/2 h-3 -translate-y-1/2"
                  style={{
                    backgroundColor: color,
                    opacity: d.significant ? 1 : 0.4,
                    width: `${half}%`,
                    left: raises ? "50%" : `${50 - half}%`,
                  }}
                />
              </div>

              {/* Real-units effect */}
              <div className="w-20 shrink-0 text-right">
                <span className={`font-display text-body ${d.significant ? "text-ink" : "text-ink/45"}`}>
                  {sign}
                  {d.effect}
                </span>
                <span className="text-caption text-ink/45"> pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
