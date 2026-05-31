import React, { useEffect, useState } from "react";
import { ScanLine, LayoutList, TrendingUp, ArrowLeft } from "lucide-react";
import ScanPage from "./pages/ScanPage";
import ReportsPage from "./pages/ReportsPage";
import TrendsPage from "./pages/TrendsPage";
import DevDataPage from "./pages/DevDataPage";

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

// Hidden developer route for seeding fake history (e.g. #/input-data).
const DEV_ROUTE = "#/input-data";
const isDevRoute = () => window.location.hash === DEV_ROUTE;

// Reusable torn-paper edge + sketch filters, referenced by .panel::before in CSS.
const FilterDefs = () => (
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
      <filter id="sketch" x="-5%" y="-20%" width="110%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.022" numOctaves="2" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);

export default function App() {
  const [page, setPage] = useState("scan");
  const [dev, setDev] = useState(isDevRoute);
  // Bumped whenever a day is logged so the Reports page re-reads localStorage.
  const [refreshKey, setRefreshKey] = useState(0);

  // Keep the dev tool reachable via the URL hash (and survive reloads).
  useEffect(() => {
    const onHash = () => setDev(isDevRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (dev) {
    return (
      <div className="min-h-screen text-ink">
        <FilterDefs />
        <nav className="sticky top-0 z-20 h-28 border-b border-ink/15 bg-paper-card/80 backdrop-blur">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
            <img src="/mh_logo.png" alt="GLOW" className="h-24 w-auto object-contain" />
            <a
              href="#"
              onClick={() => {
                window.location.hash = "";
                setDev(false);
              }}
              className="flex items-center gap-1.5 font-mono text-caption uppercase tracking-[0.18em] text-ink/60 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> back to app
            </a>
          </div>
        </nav>
        <header className="mx-auto max-w-6xl px-6 pb-10 pt-12">
          <div className="border-t-2 border-ink" />
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1 pt-4">
            <h1 className="anim-headline font-display text-heading-lg font-medium italic leading-[0.9] tracking-tight md:text-display">
              data lab
            </h1>
            <p className="eyebrow pb-2 tracking-[0.16em]">Dev · seed history</p>
          </div>
          <p className="mt-4 max-w-2xl border-t border-ink/15 pt-4 font-display text-subheading italic leading-snug text-ink/65">
            Upload a face photo, pick a date, and run it through the real analysis pipeline to
            backfill fake history. Saves to both the local report store and the backend.
          </p>
        </header>
        <DevDataPage onChange={() => setRefreshKey((k) => k + 1)} />
      </div>
    );
  }

  const now = new Date();
  const today = now.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  // Day-of-year as a playful "issue number" for the masthead dateline.
  const issue = Math.ceil((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  return (
    <div className="min-h-screen text-ink">
      <FilterDefs />

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

      {/* Masthead — a printed nameplate: heavy rule, title, dateline, then a
          standfirst deck. Replaces the generic dashed "label" row. */}
      <header className="mx-auto max-w-6xl px-6 pb-10 pt-12">
        <div className="border-t-2 border-ink" />
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1 pt-4">
          <h1
            key={page}
            className="anim-headline font-display text-heading-lg font-medium italic leading-[0.9] tracking-tight md:text-display"
          >
            {HEADERS[page].title}
          </h1>
          <p className="eyebrow pb-2 tracking-[0.16em]">Glow · No. {issue} · {today}</p>
        </div>
        <p className="mt-4 max-w-2xl border-t border-ink/15 pt-4 font-display text-subheading italic leading-snug text-ink/65">
          {HEADERS[page].subtitle}
        </p>
      </header>

      {page === "scan" && <ScanPage onLogged={() => setRefreshKey((k) => k + 1)} />}
      {page === "reports" && <ReportsPage refreshKey={refreshKey} />}
      {page === "trends" && <TrendsPage refreshKey={refreshKey} />}

      <footer className="mx-auto max-w-6xl px-6 pb-12">
        <hr className="divider mb-5" />
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-caption uppercase tracking-[0.18em] text-ink/60">
            Every score traces back to a labelled feature or a documented coefficient · Not medical
            advice
          </p>
          <a
            href={DEV_ROUTE}
            onClick={() => setDev(true)}
            className="shrink-0 font-mono text-caption uppercase tracking-[0.18em] text-ink/30 hover:text-ink/60"
          >
            seed data
          </a>
        </div>
      </footer>
    </div>
  );
}
