import { FileCode2, FileJson, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReportFormat, ReportStatus } from "@/api/types";

export const FORMAT_META: Record<
  ReportFormat,
  { label: string; icon: LucideIcon; ext: string }
> = {
  html: { label: "HTML", icon: FileCode2, ext: ".html" },
  pdf: { label: "PDF", icon: FileText, ext: ".pdf" },
  json: { label: "JSON", icon: FileJson, ext: ".json" },
};

export const STATUS_META: Record<
  ReportStatus,
  { label: string; dot: string; text: string }
> = {
  ready: { label: "Ready", dot: "bg-severity-low", text: "text-severity-low" },
  generating: {
    label: "Generating",
    dot: "bg-severity-medium",
    text: "text-severity-medium",
  },
  failed: { label: "Failed", dot: "bg-severity-critical", text: "text-severity-critical" },
};
