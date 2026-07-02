import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Play, Trash2 } from 'lucide-react';
import apiClient from '../lib/api';

interface ProjectRow {
  projectId: string;
  name: string;
  description: string | null;
}

interface WorkspaceRow {
  scanId: string;
  projectId: string;
  name: string;
  status: string;
  createdAt: string;
  selectedIntegrations: string[];
}

interface IntegrationRow {
  id: string;
  kind: string;
  name: string;
  projectId?: string;
}

interface IntegrationProgress {
  kind: string;
  label: string;
  progress: number;
  status: 'queued' | 'running' | 'completed';
}

interface HealthResponse {
  status: string;
  demoMode: boolean;
  timestamp: string;
  llm?: {
    enabled: boolean;
    provider: string | null;
    model: string | null;
  };
}

interface ScanLogEntry {
  id: string;
  at: string;
  level: 'info' | 'success' | 'error';
  message: string;
}

interface ScanHistoryRow {
  id?: string;
  scanId?: string;
  projectId?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  complianceScore?: number | null;
  status?: string;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

export function ScansPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [lastRunScanId, setLastRunScanId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [progressRows, setProgressRows] = useState<IntegrationProgress[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const timerRef = useRef<number | null>(null);

  function appendLog(message: string, level: ScanLogEntry['level'] = 'info') {
    const at = new Date().toISOString();
    setScanLogs((prev) => [
      ...prev,
      {
        id: `${at}-${Math.random().toString(36).slice(2, 8)}`,
        at,
        level,
        message,
      },
    ]);
  }

  const { data: projects = [] } = useQuery({
    queryKey: ['settings-projects'],
    queryFn: async () => {
      const response = await apiClient.getProjects();
      return response.data as ProjectRow[];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['settings-scans', selectedProjectId],
    queryFn: async () => {
      const response = await apiClient.getSettingsScans({ projectId: selectedProjectId });
      return response.data as WorkspaceRow[];
    },
    enabled: Boolean(selectedProjectId),
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', selectedProjectId],
    queryFn: async () => {
      const response = await apiClient.getIntegrations(
        selectedProjectId ? { projectId: selectedProjectId } : undefined
      );
      return response.data as IntegrationRow[];
    },
    enabled: Boolean(selectedProjectId),
  });

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiClient.health();
      return response.data as HealthResponse;
    },
  });

  const { data: scanHistory = [] } = useQuery({
    queryKey: ['scans-history'],
    queryFn: async () => {
      const response = await apiClient.getScans({ limit: 100 });
      return response.data as ScanHistoryRow[];
    },
  });

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.scanId === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces]
  );

  const filteredHistory = useMemo(() => {
    const projectFiltered = selectedProjectId
      ? scanHistory.filter((row) => row.projectId === selectedProjectId)
      : scanHistory;
    return projectFiltered.filter((row) => String(row.status ?? '').toLowerCase() === 'completed');
  }, [scanHistory, selectedProjectId]);

  const integrationLabelByKind = useMemo(() => {
    const map = new Map<string, string>();
    for (const integration of integrations) {
      if (!map.has(integration.kind)) {
        map.set(integration.kind, integration.name);
      }
    }
    return map;
  }, [integrations]);

  const runScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const response = await apiClient.runAnalysis({ scanId });
      return response.data as {
        scanId: string;
        complianceScore?: number;
        startedAt?: string;
        completedAt?: string;
      };
    },
    onSuccess: async (data) => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLastRunScanId(data.scanId);
      setIsRunning(false);
      setFinishedAt(data.completedAt ?? new Date().toISOString());
      setProgressRows((prev) =>
        prev.map((row) => ({
          ...row,
          progress: 100,
          status: 'completed',
        }))
      );
      appendLog(
        `Scan finished successfully. Run id: ${data.scanId}${
          typeof data.complianceScore === 'number' ? ` · Score: ${data.complianceScore}/100` : ''
        }`,
        'success'
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scans-history'] }),
        queryClient.invalidateQueries({ queryKey: ['scans'] }),
        queryClient.invalidateQueries({ queryKey: ['drift-runs', selectedWorkspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['graph', selectedWorkspaceId] }),
      ]);
    },
    onError: (error: unknown) => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRunning(false);
      setFinishedAt(null);
      const message =
        error instanceof Error ? error.message : 'Failed to run scan for selected workspace';
      setScanError(message);
      appendLog(`Scan failed: ${message}`, 'error');
    },
  });

  const deleteScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      await apiClient.deleteScan(scanId);
      return scanId;
    },
    onSuccess: async (deletedScanId) => {
      appendLog(`Deleted previous scan run ${deletedScanId}`, 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scans-history'] }),
        queryClient.invalidateQueries({ queryKey: ['drift-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['graph'] }),
      ]);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete scan run';
      appendLog(`Delete failed: ${message}`, 'error');
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedWorkspaceId('');
    setProgressRows([]);
    setStartedAt(null);
    setFinishedAt(null);
    setLastRunScanId(null);
    setScanError(null);
    setIsRunning(false);
    setScanLogs([]);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [selectedProjectId]);

  function startScan() {
    if (!selectedWorkspace || isRunning) {
      return;
    }

    const kinds = selectedWorkspace.selectedIntegrations;
    if (!Array.isArray(kinds) || kinds.length === 0) {
      return;
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const started = new Date().toISOString();
    setStartedAt(started);
    setFinishedAt(null);
    setLastRunScanId(null);
    setScanError(null);
    setScanLogs([]);
    setIsRunning(true);

    appendLog(`Starting scan for workspace ${selectedWorkspace.name}`, 'info');
    appendLog(`Found ${kinds.length} integration(s) in workspace`, 'info');

    const llmProvider = healthData?.llm?.provider;
    const llmModel = healthData?.llm?.model;
    if (healthData?.llm?.enabled && llmProvider) {
      appendLog(
        `Using LLM ${llmProvider}${llmModel ? ` (${llmModel})` : ''} to analyze the diagram`,
        'info'
      );
    } else {
      appendLog('LLM not configured; using deterministic fallback where applicable', 'info');
    }

    const initialRows: IntegrationProgress[] = kinds.map((kind) => ({
      kind,
      label: integrationLabelByKind.get(kind) ?? kind,
      progress: 0,
      status: 'queued',
    }));
    setProgressRows(initialRows);

    // Progress bars advance while the backend run is in-flight, then complete on success.
    timerRef.current = window.setInterval(() => {
      setProgressRows((prev) => {
        return prev.map((row) => {
          if (row.status === 'completed' || row.progress >= 90) {
            return row;
          }
          const increment = Math.floor(5 + Math.random() * 10);
          const updatedProgress = Math.min(90, row.progress + increment);
          return {
            ...row,
            progress: updatedProgress,
            status: 'running',
          };
        });
      });
    }, 700);

    runScanMutation.mutate(selectedWorkspace.scanId);
  }

  const canRun = Boolean(selectedProjectId && selectedWorkspaceId && !isRunning);

  function renderLogLine(entry: ScanLogEntry): string {
    const level = entry.level.toUpperCase().padEnd(7, ' ');
    return `[${formatDateTime(entry.at)}] ${level} ${entry.message}`;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Scans</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select a project and workspace, then run a scan to track integration progress.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              <option value="">Select project...</option>
              {projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Workspace
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(event) => {
                setSelectedWorkspaceId(event.target.value);
                setProgressRows([]);
                setScanLogs([]);
                setStartedAt(null);
                setFinishedAt(null);
                setLastRunScanId(null);
                setScanError(null);
              }}
              disabled={!selectedProjectId}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
            >
              {!selectedProjectId && <option value="">Select project first</option>}
              {selectedProjectId && <option value="">Select workspace...</option>}
              {workspaces.map((workspace) => (
                <option key={workspace.scanId} value={workspace.scanId}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={startScan}
              disabled={!canRun}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? <Clock3 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Running scan...' : 'Run scan'}
            </button>
          </div>
        </div>

        {selectedWorkspace && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
            <p>
              <span className="font-medium text-slate-100">Selected scan:</span> {selectedWorkspace.name}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Integrations in workspace: {selectedWorkspace.selectedIntegrations.length}
            </p>
          </div>
        )}

        {selectedWorkspace && selectedWorkspace.selectedIntegrations.length === 0 && (
          <p className="mt-4 text-sm text-amber-300">
            This workspace has no integrations selected, so scan progress panels cannot start.
          </p>
        )}

        {scanError && <p className="mt-4 text-sm text-rose-300">{scanError}</p>}
      </div>

      {(progressRows.length > 0 || scanLogs.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Integration Scan Progress
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {progressRows.map((row) => (
                <div key={`${row.kind}-${row.label}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-100">{row.label}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        row.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : row.status === 'running'
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-500"
                      style={{ width: `${row.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{row.progress}% complete</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Scan Logs</h2>
            <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-emerald-900/70 bg-black p-3 font-mono text-xs leading-5 text-emerald-300">
              {scanLogs.length === 0 ? (
                <p className="text-emerald-700">[idle] waiting for scan logs...</p>
              ) : (
                scanLogs.map((entry) => (
                  <p
                    key={entry.id}
                    className={
                      entry.level === 'error'
                        ? 'text-rose-300'
                        : entry.level === 'success'
                          ? 'text-emerald-300'
                          : 'text-emerald-200'
                    }
                  >
                    {renderLogLine(entry)}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Previous Scan Runs</h2>
          <p className="text-xs text-slate-500">
            {selectedProjectId ? 'Showing selected project' : 'Showing all projects'}
          </p>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No previous completed scans found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Run ID</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredHistory.map((row) => {
                  const rowScanId = row.scanId ?? row.id ?? '';
                  const isDeleting = deleteScanMutation.isPending && deleteScanMutation.variables === rowScanId;
                  return (
                    <tr key={rowScanId} className="text-slate-200">
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{rowScanId}</td>
                      <td className="px-3 py-2">{row.projectId ?? '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(row.startedAt ?? null)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(row.completedAt ?? null)}</td>
                      <td className="px-3 py-2">{row.complianceScore ?? '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (!rowScanId) return;
                            deleteScanMutation.mutate(rowScanId);
                          }}
                          disabled={!rowScanId || isDeleting}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-800 bg-rose-900/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isRunning && startedAt && finishedAt && selectedWorkspace && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-6 text-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Scan Complete
          </div>
          <p className="mt-2 text-sm">
            Scan <span className="font-semibold">{selectedWorkspace.name}</span> completed successfully.
          </p>
          {lastRunScanId && (
            <p className="mt-1 text-xs text-slate-400">Run scan id: {lastRunScanId}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">Start: {formatDateTime(startedAt)}</p>
          <p className="mt-1 text-xs text-slate-400">Finish: {formatDateTime(finishedAt)}</p>
        </div>
      )}
    </div>
  );
}
