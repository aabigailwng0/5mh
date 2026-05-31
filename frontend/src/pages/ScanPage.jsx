import React, { useMemo, useState } from "react";
import { Loader2, ArrowRight, Save, CheckCircle2 } from "lucide-react";
import CameraCapture from "../components/CameraCapture";
import ProductLog from "../components/ProductLog";
import ScoreCards from "../components/ScoreCards";
import HealthSummary from "../components/HealthSummary";
import ActionList from "../components/ActionList";
import ConfirmModal from "../components/ConfirmModal";
import { Paperclip } from "../components/Fastener";
import { analyze, logDay } from "../api";
import {
  getPreviousReport,
  saveReport,
  makeThumbnail,
  getSkipLogPrompt,
  setSkipLogPrompt,
} from "../lib/reportStore";
import { deriveActions, healthDelta } from "../lib/insights";

const TODAY = () => new Date().toISOString().slice(0, 10);
const LOG_DATE = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export default function ScanPage({ onLogged }) {
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [products, setProducts] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [toast, setToast] = useState(false);
  const [sleep, setSleep] = useState("");
  const [dairy, setDairy] = useState("");

  // The most recent saved day before today — drives all "vs last scan" deltas.
  const previous = useMemo(() => getPreviousReport(TODAY()), [saved]);
  const previousAxes = previous?.result?.analysis?.axes || null;

  const lifestyle = useMemo(() => {
    const l = {};
    if (sleep) l.sleep_hours = parseFloat(sleep);
    if (dairy) l.dairy_servings = parseFloat(dairy);
    return l;
  }, [sleep, dairy]);

  const onPhoto = (blob, url) => {
    setPhoto(blob ? { blob, url } : null);
    setResult(null);
    setSaved(false);
  };

  const productRefs = products.map(({ name, ingredients, category }) => ({
    name,
    ingredients,
    category,
  }));

  const runAnalyze = async () => {
    if (!photo) {
      setError("Capture or upload a face photo first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      setResult(await analyze(photo.blob, productRefs));
      setSaved(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Clicking "Log day" either asks for confirmation or saves directly, depending
  // on the user's saved preference.
  const requestLog = () => {
    if (saved || saving) return;
    if (getSkipLogPrompt()) doSave();
    else setShowLogModal(true);
  };

  const confirmLog = (dontAskAgain) => {
    if (dontAskAgain) setSkipLogPrompt(true);
    setShowLogModal(false);
    doSave();
  };

  const doSave = async () => {
    if (!photo || !result) return;
    setSaving(true);
    try {
      const date = TODAY();
      // Persist to the backend so cross-day attribution keeps working...
      await logDay({ imageBlob: photo.blob, entryDate: date, productRefs, lifestyle });
      // ...and store the full, rich report locally for the reports page.
      const photoThumb = await makeThumbnail(photo.url || photo.blob);
      saveReport({
        date,
        savedAt: new Date().toISOString(),
        photoThumb,
        lifestyle,
        products,
        result,
      });
      setSaved(true);
      setToast(true);
      setTimeout(() => setToast(false), 3500);
      onLogged?.();
    } catch (e) {
      setError(e.message || "Could not log the day.");
    } finally {
      setSaving(false);
    }
  };

  const delta = result ? healthDelta(result.analysis?.axes, previousAxes) : null;
  const actions = result ? deriveActions(result, { lifestyle }) : [];

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-20 lg:grid-cols-[360px_1fr]">
      {/* LEFT: the day's log — one continuous sheet, sections set off by rules
          and serif kickers rather than separate labelled boxes. */}
      <section>
        <div className="panel space-y-7">
          <Paperclip className="-top-4 left-7 rotate-[-13deg]" />
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-heading-sm font-medium italic">today's entry</h2>
            <span className="eyebrow">{LOG_DATE}</span>
          </div>

          <CameraCapture onPhoto={onPhoto} preview={photo?.url} />

          <hr className="rule" />
          <ProductLog products={products} setProducts={setProducts} />

          <hr className="rule" />
          <div>
            <div className="mb-4 flex items-baseline gap-2">
              <h3 className="kicker">lifestyle</h3>
              <span className="text-caption lowercase tracking-wide text-ink/35">if you kept track</span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <label className="text-caption uppercase tracking-wide text-ink/55">
                Sleep · hrs
                <input
                  type="number"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  className="input-line mt-2"
                  placeholder="7.5"
                />
              </label>
              <label className="text-caption uppercase tracking-wide text-ink/55">
                Dairy · servings
                <input
                  type="number"
                  value={dairy}
                  onChange={(e) => setDairy(e.target.value)}
                  className="input-line mt-2"
                  placeholder="1"
                />
              </label>
            </div>
          </div>

          <hr className="rule" />
          <div className="flex gap-3">
            <button onClick={runAnalyze} disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Analyzing" : "ANALYZE SKIN"}
            </button>
            {result && (
              <button
                onClick={requestLog}
                disabled={saving || saved}
                className="inline-flex items-center justify-center gap-2 border border-purple-700 bg-purple-600 px-6 py-3 font-mono text-caption uppercase tracking-[0.18em] text-white transition-all hover:bg-purple-700 active:translate-y-px disabled:opacity-60"
                style={{ borderRadius: 2 }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving" : saved ? "Saved" : "Log day"}
              </button>
            )}
          </div>
          {error && <p className="font-sans text-body text-purple-700">{error}</p>}
        </div>
      </section>

      {/* RIGHT: the essentials only */}
      <section className="space-y-6">
        {!result ? (
          <div className="panel flex min-h-[420px] flex-col justify-center p-10">
            <h2 className="kicker text-ink/35">a blank page</h2>
            <p className="mt-3 max-w-md font-display text-heading-sm italic leading-tight text-ink/75">
              Your reading develops here.
            </p>
            <p className="mt-4 max-w-sm font-sans text-body leading-relaxed text-ink/55">
              Capture today's photo, note what you used, then run the analysis to see your four
              scores, how far they moved, and what to do next.
            </p>
          </div>
        ) : (
          <>
            <HealthSummary delta={delta} previousDate={previous?.date} />
            <ScoreCards axes={result.analysis?.axes} previousAxes={previousAxes} />
            <ActionList actions={actions} />
            <p className="text-caption uppercase tracking-wide text-ink/45">
              {saved ? "Logged — open Reports for the full breakdown." : "Press Log day to save this scan and unlock the full report."}
            </p>
          </>
        )}
      </section>

      {/* Confirmation prompt before logging (dismissible permanently) */}
      <ConfirmModal
        open={showLogModal}
        title="Log today's scan?"
        body="This saves the full report to your history and feeds the trends analysis. You can review or delete it anytime in Reports."
        confirmLabel="Log day"
        cancelLabel="Cancel"
        allowDisable
        onConfirm={confirmLog}
        onCancel={() => setShowLogModal(false)}
      />

      {/* Post-log confirmation toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-card border border-purple-400 bg-white px-4 py-3 shadow-xl">
          <CheckCircle2 className="h-5 w-5" style={{ color: "#16a34a" }} strokeWidth={1.75} />
          <span className="text-body text-black">Logged — saved to your history.</span>
        </div>
      )}
    </main>
  );
}
