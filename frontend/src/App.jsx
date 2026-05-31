import React, { useState } from "react";
import { Loader2, ArrowRight, Save } from "lucide-react";
import CameraCapture from "./components/CameraCapture";
import ProductLog from "./components/ProductLog";
import SpectrumDashboard from "./components/SpectrumDashboard";
import {
  IngredientScore,
  Warnings,
  Schedule,
  Recommendations,
} from "./components/InsightsPanels";
import AttributionPanel from "./components/AttributionPanel";
import { analyze, logDay } from "./api";

export default function App() {
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [products, setProducts] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [sleep, setSleep] = useState("");
  const [dairy, setDairy] = useState("");

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

  const saveToday = async () => {
    if (!photo) return;
    const lifestyle = {};
    if (sleep) lifestyle.sleep_hours = parseFloat(sleep);
    if (dairy) lifestyle.dairy_servings = parseFloat(dairy);
    await logDay({
      imageBlob: photo.blob,
      entryDate: new Date().toISOString().slice(0, 10),
      productRefs,
      lifestyle,
    });
    setSaved(true);
  };

  return (
    <div className="min-h-screen text-warm-cream">
      {/* Top-fixed minimal nav */}
      <nav className="sticky top-0 z-20 border-b border-cork-shadow bg-studio-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-subheading font-medium tracking-tight">SKINALIZER</span>
          <div className="hidden gap-6 text-caption uppercase tracking-[0.18em] text-warm-cream/80 sm:flex">
            <span>Spectrum</span>
            <span>Products</span>
            <span>Attribution</span>
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-6xl px-6 pb-8 pt-12">
        <h1 className="max-w-3xl font-display text-heading-lg font-medium leading-[0.92] tracking-tight md:text-display">
          Your face, priced daily.
        </h1>
        <p className="mt-5 max-w-xl text-subheading text-warm-cream/70">
          One photo and your product log → an explainable read on four skin spectrums, the
          ingredient loads driving them, and the drivers attributed over time.
        </p>
        <span className="mt-4 inline-block text-caption uppercase tracking-[0.2em] text-burnt-sienna">
          ORYZO-grade · transparent by design
        </span>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-20 lg:grid-cols-[360px_1fr]">
        {/* LEFT: input column */}
        <section className="space-y-6">
          <div className="panel">
            <h2 className="mb-5 text-caption uppercase tracking-[0.2em] text-grey-brown">
              Today's photo
            </h2>
            <CameraCapture onPhoto={onPhoto} preview={photo?.url} />
          </div>

          <div className="panel">
            <ProductLog products={products} setProducts={setProducts} />
          </div>

          <div className="panel">
            <h3 className="mb-4 text-caption uppercase tracking-[0.2em] text-grey-brown">
              Lifestyle (optional)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-caption uppercase tracking-wide text-grey-brown">
                Sleep (hrs)
                <input
                  type="number"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  className="input-line mt-2"
                  placeholder="7.5"
                />
              </label>
              <label className="text-caption uppercase tracking-wide text-grey-brown">
                Dairy (servings)
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

          <div className="flex gap-3">
            <button onClick={runAnalyze} disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Analyzing" : "Analyze skin"}
            </button>
            {result && (
              <button onClick={saveToday} className="btn-ghost">
                <Save className="h-4 w-4" /> {saved ? "Saved" : "Log day"}
              </button>
            )}
          </div>
          {error && <p className="text-body text-burnt-sienna">{error}</p>}
        </section>

        {/* RIGHT: results column */}
        <section className="space-y-6">
          {!result ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-card border border-dashed border-cork-shadow p-10 text-center">
              <span className="mb-4 text-caption uppercase tracking-[0.25em] text-burnt-sienna">
                Awaiting input
              </span>
              <p className="max-w-sm text-subheading text-warm-cream/60">
                Capture a photo, log what you used today, then run{" "}
                <span className="text-warm-cream">Analyze skin</span> to see your spectrum,
                ingredient loads, clashes and routine.
              </p>
            </div>
          ) : (
            <>
              <SpectrumDashboard analysis={result.analysis} />
              <IngredientScore score={result.ingredient_score} />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Warnings warnings={result.warnings} />
                <Schedule schedule={result.schedule} />
              </div>
              <Recommendations recommendations={result.recommendations} />
            </>
          )}
          <AttributionPanel />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-12">
        <hr className="divider mb-5" />
        <p className="text-caption uppercase tracking-[0.18em] text-grey-brown">
          Every score traces back to a labelled feature or a documented coefficient · Not medical
          advice
        </p>
      </footer>
    </div>
  );
}
