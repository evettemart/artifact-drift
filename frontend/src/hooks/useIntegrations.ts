import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIntegration,
  listIntegrations,
  testIntegration,
} from "@/api/integrations";
import type { Integration } from "@/api/types";

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: listIntegrations,
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Integration>) => createIntegration(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (id: string) => testIntegration(id),
  });
}
