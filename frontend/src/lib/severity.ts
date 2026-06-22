import type { Severity } from "@/api/types";

interface SeverityMeta {
  label: string;
  rank: number; // lower = more severe, for sorting
  /** Tailwind text color class */
  text: string;
  /** Tailwind background tint class */
  bg: string;
  /** Tailwind border class */
  border: string;
  /** Raw hex for charts / graph rendering */
  hex: string;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: {
    label: "Critical",
    rank: 0,
    text: "text-severity-critical",
    bg: "bg-severity-critical/15",
    border: "border-severity-critical/40",
    hex: "#ef4444",
  },
  high: {
    label: "High",
    rank: 1,
    text: "text-severity-high",
    bg: "bg-severity-high/15",
    border: "border-severity-high/40",
    hex: "#f97316",
  },
  medium: {
    label: "Medium",
    rank: 2,
    text: "text-severity-medium",
    bg: "bg-severity-medium/15",
    border: "border-severity-medium/40",
    hex: "#eab308",
  },
  low: {
    label: "Low",
    rank: 3,
    text: "text-severity-low",
    bg: "bg-severity-low/15",
    border: "border-severity-low/40",
    hex: "#22c55e",
  },
  info: {
    label: "Info",
    rank: 4,
    text: "text-severity-info",
    bg: "bg-severity-info/15",
    border: "border-severity-info/40",
    hex: "#64748b",
  },
};

export const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export function severityRank(s: Severity): number {
  return SEVERITY_META[s].rank;
}
