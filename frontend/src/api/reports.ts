import { api } from "@/api/client";
import type { Paginated, Report, ReportFormat } from "@/api/types";

export function listReports() {
  return api.get<Paginated<Report>>("/reports");
}

export function getReport(id: string) {
  return api.get<Report>(`/reports/${id}`);
}

export function generateReport(runId: string, format: ReportFormat) {
  return api.post<Report>("/reports", { runId, format });
}
