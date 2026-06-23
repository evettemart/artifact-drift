import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, FileJson, Eye } from 'lucide-react';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import apiClient from '../lib/api';

export function ReportsPage() {
  const [selectedFormat, setSelectedFormat] = useState<'html' | 'json'>('html');
  const [previewMode, setPreviewMode] = useState(false);

  // Fetch scans for selection
  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const response = await apiClient.getScans();
      return response.data;
    },
  });

  // Fetch report data
  const { data: reportData, isLoading: reportLoading, error } = useQuery({
    queryKey: ['report', selectedFormat],
    queryFn: async () => {
      const response = await apiClient.getReport({ format: selectedFormat });
      return response.data;
    },
    enabled: previewMode,
  });

  const latestScan = scansData?.scans?.[0];

  const handleDownload = async (format: 'html' | 'json') => {
    try {
      const response = await apiClient.getReport({ format });
      const data = response.data;

      let blob: Blob;
      let filename: string;

      if (format === 'html') {
        // For HTML, we need to get the HTML string
        const htmlResponse = await fetch(`http://localhost:3001/api/report?format=html`);
        const htmlText = await htmlResponse.text();
        blob = new Blob([htmlText], { type: 'text/html' });
        filename = `drift-report-${new Date().toISOString().split('T')[0]}.html`;
      } else {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `drift-report-${new Date().toISOString().split('T')[0]}.json`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (scansLoading) {
    return <LoadingState message="Loading reports..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and download drift analysis reports
        </p>
      </div>

      {/* Report Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Report Configuration</h2>
        
        <div className="space-y-4">
          {/* Scan Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Scan
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled
            >
              {latestScan ? (
                <option>
                  {new Date(latestScan.startedAt).toLocaleString()} - Score: {latestScan.complianceScore}/100
                </option>
              ) : (
                <option>No scans available</option>
              )}
            </select>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedFormat('html')}
                className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-colors ${
                  selectedFormat === 'html'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText className="h-5 w-5 mr-2" />
                HTML Report
              </button>
              <button
                onClick={() => setSelectedFormat('json')}
                className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-colors ${
                  selectedFormat === 'json'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileJson className="h-5 w-5 mr-2" />
                JSON Report
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              disabled={!latestScan}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? 'Hide Preview' : 'Preview Report'}
            </button>
            <button
              onClick={() => handleDownload(selectedFormat)}
              disabled={!latestScan}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Download {selectedFormat.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {previewMode && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Report Preview</h2>
          </div>
          <div className="p-6">
            {reportLoading ? (
              <LoadingState message="Loading preview..." />
            ) : error ? (
              <ErrorAlert
                title="Failed to load preview"
                message={(error as any)?.message || 'An error occurred while loading the preview'}
              />
            ) : selectedFormat === 'html' ? (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={reportData}
                  className="w-full h-[600px]"
                  title="Report Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm">
                  <code>{JSON.stringify(reportData, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Reports</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• HTML reports provide a formatted, human-readable view of findings</li>
          <li>• JSON reports contain structured data for programmatic processing</li>
          <li>• Reports include compliance scores, findings, and remediation steps</li>
          <li>• All sensitive data is automatically redacted in reports</li>
        </ul>
      </div>
    </div>
  );
}
