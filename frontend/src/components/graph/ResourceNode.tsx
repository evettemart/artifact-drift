import { Handle, Position, type NodeProps } from 'reactflow';
import { kindMeta } from './kindMeta';
import { SEVERITY_META, type Severity } from '../../lib/severity';

export interface ResourceNodeData {
  name: string;
  kind: string;
  drifted?: boolean;
  driftSeverity?: Severity | null;
  selected?: boolean;
}

export function ResourceNode({ data }: NodeProps<ResourceNodeData>) {
  const meta = kindMeta(data.kind);
  const Icon = meta.icon;
  const sev = data.drifted && data.driftSeverity ? SEVERITY_META[data.driftSeverity] : null;

  const borderColor = sev ? sev.hex : data.selected ? '#38bdf8' : '#334155';

  return (
    <div
      className="flex w-[180px] items-center gap-2.5 rounded-lg border-2 bg-slate-800 px-3 py-2.5 shadow-lg"
      style={{ borderColor }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-500" />

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-100">{data.name}</div>
        <div className="truncate text-[11px] text-slate-400">{meta.label}</div>
      </div>

      {sev && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: sev.hex }}
          title={`${sev.label} drift`}
        />
      )}

      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-500" />
    </div>
  );
}
