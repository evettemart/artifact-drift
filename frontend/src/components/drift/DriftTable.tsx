import { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { SEVERITY_META } from '../../lib/severity';
import { SeverityBadge, StatusBadge, titleCase } from './badges';
import { formatDate } from '../../lib/utils';
import type { DriftFinding } from './types';

type SortKey = 'severity' | 'title' | 'resourceType' | 'detectedAt';
type SortDir = 'asc' | 'desc';

function findingTitle(record: DriftFinding): string {
  return record.reasoning?.summary || record.diffSummary;
}

export function DriftTable({
  records,
  selectedId,
  onSelect,
}: {
  records: DriftFinding[];
  selectedId: string | null;
  onSelect: (record: DriftFinding) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function applySort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...records].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'severity') {
      cmp = SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank;
    } else if (sortKey === 'title') {
      cmp = findingTitle(a).localeCompare(findingTitle(b));
    } else if (sortKey === 'resourceType') {
      cmp = a.resourceType.localeCompare(b.resourceType);
    } else {
      cmp = a.detectedAt.localeCompare(b.detectedAt);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-16 text-center text-sm text-slate-400">
        No drift records match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/70 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">ID</th>
            <SortHeader label="Severity" col="severity" {...{ sortKey, sortDir, applySort }} />
            <SortHeader label="Finding" col="title" {...{ sortKey, sortDir, applySort }} />
            <SortHeader label="Resource" col="resourceType" {...{ sortKey, sortDir, applySort }} />
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <SortHeader label="When" col="detectedAt" {...{ sortKey, sortDir, applySort }} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((r) => (
            <tr
              key={r.driftId}
              onClick={() => onSelect(r)}
              className={
                'cursor-pointer transition-colors hover:bg-slate-800/60 ' +
                (r.driftId === selectedId ? 'bg-slate-800/60' : '')
              }
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.driftId}</td>
              <td className="px-4 py-3">
                <SeverityBadge severity={r.severity} />
              </td>
              <td className="px-4 py-3 font-medium text-slate-100">{findingTitle(r)}</td>
              <td className="px-4 py-3 text-slate-300">{titleCase(r.resourceType)}</td>
              <td className="px-4 py-3 text-slate-300">{titleCase(r.category)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-slate-400">{formatDate(r.detectedAt)}</td>
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
  const Icon = !active ? ChevronsUpDown : sortDir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className="px-4 py-2.5 font-medium">
      <button onClick={() => applySort(col)} className="flex items-center gap-1 hover:text-slate-100">
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
