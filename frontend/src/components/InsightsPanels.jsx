import React from "react";
import { AlertTriangle, Sun, Moon, Lightbulb, FlaskConical } from "lucide-react";

// Severity → ink-edge treatment. Higher severity carries the purple accent.
const SEVERITY_STYLE = {
  high: "border-purple-600",
  moderate: "border-ink/40",
  low: "border-ink/20",
};
const SEVERITY_TEXT = {
  high: "text-purple-700",
  moderate: "text-ink",
  low: "text-ink/60",
};

// Editorial section header: a small icon beside a serif italic kicker.
function SectionLabel({ icon: Icon, children, accent }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${accent || "text-ink/60"}`} strokeWidth={1.5} />
      <h3 className="kicker">{children}</h3>
    </div>
  );
}

export function IngredientScore({ score }) {
  if (!score) return null;
  const items = [
    { label: "Comedogenic load", value: score.comedogenic_load, hint: "pore-clogging weight" },
    { label: "Irritant load", value: score.irritant_load, hint: "irritation weight" },
    {
      label: "Active clash",
      value: score.active_interaction_flag ? "Yes" : "No",
      hint: "same-day stack",
    },
  ];
  return (
    <div className="panel">
      <SectionLabel icon={FlaskConical}>ingredient load</SectionLabel>
      <div className="grid grid-cols-3 divide-x divide-ink/12">
        {items.map((it, i) => (
          <div key={it.label} className={`text-center ${i === 0 ? "pr-4" : "px-4"}`}>
            <div className="font-display text-heading-sm font-medium text-ink">{it.value}</div>
            <div className="mt-1 text-caption uppercase tracking-wide text-ink/75">{it.label}</div>
            <div className="font-sans text-caption text-ink/50">{it.hint}</div>
          </div>
        ))}
      </div>
      {score.matched_ingredients?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5">
          {score.matched_ingredients.map((m) => (
            <span key={m} className="filing-tag">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Warnings({ warnings }) {
  if (!warnings) return null;
  return (
    <div className="panel">
      <SectionLabel icon={AlertTriangle} accent="text-ink">
        interaction warnings
      </SectionLabel>
      {warnings.length === 0 ? (
        <p className="font-display text-body italic text-ink/45">
          No clashing ingredients detected today.
        </p>
      ) : (
        <div className="space-y-3">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`border-l-2 ${SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.low} pl-3`}
            >
              <div className="flex items-center justify-between">
                <span className="font-sans text-body font-medium text-ink">
                  {w.ingredient_a} + {w.ingredient_b}
                </span>
                <span
                  className={`text-caption uppercase tracking-wide ${SEVERITY_TEXT[w.severity] || SEVERITY_TEXT.low}`}
                >
                  {w.severity}
                </span>
              </div>
              <p className="mt-1 font-sans text-body text-ink/70">{w.problem}</p>
              {w.recommendation && (
                <p className="mt-1 font-display text-caption italic text-ink/50">Fix: {w.recommendation}</p>
              )}
              {w.products_involved?.length > 0 && (
                <p className="mt-1 font-mono text-caption uppercase tracking-wide text-ink/55">
                  From: {w.products_involved.join(" + ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineColumn({ title, icon: Icon, steps }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-ink/75">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        <span className="font-mono text-caption uppercase tracking-[0.18em]">{title}</span>
      </div>
      {steps.length === 0 ? (
        <p className="font-display text-caption italic text-ink/55">Nothing scheduled.</p>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-purple-600 font-mono text-caption text-purple-700">
                {i + 1}
              </span>
              <div>
                <div className="font-sans text-body text-ink">{s.product_name}</div>
                <div className="font-sans text-caption text-ink/55">{s.note}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Schedule({ schedule }) {
  if (!schedule) return null;
  return (
    <div className="panel">
      <SectionLabel icon={Sun}>daily routine</SectionLabel>
      <div className="grid grid-cols-2 gap-5">
        <RoutineColumn title="Morning" icon={Sun} steps={schedule.am} />
        <RoutineColumn title="Evening" icon={Moon} steps={schedule.pm} />
      </div>
    </div>
  );
}

export function Recommendations({ recommendations }) {
  if (!recommendations) return null;
  return (
    <div className="panel">
      <SectionLabel icon={Lightbulb} accent="text-ink">
        recommendations
      </SectionLabel>
      <div className="space-y-3">
        {recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-0.5 w-24 shrink-0 border border-purple-600 bg-purple-50 px-2 py-0.5 text-center font-mono text-caption uppercase tracking-wide text-purple-800">
              {r.kind}
            </span>
            <div>
              <div className="font-sans text-body font-medium text-ink">{r.title}</div>
              <div className="font-sans text-caption text-ink/55">{r.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
