import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { useReports } from "@/hooks/useReports";
import { useDriftRuns } from "@/hooks/useDriftRuns";
import { ReportsList } from "@/features/reports/ReportsList";
import { ReportPreview } from "@/features/reports/ReportPreview";
import { GenerateReportDialog } from "@/features/reports/GenerateReportDialog";

export function ReportsPage() {
  const { data: reportsPage, isLoading } = useReports();
  const { data: runsPage } = useDriftRuns();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const reports = reportsPage?.items ?? [];
  const runs = runsPage?.items ?? [];

  // Default selection to the most recent report once loaded.
  useEffect(() => {
    if (!selectedId && reports.length) {
      setSelectedId(reports[0].id);
    }
  }, [reports, selectedId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and review audit-ready drift reports with cited evidence."
        actions={
          <button
            onClick={() => setDialogOpen(true)}
            disabled={!runs.length}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Generate report
          </button>
        }
      />

      {isLoading ? (
        <Spinner label="Loading reports…" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <ReportsList
              reports={reports}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="min-h-[60vh]">
            <ReportPreview reportId={selectedId} />
          </div>
        </div>
      )}

      {dialogOpen && (
        <GenerateReportDialog
          runs={runs}
          onClose={() => setDialogOpen(false)}
          onGenerated={setSelectedId}
        />
      )}
    </div>
  );
}
