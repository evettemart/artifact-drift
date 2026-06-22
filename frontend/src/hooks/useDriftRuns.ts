import { useQuery } from "@tanstack/react-query";
import { getRun, getRuns } from "@/api/drift";

export function useDriftRuns() {
  return useQuery({
    queryKey: ["drift", "runs"],
    queryFn: getRuns,
  });
}

export function useDriftRun(id: string | undefined) {
  return useQuery({
    queryKey: ["drift", "run", id],
    queryFn: () => getRun(id!),
    enabled: !!id,
  });
}
