import { useQuery } from "@tanstack/react-query";
import { getGraph } from "@/api/graphs";
import type { Layer } from "@/api/types";

export function useGraph(layer: Layer) {
  return useQuery({
    queryKey: ["graph", layer],
    queryFn: () => getGraph(layer),
  });
}
