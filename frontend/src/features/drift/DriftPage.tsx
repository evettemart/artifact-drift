import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { useDriftRuns } from "@/hooks/useDriftRuns";
import { useDriftRecords } from "@/hooks/useDriftRecords";
import { DriftFilters } from "@/features/drift/DriftFilters";
import { DriftTable } from "@/features/drift/DriftTable";
import { DriftDetailDrawer } from "@/features/drift/DriftDetailDrawer";
import type { DriftRecord, DriftRecordFilters, Severity } from "@/api/types";

export function DriftPage() {
  const runsQuery = useDriftRuns();
  const runs = runsQuery.data?.items ?? [];

  const [urlParams] = useSearchParams();
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<DriftRecordFilters>({});
  const [selected, setSelected] = useState<DriftRecord | null>(null);

  // Seed the severity filter from a ?severity= deep link (e.g. dashboard cards).
  useEffect(() => {
    if (deepLinkApplied) return;
    const sev = urlParams.get("severity") as Severity | null;
    if (sev) setFilters((f) => ({ ...f, severity: [sev] }));
    setDeepLinkApplied(true);
  }, [urlParams, deepLinkApplied]);

  // Default to the latest run once runs load.
  useEffect(() => {
    if (!runId && runs.length) setRunId(runs[0].id);
  }, [runId, runs]);

  const recordsQuery = useDriftRecords(runId, filters);
  const records = recordsQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Drift Records"
        description="Deterministic findings from the graph diff engine. Click a row to inspect the base-vs-target diff and acknowledge, resolve, or suppress it."
        actions={
          runId ? (
            <span className="rounded-md border border-border bg-bg-panel px-2.5 py-1 font-mono text-xs text-fg-muted">
              scan: {runId}
            </span>
          ) : undefined
        }
      />

      <div className="mt-6">
        <DriftFilters
          runs={runs}
          runId={runId}
          onRunChange={(id) => {
            setRunId(id);
            setSelected(null);
          }}
          filters={filters}
          onChange={setFilters}
        />
      </div>

      <div className="mt-5">
        {recordsQuery.isLoading && <Spinner label="Loading drift records…" />}
        {recordsQuery.error && (
          <div className="flex items-center gap-2 text-sm text-severity-critical">
            <AlertCircle className="h-4 w-4" /> Failed to load records.
          </div>
        )}
        {!recordsQuery.isLoading && !recordsQuery.error && (
          <DriftTable
            records={records}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        )}
      </div>

      {selected && (
        <DriftDetailDrawer
          record={records.find((r) => r.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
