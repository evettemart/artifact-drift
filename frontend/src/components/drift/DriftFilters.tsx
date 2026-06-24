import { Search } from 'lucide-react';
import { SEVERITY_META, SEVERITY_ORDER, type Severity } from '../../lib/severity';
import type {
  DriftCategory,
  DriftFilterState,
  DriftRun,
  DriftStatus,
} from './types';

interface ProjectOption {
  projectId: string;
  name: string;
}

interface ScanOption {
  scanId: string;
  name?: string;
  startedAt?: string;
  status?: string;
}

const CATEGORIES: { value: DriftCategory; label: string }[] = [
  { value: 'missing', label: 'Missing' },
  { value: 'unexpected', label: 'Unexpected' },
  { value: 'attribute', label: 'Attribute' },
  { value: 'edge', label: 'Edge' },
];

const STATUSES: { value: DriftStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'suppressed', label: 'Suppressed' },
];

function toggle<T>(list: T[], value: T): T[] {
  const set = new Set(list);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

const SELECT_CLS =
  'rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40';

function workspaceLabel(scan: ScanOption, index: number): string {
  const name = scan.name || scan.scanId;
  const time = scan.startedAt ? new Date(scan.startedAt).toLocaleString() : null;
  return index === 0 ? `${name}${time ? ` · ${time}` : ''}` : `${name}${time ? ` · ${time}` : ''}`;
}

export function DriftFilters({
  projects,
  projectId,
  onProjectChange,
  scans,
  scanId,
  onScanChange,
  runs,
  runId,
  onRunChange,
  filters,
  onChange,
}: {
  projects: ProjectOption[];
  projectId: string | undefined;
  onProjectChange: (id: string) => void;
  scans: ScanOption[];
  scanId: string | undefined;
  onScanChange: (id: string) => void;
  runs: DriftRun[];
  runId: string | undefined;
  onRunChange: (id: string) => void;
  filters: DriftFilterState;
  onChange: (next: DriftFilterState) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          Project
          <select
            value={projectId ?? ''}
            onChange={(e) => onProjectChange(e.target.value)}
            className={SELECT_CLS}
          >
            {projects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          Workspace
          <select
            value={scanId ?? ''}
            onChange={(e) => onScanChange(e.target.value)}
            className={SELECT_CLS}
          >
            {scans.length === 0 ? (
              <option value="">No workspaces available</option>
            ) : (
              scans.map((scan, index) => (
                <option key={scan.scanId} value={scan.scanId}>
                  {workspaceLabel(scan, index)}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          Scan run
          <select
            value={runId ?? ''}
            onChange={(e) => onRunChange(e.target.value)}
            className={SELECT_CLS}
          >
            {runs.length === 0 ? (
              <option value="">No scan runs available</option>
            ) : (
              <>
                <option value="">All comparisons</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.label}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search findings…"
            className="w-56 rounded-md border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterGroup label="Severity">
          {SEVERITY_ORDER.filter((s) => s !== 'info').map((s) => (
            <Chip
              key={s}
              active={filters.severity.includes(s)}
              color={SEVERITY_META[s].hex}
              onClick={() => onChange({ ...filters, severity: toggle<Severity>(filters.severity, s) })}
            >
              {SEVERITY_META[s].label}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Type">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={filters.category.includes(c.value)}
              onClick={() => onChange({ ...filters, category: toggle<DriftCategory>(filters.category, c.value) })}
            >
              {c.label}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          {STATUSES.map((s) => (
            <Chip
              key={s.value}
              active={filters.status.includes(s.value)}
              onClick={() => onChange({ ...filters, status: toggle<DriftStatus>(filters.status, s.value) })}
            >
              {s.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'border-sky-500/50 bg-sky-500/15 text-slate-100'
          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-100')
      }
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </button>
  );
}
