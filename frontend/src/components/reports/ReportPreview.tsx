import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { FORMAT_META, STATUS_META, type Report } from './types';
import { SimpleMarkdown } from './SimpleMarkdown';
import { downloadReport } from './reportExport';

export function ReportPreview({ report }: { report: Report | undefined }) {
  if (!report) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
        <p className="text-sm text-slate-500">Select a report to preview, or generate a new one.</p>
      </div>
    );
  }

  const FormatIcon = FORMAT_META[report.format].icon;
  const status = STATUS_META[report.status];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{report.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Generated {formatDate(report.createdAt)} · {report.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium ${status.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
              <FormatIcon className="h-3.5 w-3.5" />
              {FORMAT_META[report.format].label}
            </span>
            <button
              onClick={() => downloadReport(report)}
              disabled={report.status !== 'ready'}
              title={`Download ${FORMAT_META[report.format].label}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-sky-500/50 hover:text-white disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-6 py-5">
        {report.sections.map((section) => (
          <section key={section.id}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-200">
              {section.title}
            </h3>
            {section.image && (
              <div
                className="mb-3 overflow-auto rounded-lg border border-slate-800 [&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-[380px] [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: section.image.svg }}
              />
            )}
            <SimpleMarkdown text={section.body} />
            <Citations ids={section.citations} />
          </section>
        ))}
      </div>
    </div>
  );
}

function Citations({ ids }: { ids: string[] }) {
  const navigate = useNavigate();
  if (!ids.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">Evidence:</span>
      {ids.map((id) => (
        <button
          key={id}
          onClick={() => navigate('/drift')}
          title="View drift record"
          className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-300 hover:border-sky-500/50"
        >
          {id}
        </button>
      ))}
    </div>
  );
}
