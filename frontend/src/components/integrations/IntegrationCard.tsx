import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Plug, PlugZap, Lock, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { schemaForKind } from './schemas';
import { layerLabel, type Integration, type IntegrationStatus } from './types';

const STATUS_META: Record<IntegrationStatus, { label: string; dot: string; text: string }> = {
  connected: { label: 'Connected', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  error: { label: 'Error', dot: 'bg-red-500', text: 'text-red-400' },
  unconfigured: { label: 'Unconfigured', dot: 'bg-slate-500', text: 'text-slate-400' },
  syncing: { label: 'Syncing', dot: 'bg-sky-400', text: 'text-sky-400' },
};

export type TestResult = { ok: boolean; message: string };

export function IntegrationCard({
  integration,
  onTest,
  onEdit,
  onDelete,
  workspaceUsageCount = 0,
}: {
  integration: Integration;
  onTest: (id: string) => Promise<TestResult>;
  onEdit: (integration: Integration) => void;
  onDelete: (integration: Integration) => void;
  workspaceUsageCount?: number;
}) {
  const schema = schemaForKind(integration.kind);
  const Icon = schema?.icon ?? Plug;
  const status = STATUS_META[integration.status] ?? STATUS_META.unconfigured;
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleTest() {
    setResult(null);
    setPending(true);
    try {
      setResult(await onTest(integration.id));
    } finally {
      setPending(false);
    }
  }

  const configEntries = Object.entries(integration.config)
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, 3);
  const inUse = workspaceUsageCount > 0;

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">{integration.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {layerLabel(integration.layer)}
              {schema?.readOnly && (
                <span className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400">
                  <Lock className="h-2.5 w-2.5" />
                  read-only
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
          {inUse && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              In use ({workspaceUsageCount})
            </span>
          )}
          <div className="ml-1 flex items-center gap-0.5">
            <button
              onClick={() => onEdit(integration)}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-800/60 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              aria-label={`Edit ${integration.name}`}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(integration)}
              disabled={inUse}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-800/60 text-slate-500 hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Delete ${integration.name}`}
              title={inUse ? 'Cannot delete while associated with a workspace' : 'Delete'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {schema && <p className="mt-3 text-xs text-slate-400">{schema.description}</p>}

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {configEntries.map(([k, v]) => {
          const isSecret = schema?.fields.find((f) => f.key === k)?.secret;
          return (
            <div key={k} className="flex justify-between gap-2">
              <span>{k}</span>
              <span className="truncate font-mono text-slate-400">
                {isSecret ? '••••••' : String(v)}
              </span>
            </div>
          );
        })}
        {integration.lastSync && (
          <div className="flex justify-between gap-2">
            <span>last sync</span>
            <span className="text-slate-400">{formatDate(integration.lastSync)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-3">
        <button
          onClick={handleTest}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlugZap className="h-3.5 w-3.5" />
          )}
          Test connection
        </button>

        {result && (
          <span
            className={`flex items-center gap-1 text-xs ${
              result.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
