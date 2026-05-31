import React, { useEffect, useRef, useState } from "react";
import { Plus, X, Search, PencilLine } from "lucide-react";
import { searchProducts } from "../api";

// Manual product log: search the catalogue, or type an ingredient list by hand.
// Emits a list of product "refs" the backend resolver understands.
export default function ProductLog({ products, setProducts }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualIng, setManualIng] = useState("");
  const debounce = useRef(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        setResults(await searchProducts(query));
      } catch {
        setResults([]);
      }
    }, 250);
  }, [query]);

  const addCatalog = (p) => {
    setProducts([
      ...products,
      {
        name: `${p.brand} ${p.name}`.trim(),
        ingredients: (p.raw_ingredients || []).join(", "),
        category: p.category,
        _source: p.source,
      },
    ]);
    setQuery("");
    setResults([]);
  };

  const addManual = () => {
    if (!manualName.trim() || !manualIng.trim()) return;
    setProducts([
      ...products,
      { name: manualName, ingredients: manualIng, category: "treatment", _source: "manual" },
    ]);
    setManualName("");
    setManualIng("");
    setManual(false);
  };

  const remove = (i) => setProducts(products.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="kicker">products</h3>
        <button onClick={() => setManual((v) => !v)} className="btn-flat">
          <PencilLine className="h-3 w-3" /> {manual ? "search instead" : "enter manually"}
        </button>
      </div>

      {/* logged products — a typewritten list, like a packing slip */}
      <div>
        {products.length === 0 ? (
          <span className="font-display text-body italic text-ink/40">Nothing logged yet.</span>
        ) : (
          <ul>
            {products.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 border-b border-ink/10 py-1.5 font-sans text-body text-ink"
              >
                <span className="min-w-0 flex-1 truncate">— {p.name}</span>
                <button
                  onClick={() => remove(i)}
                  className="shrink-0 text-ink/35 transition-colors hover:text-purple-700"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {manual ? (
        <div className="flex flex-col gap-3 border-t border-dashed border-ink/20 pt-4">
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Product name"
            className="input-line"
          />
          <textarea
            value={manualIng}
            onChange={(e) => setManualIng(e.target.value)}
            placeholder="Paste the ingredient list of your product (comma separated)"
            rows={3}
            className="input-line resize-none"
          />
          <button onClick={addManual} className="btn-ghost self-end">
            <Plus className="h-4 w-4" /> ADD
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 border-b border-ink/30 px-1 py-1.5">
            <Search className="h-4 w-4 text-ink/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products (e.g. CeraVe, Retinol, Cleanser)…"
              className="w-full bg-transparent font-sans text-body text-ink outline-none placeholder:text-ink/30"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto border border-ink/20 bg-paper-card shadow-[0_18px_34px_-20px_rgba(22,20,18,0.55)]">
              {results.map((p, i) => (
                <button
                  key={i}
                  onClick={() => addCatalog(p)}
                  className="w-full border-b border-ink/10 px-3 py-2 text-left transition-colors last:border-0 hover:bg-paper-2"
                >
                  <div className="font-sans text-body text-ink">
                    {p.brand} {p.name}
                  </div>
                  <div className="text-caption uppercase tracking-wide text-ink/55">
                    {p.category} · {p.raw_ingredients?.length || 0} ingredients · {p.source}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
