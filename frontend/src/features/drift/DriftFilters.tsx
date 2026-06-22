import { Search } from "lucide-react";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/severity";
import { layerLabel } from "@/lib/layers";
import { cn } from "@/lib/cn";
import type {
  DriftRecordFilters,
  DriftRun,
  DriftType,
  RecordStatus,
  Severity,
} from "@/api/types";

const DRIFT_TYPES: { value: DriftType; label: string }[] = [
  { value: "missing", label: "Missing" },
  { value: "unexpected", label: "Unexpected" },
  { value: "attribute_mismatch", label: "Attribute" },
  { value: "edge_drift", label: "Edge" },
];

const STATUSES: { value: RecordStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "suppressed", label: "Suppressed" },
];

export function DriftFilters({
  runs,
  runId,
  onRunChange,
  filters,
  onChange,
}: {
  runs: DriftRun[];
  runId: string | undefined;
  onRunChange: (id: string) => void;
  filters: DriftRecordFilters;
  onChange: (next: DriftRecordFilters) => void;
}) {
  function toggle<T>(list: T[] | undefined, value: T): T[] {
    const set = new Set(list ?? []);
    set.has(value) ? set.delete(value) : set.add(value);
    return [...set];
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={runId ?? ""}
          onChange={(e) => onRunChange(e.target.value)}
          className="rounded-md border border-border bg-bg-panel px-3 py-1.5 text-sm text-fg"
        >
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {layerLabel(run.baseLayer)} → {layerLabel(run.targetLayer)}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={filters.search ?? ""}
            onChange={(e) =>
              onChange({ ...filters, search: e.target.value || undefined })
            }
            placeholder="Search findings…"
            className="w-56 rounded-md border border-border bg-bg-panel py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup label="Severity">
          {SEVERITY_ORDER.filter((s) => s !== "info").map((s) => (
            <Chip
              key={s}
              active={filters.severity?.includes(s) ?? false}
              onClick={() =>
                onChange({ ...filters, severity: toggle<Severity>(filters.severity, s) })
              }
              color={SEVERITY_META[s].hex}
            >
              {SEVERITY_META[s].label}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Type">
          {DRIFT_TYPES.map((t) => (
            <Chip
              key={t.value}
              active={filters.driftType?.includes(t.value) ?? false}
              onClick={() =>
                onChange({
                  ...filters,
                  driftType: toggle<DriftType>(filters.driftType, t.value),
                })
              }
            >
              {t.label}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          {STATUSES.map((s) => (
            <Chip
              key={s.value}
              active={filters.status?.includes(s.value) ?? false}
              onClick={() =>
                onChange({
                  ...filters,
                  status: toggle<RecordStatus>(filters.status, s.value),
                })
              }
            >
              {s.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
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
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand/50 bg-brand/15 text-fg"
          : "border-border bg-bg-panel text-fg-muted hover:text-fg",
      )}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  );
}
