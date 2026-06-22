import { X } from "lucide-react";
import { SEVERITY_META } from "@/lib/severity";
import { kindMeta } from "@/features/graph/nodes/kindMeta";
import type { CanonicalNode, DriftRecord } from "@/api/types";

export function NodeDetailPanel({
  node,
  records,
  onClose,
}: {
  node: CanonicalNode;
  records: DriftRecord[];
  onClose: () => void;
}) {
  const meta = kindMeta(node.kind);
  const Icon = meta.icon;
  const related = records.filter((r) => r.nodeUid === node.uid);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-bg-subtle">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/15 text-brand">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-fg">
              {node.name}
            </div>
            <div className="text-xs text-fg-subtle">{meta.label}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-fg-subtle hover:bg-bg-panel hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto px-4 py-4">
        <section>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
            Attributes
          </h3>
          <dl className="mt-2 space-y-1.5">
            {Object.entries(node.attributes).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 text-xs">
                <dt className="text-fg-muted">{key}</dt>
                <dd className="max-w-[60%] truncate text-right font-mono text-fg">
                  {JSON.stringify(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
            Provenance
          </h3>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">source</dt>
              <dd className="font-mono text-fg">{node.provenance.source}</dd>
            </div>
            {node.provenance.ref && (
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">ref</dt>
                <dd className="max-w-[60%] truncate text-right font-mono text-fg">
                  {node.provenance.ref}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
            Related drift ({related.length})
          </h3>
          {related.length === 0 ? (
            <p className="mt-2 text-xs text-fg-subtle">
              No drift findings on this resource.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {related.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-bg-panel p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_META[r.severity].bg} ${SEVERITY_META[r.severity].text}`}
                    >
                      {SEVERITY_META[r.severity].label}
                    </span>
                    <span className="font-mono text-[10px] text-fg-subtle">
                      {r.id}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-fg">{r.title}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
