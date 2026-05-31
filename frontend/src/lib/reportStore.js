// Local, single-user report history. Each "Log day" persists the full analysis
// result (axes, features, ingredients, warnings, schedule, recommendations,
// products, lifestyle) plus a small photo thumbnail to localStorage, keyed by
// date. This is deliberately client-only — we don't care about scale or
// multi-user here; the backend still receives the day for cross-day attribution.

const KEY = "skinalizer.reports.v2";
const SKIP_PROMPT_KEY = "skinalizer.skipLogPrompt";

// Whether the user has opted out of the "Log day" confirmation prompt.
export function getSkipLogPrompt() {
  try {
    return localStorage.getItem(SKIP_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSkipLogPrompt(skip) {
  try {
    if (skip) localStorage.setItem(SKIP_PROMPT_KEY, "1");
    else localStorage.removeItem(SKIP_PROMPT_KEY);
  } catch {
    /* ignore */
  }
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(reports) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reports));
  } catch {
    // Quota exceeded (usually the photo thumbnails) — drop the oldest until it fits.
    const trimmed = [...reports];
    while (trimmed.length > 1) {
      trimmed.pop();
      try {
        localStorage.setItem(KEY, JSON.stringify(trimmed));
        return;
      } catch {
        /* keep trimming */
      }
    }
  }
}

// All reports, newest date first.
export function getReports() {
  return read().sort((a, b) => (a.date < b.date ? 1 : -1));
}

// The most recent report strictly before `beforeDate` (for day-over-day deltas).
export function getPreviousReport(beforeDate) {
  return getReports().find((r) => r.date < beforeDate) || null;
}

// Insert or replace the report for its date.
export function saveReport(report) {
  const reports = read().filter((r) => r.date !== report.date);
  reports.push(report);
  write(reports);
  return getReports();
}

export function deleteReport(date) {
  write(read().filter((r) => r.date !== date));
  return getReports();
}

// Wipe all locally stored reports (used by the dev seeding page).
export function clearReports() {
  write([]);
  return [];
}

// Downscale a photo (blob or object/data URL) to a small JPEG data URL so it can
// live in localStorage without blowing the ~5MB quota.
export function makeThumbnail(source, maxSize = 320) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = typeof source === "string" ? source : URL.createObjectURL(source);
  });
}
