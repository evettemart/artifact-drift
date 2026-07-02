import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart } from 'lucide-react';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import apiClient from '../lib/api';
import { GenerateReportDialog } from '../components/reports/GenerateReportDialog';
import { ReportPreview } from '../components/reports/ReportPreview';
import { ReportsList } from '../components/reports/ReportsList';
import { buildReport, type GraphData, type GraphLayerData, type ReportFinding } from '../components/reports/buildReport';
import type { Report, ReportFormat } from '../components/reports/types';
import { useGlobalScope } from '../context/GlobalScopeContext';

interface CompletedScanRow {
  scanId: string;
  projectId: string;
  startedAt?: string;
  completedAt?: string;
  complianceScore?: number;
}

interface DriftRunRow {
  id: string;
  scanId: string;
  baseLayer: string;
  targetLayer: string;
  baseLabel: string;
  targetLabel: string;
  label: string;
  total: number;
  summary: Record<string, number>;
}

function runKey(base: 'planned' | 'terraform' | 'deployed', target: 'planned' | 'terraform' | 'deployed') {
  return `${base}__${target}`;
}

function comparisonFromType(
  driftType: string,
): { base: 'planned' | 'terraform' | 'deployed'; target: 'planned' | 'terraform' | 'deployed' } {
  switch (driftType) {
    case 'missing':
    case 'relationship_broken':
    case 'edge':
    case 'design':
      return { base: 'planned', target: 'deployed' };
    case 'version_mismatch':
      return { base: 'planned', target: 'terraform' };
    default:
      return { base: 'terraform', target: 'deployed' };
  }
}

function normalizeFindings(raw: any[], fallbackScanId: string, runs: DriftRunRow[]): ReportFinding[] {
  const runByScanId = new Map<string, DriftRunRow>();
  const runByComparison = new Map<string, DriftRunRow>();
  for (const run of runs) {
    if (run?.scanId) runByScanId.set(String(run.scanId), run);
    const key = runKey(
      String(run.baseLayer) as 'planned' | 'terraform' | 'deployed',
      String(run.targetLayer) as 'planned' | 'terraform' | 'deployed',
    );
    runByComparison.set(key, run);
  }

  return raw.map((finding) => {
    const resolvedScanId = String(finding?.scanId ?? fallbackScanId);
    const comparison = comparisonFromType(String(finding?.driftType ?? ''));
    const comparisonKey = runKey(comparison.base, comparison.target);
    const linkedRunId =
      finding?.runId ||
      runByScanId.get(resolvedScanId)?.id ||
      runByComparison.get(comparisonKey)?.id ||
      comparisonKey;
    return {
      driftId: String(finding?.driftId ?? ''),
      driftType: String(finding?.driftType ?? ''),
      severity: String(finding?.severity ?? 'info'),
      diffSummary: String(finding?.diffSummary ?? ''),
      logicalName: String(finding?.logicalName ?? ''),
      resourceType: String(finding?.resourceType ?? ''),
      region: finding?.region ? String(finding.region) : undefined,
      runId: String(linkedRunId),
      category: String(finding?.category ?? 'attribute'),
      comparison: finding?.comparison,
      reasoning: finding?.reasoning,
      scanId: resolvedScanId,
    } as ReportFinding;
  });
}

function normalizeGraphLayer(layer: any): GraphLayerData {
  const nodes = Array.isArray(layer?.nodes)
    ? layer.nodes.map((node: any) => ({
        id: String(node?.id ?? ''),
        name: String(node?.name ?? node?.label ?? node?.id ?? ''),
        kind: String(node?.kind ?? node?.type ?? 'resource'),
        type: String(node?.type ?? node?.kind ?? 'resource'),
        drifted: Boolean(node?.drifted),
        driftSeverity: node?.driftSeverity ?? null,
      }))
    : [];

  const edges = Array.isArray(layer?.edges)
    ? layer.edges.map((edge: any) => ({
        id: String(edge?.id ?? `${edge?.source ?? ''}_${edge?.target ?? ''}`),
        source: String(edge?.source ?? ''),
        target: String(edge?.target ?? ''),
        label: String(edge?.label ?? edge?.relationshipType ?? 'related'),
      }))
    : [];

  return { nodes, edges };
}

export function ReportsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const {
    projectId,
    workspaceId,
    runId,
    selectedProject,
    selectedWorkspace,
    runs: globalRuns,
  } = useGlobalScope();

  const { data: scansData } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await apiClient.getScans()).data as CompletedScanRow[],
  });
  const scans = Array.isArray(scansData) ? scansData : [];

  const { data: runsData, isLoading: runsLoading, error: runsError } = useQuery({
    queryKey: ['drift-runs', workspaceId],
    queryFn: async () => (await apiClient.getDriftRuns({ scanId: workspaceId })).data as { runs: DriftRunRow[] },
    enabled: Boolean(workspaceId),
  });

  const runs = Array.isArray(runsData?.runs) ? runsData.runs : globalRuns;
  const selectedRun = runId ? runs.find((run) => run.id === runId) ?? null : null;
  const findingsScopeId = selectedRun?.scanId || workspaceId;

  const { data: findingsData, isLoading: findingsLoading, error: findingsError } = useQuery({
    queryKey: ['findings', findingsScopeId, runId],
    queryFn: async () =>
      (await apiClient.getFindings({ scanId: findingsScopeId })).data as {
        scanId: string;
        findings: any[];
      },
    enabled: Boolean(findingsScopeId),
  });

  const { data: graphData, isLoading: graphLoading, error: graphError } = useQuery({
    queryKey: ['graph', workspaceId, runId],
    queryFn: async () => (await apiClient.getGraph({ scanId: workspaceId, runId: runId || undefined })).data,
    enabled: Boolean(workspaceId),
  });

  const { data: integrationsData } = useQuery({
    queryKey: ['integrations', projectId],
    queryFn: async () => (await apiClient.getIntegrations({ projectId })).data,
    enabled: Boolean(projectId),
  });

  const resolvedScanId = findingsData?.scanId ?? findingsScopeId ?? workspaceId;
  const selectedCompletedScan = scans.find((scan) => scan.scanId === resolvedScanId) ?? null;

  const findings = normalizeFindings(
    Array.isArray(findingsData?.findings) ? findingsData.findings : [],
    resolvedScanId,
    runs,
  );
  const projectName = selectedProject?.name ?? (projectId || 'Unknown Project');
  const graph: GraphData = {
    planned: normalizeGraphLayer((graphData as any)?.planned),
    terraform: normalizeGraphLayer((graphData as any)?.terraform),
    deployed: normalizeGraphLayer((graphData as any)?.deployed),
  };
  const selectedReport = reports.find((report) => report.id === selectedReportId);

  function handleGenerate(runId: string, format: ReportFormat) {
    if (!workspaceId) {
      return;
    }

    const report = buildReport({
      format,
      runId,
      projectId: projectId || 'unknown-project',
      projectName,
      scanId: resolvedScanId,
      scanRunAt:
        selectedCompletedScan?.startedAt ??
        selectedCompletedScan?.completedAt ??
        new Date().toISOString(),
      complianceScore: selectedCompletedScan?.complianceScore,
      runs,
      findings,
      graph,
      integrations: Array.isArray(integrationsData) ? integrationsData : [],
    });

    setReports((prev) => [report, ...prev]);
    setSelectedReportId(report.id);
  }

  function handleDeleteReport(id: string) {
    setReports((prev) => {
      const next = prev.filter((report) => report.id !== id);
      setSelectedReportId((current) => (current === id ? next[0]?.id : current));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Reports</h1>
            <p className="mt-1 text-sm text-slate-400">
              Generate architecture drift reports from scan runs and download in HTML, PDF, or JSON.
            </p>
          </div>
          <button
            onClick={() => setShowGenerateDialog(true)}
            disabled={!workspaceId}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileBarChart className="h-4 w-4" />
            Generate report
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Report Configuration</h2>

        {runsError && (
          <div className="mb-4">
            <ErrorAlert
              title="Failed to load drift runs"
              message={(runsError as any)?.message || 'Could not load drift runs for this scan.'}
            />
          </div>
        )}

        {(findingsError || graphError) && (
          <div className="mb-4">
            <ErrorAlert
              title="Some report sources failed to load"
              message={
                (findingsError as any)?.message ||
                (graphError as any)?.message ||
                'Findings or graph data could not be loaded.'
              }
            />
          </div>
        )}
        
        <div className="space-y-4">
          {!workspaceId && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Select a project and workspace from the global top bar to generate reports.
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <span className="text-slate-500">Project:</span> {projectName}
              </p>
              <p>
                <span className="text-slate-500">Workspace:</span>{' '}
                {selectedWorkspace?.name || workspaceId || '-'}
              </p>
              <p>
                <span className="text-slate-500">Selected run:</span> {runId || 'All comparisons'}
              </p>
              <p>
                <span className="text-slate-500">Resolved scan:</span> {resolvedScanId || '-'}
              </p>
              <p>
                <span className="text-slate-500">Findings:</span> {findings.length}
              </p>
              <p>
                <span className="text-slate-500">Graph nodes:</span>{' '}
                {graph.planned.nodes.length + graph.terraform.nodes.length + graph.deployed.nodes.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {runsLoading || findingsLoading || graphLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <LoadingState message="Loading report data..." />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Generated Reports</h2>
            <ReportsList
              reports={reports}
              selectedId={selectedReportId}
              onSelect={setSelectedReportId}
              onDelete={handleDeleteReport}
            />
          </div>
          <div className="min-h-[520px]">
            <ReportPreview report={selectedReport} />
          </div>
        </div>
      )}

      {showGenerateDialog && (
        <GenerateReportDialog
          runs={runs}
          defaultRunId={runId || undefined}
          onClose={() => setShowGenerateDialog(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
