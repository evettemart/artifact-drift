import { X } from 'lucide-react';
import { kindMeta } from './kindMeta';
import { SEVERITY_META } from '../../lib/severity';
import type { GraphNodeData } from './types';

export function NodeDetailPanel({
  node,
  onClose,
}: {
  node: GraphNodeData;
  onClose: () => void;
}) {
  const meta = kindMeta(node.kind);
  const Icon = meta.icon;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{node.name}</div>
            <div className="text-xs text-slate-400">{meta.label}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto px-4 py-4">
        <section>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Resource
          </h3>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">region</dt>
              <dd className="font-mono text-slate-200">{node.region}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">source</dt>
              <dd className="font-mono text-slate-200">{node.source}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">type</dt>
              <dd className="font-mono text-slate-200">{node.type}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Attributes
          </h3>
          <dl className="mt-2 space-y-1.5">
            {Object.entries(node.attributes).length === 0 ? (
              <p className="text-xs text-slate-500">No attributes captured.</p>
            ) : (
              Object.entries(node.attributes).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 text-xs">
                  <dt className="text-slate-400">{key}</dt>
                  <dd className="max-w-[60%] truncate text-right font-mono text-slate-200">
                    {JSON.stringify(value)}
                  </dd>
                </div>
              ))
            )}
          </dl>
        </section>

        {Object.keys(node.tags).length > 0 && (
          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Tags
            </h3>
            <dl className="mt-2 space-y-1.5">
              {Object.entries(node.tags).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 text-xs">
                  <dt className="text-slate-400">{key}</dt>
                  <dd className="max-w-[60%] truncate text-right font-mono text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Drift issues ({node.drifts.length})
          </h3>
          {node.drifts.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No drift detected on this resource.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {node.drifts.map((drift) => {
                const sev = SEVERITY_META[drift.severity];
                return (
                  <li
                    key={drift.driftId}
                    className="rounded-lg border border-slate-700 bg-slate-800 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text}`}
                      >
                        {sev.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{drift.driftType}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-200">{drift.title}</div>
                    {drift.diffSummary && drift.diffSummary !== drift.title && (
                      <div className="mt-1 text-[11px] text-slate-400">{drift.diffSummary}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
