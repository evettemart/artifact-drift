import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Play } from 'lucide-react';
import apiClient, { api } from '../lib/api';

interface ProjectRow {
  projectId: string;
  name: string;
  description: string | null;
}

interface WorkspaceRow {
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

export function ScansPage() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [progressRows, setProgressRows] = useState<IntegrationProgress[]>([]);
  const [lastCreatedScanId, setLastCreatedScanId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['settings-projects'],
    queryFn: async () => {
      const response = await apiClient.getProjects();
      return response.data as ProjectRow[];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', selectedProjectId],
    queryFn: async () => {
      const response = await apiClient.getWorkspaces({ projectId: selectedProjectId });
      return response.data as WorkspaceRow[];
    },
    enabled: Boolean(selectedProjectId),
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', selectedProjectId],
    queryFn: async () => {
      const response = await apiClient.getIntegrations();
      return response.data as IntegrationRow[];
    },
    enabled: Boolean(selectedProjectId),
  });

  const selectedWorkspace = useMemo(
    () => workspaces.find((ws) => ws.workspaceId === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces]
  );

  const integrationLabelByKind = useMemo(() => {
    const map = new Map<string, string>();
    for (const integration of integrations) {
      if (!map.has(integration.kind)) {
        map.set(integration.kind, integration.name);
      }
    }
    return map;
  }, [integrations]);

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
    setLastCreatedScanId(null);
    setIsRunning(false);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [selectedProjectId]);

  useEffect(() => {
    setProgressRows([]);
    setStartedAt(null);
    setFinishedAt(null);
    setLastCreatedScanId(null);
    setIsRunning(false);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [selectedWorkspaceId]);

  async function startScan() {
    if (!selectedWorkspaceId || !selectedProjectId || isRunning) {
      return;
    }

    // Get all integrations for this project to include in the scan
    const kinds = integrations.map((i) => i.kind);
    if (kinds.length === 0) {
      console.error('No integrations available for this project');
      return;
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const started = new Date().toISOString();
    setStartedAt(started);
    setFinishedAt(null);
    setIsRunning(true);

    const initialRows: IntegrationProgress[] = kinds.map((kind) => ({
      kind,
      label: integrationLabelByKind.get(kind) ?? kind,
      progress: 0,
      status: 'running',
    }));
    setProgressRows(initialRows);

    try {
      // Create a new scan configuration
      const scanName = `Scan ${new Date().toLocaleString()}`;
      const createResponse = await api.post('/settings/scans', {
        projectId: selectedProjectId,
        workspaceId: selectedWorkspaceId,
        name: scanName,
        selectedIntegrations: kinds,
      });
      
      const newScanId = createResponse.data.scanId;
      setLastCreatedScanId(newScanId);
      
      // Run the analysis with the new scan ID
      console.log('Starting real analysis for new scan:', newScanId);
      const response = await apiClient.runAnalysis({ scanId: newScanId });
      console.log('Analysis complete:', response.data);

      // Mark all integrations as completed
      setProgressRows((prev) =>
        prev.map((row) => ({
          ...row,
          progress: 100,
          status: 'completed',
        }))
      );

      setFinishedAt(new Date().toISOString());
    } catch (error) {
      console.error('Analysis failed:', error);
      // Mark all integrations as failed
      setProgressRows((prev) =>
        prev.map((row) => ({
          ...row,
          progress: 0,
          status: 'queued',
        }))
      );
    } finally {
      setIsRunning(false);
    }
  }

  const canRun = Boolean(selectedProjectId && selectedWorkspaceId && !isRunning && integrations.length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Scans</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select a project and workspace, then run a new scan to track integration progress.
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
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              disabled={!selectedProjectId}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
            >
              {!selectedProjectId && <option value="">Select project first</option>}
              {selectedProjectId && <option value="">Select workspace...</option>}
              {workspaces.map((workspace) => (
                <option key={workspace.workspaceId} value={workspace.workspaceId}>
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
              {isRunning ? 'Running scan...' : 'Run new scan'}
            </button>
          </div>
        </div>

        {selectedWorkspace && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
            <p>
              <span className="font-medium text-slate-100">Selected workspace:</span> {selectedWorkspace.name}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Available integrations: {integrations.length}
            </p>
          </div>
        )}

        {selectedWorkspaceId && integrations.length === 0 && (
          <p className="mt-4 text-sm text-amber-300">
            No integrations available. Please add integrations in the Projects page before running a scan.
          </p>
        )}
      </div>

      {progressRows.length > 0 && (
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
      )}

      {!isRunning && startedAt && finishedAt && lastCreatedScanId && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-100">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Scan Complete
          </div>
          <p className="mt-2 text-sm">
            New scan completed successfully in workspace <span className="font-semibold">{selectedWorkspace?.name}</span>.
          </p>
          <p className="mt-1 text-xs text-emerald-200/90">Scan ID: {lastCreatedScanId}</p>
          <p className="mt-1 text-xs text-emerald-200/90">Start: {formatDateTime(startedAt)}</p>
          <p className="mt-1 text-xs text-emerald-200/90">Finish: {formatDateTime(finishedAt)}</p>
          <p className="mt-2 text-xs text-emerald-200/90">
            View results in the Drift page by selecting this scan.
          </p>
        </div>
      )}
    </div>
  );
}
