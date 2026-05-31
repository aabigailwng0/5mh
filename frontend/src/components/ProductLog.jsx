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
      <div className="flex items-center justify-between">
        <h3 className="text-caption uppercase tracking-[0.2em] text-black">Today's products</h3>
        <button onClick={() => setManual((v) => !v)} className="btn-flat">
          <PencilLine className="h-3 w-3" /> {manual ? "search instead" : "enter manually"}
        </button>
      </div>

      {/* logged products */}
      <div className="flex flex-wrap gap-2">
        {products.length === 0 && (
          <span className="text-body text-black/40">No products logged yet.</span>
        )}
        {products.map((p, i) => (
          <span
            key={i}
            className="flex items-center gap-2 rounded-rounded border border-purple-300 py-1.5 pl-3 pr-2 text-body"
          >
            {p.name}
            <button onClick={() => remove(i)} className="text-black hover:text-purple-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {manual ? (
        <div className="flex flex-col gap-3 border-t border-dashed border-purple-300 pt-4">
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
          <div className="flex items-center gap-2 border-b border-black/20 px-1 py-1.5">
            <Search className="h-4 w-4 text-black" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products (e.g. CeraVe, Retinol, Cleanser)…"
              className="w-full bg-transparent text-body text-black outline-none placeholder:text-black/35"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-card border border-purple-400 bg-white">
              {results.map((p, i) => (
                <button
                  key={i}
                  onClick={() => addCatalog(p)}
                  className="w-full border-b border-purple-200 px-3 py-2 text-left transition-colors last:border-0 hover:bg-purple-50"
                >
                  <div className="text-body text-black">
                    {p.brand} {p.name}
                  </div>
                  <div className="text-caption uppercase tracking-wide text-black/60">
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
