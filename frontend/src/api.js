// Thin client for the Skinalizer backend. All calls go through the Vite proxy
// (/api -> FastAPI), so URLs stay relative and same-origin.

const BASE = "/api";

export async function searchProducts(query, limit = 8) {
  const res = await fetch(`${BASE}/products/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.results;
}

export async function lookupBarcode(barcode) {
  const res = await fetch(`${BASE}/products/barcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode }),
  });
  if (!res.ok) return null;
  return res.json();
}

// products: array of refs ({name, ingredients?, barcode?, category?})
export async function analyze(imageBlob, productRefs) {
  const form = new FormData();
  form.append("image", imageBlob, "capture.jpg");
  form.append("products", JSON.stringify(productRefs));
  const res = await fetch(`${BASE}/analyze`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || "Analysis failed");
  }
  return res.json();
}

export async function logDay({ imageBlob, entryDate, productRefs, lifestyle }) {
  const form = new FormData();
  if (imageBlob) form.append("image", imageBlob, "capture.jpg");
  form.append("entry_date", entryDate || "");
  form.append("products", JSON.stringify(productRefs || []));
  form.append("lifestyle", JSON.stringify(lifestyle || {}));
  const res = await fetch(`${BASE}/log`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Log failed");
  return res.json();
}

// level: "aggregate" (comedogenic/irritant loads + lifestyle) or
// "ingredient" (individual ingredient presence + lifestyle).
export async function getAttribution(axis = "acne", level = "aggregate") {
  const res = await fetch(
    `${BASE}/attribution?axis=${encodeURIComponent(axis)}&level=${encodeURIComponent(level)}`
  );
  if (!res.ok) throw new Error("Attribution failed");
  return res.json();
}

export async function getHistory() {
  const res = await fetch(`${BASE}/history`);
  if (!res.ok) throw new Error("History failed");
  const data = await res.json();
  return data.entries || [];
}

export async function getHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error("Health failed");
  return res.json();
}
