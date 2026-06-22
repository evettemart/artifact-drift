import { X, Check, EyeOff, RotateCcw, CircleCheck } from "lucide-react";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { usePatchDriftRecord } from "@/hooks/usePatchDriftRecord";
import { titleCase } from "@/lib/format";
import type { DriftRecord, RecordStatus } from "@/api/types";

export function DriftDetailDrawer({
  record,
  onClose,
}: {
  record: DriftRecord;
  onClose: () => void;
}) {
  const patch = usePatchDriftRecord();

  function setStatus(status: RecordStatus) {
    patch.mutate({ id: record.id, status });
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-[28rem] flex-col border-l border-border bg-bg-subtle shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={record.severity} />
              <StatusBadge status={record.status} />
              <span className="font-mono text-[11px] text-fg-subtle">
                {record.id}
              </span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-fg">
              {record.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-fg-subtle hover:bg-bg-panel hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta label="Drift type" value={titleCase(record.driftType)} />
            <Meta
              label="Resource kind"
              value={titleCase(record.resourceKind.replace(/^aws_/, ""))}
            />
            {record.nodeUid && <Meta label="Node" value={record.nodeUid} mono />}
            {record.edgeUid && <Meta label="Edge" value={record.edgeUid} mono />}
          </div>

          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
              Base vs Target
            </h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-bg-panel text-left text-fg-subtle">
                  <tr>
                    <th className="px-3 py-2 font-medium">Path</th>
                    <th className="px-3 py-2 font-medium">Base (intended)</th>
                    <th className="px-3 py-2 font-medium">Target (actual)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {record.diff.map((d, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-fg-muted">
                        {d.path}
                      </td>
                      <td className="px-3 py-2 font-mono text-severity-low">
                        {fmt(d.base)}
                      </td>
                      <td className="px-3 py-2 font-mono text-severity-critical">
                        {fmt(d.target)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <RawValue label="Base value" value={record.baseValue} />
            <RawValue label="Target value" value={record.targetValue} />
          </section>
        </div>

        <div className="border-t border-border px-5 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-fg-subtle">
            Actions
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={Check}
              label="Acknowledge"
              onClick={() => setStatus("acknowledged")}
              disabled={patch.isPending || record.status === "acknowledged"}
            />
            <ActionButton
              icon={CircleCheck}
              label="Resolve"
              onClick={() => setStatus("resolved")}
              disabled={patch.isPending || record.status === "resolved"}
            />
            <ActionButton
              icon={EyeOff}
              label="Suppress"
              onClick={() => setStatus("suppressed")}
              disabled={patch.isPending || record.status === "suppressed"}
            />
            <ActionButton
              icon={RotateCcw}
              label="Reopen"
              onClick={() => setStatus("open")}
              disabled={patch.isPending || record.status === "open"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-fg-subtle">{label}</div>
      <div className={"mt-0.5 text-fg " + (mono ? "font-mono text-[11px]" : "")}>
        {value}
      </div>
    </div>
  );
}

function RawValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <pre className="mt-1 overflow-auto rounded-lg border border-border bg-bg-panel p-2.5 text-[11px] text-fg">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-border bg-bg-panel px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
