import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { useDriftRuns } from "@/hooks/useDriftRuns";
import { useDriftRecords } from "@/hooks/useDriftRecords";
import { layerLabel } from "@/lib/layers";
import { computeComplianceScore } from "@/lib/scoring";
import { ComplianceScore } from "@/features/dashboard/ComplianceScore";
import { SeverityCards } from "@/features/dashboard/SeverityCards";
import { SeverityBreakdownChart } from "@/features/dashboard/SeverityBreakdownChart";
import { DriftByKindChart } from "@/features/dashboard/DriftByKindChart";
import { RecentRunsTable } from "@/features/dashboard/RecentRunsTable";
import { ScanControls } from "@/features/dashboard/ScanControls";

export function DashboardPage() {
  const runsQuery = useDriftRuns();
  const runs = runsQuery.data?.items ?? [];
  const latestRun = runs[0];
  const recordsQuery = useDriftRecords(latestRun?.id);
  const records = recordsQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Drift Dashboard"
        description={
          latestRun
            ? `Latest run · ${layerLabel(latestRun.baseLayer)} → ${layerLabel(latestRun.targetLayer)}`
            : "Overview of architecture drift across your environment"
        }
        actions={<ScanControls />}
      />

      {runsQuery.isLoading && (
        <div className="mt-8">
          <Spinner label="Loading drift runs…" />
        </div>
      )}

      {runsQuery.error && (
        <div className="mt-8 flex items-center gap-2 rounded-lg border border-severity-critical/40 bg-severity-critical/10 px-4 py-3 text-sm text-severity-critical">
          <AlertCircle className="h-4 w-4" /> Failed to load dashboard data.
        </div>
      )}

      {!runsQuery.isLoading && !runsQuery.error && latestRun && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
            <ComplianceScore score={computeComplianceScore(latestRun.summary)} />
            <div className="flex flex-col justify-center">
              <SeverityCards summary={latestRun.summary} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SeverityBreakdownChart summary={latestRun.summary} />
            <DriftByKindChart records={records} />
          </div>

          <RecentRunsTable runs={runs} />
        </div>
      )}
    </div>
  );
}
