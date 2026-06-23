import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Clock, Play } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { DriftBadge } from '../components/DriftBadge';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert, EmptyState } from '../components/ErrorAlert';
import apiClient from '../lib/api';
import { getComplianceColor } from '../lib/utils';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

const DRIFT_TYPE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
  '#10b981', '#06b6d4', '#6366f1', '#f43f5e'
];

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  // Fetch latest scan
  const { data: scansData, isLoading: scansLoading, error: scansError } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const response = await apiClient.getScans({ limit: 1 });
      return response.data;
    },
  });

  // Fetch findings
  const { data: findingsData, isLoading: findingsLoading } = useQuery({
    queryKey: ['findings'],
    queryFn: async () => {
      const response = await apiClient.getFindings();
      return response.data;
    },
    enabled: !!scansData?.scans?.[0],
  });

  // Run analysis mutation
  const runAnalysisMutation = useMutation({
    mutationFn: () => apiClient.runAnalysis(),
    onMutate: () => {
      setIsRunning(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
      setTimeout(() => setIsRunning(false), 1000);
    },
    onError: () => {
      setIsRunning(false);
    },
  });

  const latestScan = scansData?.scans?.[0];
  const findings = findingsData?.findings || [];

  // Calculate statistics
  const stats = {
    totalFindings: findings.length,
    bySeverity: findings.reduce((acc: any, f: any) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {}),
    byType: findings.reduce((acc: any, f: any) => {
      acc[f.driftType] = (acc[f.driftType] || 0) + 1;
      return acc;
    }, {}),
  };

  // Prepare chart data
  const severityChartData = Object.entries(stats.bySeverity).map(([severity, count]) => ({
    severity: severity.charAt(0).toUpperCase() + severity.slice(1),
    count,
    fill: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '#6b7280',
  }));

  const typeChartData = Object.entries(stats.byType).map(([type, count], index) => ({
    name: type.replace(/_/g, ' '),
    value: count,
    fill: DRIFT_TYPE_COLORS[index % DRIFT_TYPE_COLORS.length],
  }));

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of architecture drift analysis
          </p>
        </div>
        <button
          onClick={() => runAnalysisMutation.mutate()}
          disabled={isRunning}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Scan
            </>
          )}
        </button>
      </div>

      {!latestScan ? (
        <EmptyState
          title="No scans yet"
          message="Run your first scan to start analyzing architecture drift"
          icon={Activity}
          action={{
            label: 'Run First Scan',
            onClick: () => runAnalysisMutation.mutate(),
          }}
        />
      ) : (
        <>
          {/* Compliance Score */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="text-center">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Compliance Score</h2>
              <div className={`text-6xl font-bold ${getComplianceColor(latestScan.complianceScore || 0)}`}>
                {latestScan.complianceScore || 0}
                <span className="text-3xl">/100</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Last scan: {new Date(latestScan.startedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Findings"
              value={stats.totalFindings}
              icon={Activity}
            />
            <StatCard
              title="Critical"
              value={stats.bySeverity.critical || 0}
              icon={AlertTriangle}
              className="border-red-200"
            />
            <StatCard
              title="High"
              value={stats.bySeverity.high || 0}
              icon={AlertTriangle}
              className="border-orange-200"
            />
            <StatCard
              title="Medium"
              value={stats.bySeverity.medium || 0}
              icon={CheckCircle}
              className="border-yellow-200"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Findings by Severity
              </h3>
              {severityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={severityChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No data available
                </div>
              )}
            </div>

            {/* Drift Type Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Findings by Type
              </h3>
              {typeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Recent Findings */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Findings</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {findingsLoading ? (
                <LoadingState message="Loading findings..." />
              ) : findings.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No findings detected
                </div>
              ) : (
                findings.slice(0, 5).map((finding: any) => (
                  <div key={finding.driftId} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <DriftBadge severity={finding.severity} />
                          <span className="text-sm font-medium text-gray-900">
                            {finding.logicalName}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {finding.diffSummary}
                        </p>
                      </div>
                      <div className="ml-4 text-sm text-gray-500">
                        {finding.resourceType}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
