import React from "react";
import { AlertTriangle, Sun, Moon, Lightbulb, FlaskConical } from "lucide-react";

// Severity → warm hairline treatment. High clashes get the burnt-sienna edge.
const SEVERITY_STYLE = {
  high: "border-burnt-sienna",
  moderate: "border-warm-cream/60",
  low: "border-cork-shadow",
};
const SEVERITY_TEXT = {
  high: "text-burnt-sienna",
  moderate: "text-warm-cream",
  low: "text-grey-brown",
};

function SectionLabel({ icon: Icon, children, accent }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${accent || "text-warm-cream/70"}`} strokeWidth={1.5} />
      <h3 className="text-caption uppercase tracking-[0.2em] text-grey-brown">{children}</h3>
    </div>
  );
}

export function IngredientScore({ score }) {
  if (!score) return null;
  const items = [
    { label: "Comedogenic load", value: score.comedogenic_load, hint: "→ acne axis" },
    { label: "Irritant load", value: score.irritant_load, hint: "→ redness axis" },
    {
      label: "Active clash",
      value: score.active_interaction_flag ? "Yes" : "No",
      hint: "same-day stack",
    },
  ];
  return (
    <div className="panel">
      <SectionLabel icon={FlaskConical}>Ingredient load (from your products)</SectionLabel>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-card border border-cork-shadow bg-cork-shadow">
        {items.map((it) => (
          <div key={it.label} className="bg-studio-black p-4 text-center">
            <div className="font-display text-heading-sm font-medium text-warm-cream">
              {it.value}
            </div>
            <div className="mt-1 text-caption uppercase tracking-wide text-warm-cream/80">
              {it.label}
            </div>
            <div className="text-caption text-grey-brown">{it.hint}</div>
          </div>
        ))}
      </div>
      {score.matched_ingredients?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {score.matched_ingredients.map((m) => (
            <span
              key={m}
              className="rounded-rounded border border-cork-shadow px-2 py-0.5 text-caption text-warm-cream/70"
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
      <SectionLabel icon={AlertTriangle} accent="text-burnt-sienna">
        Interaction warnings
      </SectionLabel>
      {warnings.length === 0 ? (
        <p className="text-body text-warm-cream/40">No clashing ingredients detected today.</p>
      ) : (
        <div className="space-y-3">
          {warnings.map((w, i) => (
            <div key={i} className={`rounded-card border ${SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.low} p-3`}>
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-warm-cream">
                  {w.ingredient_a} + {w.ingredient_b}
                </span>
                <span
                  className={`text-caption uppercase tracking-wide ${SEVERITY_TEXT[w.severity] || SEVERITY_TEXT.low}`}
                >
                  {w.severity}
                </span>
              </div>
              <p className="mt-1 text-body text-warm-cream/70">{w.problem}</p>
              {w.recommendation && (
                <p className="mt-1 text-caption italic text-warm-cream/50">Fix: {w.recommendation}</p>
              )}
              {w.products_involved?.length > 0 && (
                <p className="mt-1 text-caption uppercase tracking-wide text-grey-brown">
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
      <div className="mb-3 flex items-center gap-2 text-warm-cream/80">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-caption uppercase tracking-[0.2em]">{title}</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-caption text-grey-brown">Nothing scheduled.</p>
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
      <SectionLabel icon={Lightbulb} accent="text-burnt-sienna">
        Recommendations
      </SectionLabel>
      <div className="space-y-3">
        {recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-caption uppercase tracking-wide ${
                r.kind === "product"
                  ? "border-burnt-sienna text-burnt-sienna"
                  : "border-cork-shadow text-warm-cream/70"
              }`}
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
