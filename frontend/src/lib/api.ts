import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiClient = {
  // Health check
  health: () => api.get('/health'),

  // Projects
  getProjects: () => api.get('/projects'),
  getProject: (projectId: string) => api.get(`/projects/${projectId}`),

  // Workspaces
  getWorkspaces: (params: { projectId: string }) =>
    api.get('/workspaces', { params }),
  getWorkspace: (workspaceId: string) => api.get(`/workspaces/${workspaceId}`),
  createWorkspace: (data: {
    projectId: string;
    name: string;
    description?: string;
  }) => api.post('/workspaces', data),

  // Integrations
  getIntegrations: (params?: { projectId?: string }) =>
    api.get('/integrations', { params }),
  createIntegration: (data: {
    projectId: string;
    kind: string;
    name: string;
    configJson?: string;
  }) => api.post('/integrations', data),
  deleteIntegration: (integrationId: string) =>
    api.delete(`/integrations/${integrationId}`),

  // Analysis
  runAnalysis: (data?: { scanId?: string }) => api.post('/analyze', data),

  // Findings
  getFindings: (params?: {
    scanId?: string;
    severity?: string;
    type?: string;
    status?: string;
    runId?: string;
  }) => api.get('/findings', { params }),

  // Drift runs
  getDriftRuns: (params?: { scanId?: string }) =>
    api.get('/drift-runs', { params }),

  // Resources
  getResources: (params?: { scanId?: string; source?: string }) =>
    api.get('/resources', { params }),

  // Scans
  getScans: (params?: { limit?: number }) =>
    api.get('/scans', { params }),

  // Settings
  getSettingsScans: (projectIdOrParams?: string | { projectId?: string }) => {
    const params =
      typeof projectIdOrParams === 'string'
        ? { projectId: projectIdOrParams }
        : projectIdOrParams;

    return api.get('/settings/scans', {
      params,
    });
  },

  // Report
  getReport: (params?: { scanId?: string; format?: 'json' | 'html' }) =>
    api.get('/report', { params }),

  // Graph
  getGraph: (params?: { scanId?: string }) =>
    api.get('/graph', { params }),
};

export default apiClient;
