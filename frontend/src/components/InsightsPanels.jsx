import React from "react";
import { AlertTriangle, Sun, Moon, Lightbulb, FlaskConical } from "lucide-react";

// Severity → purple hairline treatment. High severity gets the purple edge.
const SEVERITY_STYLE = {
  high: "border-purple-600",
  moderate: "border-purple-400",
  low: "border-purple-200",
};
const SEVERITY_TEXT = {
  high: "text-purple-600",
  moderate: "text-black",
  low: "text-black/60",
};

function SectionLabel({ icon: Icon, children, accent }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${accent || "text-black/70"}`} strokeWidth={1.5} />
      <h3 className="text-caption uppercase tracking-[0.2em] text-black">{children}</h3>
    </div>
  );
}

export function IngredientScore({ score }) {
  if (!score) return null;
  const items = [
    { label: "Comedogenic load", value: score.comedogenic_load, hint: "Pore Clogging Weight" },
    { label: "Irritant load", value: score.irritant_load, hint: "Irritation Weight" },
    {
      label: "Active clash",
      value: score.active_interaction_flag ? "Yes" : "No",
      hint: "same-day stack",
    },
  ];
  return (
    <div className="panel">
      <SectionLabel icon={FlaskConical}>Ingredient load (from your products)</SectionLabel>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-card border border-purple-400 bg-purple-300">
        {items.map((it) => (
          <div key={it.label} className="bg-studio-black p-4 text-center">
            <div className="font-display text-heading-sm font-medium text-black">
              {it.value}
            </div>
            <div className="mt-1 text-caption uppercase tracking-wide text-black/80">
              {it.label}
            </div>
            <div className="text-caption text-black/60">{it.hint}</div>
          </div>
        ))}
      </div>
      {score.matched_ingredients?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {score.matched_ingredients.map((m) => (
            <span
              key={m}
              className="rounded-rounded border border-purple-300 px-2 py-0.5 text-caption text-black/70"
            >
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
      <SectionLabel icon={AlertTriangle} accent="text-black">
        Interaction warnings
      </SectionLabel>
      {warnings.length === 0 ? (
        <p className="text-body text-black/40">No clashing ingredients detected today.</p>
      ) : (
        <div className="space-y-3">
          {warnings.map((w, i) => (
            <div key={i} className={`rounded-card border ${SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.low} p-3`}>
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-black">
                  {w.ingredient_a} + {w.ingredient_b}
                </span>
                <span
                  className={`text-caption uppercase tracking-wide ${SEVERITY_TEXT[w.severity] || SEVERITY_TEXT.low}`}
                >
                  {w.severity}
                </span>
              </div>
              <p className="mt-1 text-body text-black/70">{w.problem}</p>
              {w.recommendation && (
                <p className="mt-1 text-caption italic text-black/50">Fix: {w.recommendation}</p>
              )}
              {w.products_involved?.length > 0 && (
                <p className="mt-1 text-caption uppercase tracking-wide text-black/60">
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
      <div className="mb-3 flex items-center gap-2 text-black/80">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-caption uppercase tracking-[0.2em]">{title}</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-caption text-black/60">Nothing scheduled.</p>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-burnt-sienna text-caption text-burnt-sienna">
                {i + 1}
              </span>
              <div>
                <div className="text-body text-warm-cream">{s.product_name}</div>
                <div className="text-caption text-grey-brown">{s.note}</div>
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
      <SectionLabel icon={Sun}>Daily routine</SectionLabel>
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
      <SectionLabel icon={Lightbulb} accent="text-black">
        Recommendations
      </SectionLabel>
      <div className="space-y-3">
        {recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="mt-0.5 shrink-0 w-24 text-center rounded-full border border-purple-600 bg-purple-50 px-2 py-0.5 text-caption uppercase tracking-wide text-black"
              >
              {r.kind}
            </span>
            <div>
              <div className="text-body font-medium text-warm-cream">{r.title}</div>
              <div className="text-caption text-grey-brown">{r.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
