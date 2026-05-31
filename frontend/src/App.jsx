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

  return (
    <div className="min-h-screen text-black">
      {/* Top nav with real page switching; logo + design language from main */}
      <nav className="sticky top-0 z-20 h-28 border-b border-purple-400 bg-white/90 backdrop-blur">
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
                  className={`flex items-center gap-1.5 rounded-rounded px-3 py-1.5 text-caption uppercase tracking-[0.18em] transition-colors ${
                    active ? "bg-purple-200 text-black" : "text-black/55 hover:text-black"
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

      <header className="mx-auto max-w-6xl px-6 pb-8 pt-12">
        <h1 className="max-w-3xl font-display text-heading-lg font-medium leading-[0.92] tracking-tight md:text-display">
          {HEADERS[page].title}
        </h1>
        <p className="mt-5 max-w-xl text-subheading text-black/70">{HEADERS[page].subtitle}</p>
      </header>

      {page === "scan" && <ScanPage onLogged={() => setRefreshKey((k) => k + 1)} />}
      {page === "reports" && <ReportsPage refreshKey={refreshKey} />}
      {page === "trends" && <TrendsPage refreshKey={refreshKey} />}

      <footer className="mx-auto max-w-6xl px-6 pb-12">
        <hr className="divider mb-5" />
        <p className="text-caption uppercase tracking-[0.18em] text-black">
          Every score traces back to a labelled feature or a documented coefficient · Not medical
          advice
        </p>
      </footer>
    </div>
  );
}
