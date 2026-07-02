import { FORMAT_META, STATUS_META, type Report } from './types';
import { formatDate } from '../../lib/utils';
import { Trash2 } from 'lucide-react';

export function ReportsList({
  reports,
  selectedId,
  onSelect,
  onDelete,
}: {
  reports: Report[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!reports.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
        No reports yet. Generate one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => {
        const FormatIcon = FORMAT_META[report.format].icon;
        const status = STATUS_META[report.status];
        const active = report.id === selectedId;
        return (
          <div
            key={report.id}
            className={`w-full rounded-lg border px-3 py-3 transition-colors ${
              active
                ? 'border-sky-500/60 bg-slate-900'
                : 'border-slate-800 bg-slate-900/40 hover:border-sky-500/30'
            }`}
          >
            <div className="flex items-start gap-2">
              <button
                onClick={() => onSelect(report.id)}
                className="min-w-0 flex-1 text-left"
                title="Open report"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium text-slate-100">
                    {report.title}
                  </span>
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                    title={status.label}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <FormatIcon className="h-3.5 w-3.5" />
                  {FORMAT_META[report.format].label}
                  <span>·</span>
                  {formatDate(report.createdAt)}
                </div>
              </button>
              <button
                onClick={() => onDelete(report.id)}
                className="mt-0.5 rounded-md border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:border-red-500/50 hover:text-red-300"
                title="Delete report"
                aria-label="Delete report"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
