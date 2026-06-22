import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import type { Report } from "@/api/types";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { useReport } from "@/hooks/useReports";
import { formatDateTime } from "@/lib/format";
import { FORMAT_META, STATUS_META } from "@/features/reports/reportMeta";
import { downloadReport } from "@/features/reports/reportExport";
import { cn } from "@/lib/cn";

export function ReportPreview({ reportId }: { reportId: string | undefined }) {
  const { data: report, isLoading } = useReport(reportId);

  if (!reportId) {
    return (
      <Card className="flex h-full items-center justify-center">
        <p className="text-sm text-fg-subtle">
          Select a report to preview, or generate a new one.
        </p>
      </Card>
    );
  }

  if (isLoading || !report) {
    return (
      <Card className="flex h-full items-center justify-center">
        <Spinner label="Loading report…" />
      </Card>
    );
  }

  const FormatIcon = FORMAT_META[report.format].icon;
  const status = STATUS_META[report.status];

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-fg">{report.title}</h2>
            <p className="mt-1 text-xs text-fg-subtle">
              Generated {formatDateTime(report.createdAt)} · {report.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-bg-panel px-2.5 py-1 text-xs font-medium",
                status.text,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-panel px-2.5 py-1 text-xs font-medium text-fg-muted">
              <FormatIcon className="h-3.5 w-3.5" />
              {FORMAT_META[report.format].label}
            </span>
            <button
              onClick={() => downloadReport(report)}
              disabled={report.status !== "ready"}
              title={`Download ${FORMAT_META[report.format].label}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-panel px-2.5 py-1 text-xs font-medium text-fg-muted hover:border-brand/50 hover:text-fg disabled:opacity-50"
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
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg">
              {section.title}
            </h3>
            <SimpleMarkdown text={section.body} />
            <Citations ids={section.citations} />
          </section>
        ))}
      </div>
    </Card>
  );
}

function Citations({ ids }: { ids: string[] }) {
  const navigate = useNavigate();
  if (!ids.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-fg-subtle">Evidence:</span>
      {ids.map((id) => (
        <button
          key={id}
          onClick={() => navigate("/drift")}
          title="View drift record"
          className="rounded border border-border bg-bg-panel px-1.5 py-0.5 font-mono text-[11px] text-brand hover:border-brand/50"
        >
          {id}
        </button>
      ))}
    </div>
  );
}

export type { Report };
