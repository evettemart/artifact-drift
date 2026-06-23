import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { DriftBadge, DriftTypeBadge } from '../components/DriftBadge';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert, EmptyState } from '../components/ErrorAlert';
import apiClient from '../lib/api';
import { formatDate } from '../lib/utils';

interface Finding {
  driftId: string;
  driftType: string;
  severity: string;
  status: string;
  resourceType: string;
  logicalName: string;
  region: string;
  diffSummary: string;
  reasoning?: {
    summary: string;
    likelyCause: string;
    impact: string;
    terraformRemediation: string;
  };
  expected?: any;
  observed?: any;
  detectedAt: string;
}

export function FindingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: findingsData, isLoading, error } = useQuery({
    queryKey: ['findings'],
    queryFn: async () => {
      const response = await apiClient.getFindings();
      return response.data;
    },
  });

  const findings: Finding[] = findingsData?.findings || [];

  // Filter findings
  const filteredFindings = findings.filter((finding) => {
    const matchesSearch = 
      finding.logicalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.resourceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.diffSummary.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || finding.severity === severityFilter;
    const matchesType = typeFilter === 'all' || finding.driftType === typeFilter;

    return matchesSearch && matchesSeverity && matchesType;
  });

  // Get unique values for filters
  const severities = Array.from(new Set(findings.map(f => f.severity)));
  const types = Array.from(new Set(findings.map(f => f.driftType)));

  if (isLoading) {
    return <LoadingState message="Loading findings..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Failed to load findings"
        message={(error as any)?.message || 'An error occurred while loading findings'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Findings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Detailed view of all detected drift findings
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search findings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Severity Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Severities</option>
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredFindings.length} of {findings.length} findings
          </span>
          {(searchQuery || severityFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter('all');
                setTypeFilter('all');
              }}
              className="text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <EmptyState
          title="No findings found"
          message={
            searchQuery || severityFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No drift findings detected in the latest scan'
          }
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedId === finding.driftId;
            
            return (
              <div key={finding.driftId} className="hover:bg-gray-50">
                {/* Finding Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : finding.driftId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        )}
                        <DriftBadge severity={finding.severity} />
                        <DriftTypeBadge type={finding.driftType} />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 ml-7">
                        {finding.logicalName}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600 ml-7">
                        {finding.diffSummary}
                      </p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 ml-7">
                        <span>{finding.resourceType}</span>
                        <span>•</span>
                        <span>{finding.region}</span>
                        <span>•</span>
                        <span>{formatDate(finding.detectedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && finding.reasoning && (
                  <div className="px-4 pb-4 ml-7 space-y-4">
                    {/* Analysis */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">
                        Analysis
                      </h4>
                      <p className="text-sm text-blue-800">{finding.reasoning.summary}</p>
                    </div>

                    {/* Likely Cause */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-yellow-900 mb-2">
                        Likely Cause
                      </h4>
                      <p className="text-sm text-yellow-800">{finding.reasoning.likelyCause}</p>
                    </div>

                    {/* Impact */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-orange-900 mb-2">
                        Impact
                      </h4>
                      <p className="text-sm text-orange-800">{finding.reasoning.impact}</p>
                    </div>

                    {/* Remediation */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Terraform Remediation
                      </h4>
                      <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
                        <code>{finding.reasoning.terraformRemediation}</code>
                      </pre>
                    </div>

                    {/* Expected vs Observed */}
                    {(finding.expected || finding.observed) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {finding.expected && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-green-900 mb-2">
                              Expected
                            </h4>
                            <pre className="text-xs text-green-800 overflow-x-auto">
                              {JSON.stringify(finding.expected, null, 2)}
                            </pre>
                          </div>
                        )}
                        {finding.observed && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-red-900 mb-2">
                              Observed
                            </h4>
                            <pre className="text-xs text-red-800 overflow-x-auto">
                              {JSON.stringify(finding.observed, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
