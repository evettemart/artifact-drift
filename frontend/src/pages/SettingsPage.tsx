import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

interface ConfiguredIntegration {
  id: string;
  integrationId: string;
  type: string;
  name: string;
  projectId: string;
}

interface SettingsProject {
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  scanCount: number;
}

interface SettingsWorkspace {
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  selectedIntegrationIds?: string[];
}

const INPUT_CLS =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30';

function errorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'error' in error.response.data &&
    typeof error.response.data.error === 'string'
  ) {
    return error.response.data.error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectSearch, setProjectSearch] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<string[]>([]);
  const [integrationSearch, setIntegrationSearch] = useState('');

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['settings-projects'],
    queryFn: async () => {
      const response = await api.get('/settings/projects');
      return response.data as SettingsProject[];
    },
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const visibleProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) {
      return projects;
    }
    return projects.filter((project) => {
      const haystack = `${project.name} ${project.description ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, projectSearch]);

  const { data: projectIntegrations = [] } = useQuery({
    queryKey: ['project-integrations', selectedProjectId],
    queryFn: async () => {
      const response = await api.get('/integrations');
      return response.data as ConfiguredIntegration[];
    },
    enabled: Boolean(selectedProjectId),
  });

  const filteredIntegrationOptions = useMemo(() => {
    const q = integrationSearch.trim().toLowerCase();
    return projectIntegrations.filter((integration) => {
      if (selectedIntegrationIds.includes(integration.integrationId)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        integration.name.toLowerCase().includes(q) ||
        integration.type.toLowerCase().includes(q)
      );
    });
  }, [projectIntegrations, integrationSearch, selectedIntegrationIds]);

  const selectedIntegrations = useMemo(() => {
    return projectIntegrations.filter((integration) =>
      selectedIntegrationIds.includes(integration.integrationId)
    );
  }, [projectIntegrations, selectedIntegrationIds]);

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['workspaces', selectedProjectId],
    queryFn: async () => {
      const response = await api.get('/workspaces', {
        params: { projectId: selectedProjectId },
      });
      return response.data as SettingsWorkspace[];
    },
    enabled: Boolean(selectedProjectId),
  });

  const createProject = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const response = await api.post('/projects', payload);
      return response.data as SettingsProject;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['settings-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProjectId(created.projectId);
      setProjectName('');
      setProjectDescription('');
    },
  });

  const createWorkspace = useMutation({
    mutationFn: async (payload: {
      projectId: string;
      name: string;
      description?: string;
      selectedIntegrationIds?: string[];
    }) => {
      const response = await api.post('/workspaces', payload);
      return response.data as SettingsWorkspace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-projects'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', selectedProjectId] });
      setWorkspaceName('');
      setWorkspaceDescription('');
      setSelectedIntegrationIds([]);
      setIntegrationSearch('');
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(`/projects/${projectId}`);
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['settings-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (selectedProjectId === projectId) {
        setSelectedProjectId('');
      }
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (integrationId: string) => {
      await api.delete(`/integrations/${integrationId}`);
      return integrationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-integrations', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) {
      return;
    }
    createProject.mutate({
      name,
      description: projectDescription.trim() || undefined,
    });
  }

  function toggleIntegration(integrationId: string) {
    setSelectedIntegrationIds((prev) =>
      prev.includes(integrationId)
        ? prev.filter((id) => id !== integrationId)
        : [...prev, integrationId]
    );
  }

  function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId || !workspaceName.trim()) {
      return;
    }

    createWorkspace.mutate({
      projectId: selectedProjectId,
      name: workspaceName.trim(),
      description: workspaceDescription.trim() || undefined,
      selectedIntegrationIds: selectedIntegrationIds.length > 0 ? selectedIntegrationIds : undefined,
    });
  }

  function handleDeleteIntegration(integration: ConfiguredIntegration) {
    const confirmed = window.confirm(
      `Delete integration "${integration.name}"? This will affect all workspaces using it.`
    );
    if (confirmed) {
      deleteIntegration.mutate(integration.id);
    }
  }

  function handleDeleteProject(project: SettingsProject) {
    const confirmed = window.confirm(
      `Delete project "${project.name}"? This also removes its scans and integrations.`
    );
    if (confirmed) {
      deleteProject.mutate(project.projectId);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Projects & Workspaces</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create projects, define workspaces, and configure integrations for each project.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Projects</h2>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              placeholder="Search projects..."
            />
          </div>

          <form className="mt-4 space-y-3" onSubmit={submitProject}>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              className={INPUT_CLS}
              placeholder="Project name"
            />
            <textarea
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              className={`${INPUT_CLS} min-h-[84px] resize-none`}
              placeholder="Description (optional)"
            />
            <button
              type="submit"
              disabled={createProject.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {createProject.isPending ? 'Creating...' : 'Create project'}
            </button>
            {createProject.isError && (
              <p className="text-xs text-red-400">
                {errorMessage(createProject.error, 'Failed to create project. Try again.')}
              </p>
            )}
          </form>

          <div className="mt-5 space-y-2">
            {projectsLoading && <p className="text-sm text-slate-400">Loading projects...</p>}
            {!projectsLoading && visibleProjects.length === 0 && (
              <p className="text-sm text-slate-400">No projects yet.</p>
            )}
            {visibleProjects.map((project) => {
              const active = selectedProjectId === project.projectId;
              return (
                <div
                  key={project.projectId}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-3 transition ${
                    active
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <button
                    onClick={() => setSelectedProjectId(project.projectId)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-slate-100">{project.name}</p>
                    {project.description && (
                      <p className="mt-1 text-xs text-slate-400">{project.description}</p>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project)}
                    disabled={deleteProject.isPending}
                    className="rounded p-1.5 text-slate-500 transition hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Workspaces & Integrations
          </h2>

          {!selectedProject && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Select a project to configure workspaces and integrations.
            </div>
          )}

          {selectedProject && (
            <>
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm font-semibold text-slate-100">{selectedProject.name}</p>
                {selectedProject.description && (
                  <p className="mt-1 text-xs text-slate-400">{selectedProject.description}</p>
                )}
              </div>

              <form className="mt-4 space-y-4" onSubmit={submitWorkspace}>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Workspace name
                  </label>
                  <input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    className={INPUT_CLS}
                    placeholder="e.g. Production Environment"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Description (optional)
                  </label>
                  <textarea
                    value={workspaceDescription}
                    onChange={(event) => setWorkspaceDescription(event.target.value)}
                    className={`${INPUT_CLS} min-h-[60px] resize-none`}
                    placeholder="Describe this workspace..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Select integrations for this workspace (optional)
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={integrationSearch}
                        onChange={(event) => setIntegrationSearch(event.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        placeholder="Search integrations..."
                      />
                    </div>

                    {selectedIntegrations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedIntegrations.map((integration) => (
                          <button
                            key={integration.integrationId}
                            type="button"
                            onClick={() => toggleIntegration(integration.integrationId)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                          >
                            {integration.name}
                            <X className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    )}

                    {projectIntegrations.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No integrations available. Add integrations below to enable workspace scanning.
                      </p>
                    )}

                    {filteredIntegrationOptions.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {filteredIntegrationOptions.map((integration) => (
                          <button
                            key={integration.integrationId}
                            type="button"
                            onClick={() => toggleIntegration(integration.integrationId)}
                            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-slate-700"
                          >
                            <span className="font-medium">{integration.name}</span>
                            <span className="ml-2 text-xs text-slate-500">({integration.type})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createWorkspace.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {createWorkspace.isPending ? 'Creating...' : 'Create workspace'}
                </button>
                {createWorkspace.isError && (
                  <p className="text-xs text-red-400">
                    {errorMessage(createWorkspace.error, 'Failed to create workspace.')}
                  </p>
                )}
              </form>

              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">Workspaces</h3>
                {workspacesLoading && <p className="text-sm text-slate-400">Loading workspaces...</p>}
                {!workspacesLoading && workspaces.length === 0 && (
                  <p className="text-sm text-slate-400">No workspaces yet. Create one above.</p>
                )}
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.workspaceId}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{workspace.name}</p>
                        {workspace.description && (
                          <p className="mt-1 text-xs text-slate-400">{workspace.description}</p>
                        )}
                      </div>
                      <span className="rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-300">
                        {workspace.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">Integrations</h3>
                <p className="text-xs text-slate-400">
                  Global integrations available to all projects and workspaces.
                </p>
                
                {projectIntegrations.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No integrations configured. Add integrations to enable scanning across all projects.
                  </p>
                )}
                
                {projectIntegrations.length > 0 && (
                  <div className="space-y-2">
                    {projectIntegrations.map((integration) => (
                      <div
                        key={integration.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-100">{integration.name}</p>
                          <p className="text-xs text-slate-400">{integration.type}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteIntegration(integration)}
                          disabled={deleteIntegration.isPending}
                          className="rounded p-1.5 text-slate-500 transition hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${integration.name}`}
                          title="Delete integration"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
                    Add Integration
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Note: This is a simplified interface. Use the Integrations page for full configuration.
                  </p>
                  <button
                    onClick={() => {
                      // For now, just show a message. Full integration management should be on a dedicated page
                      alert('Please use the Integrations page to add new integrations with full configuration options.');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add integration
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
