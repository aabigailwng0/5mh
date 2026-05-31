import React from "react";
import { Microscope, Package, Moon } from "lucide-react";
import SpectrumDashboard from "./SpectrumDashboard";
import Polaroid from "./Polaroid";
import { IngredientScore, Warnings, Schedule, Recommendations } from "./InsightsPanels";

function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Friendly labels + descriptions for the raw, interpretable CV features so the
// full report can expose the evidence behind every score.
const FEATURE_META = {
  redness_a: ["Redness a* (skin)", "CIELab red lift over neutral"],
  redness_ratio: ["Red dominance (R−G)", "share of red over green"],
  tone_unevenness: ["Tone unevenness", "spread of skin luminance"],
  dark_spot_fraction: ["Dark-spot fraction", "share of notably dark pixels"],
  texture_energy: ["Texture energy", "high-frequency roughness (dryness)"],
  specular_fraction: ["Specular glow", "glossy highlight share (hydration)"],
  spot_density: ["Spot density", "inflamed blobs per skin area (acne)"],
  skin_pixel_fraction: ["Skin coverage", "fraction of frame read as skin"],
};

function Features({ features }) {
  if (!features) return null;
  return (
    <div className="panel">
      <div className="mb-4 flex items-center gap-2">
        <Microscope className="h-4 w-4 text-black/70" strokeWidth={1.5} />
        <h3 className="text-caption uppercase tracking-[0.2em] text-black">Measured features</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(features).map(([key, val]) => {
          const [label, desc] = FEATURE_META[key] || [key, ""];
          return (
            <div key={key} className="rounded-card border border-purple-200 p-3">
              <div className="font-display text-body font-medium text-black">
                {typeof val === "number" ? val.toFixed(3) : val}
              </div>
              <div className="mt-1 text-caption uppercase tracking-wide text-black/70">{label}</div>
              <div className="text-caption text-black/45">{desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PerIngredient({ score }) {
  const rows = score?.detail?.per_ingredient || [];
  const unmatched = score?.unmatched_ingredients || [];
  if (rows.length === 0 && unmatched.length === 0) return null;
  return (
    <div className="panel">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-black/70" strokeWidth={1.5} />
        <h3 className="text-caption uppercase tracking-[0.2em] text-black">Ingredient breakdown</h3>
      </div>
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-card border border-purple-200">
          <table className="w-full text-body">
            <thead>
              <tr className="bg-purple-50 text-caption uppercase tracking-wide text-black/60">
                <th className="px-3 py-2 text-left">Ingredient</th>
                <th className="px-3 py-2 text-right">Comedogenic</th>
                <th className="px-3 py-2 text-right">Irritant</th>
                <th className="px-3 py-2 text-left">From</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-purple-100">
                  <td className="px-3 py-2 text-black">{r.ingredient}</td>
                  <td className="px-3 py-2 text-right text-black/70">{r.comedogenic}</td>
                  <td className="px-3 py-2 text-right text-black/70">{r.irritant}</td>
                  <td className="px-3 py-2 text-caption text-black/50">{r.product}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unmatched.length > 0 && (
        <p className="mt-3 text-caption text-black/50">
          <span className="uppercase tracking-wide">Unrecognised:</span> {unmatched.join(", ")}
        </p>
      )}
    </div>
  );
}

function Context({ products, lifestyle, notes, source }) {
  const hasLifestyle = lifestyle && Object.keys(lifestyle).length > 0;
  return (
    <div className="panel">
      <div className="mb-4 flex items-center gap-2">
        <Moon className="h-4 w-4 text-black/70" strokeWidth={1.5} />
        <h3 className="text-caption uppercase tracking-[0.2em] text-black">Day context</h3>
      </div>
      <div className="space-y-3 text-body">
        <div>
          <span className="text-caption uppercase tracking-wide text-black/55">Products · </span>
          {products && products.length > 0
            ? products.map((p) => p.name || p).join(", ")
            : "none logged"}
        </div>
        {hasLifestyle && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(lifestyle).map(([k, v]) => (
              <span key={k} className="rounded-rounded border border-purple-300 px-2 py-0.5 text-caption">
                {k.replace(/_/g, " ")}: {v}
              </span>
            ))}
          </div>
        )}
        {source && (
          <div className="text-caption uppercase tracking-wide text-black/45">scored using {source}</div>
        )}
        {notes && notes.length > 0 && (
          <ul className="list-inside list-disc text-caption text-black/55">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// The complete report for a single day — everything we computed, nothing hidden.
export default function ReportDetail({ report }) {
  const { result, photoThumb, lifestyle } = report;
  if (!result) return null;
  return (
    <div className="space-y-6">
      {photoThumb && (
        <Polaroid
          src={photoThumb}
          alt={`Face on ${report.date}`}
          caption={fmtDay(report.date)}
          rotate={-2}
          tape
          className="[&>.polaroid-photo]:h-40 [&>.polaroid-photo]:w-40"
        />
      )}
      <SpectrumDashboard analysis={result.analysis} />
      <Features features={result.features} />
      <IngredientScore score={result.ingredient_score} />
      <PerIngredient score={result.ingredient_score} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Warnings warnings={result.warnings} />
        <Schedule schedule={result.schedule} />
      </div>
      <Recommendations recommendations={result.recommendations} />
      <Context
        products={result.products || report.products}
        lifestyle={lifestyle}
        notes={result.analysis?.notes}
        source={result.analysis?.source}
      />
    </div>
  );
}
