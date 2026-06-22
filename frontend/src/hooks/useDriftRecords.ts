import { useQuery } from "@tanstack/react-query";
import { getRecords } from "@/api/drift";
import type { DriftRecordFilters } from "@/api/types";

export function useDriftRecords(
  runId: string | undefined,
  filters: DriftRecordFilters = {},
) {
  return useQuery({
    queryKey: ["drift", "records", runId, filters],
    queryFn: () => getRecords(runId!, filters),
    enabled: !!runId,
  });
}
