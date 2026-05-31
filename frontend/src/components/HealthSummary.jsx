import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Headline overall skin-health score (0–100, higher = better) plus a
// day-over-day indicator: "improved 5 vs last scan (May 30)".
export default function HealthSummary({ delta, previousDate }) {
  if (!delta) return null;
  const { score, delta: change } = delta;
  const improved = change != null && change > 0;
  const worsened = change != null && change < 0;
  const color = improved ? "#16a34a" : worsened ? "#dc5000" : "#6b7280";
  const Icon = improved ? ArrowUpRight : worsened ? ArrowDownRight : Minus;

  return (
    <div className="panel flex items-end justify-between">
      <div>
        <div className="kicker">skin health</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-display font-medium leading-none">{score}</span>
          <span className="font-display text-subheading italic text-ink/40">/100</span>
        </div>
      </div>

      <div className="text-right">
        {change == null ? (
          <span className="font-display text-body italic text-ink/50">
            first scan — no comparison yet
          </span>
        ) : (
          <>
            <div className="flex items-center justify-end gap-1" style={{ color }}>
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span className="font-display text-heading-sm font-medium">
                {change > 0 ? "+" : ""}
                {change}
              </span>
            </div>
            <div className="mt-1 text-caption uppercase tracking-wide text-ink/50">
              {improved ? "improved" : worsened ? "down" : "no change"}
              {previousDate ? ` vs ${fmtDate(previousDate)}` : " vs last scan"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
