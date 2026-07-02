import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api';

interface ProjectRow {
  projectId: string;
  name: string;
  status?: string;
  description?: string;
}

interface WorkspaceRow {
  scanId: string;
  projectId: string;
  name?: string;
  status?: string;
  createdAt?: string;
  selectedIntegrations?: string[];
}

interface DriftRunRow {
  id: string;
  scanId: string;
  projectId: string;
  baseLayer: string;
  targetLayer: string;
  baseLabel: string;
  targetLabel: string;
  label: string;
  total: number;
  summary: Record<string, number>;
  createdAt?: string | null;
}

interface GlobalScopeContextValue {
  projectId: string;
  setProjectId: (id: string) => void;
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  runId: string;
  setRunId: (id: string) => void;
  projects: ProjectRow[];
  workspaces: WorkspaceRow[];
  runs: DriftRunRow[];
  selectedProject: ProjectRow | null;
  selectedWorkspace: WorkspaceRow | null;
}

const GlobalScopeContext = createContext<GlobalScopeContextValue | null>(null);

export function GlobalScopeProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [runId, setRunId] = useState('');

  const { data: projectsData = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.getProjects()).data as ProjectRow[],
  });

  const { data: workspacesData = [] } = useQuery({
    queryKey: ['settings-scans', projectId],
    queryFn: async () =>
      (await apiClient.getSettingsScans({ projectId })).data as WorkspaceRow[],
    enabled: Boolean(projectId),
  });

  const { data: runsData } = useQuery({
    queryKey: ['drift-runs', workspaceId],
    queryFn: async () =>
      (await apiClient.getDriftRuns({ scanId: workspaceId })).data as { runs: DriftRunRow[] },
    enabled: Boolean(workspaceId),
  });

  const projects = Array.isArray(projectsData) ? projectsData : [];
  const workspaces = Array.isArray(workspacesData) ? workspacesData : [];
  const runs = Array.isArray(runsData?.runs) ? runsData.runs : [];

  useEffect(() => {
    if (!projectId && projects.length) {
      setProjectId(projects[0].projectId);
      return;
    }
    if (projectId && !projects.some((project) => project.projectId === projectId)) {
      setProjectId(projects[0]?.projectId ?? '');
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (!projectId) {
      setWorkspaceId('');
      setRunId('');
      return;
    }
    if (!workspaceId && workspaces.length) {
      setWorkspaceId(workspaces[0].scanId);
      setRunId('');
      return;
    }
    if (workspaceId && !workspaces.some((workspace) => workspace.scanId === workspaceId)) {
      setWorkspaceId(workspaces[0]?.scanId ?? '');
      setRunId('');
    }
  }, [projectId, workspaceId, workspaces]);

  useEffect(() => {
    if (runId && !runs.some((run) => run.id === runId)) {
      setRunId('');
    }
  }, [runId, runs]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === projectId) ?? null,
    [projects, projectId],
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.scanId === workspaceId) ?? null,
    [workspaces, workspaceId],
  );

  return (
    <GlobalScopeContext.Provider
      value={{
        projectId,
        setProjectId,
        workspaceId,
        setWorkspaceId,
        runId,
        setRunId,
        projects,
        workspaces,
        runs,
        selectedProject,
        selectedWorkspace,
      }}
    >
      {children}
    </GlobalScopeContext.Provider>
  );
}

export function useGlobalScope() {
  const context = useContext(GlobalScopeContext);
  if (!context) {
    throw new Error('useGlobalScope must be used within GlobalScopeProvider');
  }
  return context;
}
