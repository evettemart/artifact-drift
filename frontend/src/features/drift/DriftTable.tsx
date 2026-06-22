import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { severityRank } from "@/lib/severity";
import { formatDateTime, titleCase } from "@/lib/format";
import type { DriftRecord } from "@/api/types";

type SortKey = "severity" | "title" | "resourceKind" | "createdAt";
type SortDir = "asc" | "desc";

export function DriftTable({
  records,
  selectedId,
  onSelect,
}: {
  records: DriftRecord[];
  selectedId: string | null;
  onSelect: (record: DriftRecord) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function applySort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...records].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "severity") cmp = severityRank(a.severity) - severityRank(b.severity);
    else if (sortKey === "title") cmp = a.title.localeCompare(b.title);
    else if (sortKey === "resourceKind")
      cmp = a.resourceKind.localeCompare(b.resourceKind);
    else cmp = a.createdAt.localeCompare(b.createdAt);
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg-subtle/50 px-6 py-16 text-center text-sm text-fg-subtle">
        No drift records match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-bg-panel text-left text-xs uppercase tracking-wide text-fg-subtle">
          <tr>
            <th className="px-4 py-2.5 font-medium">ID</th>
            <SortHeader label="Severity" col="severity" {...{ sortKey, sortDir, applySort }} />
            <SortHeader label="Finding" col="title" {...{ sortKey, sortDir, applySort }} />
            <SortHeader label="Resource" col="resourceKind" {...{ sortKey, sortDir, applySort }} />
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <SortHeader label="When" col="createdAt" {...{ sortKey, sortDir, applySort }} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              className={
                "cursor-pointer transition-colors hover:bg-bg-panel " +
                (r.id === selectedId ? "bg-bg-panel" : "")
              }
            >
              <td className="px-4 py-3 font-mono text-xs text-fg-subtle">
                {r.id}
              </td>
              <td className="px-4 py-3">
                <SeverityBadge severity={r.severity} />
              </td>
              <td className="px-4 py-3 font-medium text-fg">{r.title}</td>
              <td className="px-4 py-3 text-fg-muted">
                {titleCase(r.resourceKind.replace(/^aws_/, ""))}
              </td>
              <td className="px-4 py-3 text-fg-muted">
                {titleCase(r.driftType)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-fg-subtle">
                {formatDateTime(r.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  applySort,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  applySort: (key: SortKey) => void;
}) {
  const active = sortKey === col;
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th className="px-4 py-2.5 font-medium">
      <button
        onClick={() => applySort(col)}
        className="flex items-center gap-1 hover:text-fg"
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
