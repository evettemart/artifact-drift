import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IntegrationCard, type TestResult } from '../components/integrations/IntegrationCard';
import { AddIntegrationDialog } from '../components/integrations/AddIntegrationDialog';
import type { Integration, IntegrationPayload } from '../components/integrations/types';
import apiClient, { api } from '../lib/api';

interface SettingsScanRow {
  scanId: string;
  projectId: string;
  selectedIntegrations: string[];
}

type UsageFilter = 'all' | 'in-use' | 'not-in-use';

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');

  // Some users can run a stale frontend bundle where apiClient is missing
  // newer helper methods (e.g. createIntegration). Fall back to direct API calls.
  const integrationsApi = {
    getIntegrations: (params?: { projectId?: string }) =>
      (apiClient as any).getIntegrations
        ? (apiClient as any).getIntegrations(params)
        : api.get('/integrations', { params }),
    createIntegration: (payload: IntegrationPayload) =>
      (apiClient as any).createIntegration
        ? (apiClient as any).createIntegration(payload)
        : api.post('/integrations', payload),
    updateIntegration: (id: string, payload: IntegrationPayload) =>
      (apiClient as any).updateIntegration
        ? (apiClient as any).updateIntegration(id, payload)
        : api.put(`/integrations/${id}`, payload),
    deleteIntegration: (id: string) =>
      (apiClient as any).deleteIntegration
        ? (apiClient as any).deleteIntegration(id)
        : api.delete(`/integrations/${id}`),
  };

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => (await integrationsApi.getIntegrations()).data as Integration[],
  });

  const { data: allScans = [] } = useQuery({
    queryKey: ['settings-scans-all'],
    queryFn: async () => (await api.get('/settings/scans')).data as SettingsScanRow[],
  });

  const usageByIntegration = useMemo(() => {
    const map = new Map<string, number>();
    for (const integration of integrations) {
      const usage = allScans.filter((scan) => {
        const selected = Array.isArray(scan.selectedIntegrations)
          ? scan.selectedIntegrations
          : [];
        const sameProject =
          (integration as any).projectId && scan.projectId
            ? scan.projectId === (integration as any).projectId
            : true;
        return sameProject && selected.includes(integration.kind);
      }).length;
      map.set(integration.id, usage);
    }
    return map;
  }, [allScans, integrations]);

  const visibleIntegrations = useMemo(() => {
    if (usageFilter === 'all') {
      return integrations;
    }
    return integrations.filter((integration) => {
      const usage = usageByIntegration.get(integration.id) ?? 0;
      return usageFilter === 'in-use' ? usage > 0 : usage === 0;
    });
  }, [integrations, usageByIntegration, usageFilter]);

  const createMutation = useMutation({
    mutationFn: (payload: IntegrationPayload) => integrationsApi.createIntegration(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IntegrationPayload }) =>
      integrationsApi.updateIntegration(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => integrationsApi.deleteIntegration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
    onError: (error) => {
      const message =
        (error as any)?.response?.data?.error ?? 'Failed to delete integration. Please try again.';
      window.alert(message);
    },
  });

  async function handleSave(payload: IntegrationPayload, existingId?: string) {
    if (existingId) {
      await updateMutation.mutateAsync({ id: existingId, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  }

  function handleDelete(integration: Integration) {
    const confirmed = window.confirm(`Delete integration "${integration.name}"?`);
    if (confirmed) {
      deleteMutation.mutate(integration.id);
    }
  }

  function handleTest(id: string): Promise<TestResult> {
    const integration = integrations.find((i) => i.id === id);
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!integration || integration.status === 'unconfigured') {
          resolve({ ok: false, message: 'Not configured' });
        } else if (integration.status === 'error') {
          resolve({ ok: false, message: 'Authentication failed' });
        } else {
          resolve({ ok: true, message: 'Reachable' });
        }
      }, 600);
    });
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Integrations</h1>
          <p className="mt-1 text-sm text-slate-400">
            Connect architecture intent, Terraform state, and AWS infrastructure sources.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUsageFilter('all')}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                usageFilter === 'all'
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setUsageFilter('in-use')}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                usageFilter === 'in-use'
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              In use by workspace(s)
            </button>
            <button
              type="button"
              onClick={() => setUsageFilter('not-in-use')}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                usageFilter === 'not-in-use'
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Not in use
            </button>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          Add integration
        </button>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-400">Loading integrations…</p>
      ) : visibleIntegrations.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            {integrations.length === 0
              ? 'No integrations yet.'
              : 'No integrations match the current filter.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add a source to connect architecture intent, Terraform state, or AWS infrastructure.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onTest={handleTest}
              onEdit={setEditing}
              onDelete={handleDelete}
              workspaceUsageCount={usageByIntegration.get(integration.id) ?? 0}
            />
          ))}
        </div>
      )}

      {adding && <AddIntegrationDialog onClose={() => setAdding(false)} onSave={handleSave} />}

      {editing && (
        <AddIntegrationDialog
          existing={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
