import React from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

// At most three plain-English, prioritised actions — the "so what do I do?"
// answer. Tone drives the icon + accent colour.
const TONE = {
  good: { icon: CheckCircle2, color: "#16a34a" },
  warn: { icon: AlertTriangle, color: "#dc5000" },
  info: { icon: Info, color: "#7c3aed" },
};

export default function ActionList({ actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="panel">
      <h3 className="mb-4 text-caption uppercase tracking-[0.2em] text-black/70">What to do</h3>
      <ul className="space-y-3">
        {actions.map((a, i) => {
          const tone = TONE[a.tone] || TONE.info;
          const Icon = tone.icon;
          return (
            <li key={i} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tone.color }} strokeWidth={1.75} />
              <span className="text-body text-black/85">{a.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
