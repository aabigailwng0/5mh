import React, { useMemo, useState } from "react";
import { Loader2, ArrowRight, Save, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import CameraCapture from "../components/CameraCapture";
import ProductLog from "../components/ProductLog";
import ScoreCards from "../components/ScoreCards";
import { analyze, logDay } from "../api";
import {
  saveReport,
  makeThumbnail,
  getReports,
  deleteReport,
  clearReports,
} from "../lib/reportStore";

// Dev-only tool for seeding fake history. It runs the *real* pipeline
// (analyze -> log -> saveReport) exactly like the Scan page, but lets you pick
// any date so you can backfill days from real photos.

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDay = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function shiftISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DevDataPage({ onChange }) {
  const [date, setDate] = useState(todayISO);
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [products, setProducts] = useState([]);
  const [sleep, setSleep] = useState("");
  const [dairy, setDairy] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState(0); // bump to re-read the saved list

  const reports = useMemo(() => getReports(), [version]);

  const lifestyle = useMemo(() => {
    const l = {};
    if (sleep) l.sleep_hours = parseFloat(sleep);
    if (dairy) l.dairy_servings = parseFloat(dairy);
    return l;
  }, [sleep, dairy]);

  const productRefs = products.map(({ name, ingredients, category }) => ({
    name,
    ingredients,
    category,
  }));

  const onPhoto = (blob, url) => {
    setPhoto(blob ? { blob, url } : null);
    setResult(null);
    setStatus("");
  };

  const runPipeline = async () => {
    if (!photo) {
      setError("Upload (or capture) a face photo first.");
      return;
    }
    setError("");
    setStatus("");
    setLoading(true);
    try {
      setResult(await analyze(photo.blob, productRefs));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveForDate = async () => {
    if (!photo || !result) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      // Same two-step persistence as the real Scan page: backend (for
      // cross-day attribution) + local report store (for the Reports page).
      await logDay({ imageBlob: photo.blob, entryDate: date, productRefs, lifestyle });
      const photoThumb = await makeThumbnail(photo.url || photo.blob);
      saveReport({
        date,
        savedAt: new Date().toISOString(),
        photoThumb,
        lifestyle,
        products,
        result,
      });
      setVersion((v) => v + 1);
      onChange?.();
      setStatus(`Saved entry for ${fmtDay(date)}.`);
      // Auto-step one day earlier so backfilling history is quick; clear the
      // photo/result so each day gets its own capture.
      setDate((d) => shiftISO(d, -1));
      setPhoto(null);
      setResult(null);
    } catch (e) {
      setError(e.message || "Could not save the day.");
    } finally {
      setSaving(false);
    }
  };

  const removeOne = (d) => {
    deleteReport(d);
    setVersion((v) => v + 1);
    onChange?.();
  };

  const wipeAll = () => {
    if (!window.confirm("Delete ALL locally saved reports? This cannot be undone.")) return;
    clearReports();
    setVersion((v) => v + 1);
    onChange?.();
  };

  const exists = reports.some((r) => r.date === date);

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-20 lg:grid-cols-[360px_1fr]">
      {/* LEFT: the seeding sheet */}
      <section>
        <div className="panel space-y-7">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-heading-sm font-medium italic">seed an entry</h2>
            <span className="eyebrow">dev tool</span>
          </div>

          {/* Date picker with quick steppers */}
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="kicker">entry date</h3>
              {exists && (
                <span className="text-caption uppercase tracking-wide text-purple-700">
                  overwrites existing
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDate((d) => shiftISO(d, -1))}
                className="btn-ghost px-2 py-2"
                title="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value || todayISO())}
                className="input-line flex-1 text-center"
              />
              <button
                onClick={() => setDate((d) => shiftISO(d, 1))}
                className="btn-ghost px-2 py-2"
                title="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-caption uppercase tracking-wide text-ink/45">{fmtDay(date)}</p>
          </div>

          <hr className="rule" />
          <CameraCapture onPhoto={onPhoto} preview={photo?.url} />

          <hr className="rule" />
          <ProductLog products={products} setProducts={setProducts} />

          <hr className="rule" />
          <div>
            <h3 className="kicker mb-4">lifestyle</h3>
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
            <button onClick={runPipeline} disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Analyzing" : "RUN PIPELINE"}
            </button>
            {result && (
              <button
                onClick={saveForDate}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 border border-purple-700 bg-purple-600 px-6 py-3 font-mono text-caption uppercase tracking-[0.18em] text-white transition-all hover:bg-purple-700 active:translate-y-px disabled:opacity-60"
                style={{ borderRadius: 2 }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving" : "Save day"}
              </button>
            )}
          </div>
          {error && <p className="font-sans text-body text-purple-700">{error}</p>}
          {status && <p className="font-sans text-body text-ink/60">{status}</p>}
        </div>
      </section>

      {/* RIGHT: preview + saved days manager */}
      <section className="space-y-6">
        {result ? (
          <ScoreCards axes={result.analysis?.axes} previousAxes={null} />
        ) : (
          <div className="panel flex min-h-[180px] flex-col justify-center p-10">
            <h2 className="kicker text-ink/35">preview</h2>
            <p className="mt-3 max-w-md font-display text-heading-sm italic leading-tight text-ink/70">
              Run the pipeline to preview the four scores, then save them to the chosen date.
            </p>
          </div>
        )}

        <div className="panel">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <h3 className="kicker">seeded days</h3>
              <span className="eyebrow">{reports.length} saved</span>
            </div>
            {reports.length > 0 && (
              <button
                onClick={wipeAll}
                className="inline-flex items-center gap-1.5 text-caption uppercase tracking-wide text-purple-700 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> clear all
              </button>
            )}
          </div>

          {reports.length === 0 ? (
            <p className="font-display text-body italic text-ink/50">No saved days yet.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {reports.map((r) => (
                <li key={r.date} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  {r.photoThumb ? (
                    <img
                      src={r.photoThumb}
                      alt=""
                      className="h-9 w-9 shrink-0 object-cover"
                      style={{ borderRadius: 2 }}
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 bg-ink/10" style={{ borderRadius: 2 }} />
                  )}
                  <span className="flex-1 font-sans text-body">{fmtDay(r.date)}</span>
                  <span className="font-mono text-caption text-ink/45">
                    {r.products?.length || 0} products
                  </span>
                  <button
                    onClick={() => removeOne(r.date)}
                    className="text-ink/40 hover:text-purple-700"
                    title="Delete this day"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
