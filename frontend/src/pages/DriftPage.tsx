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
  DriftCategory,
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
  projectId: string;
  name?: string;
  startedAt?: string;
  status?: string;
}

const EMPTY_FILTERS: DriftFilterState = {
  search: '',
  severity: [],
  category: [],
  status: [],
};

type DriftLayer = 'planned' | 'terraform' | 'deployed';

function runKey(base: DriftLayer, target: DriftLayer): string {
  return `${base}__${target}`;
}

function comparisonFromType(driftType: string): { base: DriftLayer; target: DriftLayer } {
  switch (driftType) {
    case 'missing':
      return { base: 'planned', target: 'deployed' };
    case 'unexpected':
    case 'unmanaged':
      return { base: 'deployed', target: 'planned' };
    case 'version_mismatch':
      return { base: 'planned', target: 'terraform' };
    default:
      return { base: 'terraform', target: 'deployed' };
  }
}

function categoryFromType(driftType: string): DriftCategory {
  switch (driftType) {
    case 'missing':
      return 'missing';
    case 'unexpected':
    case 'unmanaged':
      return 'unexpected';
    case 'relationship_broken':
    case 'edge':
      return 'edge';
    default:
      return 'attribute';
  }
}

function layerLabel(layer: DriftLayer): string {
  if (layer === 'planned') return 'Planned Architecture';
  if (layer === 'terraform') return 'Terraform State';
  return 'Deployed Infrastructure';
}

export function DriftPage() {
  const [searchParams] = useSearchParams();

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.getProjects()).data as ProjectRow[],
  });
  const [projectId, setProjectId] = useState<string>();
  const [scanId, setScanId] = useState<string>();
  const [runId, setRunId] = useState<string>();

  const { data: scansData = [] } = useQuery({
    queryKey: ['settings-scans', projectId],
    queryFn: async () =>
      (await apiClient.getSettingsScans({ projectId: projectId as string })).data as ScanRow[],
    enabled: Boolean(projectId),
  });
  const { data: runsData } = useQuery({
    queryKey: ['drift-runs', scanId],
    queryFn: async () => (await apiClient.getDriftRuns({ scanId })).data as { runs: DriftRun[] },
    enabled: Boolean(scanId),
  });
  const { data: findingsData, isLoading, error } = useQuery({
    queryKey: ['findings', scanId],
    queryFn: async () =>
      (await apiClient.getFindings({ scanId })).data as { scanId: string; findings: DriftFinding[] },
    enabled: Boolean(scanId),
  });

  const projects = projectsData ?? [];
  const scans = scansData ?? [];
  const runs = runsData?.runs ?? [];
  const findings = useMemo(() => {
    const raw = findingsData?.findings ?? [];
    const fallbackScanId = findingsData?.scanId ?? scansData?.[0]?.scanId ?? '';
    return raw.map((finding) => {
      const comparison = comparisonFromType(String(finding.driftType ?? ''));
      return {
        ...finding,
        scanId: finding.scanId ?? fallbackScanId,
        category: finding.category ?? categoryFromType(String(finding.driftType ?? '')),
        runId: finding.runId ?? runKey(comparison.base, comparison.target),
        comparison:
          finding.comparison ??
          {
            baseLayer: comparison.base,
            targetLayer: comparison.target,
            baseLabel: layerLabel(comparison.base),
            targetLabel: layerLabel(comparison.target),
          },
      } as DriftFinding;
    });
  }, [findingsData, scansData]);

  const [filters, setFilters] = useState<DriftFilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, DriftStatus>>({});
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  // Default selections once data loads.
  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].projectId);
  }, [projectId, projects]);

  useEffect(() => {
    if (!projectId) {
      setScanId(undefined);
      setRunId(undefined);
      return;
    }
    if (scans.length === 0) {
      setScanId(undefined);
      setRunId(undefined);
      return;
    }
    if (!scanId || !scans.some((s) => s.scanId === scanId)) {
      setScanId(scans[0].scanId);
      setRunId(undefined);
    }
  }, [projectId, scans, scanId]);

  useEffect(() => {
    if (runId && !runs.some((r) => r.id === runId)) {
      setRunId(undefined);
    }
  }, [runId, runs]);
  // Seed severity/category filters from ?severity= / ?category= deep links
  // (dashboard stat cards and the drift-by-type chart).
  useEffect(() => {
    if (deepLinkApplied) return;
    const sev = searchParams.get('severity') as Severity | null;
    const cat = searchParams.get('category') as DriftCategory | null;
    const rid = searchParams.get('runId');
    if (sev || cat) {
      setFilters((f) => ({
        ...f,
        severity: sev ? [sev] : f.severity,
        category: cat ? [cat] : f.category,
      }));
    }
    if (rid) setRunId(rid);
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
      if (projectId && runs.length > 0) {
        const run = runs.find((r) => r.id === f.runId);
        if (run && run.projectId !== projectId) {
          return false;
        }
      }
      if (scanId && f.scanId && f.scanId !== scanId) {
        return false;
      }
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
  }, [decorated, runId, filters, projectId, scanId, runs]);

  const selected = selectedId ? decorated.find((f) => f.driftId === selectedId) ?? null : null;

  function handleStatusChange(id: string, status: DriftStatus) {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  }

  if (isLoading && scanId) {
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
          onProjectChange={(id) => {
            setProjectId(id || undefined);
            setScanId(undefined);
            setRunId(undefined);
            setSelectedId(null);
          }}
          scans={scans}
          scanId={scanId}
          onScanChange={(id) => {
            setScanId(id || undefined);
            setRunId(undefined);
            setSelectedId(null);
          }}
          runs={runs}
          runId={runId}
          onRunChange={(id) => {
            setRunId(id || undefined);
            setSelectedId(null);
          }}
          filters={filters}
          onChange={setFilters}
        />
      </div>

      {projectId && scans.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          No workspaces found for this project.
        </div>
      )}

      {scanId && runs.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          No scan runs found for this workspace.
        </div>
      )}

      <div className="mt-5 text-xs text-slate-500">
        Showing {visible.length} of {decorated.filter((f) => !runId || f.runId === runId).length} drift
        records {runId ? 'for this comparison' : 'across all comparisons'}.
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
