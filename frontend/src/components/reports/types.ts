import { FileCode2, FileJson, FileText, type LucideIcon } from 'lucide-react';

export type ReportFormat = 'html' | 'pdf' | 'json';
export type ReportStatus = 'ready' | 'generating' | 'failed';

export interface GraphImage {
  /** Self-contained SVG markup for the graph diagram. */
  svg: string;
  width: number;
  height: number;
}

export interface ReportSection {
  id: string;
  title: string;
  /** Limited markdown: **bold**, `code`, and "- " bullet lines. */
  body: string;
  citations: string[];
  /** Optional rendered graph diagram (present on graph sections). */
  image?: GraphImage;
}

export interface Report {
  id: string;
  title: string;
  format: ReportFormat;
  status: ReportStatus;
  createdAt: string;
  projectId: string;
  projectName: string;
  scanId: string;
  /** Scan run timestamp (when the analysed scan ran). */
  scanRunAt: string;
  /** Drift run included, or 'all' for every comparison. */
  runId: string;
  sections: ReportSection[];
}

export const FORMAT_META: Record<
  ReportFormat,
  { label: string; icon: LucideIcon; ext: string }
> = {
  html: { label: 'HTML', icon: FileCode2, ext: '.html' },
  pdf: { label: 'PDF', icon: FileText, ext: '.pdf' },
  json: { label: 'JSON', icon: FileJson, ext: '.json' },
};

export const STATUS_META: Record<ReportStatus, { label: string; dot: string; text: string }> = {
  ready: { label: 'Ready', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  generating: { label: 'Generating', dot: 'bg-amber-400', text: 'text-amber-400' },
  failed: { label: 'Failed', dot: 'bg-red-500', text: 'text-red-400' },
};
