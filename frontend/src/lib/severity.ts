export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface SeverityMeta {
  label: string;
  rank: number; // lower = more severe, for sorting
  /** Tailwind text color class */
  text: string;
  /** Tailwind background tint class */
  bg: string;
  /** Tailwind border class */
  border: string;
  /** Raw hex for charts / graph rendering */
  hex: string;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: {
    label: 'Critical',
    rank: 0,
    text: 'text-red-300',
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
    hex: '#ef4444',
  },
  high: {
    label: 'High',
    rank: 1,
    text: 'text-orange-300',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    hex: '#f97316',
  },
  medium: {
    label: 'Medium',
    rank: 2,
    text: 'text-yellow-300',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-500/40',
    hex: '#eab308',
  },
  low: {
    label: 'Low',
    rank: 3,
    text: 'text-green-300',
    bg: 'bg-green-500/15',
    border: 'border-green-500/40',
    hex: '#22c55e',
  },
  info: {
    label: 'Info',
    rank: 4,
    text: 'text-slate-300',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/40',
    hex: '#64748b',
  },
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function severityMeta(severity: string | null | undefined): SeverityMeta | null {
  if (!severity) return null;
  return SEVERITY_META[severity as Severity] ?? null;
}
