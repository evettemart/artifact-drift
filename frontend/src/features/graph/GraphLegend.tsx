import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/severity";

/** Legend overlay describing node/edge drift colours. */
export function GraphLegend() {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle/90 px-3 py-2.5 backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
        Drift severity
      </div>
      <div className="mt-2 space-y-1.5">
        {SEVERITY_ORDER.filter((s) => s !== "info").map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SEVERITY_META[s].hex }}
            />
            <span className="text-xs text-fg-muted">{SEVERITY_META[s].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-fg-subtle" />
          <span className="text-xs text-fg-muted">No drift</span>
        </div>
      </div>
    </div>
  );
}
