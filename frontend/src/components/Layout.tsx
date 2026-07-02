import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, FileText, Network, PlayCircle, Plug, Settings2 } from 'lucide-react';
import { Logo } from './Logo';
import apiClient from '../lib/api';
import { useGlobalScope } from '../context/GlobalScopeContext';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/settings', label: 'Projects', icon: Settings2 },
  { path: '/scans', label: 'Scans', icon: PlayCircle },
  { path: '/graph', label: 'Graph', icon: Network },
  { path: '/drift', label: 'Drift', icon: Activity },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/reports', label: 'Reports', icon: FileText },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const {
    projectId,
    setProjectId,
    workspaceId,
    setWorkspaceId,
    runId,
    setRunId,
    projects,
    workspaces,
    runs,
    selectedWorkspace,
  } = useGlobalScope();

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiClient.health();
      return response.data as { status: string; demoMode?: boolean };
    },
  });

  const demoMode = healthData?.demoMode ?? false;

  const selectedRun = runs.find((run) => run.id === runId) ?? null;
  const selectClass =
    'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <Logo size={36} className="shrink-0" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Drifters</p>
            <p className="text-xs text-slate-400">Architecture Governance</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 px-5 py-3">
          <span className="inline-flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                demoMode ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            {demoMode ? 'Mock data mode' : 'Live mode · reading from database'}
          </span>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        {/* Topbar: global project/workspace/run context */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={selectClass}
            >
              <option value="">Project</option>
              {projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className={selectClass}
              disabled={!projectId}
            >
              <option value="">Workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.scanId} value={workspace.scanId}>
                  {workspace.name || workspace.scanId}
                </option>
              ))}
            </select>
            <select
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className={selectClass}
              disabled={!workspaceId}
            >
              <option value="">Run (all comparisons)</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.label}
                </option>
              ))}
            </select>
          </div>
          {selectedWorkspace && (
            <span className="font-mono text-xs text-gray-400">
              workspace: {selectedWorkspace.scanId}
              {selectedRun ? ` · run: ${selectedRun.id}` : ''}
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

