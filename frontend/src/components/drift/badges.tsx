import { SEVERITY_META, type Severity } from '../../lib/severity';
import type { DriftStatus } from './types';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.info;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}
    >
      {meta.label}
    </span>
  );
}

const STATUS_META: Record<DriftStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
  resolved: { label: 'Resolved', cls: 'bg-green-500/15 text-green-300 border-green-500/40' },
  suppressed: { label: 'Suppressed', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
};

export function StatusBadge({ status }: { status: DriftStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.open;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
