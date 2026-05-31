import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import ReportDetail from "../components/ReportDetail";
import { getReports, deleteReport } from "../lib/reportStore";
import { overallHealth, AXIS_TITLES } from "../lib/insights";

function fmtLong(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// One collapsible day. Header shows date + overall score + a quick axis glance;
// expanding reveals the complete ReportDetail.
function ReportRow({ report, open, onToggle, onDelete }) {
  const axes = report.result?.analysis?.axes || {};
  const health = overallHealth(axes);
  return (
    <div className="border border-ink/15 bg-paper-card/70">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-ink/60" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink/60" />
          )}
          <div>
            <div className="font-display text-subheading font-medium italic text-ink">
              {fmtLong(report.date)}
            </div>
            <div className="font-mono text-caption uppercase tracking-wide text-ink/50">
              {Object.keys(AXIS_TITLES)
                .filter((k) => axes[k])
                .map((k) => `${AXIS_TITLES[k].slice(0, 4)} ${Math.round(axes[k].value)}`)
                .join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {health != null && (
            <div className="text-right">
              <div className="font-display text-heading-sm font-medium leading-none">{health}</div>
              <div className="text-caption uppercase tracking-wide text-ink/50">health</div>
            </div>
          )}
          <Trash2
            className="h-4 w-4 text-ink/40 hover:text-purple-700"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(report.date);
            }}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-dashed border-ink/20 p-5">
          <ReportDetail report={report} />
        </div>
      )}
    </div>
  );
}

export default function ReportsPage({ refreshKey }) {
  const reports = useMemo(() => getReports(), [refreshKey]);
  const [openDate, setOpenDate] = useState(reports[0]?.date || null);
  const [, force] = useState(0);

  const handleDelete = (date) => {
    deleteReport(date);
    force((n) => n + 1);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 pb-20">
      {/* Per-day full reports, newest first */}
      <section>
        <div className="mb-5 flex items-baseline gap-3 border-b border-ink/15 pb-3">
          <h2 className="kicker">daily reports</h2>
          <span className="eyebrow">{reports.length} saved</span>
        </div>

        {reports.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="font-display text-subheading italic text-ink/55">
              No saved scans yet. Run a scan and press <span className="text-ink">Log day</span> to
              build your history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportRow
                key={r.date}
                report={r}
                open={openDate === r.date}
                onToggle={() => setOpenDate(openDate === r.date ? null : r.date)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
