import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateReport, getReport, listReports } from "@/api/reports";
import type { ReportFormat } from "@/api/types";

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: listReports,
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport(id!),
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, format }: { runId: string; format: ReportFormat }) =>
      generateReport(runId, format),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });
}
