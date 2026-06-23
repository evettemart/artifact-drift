import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import { DriftFilters } from '../components/drift/DriftFilters';
import { DriftTable } from '../components/drift/DriftTable';
import { DriftDetailDrawer } from '../components/drift/DriftDetailDrawer';
import apiClient from '../lib/api';
import type {
  DriftFilterState,
  DriftFinding,
  DriftRun,
  DriftStatus,
} from '../components/drift/types';
import type { Severity } from '../lib/severity';

interface ProjectRow {
  projectId: string;
  name: string;
}
interface ScanRow {
  scanId: string;
}

const EMPTY_FILTERS: DriftFilterState = {
  search: '',
  severity: [],
  category: [],
  status: [],
};

export function DriftPage() {
  const [searchParams] = useSearchParams();

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.getProjects()).data as ProjectRow[],
  });
  const { data: scansData } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await apiClient.getScans()).data as ScanRow[],
  });
  const { data: runsData } = useQuery({
    queryKey: ['drift-runs'],
    queryFn: async () => (await apiClient.getDriftRuns()).data as { runs: DriftRun[] },
  });
  const { data: findingsData, isLoading, error } = useQuery({
    queryKey: ['findings'],
    queryFn: async () => (await apiClient.getFindings()).data as { scanId: string; findings: DriftFinding[] },
  });

  const projects = projectsData ?? [];
  const scans = scansData ?? [];
  const runs = runsData?.runs ?? [];
  const findings = useMemo(() => findingsData?.findings ?? [], [findingsData]);

  const [projectId, setProjectId] = useState<string>();
  const [scanId, setScanId] = useState<string>();
  const [runId, setRunId] = useState<string>();
  const [filters, setFilters] = useState<DriftFilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, DriftStatus>>({});
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  // Default selections once data loads.
  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].projectId);
  }, [projectId, projects]);
  useEffect(() => {
    if (!scanId && scans.length) setScanId(scans[0].scanId);
  }, [scanId, scans]);
  useEffect(() => {
    if (!runId && runs.length) setRunId(runs[0].id);
  }, [runId, runs]);

  // Seed the severity filter from a ?severity= deep link (dashboard cards).
  useEffect(() => {
    if (deepLinkApplied) return;
    const sev = searchParams.get('severity') as Severity | null;
    if (sev) setFilters((f) => ({ ...f, severity: [sev] }));
    setDeepLinkApplied(true);
  }, [searchParams, deepLinkApplied]);

  // Apply local status overrides so acknowledge/resolve/suppress feel live.
  const decorated = useMemo(
    () =>
      findings.map((f) => ({
        ...f,
        status: statusOverrides[f.driftId] ?? f.status,
      })),
    [findings, statusOverrides]
  );

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return decorated.filter((f) => {
      if (runId && f.runId !== runId) return false;
      if (filters.severity.length && !filters.severity.includes(f.severity)) return false;
      if (filters.category.length && !filters.category.includes(f.category)) return false;
      if (filters.status.length && !filters.status.includes(f.status)) return false;
      if (q) {
        const haystack = `${f.logicalName} ${f.resourceType} ${f.diffSummary} ${
          f.reasoning?.summary ?? ''
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [decorated, runId, filters]);

  const selected = selectedId ? decorated.find((f) => f.driftId === selectedId) ?? null : null;

  function handleStatusChange(id: string, status: DriftStatus) {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  }

  if (isLoading) {
    return <LoadingState message="Loading drifts..." />;
  }
  if (error) {
    return (
      <ErrorAlert
        title="Failed to load drifts"
        message={(error as Error)?.message || 'An error occurred while loading drifts'}
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Drift Records</h1>
          <p className="mt-1 text-sm text-slate-400">
            Deterministic findings from the graph diff engine. Click a row to inspect the
            base-vs-target diff and acknowledge, resolve, or suppress it.
          </p>
        </div>
        {scanId && (
          <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-300">
            scan: {scanId}
          </span>
        )}
      </div>

      <div className="mt-6">
        <DriftFilters
          projects={projects}
          projectId={projectId}
          onProjectChange={setProjectId}
          scans={scans}
          scanId={scanId}
          onScanChange={setScanId}
          runs={runs}
          runId={runId}
          onRunChange={(id) => {
            setRunId(id);
            setSelectedId(null);
          }}
          filters={filters}
          onChange={setFilters}
        />
      </div>

      <div className="mt-5 text-xs text-slate-500">
        Showing {visible.length} of {decorated.filter((f) => !runId || f.runId === runId).length} drift
        records for this run.
      </div>

      <div className="mt-2">
        <DriftTable records={visible} selectedId={selectedId} onSelect={(r) => setSelectedId(r.driftId)} />
      </div>

      {selected && (
        <DriftDetailDrawer
          record={selected}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
