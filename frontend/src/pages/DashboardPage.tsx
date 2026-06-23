import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Activity, ArrowRight, Clock, Info, Play } from 'lucide-react';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import apiClient from '../lib/api';
import { formatDate } from '../lib/utils';
import { SEVERITY_META, SEVERITY_ORDER } from '../lib/severity';
import { computeComplianceScore, scoreBand } from '../lib/scoring';

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

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.getProjects();
      return response.data;
    },
  });

  const currentProject =
    Array.isArray(projectsData) && projectsData.length > 0 ? projectsData[0] : null;

  const { data: integrationsData } = useQuery({
    queryKey: ['integrations', currentProject?.projectId],
    queryFn: async () => {
      const response = await apiClient.getIntegrations({ projectId: currentProject?.projectId });
      return response.data;
    },
    enabled: !!currentProject,
  });

  const { data: scansData, isLoading: scansLoading, error: scansError } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const response = await apiClient.getScans({ limit: 1 });
      return response.data;
    },
  });

  const { data: findingsData } = useQuery({
    queryKey: ['findings'],
    queryFn: async () => {
      const response = await apiClient.getFindings();
      return response.data;
    },
    enabled: !!(Array.isArray(scansData) && scansData.length > 0),
  });

  const { data: resourcesData } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const response = await apiClient.getResources();
      return response.data;
    },
    enabled: !!(Array.isArray(scansData) && scansData.length > 0),
  });

  const { data: driftRunsData } = useQuery({
    queryKey: ['drift-runs'],
    queryFn: async () => {
      const response = await apiClient.getDriftRuns();
      return response.data;
    },
    enabled: !!(Array.isArray(scansData) && scansData.length > 0),
  });

  const runAnalysisMutation = useMutation({
    mutationFn: () => apiClient.runAnalysis(),
    onMutate: () => {
      setIsRunning(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setTimeout(() => setIsRunning(false), 1000);
    },
    onError: () => {
      setIsRunning(false);
    },
  });

  const latestScan = Array.isArray(scansData) ? scansData[0] : null;
  const findings = findingsData?.findings || [];
  const driftRuns = driftRunsData?.runs || [];

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

  if (scansLoading || projectsLoading) {
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

  const integrations = Array.isArray(integrationsData) ? integrationsData : [];

  const score = latestScan?.complianceScore || 0;
  const scoreColor = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';

  const severityCards = [
    { key: 'total', label: 'Total Drifts', value: findings.length, color: '#e2e8f0', to: '/drift' },
    { key: 'critical', label: 'Critical', value: bySeverity.critical || 0, color: SEVERITY_COLORS.critical, to: '/drift?severity=critical' },
    { key: 'high', label: 'High', value: bySeverity.high || 0, color: SEVERITY_COLORS.high, to: '/drift?severity=high' },
    { key: 'medium', label: 'Medium', value: bySeverity.medium || 0, color: SEVERITY_COLORS.medium, to: '/drift?severity=medium' },
    { key: 'low', label: 'Low', value: bySeverity.low || 0, color: SEVERITY_COLORS.low, to: '/drift?severity=low' },
    { key: 'info', label: 'Info', value: bySeverity.info || 0, color: SEVERITY_COLORS.info, to: '/drift?severity=info' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            {currentProject ? currentProject.name : 'Overview of architecture drift analysis'}
          </p>
        </div>
        <button
          onClick={() => runAnalysisMutation.mutate()}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Clock className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Scan
            </>
          )}
        </button>
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
              {integrations.map((integration: any) => (
                <div
                  key={integration.integrationId}
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
          <button
            onClick={() => runAnalysisMutation.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            <Play className="h-4 w-4" />
            Run First Scan
          </button>
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
                        onClick={(d: any) => d?.key && navigate(`/drift?category=${d.key}`)}
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
                        onClick={() => navigate(`/drift?category=${entry.key}`)}
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
        </>
      )}
    </div>
  );
}
