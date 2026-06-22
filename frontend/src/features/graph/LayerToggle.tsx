import { layerLabel } from "@/lib/layers";
import type { Layer } from "@/api/types";

const LAYERS: Layer[] = ["intent", "terraform", "runtime"];

export function LayerToggle({
  value,
  onChange,
}: {
  value: Layer;
  onChange: (layer: Layer) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-bg-subtle p-0.5">
      {LAYERS.map((layer) => (
        <button
          key={layer}
          onClick={() => onChange(layer)}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
            (value === layer
              ? "bg-brand/20 text-fg"
              : "text-fg-muted hover:text-fg")
          }
        >
          {layerLabel(layer)}
        </button>
      ))}
    </div>
  );
}
