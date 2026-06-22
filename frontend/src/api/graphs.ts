import { api } from "@/api/client";
import type { GraphSnapshot, Layer } from "@/api/types";

export function getGraph(layer: Layer) {
  return api.get<GraphSnapshot>(`/graphs/${layer}/latest`);
}
