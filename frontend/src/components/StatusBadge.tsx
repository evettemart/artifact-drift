import type { RecordStatus } from "@/api/types";

const STATUS_META: Record<RecordStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-severity-high/15 text-severity-high border-severity-high/40",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-brand/15 text-brand border-brand/40",
  },
  resolved: {
    label: "Resolved",
    className: "bg-severity-low/15 text-severity-low border-severity-low/40",
  },
  suppressed: {
    label: "Suppressed",
    className: "bg-fg-subtle/15 text-fg-subtle border-fg-subtle/40",
  },
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
