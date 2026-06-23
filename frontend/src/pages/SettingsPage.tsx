import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Settings2, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { INTEGRATION_SCHEMAS } from '../components/integrations/schemas';

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

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const [scanName, setScanName] = useState('');
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);

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

  function toggleIntegration(kind: string) {
    setSelectedIntegrations((prev) =>
      prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind]
    );
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Project Scans</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create projects first, then define scans for each project and choose which integrations each scan uses.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Projects</h2>

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
            {!projectsLoading && projects.length === 0 && (
              <p className="text-sm text-slate-400">No projects yet.</p>
            )}
            {projects.map((project) => {
              const active = selectedProjectId === project.projectId;
              return (
                <button
                  key={project.projectId}
                  onClick={() => setSelectedProjectId(project.projectId)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    active
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-100">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {project.scanCount} {project.scanCount === 1 ? 'scan' : 'scans'}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Scans</h2>

          {!selectedProject && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Select a project to configure scans.
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
                    Scan name
                  </label>
                  <input
                    value={scanName}
                    onChange={(event) => setScanName(event.target.value)}
                    className={INPUT_CLS}
                    placeholder="e.g. nightly-architecture-scan"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Integrations selected by this scan
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {INTEGRATION_SCHEMAS.map((schema) => {
                      const checked = selectedIntegrations.includes(schema.kind);
                      return (
                        <button
                          key={schema.kind}
                          type="button"
                          onClick={() => toggleIntegration(schema.kind)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                            checked
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="font-medium">{schema.label}</span>
                          <span className="block text-xs opacity-80">{schema.layer}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createScan.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Settings2 className="h-4 w-4" />
                  {createScan.isPending ? 'Creating scan...' : 'Create scan'}
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
                <h3 className="text-sm font-semibold text-slate-200">Configured scans</h3>
                {scansLoading && <p className="text-sm text-slate-400">Loading scans...</p>}
                {!scansLoading && scans.length === 0 && (
                  <p className="text-sm text-slate-400">No scans configured for this project.</p>
                )}
                {scans.map((scan) => (
                  <article
                    key={scan.scanId}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">{scan.name}</p>
                      <span className="rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-300">
                        {scan.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Integrations: {scan.selectedIntegrations.join(', ')}
                    </p>
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
