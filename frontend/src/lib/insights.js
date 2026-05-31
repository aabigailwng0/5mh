// Pure helpers that turn a raw analysis result into the few human-facing numbers
// and sentences the main page shows: an overall skin-health score, day-over-day
// deltas, and up to three prioritised, actionable recommendations.

export const AXIS_TITLES = {
  acne: "Acne",
  redness: "Redness",
  hyperpigmentation: "Hyperpigmentation",
  hydration: "Hydration",
};

// Problem axes are "lower is better"; hydration is "higher is better". We fold
// all four into a single 0–100 "skin health" score (higher = better) by
// inverting the problem axes.
const PROBLEM_AXES = ["acne", "redness", "hyperpigmentation"];

export function overallHealth(axes) {
  if (!axes) return null;
  const parts = [];
  PROBLEM_AXES.forEach((k) => {
    if (axes[k]) parts.push(100 - axes[k].value);
  });
  if (axes.hydration) parts.push(axes.hydration.value);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

// Signed change for one axis, expressed as "improvement" (positive = better),
// so a drop in acne and a rise in hydration both read as positive.
export function axisImprovement(axisKey, current, previous) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  return axisKey === "hydration" ? delta : -delta;
}

// Build the day-over-day comparison block for the header indicator.
export function healthDelta(currentAxes, previousAxes) {
  const today = overallHealth(currentAxes);
  const prev = overallHealth(previousAxes);
  if (today == null) return null;
  if (prev == null) return { score: today, delta: null };
  return { score: today, delta: today - prev };
}

// Up to three prioritised actions. Priority: clashes > a flaring axis >
// lifestyle nudge > top recommendation, with a positive fallback.
export function deriveActions(result, { lifestyle = {} } = {}) {
  if (!result) return [];
  const actions = [];
  const axes = result.analysis?.axes || {};

  // 1. Ingredient clashes — the most urgent "stop doing X".
  const seriousWarnings = (result.warnings || []).filter(
    (w) => w.severity === "high" || w.severity === "moderate"
  );
  if (seriousWarnings.length > 0) {
    const w = seriousWarnings[0];
    actions.push({
      tone: "warn",
      text: `Stop combining ${w.ingredient_a} and ${w.ingredient_b} — ${
        w.recommendation || w.problem
      }`,
    });
  }

  // 2. The single worst flaring problem axis (moderate or severe).
  const worst = PROBLEM_AXES.map((k) => axes[k])
    .filter((a) => a && a.value >= 50)
    .sort((a, b) => b.value - a.value)[0];
  if (worst) {
    const rec = (result.recommendations || []).find((r) => r.target_axis === worst.axis);
    actions.push({
      tone: "warn",
      text: rec
        ? `Your ${AXIS_TITLES[worst.axis]?.toLowerCase()} is ${worst.label} — try ${rec.title.toLowerCase()} (${rec.reason.toLowerCase()})`
        : `Your ${AXIS_TITLES[worst.axis]?.toLowerCase()} is ${worst.label} — prioritise calming it this week`,
    });
  }

  // 3. Dryness / hydration support.
  if (axes.hydration && axes.hydration.value < 40 && actions.length < 3) {
    actions.push({
      tone: "warn",
      text: `Skin is reading ${axes.hydration.label} — add a hydrating layer (e.g. hyaluronic acid) morning and night`,
    });
  }

  // 4. Lifestyle nudge from what was logged today.
  const sleep = parseFloat(lifestyle.sleep_hours);
  if (!Number.isNaN(sleep) && sleep < 7 && actions.length < 3) {
    actions.push({
      tone: "info",
      text: `Aim for more sleep — you logged ${sleep}h (7–9h supports skin repair)`,
    });
  }

  // 5. A beneficial recommendation, if we still have room.
  const rec = (result.recommendations || [])[0];
  if (rec && actions.length < 3) {
    actions.push({ tone: "info", text: `Consider ${rec.title} — ${rec.reason}` });
  }

  // Fallback: nothing concerning.
  if (actions.length === 0) {
    actions.push({ tone: "good", text: "Everything looks good — keep your current routine." });
  }

  return actions.slice(0, 3);
}
