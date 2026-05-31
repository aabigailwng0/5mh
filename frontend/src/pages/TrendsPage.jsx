import React, { useMemo } from "react";
import AttributionPanel from "../components/AttributionPanel";
import OverviewTrend from "../components/OverviewTrend";
import { getReports } from "../lib/reportStore";

// Cross-day analysis: a unified overall-health trend up top, then the per-axis
// driver attribution below.
export default function TrendsPage({ refreshKey }) {
  const reports = useMemo(() => getReports(), [refreshKey]);
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 pb-20">
      <OverviewTrend reports={reports} />
      <AttributionPanel />
    </main>
  );
}
