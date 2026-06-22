import { useState } from "react";
import { X, Loader2, FileBarChart } from "lucide-react";
import type { DriftRun, ReportFormat } from "@/api/types";
import { useGenerateReport } from "@/hooks/useReports";
import { layerLabel } from "@/lib/layers";
import { FORMAT_META } from "@/features/reports/reportMeta";
import { cn } from "@/lib/cn";

const FORMATS: ReportFormat[] = ["html", "pdf", "json"];

export function GenerateReportDialog({
  runs,
  onClose,
  onGenerated,
}: {
  runs: DriftRun[];
  onClose: () => void;
  onGenerated: (reportId: string) => void;
}) {
  const generate = useGenerateReport();
  const [runId, setRunId] = useState(runs[0]?.id ?? "");
  const [format, setFormat] = useState<ReportFormat>("html");

  function submit() {
    if (!runId) return;
    generate.mutate(
      { runId, format },
      {
        onSuccess: (report) => {
          onGenerated(report.id);
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-bg-subtle shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-fg">Generate Report</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-fg-subtle hover:bg-bg-panel hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fg-muted">
              Drift run
            </span>
            <select
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-panel px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
            >
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {layerLabel(run.baseLayer)} → {layerLabel(run.targetLayer)}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-fg-muted">
              Format
            </span>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const meta = FORMAT_META[f];
                const Icon = meta.icon;
                const active = f === format;
                return (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
                      active
                        ? "border-brand/60 bg-bg-panel text-fg"
                        : "border-border bg-bg-panel/40 text-fg-muted hover:border-brand/30",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-panel"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!runId || generate.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileBarChart className="h-4 w-4" />
            )}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
