import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "@/lib/cn";
import { SEVERITY_META } from "@/lib/severity";
import { kindMeta } from "@/features/graph/nodes/kindMeta";
import type { Severity } from "@/api/types";

export interface ResourceNodeData {
  name: string;
  kind: string;
  drifted?: boolean;
  driftSeverity?: Severity;
  selected?: boolean;
}

/** Custom React Flow node for an architecture resource. */
export function ResourceNode({ data, selected }: NodeProps<ResourceNodeData>) {
  const meta = kindMeta(data.kind);
  const Icon = meta.icon;
  const drift = data.drifted ? data.driftSeverity ?? "info" : undefined;
  const driftColor = drift ? SEVERITY_META[drift].hex : undefined;

  return (
    <div
      className={cn(
        "flex w-[180px] items-center gap-2.5 rounded-lg border bg-bg-panel px-3 py-2.5 shadow-md transition-all",
        selected ? "border-brand ring-2 ring-brand/40" : "border-border",
      )}
      style={drift ? { borderColor: driftColor } : undefined}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-fg-subtle"
      />
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: drift ? `${driftColor}22` : "#5b8def22",
          color: drift ? driftColor : "#5b8def",
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-fg">{data.name}</div>
        <div className="truncate text-[10px] text-fg-subtle">{meta.label}</div>
      </div>
      {drift && (
        <span
          className="ml-auto h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: driftColor }}
          title={`${SEVERITY_META[drift].label} drift`}
        />
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-fg-subtle"
      />
    </div>
  );
}
