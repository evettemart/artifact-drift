import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getScanSchedule, setScanSchedule, startScan } from "@/api/drift";
import type { Layer } from "@/api/types";

export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      baseLayer = "intent",
      targetLayer = "runtime",
    }: {
      baseLayer?: Layer;
      targetLayer?: Layer;
    }) => startScan(baseLayer, targetLayer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drift", "runs"] });
      queryClient.invalidateQueries({ queryKey: ["drift", "records"] });
    },
  });
}

export function useScanSchedule() {
  return useQuery({
    queryKey: ["scan", "schedule"],
    queryFn: getScanSchedule,
  });
}

export function useSetScanSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: string) => setScanSchedule(schedule),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["scan", "schedule"] }),
  });
}
