import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchRecord } from "@/api/drift";
import type { RecordStatus } from "@/api/types";

export function usePatchDriftRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      patchRecord(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drift", "records"] });
    },
  });
}
