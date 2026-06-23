import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { LoadingState } from '../components/LoadingSpinner';
import apiClient from '../lib/api';
import { SEED_INTEGRATIONS } from '../components/integrations/data';
import { ReportsList } from '../components/reports/ReportsList';
import { ReportPreview } from '../components/reports/ReportPreview';
import { GenerateReportDialog } from '../components/reports/GenerateReportDialog';
import { buildReport, type DriftRun, type GraphData, type ReportFinding } from '../components/reports/buildReport';
import type { Report, ReportFormat } from '../components/reports/types';

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const seededRef = useRef(false);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.getProjects()).data as Array<Record<string, unknown>>,
  });
  const { data: scansData } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await apiClient.getScans()).data as Array<Record<string, unknown>>,
  });
  const { data: driftRunsData } = useQuery({
    queryKey: ['drift-runs'],
    queryFn: async () => (await apiClient.getDriftRuns()).data as { runs: DriftRun[] },
  });
  const { data: findingsData } = useQuery({
    queryKey: ['findings'],
    queryFn: async () => (await apiClient.getFindings()).data as { findings: ReportFinding[] },
  });
  const { data: graphData } = useQuery({
    queryKey: ['graph'],
    queryFn: async () => (await apiClient.getGraph()).data as GraphData,
  });

  const project = projectsData?.[0];
  const scan = scansData?.[0];
  const runs = driftRunsData?.runs ?? [];
  const ready = Boolean(project && scan && driftRunsData && findingsData && graphData);

  function makeReport(runId: string, format: ReportFormat): Report | null {
    if (!project || !scan || !driftRunsData || !findingsData || !graphData) return null;
    return buildReport({
      format,
      runId,
      projectId: String(project.projectId ?? project.id ?? ''),
      projectName: String(project.name ?? 'Project'),
      scanId: String(scan.scanId ?? scan.id ?? ''),
      scanRunAt: String(scan.startedAt ?? new Date().toISOString()),
      complianceScore: typeof scan.complianceScore === 'number' ? scan.complianceScore : undefined,
      runs: driftRunsData.runs,
      findings: findingsData.findings,
      graph: graphData,
      integrations: SEED_INTEGRATIONS,
    });
  }

  function handleGenerate(runId: string, format: ReportFormat) {
    const report = makeReport(runId, format);
    if (report) {
      setReports((prev) => [report, ...prev]);
      setSelectedId(report.id);
    }
  }

  // Seed an initial report once data is available so the preview is populated.
  useEffect(() => {
    if (!seededRef.current && ready) {
      seededRef.current = true;
      const firstRun = runs[0]?.id ?? 'all';
      const report = makeReport(firstRun, 'html');
      if (report) {
        setReports([report]);
        setSelectedId(report.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const selected = reports.find((r) => r.id === selectedId);

  if (!ready) {
    return <LoadingState message="Loading reports..." />;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Reports</h1>
          <p className="mt-1 text-sm text-slate-400">
            Generate and review audit-ready drift reports with cited evidence.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          Generate report
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <ReportsList reports={reports} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="min-h-[60vh]">
          <ReportPreview report={selected} />
        </div>
      </div>

      {dialogOpen && (
        <GenerateReportDialog
          runs={runs}
          onClose={() => setDialogOpen(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
