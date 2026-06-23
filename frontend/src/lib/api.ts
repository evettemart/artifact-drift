import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// API endpoints
export const apiClient = {
  // Health check
  health: () => api.get('/health'),

  // Projects
  getProjects: () => api.get('/projects'),
  getProject: (projectId: string) => api.get(`/projects/${projectId}`),

  // Integrations
  getIntegrations: (params?: { projectId?: string }) =>
    api.get('/integrations', { params }),

  // Analysis
  runAnalysis: () => api.post('/analyze'),

  // Findings
  getFindings: (params?: { scanId?: string; severity?: string; type?: string; status?: string }) =>
    api.get('/findings', { params }),

  // Resources
  getResources: (params?: { scanId?: string; source?: string }) =>
    api.get('/resources', { params }),

  // Scans
  getScans: (params?: { limit?: number }) =>
    api.get('/scans', { params }),

  // Report
  getReport: (params?: { scanId?: string; format?: 'json' | 'html' }) =>
    api.get('/report', { params }),

  // Graph
  getGraph: () => api.get('/graph'),
};

export default apiClient;
