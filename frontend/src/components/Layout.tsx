import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, FileText, Network, Plug, TriangleAlert } from 'lucide-react';
import apiClient from '../lib/api';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/drift', label: 'Drift', icon: Activity },
  { path: '/graph', label: 'Graph', icon: Network },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/reports', label: 'Reports', icon: FileText },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.getProjects();
      return response.data;
    },
  });

  const { data: scansData } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const response = await apiClient.getScans({ limit: 1 });
      return response.data;
    },
  });

  const currentProject =
    Array.isArray(projectsData) && projectsData.length > 0 ? projectsData[0] : null;
  const latestScan =
    Array.isArray(scansData) && scansData.length > 0 ? scansData[0] : null;

  const projectName = currentProject?.name || 'Architecture Drift Copilot';
  const scanLabel = latestScan
    ? `Run · ${new Date(latestScan.startedAt).toLocaleString()}`
    : 'No scans yet';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <TriangleAlert className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Drift Copilot</p>
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
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Mock data mode
          </span>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        {/* Topbar: project + scan context */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 font-medium text-gray-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {projectName}
            </span>
            <span className="text-gray-300">/</span>
            <span className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600">
              {scanLabel}
            </span>
          </div>
          {latestScan && (
            <span className="font-mono text-xs text-gray-400">scan: {latestScan.scanId}</span>
          )}
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

