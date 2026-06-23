import { useState } from 'react';
import { X, FileBarChart } from 'lucide-react';
import { FORMAT_META, type ReportFormat } from './types';
import type { DriftRun } from './buildReport';

const FORMATS: ReportFormat[] = ['html', 'pdf', 'json'];

export function GenerateReportDialog({
  runs,
  onClose,
  onGenerate,
}: {
  runs: DriftRun[];
  onClose: () => void;
  onGenerate: (runId: string, format: ReportFormat) => void;
}) {
  const [runId, setRunId] = useState('all');
  const [format, setFormat] = useState<ReportFormat>('html');

  function submit() {
    onGenerate(runId, format);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">Generate Report</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Scan run</span>
            <select
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">All comparisons</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Format</span>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const meta = FORMAT_META[f];
                const Icon = meta.icon;
                const active = f === format;
                return (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-slate-900 text-slate-100'
                        : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-sky-500/30'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            <FileBarChart className="h-4 w-4" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
