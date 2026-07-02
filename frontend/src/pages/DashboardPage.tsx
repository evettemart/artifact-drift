import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, ArrowRight, Info } from 'lucide-react';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import apiClient from '../lib/api';
import { formatDate } from '../lib/utils';
import { SEVERITY_META, SEVERITY_ORDER } from '../lib/severity';
import { computeComplianceScore, scoreBand } from '../lib/scoring';
import { useGlobalScope } from '../context/GlobalScopeContext';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#64748b',
};

const CATEGORY_META: Record<string, { label: string; fill: string }> = {
  missing: { label: 'Missing', fill: '#ef4444' },
  unexpected: { label: 'Unexpected', fill: '#f59e0b' },
  attribute: { label: 'Attribute', fill: '#8b5cf6' },
  edge: { label: 'Edge', fill: '#06b6d4' },
};

const CHART_TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
};

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

export function DashboardPage() {
  const navigate = useNavigate();
  const { projectId, workspaceId, runId, projects, workspaces, selectedProject } = useGlobalScope();

  const currentProject = selectedProject;

  const { data: integrationsData } = useQuery({
    queryKey: ['integrations', projectId],
    queryFn: async () => {
      const response = await apiClient.getIntegrations({ projectId: projectId || undefined });
      return response.data;
    },
    enabled: Boolean(projectId),
  });

  const { data: scansData, isLoading: scansLoading, error: scansError } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const response = await apiClient.getScans({ limit: 100 });
      return response.data;
    },
  });

  const { data: driftRunsData } = useQuery({
    queryKey: ['drift-runs', workspaceId],
    queryFn: async () => {
      const response = await apiClient.getDriftRuns({ scanId: workspaceId || undefined });
      return response.data;
    },
    enabled: Boolean(workspaceId),
  });

  const runs = Array.isArray(driftRunsData?.runs) ? driftRunsData.runs : [];
  const selectedRun = runId ? runs.find((run: any) => run.id === runId) ?? null : null;
  const findingsScopeId = selectedRun?.scanId || workspaceId;

  const { data: findingsData } = useQuery({
    queryKey: ['findings', findingsScopeId, runId],
    queryFn: async () => {
      const response = await apiClient.getFindings({ scanId: findingsScopeId || undefined });
      return response.data;
    },
    enabled: Boolean(findingsScopeId),
  });

  const { data: resourcesData } = useQuery({
    queryKey: ['resources', findingsScopeId],
    queryFn: async () => {
      const response = await apiClient.getResources({ scanId: findingsScopeId || undefined });
      return response.data;
    },
    enabled: Boolean(findingsScopeId),
  });

  const allScans = Array.isArray(scansData) ? scansData : [];
  const projectScans = projectId
    ? allScans.filter((scan: any) => scan.projectId === projectId)
    : allScans;
  const resolvedFindingsScanId = findingsData?.scanId ?? findingsScopeId;
  const latestScan =
    projectScans.find((scan: any) => scan.scanId === resolvedFindingsScanId) ??
    projectScans[0] ??
    null;
  const findingsRaw = findingsData?.findings || [];
  const findings = runId
    ? findingsRaw.filter((finding: any) => {
        if (finding?.runId && finding.runId === runId) return true;
        if (selectedRun?.baseLayer && selectedRun?.targetLayer) {
          const driftType = String(finding?.driftType ?? '');
          const comparison = comparisonFromType(driftType);
          return comparison.base === selectedRun.baseLayer && comparison.target === selectedRun.targetLayer;
        }
        return false;
      })
    : findingsRaw;
  const allDriftRuns = runs;
  const driftRuns = runId
    ? allDriftRuns.filter((run: any) => run.id === runId)
    : allDriftRuns;
  const scopedRuns = projectScans;

  const resourceCounts = {
    intent: Array.isArray(resourcesData?.intentResources) ? resourcesData.intentResources.length : 0,
    terraform: Array.isArray(resourcesData?.terraformResources) ? resourcesData.terraformResources.length : 0,
    aws: Array.isArray(resourcesData?.awsResources) ? resourcesData.awsResources.length : 0,
  };

  const bySeverity = findings.reduce((acc: Record<string, number>, f: any) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  const byCategory = findings.reduce((acc: Record<string, number>, f: any) => {
    const c = f.category || 'attribute';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const severityChartData = ['critical', 'high', 'medium', 'low', 'info']
    .filter((s) => bySeverity[s])
    .map((severity) => ({
      severity: severity.charAt(0).toUpperCase() + severity.slice(1),
      count: bySeverity[severity],
      fill: SEVERITY_COLORS[severity],
    }));

  const typeChartData = Object.entries(byCategory).map(([key, value]) => ({
    key,
    name: CATEGORY_META[key]?.label ?? key,
    value: value as number,
    fill: CATEGORY_META[key]?.fill ?? '#64748b',
  }));

  const integrations = Array.isArray(integrationsData) ? integrationsData : [];

  const score = Number(latestScan?.complianceScore ?? 0);
  const scoreColor = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';

  const driftQuerySuffix = runId ? `&runId=${encodeURIComponent(runId)}` : '';
  const severityCards = [
    { key: 'total', label: 'Total Drifts', value: findings.length, color: '#e2e8f0', to: runId ? `/drift?runId=${encodeURIComponent(runId)}` : '/drift' },
    { key: 'critical', label: 'Critical', value: bySeverity.critical || 0, color: SEVERITY_COLORS.critical, to: `/drift?severity=critical${driftQuerySuffix}` },
    { key: 'high', label: 'High', value: bySeverity.high || 0, color: SEVERITY_COLORS.high, to: `/drift?severity=high${driftQuerySuffix}` },
    { key: 'medium', label: 'Medium', value: bySeverity.medium || 0, color: SEVERITY_COLORS.medium, to: `/drift?severity=medium${driftQuerySuffix}` },
    { key: 'low', label: 'Low', value: bySeverity.low || 0, color: SEVERITY_COLORS.low, to: `/drift?severity=low${driftQuerySuffix}` },
    { key: 'info', label: 'Info', value: bySeverity.info || 0, color: SEVERITY_COLORS.info, to: `/drift?severity=info${driftQuerySuffix}` },
  ];

  const topProjects = useMemo(() => {
    return projects
      .map((project: any) => {
        const projectScans = allScans.filter((scan: any) => scan.projectId === project.projectId);
        const runCount = projectScans.length;
        const avgScore =
          runCount > 0
            ? Math.round(
                projectScans.reduce((sum: number, scan: any) => sum + Number(scan.complianceScore ?? 0), 0) /
                  runCount,
              )
            : 0;
        const latest = projectScans[0] ?? null;
        return {
          projectId: project.projectId,
          name: project.name,
          runCount,
          avgScore,
          latestScore: latest ? Number(latest.complianceScore ?? 0) : null,
          latestAt: latest?.startedAt ?? null,
        };
      })
      .sort((a, b) => {
        const scoreDelta = (b.latestScore ?? -1) - (a.latestScore ?? -1);
        if (scoreDelta !== 0) return scoreDelta;
        return b.runCount - a.runCount;
      })
      .slice(0, 5);
  }, [projects, allScans]);

  const fleetInsights = useMemo(() => {
    const avgFleetScore =
      scopedRuns.length > 0
        ? Math.round(scopedRuns.reduce((sum: number, scan: any) => sum + Number(scan.complianceScore ?? 0), 0) / scopedRuns.length)
        : 0;
    const atRiskProjects = topProjects.filter((project) => (project.latestScore ?? 100) < 65).length;

    return {
      totalProjects: projects.length,
      totalWorkspaces: workspaces.length,
      totalRuns: scopedRuns.length,
      avgFleetScore,
      atRiskProjects,
    };
  }, [projects, workspaces, scopedRuns, topProjects]);

  if (scansLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (scansError) {
    return (
      <ErrorAlert
        title="Failed to load dashboard"
        message={(scansError as any)?.message || 'An error occurred while loading the dashboard'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">
              Overview of architecture drift analysis and operational posture.
            </p>
            <p className="mt-2 text-sm text-slate-200">
              <span className="text-slate-400">Project:</span>{' '}
              <span className="font-medium text-slate-100">
                {currentProject?.name || 'No project selected'}
              </span>
            </p>
          </div>
          {workspaceId && (
            <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-300">
              workspace: {workspaceId}
            </span>
          )}
        </div>
      </div>

      {/* Project & Integrations */}
      {currentProject && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Project &amp; Integrations
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                currentProject.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-slate-700/40 text-slate-300'
              }`}
            >
              {currentProject.status}
            </span>
          </div>
          <div className="mb-4">
            <p className="text-base font-semibold text-slate-100">{currentProject.name}</p>
            {currentProject.description && (
              <p className="mt-1 text-sm text-slate-400">{currentProject.description}</p>
            )}
          </div>
          {integrations.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {integrations.map((integration: any, index: number) => (
                <div
                  key={integration.integrationId || `${integration.name}-${index}`}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-slate-100">{integration.name}</h3>
                    <span className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">
                      {integration.type}
                    </span>
                  </div>
                  {integration.lastSyncAt && (
                    <p className="text-xs text-slate-500">
                      Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!latestScan ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-100">
          <Activity className="mx-auto h-10 w-10 text-slate-600" />
          <h2 className="mt-3 text-lg font-semibold text-slate-100">No scans yet</h2>
          <p className="mt-1 text-sm text-slate-400">
            Run your first scan to start analyzing architecture drift
          </p>
        </div>
      ) : (
        <>
          {/* Compliance + severity stats */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Compliance Score
              </h2>
              <div
                className="relative flex h-36 w-36 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(${scoreColor} ${score * 3.6}deg, #1e293b 0deg)` }}
              >
                <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-slate-950">
                  <span className="text-4xl font-bold" style={{ color: scoreColor }}>
                    {score}
                  </span>
                  <span className="text-xs text-slate-500">/ 100</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Last scan: {new Date(latestScan.startedAt).toLocaleString()}
              </p>
              <button
                type="button"
                onClick={() => navigate('/methodology')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/50 hover:text-slate-100"
                title="How is this score calculated?"
              >
                <Info className="h-3.5 w-3.5" />
                How is this calculated?
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
              {severityCards.map((card) => (
                <button
                  key={card.key}
                  onClick={() => navigate(card.to)}
                  className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-5 text-left transition hover:border-slate-600 hover:bg-slate-900"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {card.label}
                  </span>
                  <span className="mt-2 text-3xl font-bold" style={{ color: card.color }}>
                    {card.value}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Resource Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Resource Summary
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
                <div className="text-3xl font-bold text-slate-100">{resourceCounts.intent}</div>
                <div className="mt-1 text-sm text-slate-400">Architecture Intent</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
                <div className="text-3xl font-bold text-slate-100">{resourceCounts.terraform}</div>
                <div className="mt-1 text-sm text-slate-400">Terraform State</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
                <div className="text-3xl font-bold text-slate-100">{resourceCounts.aws}</div>
                <div className="mt-1 text-sm text-slate-400">AWS Deployed</div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Drift by Severity
              </h3>
              {severityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={severityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="severity"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={{ stroke: '#334155' }}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(30,41,59,0.35)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {severityChartData.map((entry) => (
                        <Cell key={entry.severity} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Drift by Type
                </h3>
                <span className="text-xs text-slate-500">Click to filter</span>
              </div>
              {typeChartData.length > 0 ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(d: any) =>
                          d?.key &&
                          navigate(
                            `/drift?category=${d.key}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`,
                          )
                        }
                        className="cursor-pointer focus:outline-none"
                      >
                        {typeChartData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.fill}
                            stroke="#0b1220"
                            strokeWidth={2}
                            className="cursor-pointer focus:outline-none"
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 sm:w-56">
                    {typeChartData.map((entry) => (
                      <button
                        key={entry.key}
                        onClick={() =>
                          navigate(
                            `/drift?category=${entry.key}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`,
                          )
                        }
                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm transition hover:border-slate-600"
                      >
                        <span className="flex items-center gap-2 truncate text-slate-300">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                          {entry.name}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-100">{entry.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[240px] items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Recent Drift Runs */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Recent Drift Runs
              </h3>
              <button
                onClick={() => navigate('/drift')}
                className="text-sm font-medium text-sky-400 hover:text-sky-300"
              >
                View all
              </button>
            </div>
            {driftRuns.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">No drift runs yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Comparison</th>
                      <th className="px-6 py-3 font-medium">Findings</th>
                      <th className="px-6 py-3 font-medium">Score</th>
                      <th className="px-6 py-3 font-medium">When</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {driftRuns.map((run: any) => {
                      const runScore = computeComplianceScore(run.summary);
                      const band = scoreBand(runScore);
                      return (
                        <tr
                          key={run.id}
                          onClick={() => navigate(`/drift?runId=${run.id}`)}
                          className="cursor-pointer transition hover:bg-slate-900"
                        >
                          <td className="px-6 py-4 font-medium text-slate-100">
                            {run.baseLabel} &rarr; {run.targetLabel}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              {SEVERITY_ORDER.filter((s) => run.summary[s] > 0).map((s) => (
                                <span
                                  key={s}
                                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_META[s].bg} ${SEVERITY_META[s].text}`}
                                >
                                  {run.summary[s]}
                                </span>
                              ))}
                              {run.total === 0 && (
                                <span className="text-xs text-slate-500">None</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold" style={{ color: band.color }}>
                            {runScore}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {latestScan ? formatDate(latestScan.startedAt) : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <ArrowRight className="ml-auto h-4 w-4 text-slate-500" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Top Projects
                </h3>
                <button
                  onClick={() => navigate('/settings')}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300"
                >
                  Manage projects
                </button>
              </div>
              {topProjects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                  No project scan history yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Project</th>
                        <th className="px-4 py-2.5 font-medium">Latest Score</th>
                        <th className="px-4 py-2.5 font-medium">Avg Score</th>
                        <th className="px-4 py-2.5 font-medium">Runs</th>
                        <th className="px-4 py-2.5 font-medium">Last Run</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {topProjects.map((project) => (
                        <tr key={project.projectId} className="transition hover:bg-slate-900">
                          <td className="px-4 py-3 font-medium text-slate-100">{project.name}</td>
                          <td className="px-4 py-3">
                            {project.latestScore === null ? (
                              <span className="text-slate-500">-</span>
                            ) : (
                              <span
                                className={`font-semibold ${
                                  project.latestScore >= 85
                                    ? 'text-emerald-400'
                                    : project.latestScore >= 65
                                      ? 'text-amber-300'
                                      : 'text-rose-400'
                                }`}
                              >
                                {project.latestScore}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{project.avgScore}</td>
                          <td className="px-4 py-3 text-slate-300">{project.runCount}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {project.latestAt ? formatDate(project.latestAt) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Fleet Insights
              </h3>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <div className="text-xs text-slate-500">Projects</div>
                  <div className="text-xl font-semibold text-slate-100">{fleetInsights.totalProjects}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <div className="text-xs text-slate-500">Configured Workspaces</div>
                  <div className="text-xl font-semibold text-slate-100">{fleetInsights.totalWorkspaces}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <div className="text-xs text-slate-500">Completed Runs</div>
                  <div className="text-xl font-semibold text-slate-100">{fleetInsights.totalRuns}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <div className="text-xs text-slate-500">Average Fleet Score</div>
                  <div className="text-xl font-semibold text-slate-100">{fleetInsights.avgFleetScore}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <div className="text-xs text-slate-500">Projects At Risk (&lt;65)</div>
                  <div className="text-xl font-semibold text-rose-400">{fleetInsights.atRiskProjects}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
