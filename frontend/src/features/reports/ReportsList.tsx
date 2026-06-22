import type { Report } from "@/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { FORMAT_META, STATUS_META } from "@/features/reports/reportMeta";

export function ReportsList({
  reports,
  selectedId,
  onSelect,
}: {
  reports: Report[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (!reports.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-fg-subtle">
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
          <button
            key={report.id}
            onClick={() => onSelect(report.id)}
            className={cn(
              "w-full rounded-lg border px-4 py-3 text-left transition-colors",
              active
                ? "border-brand/60 bg-bg-panel"
                : "border-border bg-bg-subtle hover:border-brand/30",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-sm font-medium text-fg">
                {report.title}
              </span>
              <span
                className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", status.dot)}
                title={status.label}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-fg-subtle">
              <FormatIcon className="h-3.5 w-3.5" />
              {FORMAT_META[report.format].label}
              <span>·</span>
              {formatDateTime(report.createdAt)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
