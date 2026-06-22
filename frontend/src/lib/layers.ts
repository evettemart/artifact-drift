import type { Layer } from "@/api/types";

/** Human-facing names for each architecture layer. */
export const LAYER_LABELS: Record<Layer, string> = {
  intent: "Planned Architecture",
  terraform: "Terraform State",
  runtime: "Deployed Infrastructure",
};

export function layerLabel(layer: Layer): string {
  return LAYER_LABELS[layer];
}
