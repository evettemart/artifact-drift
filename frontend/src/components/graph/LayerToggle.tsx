import type { GraphLayer } from './types';

const LAYERS: { value: GraphLayer; label: string }[] = [
  { value: 'planned', label: 'Planned Architecture' },
  { value: 'terraform', label: 'Terraform State' },
  { value: 'deployed', label: 'Deployed Infrastructure' },
];

export function LayerToggle({
  value,
  onChange,
}: {
  value: GraphLayer;
  onChange: (layer: GraphLayer) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
      {LAYERS.map((layer) => (
        <button
          key={layer.value}
          onClick={() => onChange(layer.value)}
          className={
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
            (value === layer.value
              ? 'bg-sky-500/20 text-slate-100'
              : 'text-slate-400 hover:text-slate-100')
          }
        >
          {layer.label}
        </button>
      ))}
    </div>
  );
}
