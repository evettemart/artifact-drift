import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus, Save, Search, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

interface ConfiguredIntegration {
  id: string;
  kind: string;
  name: string;
  projectId: string;
}

interface IntegrationOption {
  id: string;
  kind: string;
  name: string;
  label: string;
}

interface SettingsProject {
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  scanCount: number;
}

interface SettingsScan {
  scanId: string;
  projectId: string;
  name: string;
  status: string;
  createdAt: string;
  selectedIntegrations: string[];
  outputPlan: {
    driftItems: string;
    graphOutputs: number;
  };
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

  const [scanName, setScanName] = useState('');
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [selectedIntegrationNamesByKind, setSelectedIntegrationNamesByKind] = useState<
    Record<string, string>
  >({});
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [editingScanId, setEditingScanId] = useState<string | null>(null);
  const [editIntegrations, setEditIntegrations] = useState<string[]>([]);
  const [editIntegrationNamesByKind, setEditIntegrationNamesByKind] = useState<
    Record<string, string>
  >({});
  const [editSearch, setEditSearch] = useState('');

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

  const { data: configuredIntegrations = [] } = useQuery({
    queryKey: ['settings-integrations-all'],
    queryFn: async () => {
      const response = await api.get('/integrations');
      return response.data as ConfiguredIntegration[];
    },
  });

  const integrationOptions = useMemo<IntegrationOption[]>(() => {
    return configuredIntegrations.map((integration) => ({
      id: integration.id,
      kind: integration.kind,
      name: integration.name,
      label: integration.name,
    }));
  }, [configuredIntegrations]);

  const fallbackIntegrationNameByKind = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of integrationOptions) {
      if (!map.has(option.kind)) {
        map.set(option.kind, option.name);
      }
    }
    return map;
  }, [integrationOptions]);

  function getIntegrationDisplayName(kind: string, namesByKind?: Record<string, string>): string {
    return namesByKind?.[kind] ?? fallbackIntegrationNameByKind.get(kind) ?? kind;
  }

  const filteredIntegrationOptions = useMemo(() => {
    const q = integrationSearch.trim().toLowerCase();
    return integrationOptions.filter((option) => {
      if (selectedIntegrations.includes(option.kind)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        option.label.toLowerCase().includes(q) ||
        option.name.toLowerCase().includes(q) ||
        option.kind.toLowerCase().includes(q)
      );
    });
  }, [integrationOptions, integrationSearch, selectedIntegrations]);

  const filteredEditOptions = useMemo(() => {
    const q = editSearch.trim().toLowerCase();
    return integrationOptions.filter((option) => {
      if (editIntegrations.includes(option.kind)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        option.label.toLowerCase().includes(q) ||
        option.name.toLowerCase().includes(q) ||
        option.kind.toLowerCase().includes(q)
      );
    });
  }, [integrationOptions, editSearch, editIntegrations]);

  const { data: scans = [], isLoading: scansLoading } = useQuery({
    queryKey: ['settings-scans', selectedProjectId],
    queryFn: async () => {
      const response = await api.get('/settings/scans', {
        params: { projectId: selectedProjectId },
      });
      return response.data as SettingsScan[];
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

  const createScan = useMutation({
    mutationFn: async (payload: {
      projectId: string;
      name: string;
      selectedIntegrations: string[];
    }) => {
      const response = await api.post('/settings/scans', payload);
      return response.data as SettingsScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-projects'] });
      queryClient.invalidateQueries({ queryKey: ['settings-scans', selectedProjectId] });
      setScanName('');
      setSelectedIntegrations([]);
      setSelectedIntegrationNamesByKind({});
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

  const updateScan = useMutation({
    mutationFn: async (payload: { scanId: string; selectedIntegrations: string[] }) => {
      const response = await api.patch(`/settings/scans/${payload.scanId}`, {
        selectedIntegrations: payload.selectedIntegrations,
      });
      return response.data as SettingsScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-scans', selectedProjectId] });
      setEditingScanId(null);
      setEditIntegrations([]);
      setEditIntegrationNamesByKind({});
      setEditSearch('');
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

  function toggleIntegration(kind: string, name: string) {
    setSelectedIntegrations((prev) =>
      prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind]
    );
    setSelectedIntegrationNamesByKind((prev) => {
      if (selectedIntegrations.includes(kind)) {
        const { [kind]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [kind]: name };
    });
  }

  function startEditingScan(scan: SettingsScan) {
    setEditingScanId(scan.scanId);
    setEditIntegrations(scan.selectedIntegrations);
    const namesByKind: Record<string, string> = {};
    for (const kind of scan.selectedIntegrations) {
      namesByKind[kind] = getIntegrationDisplayName(kind);
    }
    setEditIntegrationNamesByKind(namesByKind);
    setEditSearch('');
  }

  function toggleEditIntegration(kind: string, name: string) {
    setEditIntegrations((prev) =>
      prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind]
    );
    setEditIntegrationNamesByKind((prev) => {
      if (editIntegrations.includes(kind)) {
        const { [kind]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [kind]: name };
    });
  }

  function saveEditedScan(scanId: string) {
    if (editIntegrations.length === 0) {
      return;
    }
    updateScan.mutate({ scanId, selectedIntegrations: editIntegrations });
  }

  function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId || !scanName.trim() || selectedIntegrations.length === 0) {
      return;
    }

    createScan.mutate({
      projectId: selectedProjectId,
      name: scanName.trim(),
      selectedIntegrations,
    });
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
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create projects first, then define workspaces for each project and choose which integrations each workspace uses.
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
                    <p className="mt-1 text-xs text-slate-400">
                      {project.scanCount} {project.scanCount === 1 ? 'workspace' : 'workspaces'}
                    </p>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Workspaces</h2>

          {!selectedProject && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Select a project to configure workspaces.
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

              <form className="mt-4 space-y-4" onSubmit={submitScan}>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Workspace name
                  </label>
                  <input
                    value={scanName}
                    onChange={(event) => setScanName(event.target.value)}
                    className={INPUT_CLS}
                    placeholder="e.g. nightly-architecture-workspace"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Integrations selected by this workspace
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={integrationSearch}
                        onChange={(event) => setIntegrationSearch(event.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        placeholder="Search configured integrations..."
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedIntegrations.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() =>
                            toggleIntegration(
                              kind,
                              getIntegrationDisplayName(kind, selectedIntegrationNamesByKind)
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                        >
                          {getIntegrationDisplayName(kind, selectedIntegrationNamesByKind)}
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredIntegrationOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleIntegration(option.kind, option.name)}
                          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-slate-700"
                        >
                          <span className="font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>

                    {integrationOptions.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No configured integrations found.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createScan.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Settings2 className="h-4 w-4" />
                  {createScan.isPending ? 'Creating workspace...' : 'Create workspace'}
                </button>
                {createScan.isError && (
                  <p className="text-xs text-red-400">
                    {errorMessage(
                      createScan.error,
                      'Failed to create scan. Make sure a name and at least one integration are selected.'
                    )}
                  </p>
                )}
              </form>

              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Configured workspaces</h3>
                {scansLoading && <p className="text-sm text-slate-400">Loading workspaces...</p>}
                {!scansLoading && scans.length === 0 && (
                  <p className="text-sm text-slate-400">No workspaces configured for this project.</p>
                )}
                {scans.map((scan) => (
                  <article
                    key={scan.scanId}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">{scan.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-300">
                          {scan.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditingScan(scan)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit integrations
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Integrations:{' '}
                      {scan.selectedIntegrations
                        .map((kind) => getIntegrationDisplayName(kind, editIntegrationNamesByKind))
                        .join(', ')}
                    </p>

                    {editingScanId === scan.scanId && (
                      <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-slate-900/70 p-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <input
                            value={editSearch}
                            onChange={(event) => setEditSearch(event.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                            placeholder="Search configured integrations..."
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {editIntegrations.map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() =>
                                toggleEditIntegration(
                                  kind,
                                  getIntegrationDisplayName(kind, editIntegrationNamesByKind)
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                            >
                              {getIntegrationDisplayName(kind, editIntegrationNamesByKind)}
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {filteredEditOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleEditIntegration(option.kind, option.name)}
                              className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-slate-700"
                            >
                              <span className="font-medium">{option.label}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingScanId(null);
                              setEditIntegrations([]);
                              setEditIntegrationNamesByKind({});
                              setEditSearch('');
                            }}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={updateScan.isPending || editIntegrations.length === 0}
                            onClick={() => saveEditedScan(scan.scanId)}
                            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Save className="h-3 w-3" />
                            {updateScan.isPending ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                        <Sparkles className="h-3 w-3" />
                        Drift items: {scan.outputPlan.driftItems}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Graphs per integration: {scan.outputPlan.graphOutputs}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
