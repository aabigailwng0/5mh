import React, { useState } from "react";
import { ScanLine, LayoutList, TrendingUp } from "lucide-react";
import ScanPage from "./pages/ScanPage";
import ReportsPage from "./pages/ReportsPage";
import TrendsPage from "./pages/TrendsPage";

const TABS = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "reports", label: "Reports", icon: LayoutList },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

const HEADERS = {
  scan: {
    title: "glow",
    subtitle:
      "Snap a photo, log your products, and get your four skin scores, how they moved, and what to do next.",
  },
  reports: {
    title: "your history",
    subtitle: "Every saved scan in full detail, latest first.",
  },
  trends: {
    title: "trends & drivers",
    subtitle: "What's actually moving your skin over time, and which factors matter most.",
  },
};

export default function App() {
  const [page, setPage] = useState("scan");
  // Bumped whenever a day is logged so the Reports page re-reads localStorage.
  const [refreshKey, setRefreshKey] = useState(0);

  const today = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen text-ink">
      {/* Reusable torn-paper edge filters, referenced by .panel::before in CSS.
          feTurbulence builds noise; feDisplacementMap shoves the sheet's edge
          along it, producing a ragged, hand-torn outline. Two seeds = variety. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <filter id="torn" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="torn-b" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.021" numOctaves="3" seed="29" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Top nav with real page switching; logo + design language from main */}
      <nav className="sticky top-0 z-20 h-28 border-b border-ink/15 bg-paper-card/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <img src="/mh_logo.png" alt="GLOW" className="h-24 w-auto object-contain" />
          <div className="flex gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = page === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPage(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-caption uppercase tracking-[0.18em] transition-colors ${
                    active ? "marker text-ink" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-6xl px-6 pb-8 pt-14">
        <div className="mb-4 flex items-center gap-3">
          <span className="eyebrow">Skin journal</span>
          <span className="h-px flex-1 border-t border-dashed border-ink/25" />
          <span className="eyebrow">{today}</span>
        </div>
        <h1
          key={page}
          className="anim-headline max-w-3xl font-display text-heading-lg font-medium italic leading-[0.92] tracking-tight md:text-display"
        >
          {HEADERS[page].title}
        </h1>
        <p className="mt-5 max-w-xl font-sans text-subheading leading-snug text-ink/70">
          {HEADERS[page].subtitle}
        </p>
      </header>

      {page === "scan" && <ScanPage onLogged={() => setRefreshKey((k) => k + 1)} />}
      {page === "reports" && <ReportsPage refreshKey={refreshKey} />}
      {page === "trends" && <TrendsPage refreshKey={refreshKey} />}

      <footer className="mx-auto max-w-6xl px-6 pb-12">
        <hr className="divider mb-5" />
        <p className="text-caption uppercase tracking-[0.18em] text-ink/60">
          Every score traces back to a labelled feature or a documented coefficient · Not medical
          advice
        </p>
      </footer>
    </div>
  );
}
