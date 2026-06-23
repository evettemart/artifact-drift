import { useState } from 'react';
import { Plus } from 'lucide-react';
import { IntegrationCard, type TestResult } from '../components/integrations/IntegrationCard';
import {
  AddIntegrationDialog,
  type IntegrationDraft,
} from '../components/integrations/AddIntegrationDialog';
import { SEED_INTEGRATIONS } from '../components/integrations/data';
import type { Integration } from '../components/integrations/types';

let idCounter = 0;

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(SEED_INTEGRATIONS);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);

  function handleSave(draft: IntegrationDraft, existingId?: string) {
    if (existingId) {
      setIntegrations((prev) =>
        prev.map((i) => (i.id === existingId ? { ...i, ...draft } : i)),
      );
    } else {
      const created: Integration = {
        ...draft,
        id: `int-new-${++idCounter}`,
        status: 'connected',
        lastSync: new Date().toISOString(),
      };
      setIntegrations((prev) => [...prev, created]);
    }
  }

  function handleDelete(integration: Integration) {
    const confirmed = window.confirm(`Delete integration "${integration.name}"?`);
    if (confirmed) {
      setIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
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
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          Add integration
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onTest={handleTest}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))}
      </div>

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
