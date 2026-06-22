import { api } from "@/api/client";
import type { Integration, Paginated } from "@/api/types";

export function listIntegrations() {
  return api.get<Paginated<Integration>>("/integrations");
}

export function createIntegration(input: Partial<Integration>) {
  return api.post<Integration>("/integrations", input);
}

export function testIntegration(id: string) {
  return api.post<{ ok: boolean; message: string }>(
    `/integrations/${id}/test`,
  );
}
