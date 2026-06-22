import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Plug,
  PlugZap,
} from "lucide-react";
import { Card } from "@/components/Card";
import { useTestIntegration } from "@/hooks/useIntegrations";
import { schemaForKind } from "@/features/integrations/schemas";
import { layerLabel } from "@/lib/layers";
import { formatDateTime } from "@/lib/format";
import type { Integration, IntegrationStatus } from "@/api/types";

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; dot: string; text: string }
> = {
  connected: { label: "Connected", dot: "bg-severity-low", text: "text-severity-low" },
  error: { label: "Error", dot: "bg-severity-critical", text: "text-severity-critical" },
  unconfigured: { label: "Unconfigured", dot: "bg-fg-subtle", text: "text-fg-subtle" },
  syncing: { label: "Syncing", dot: "bg-brand", text: "text-brand" },
};

export function IntegrationCard({ integration }: { integration: Integration }) {
  const schema = schemaForKind(integration.kind);
  const Icon = schema?.icon ?? Plug;
  const status = STATUS_META[integration.status];
  const test = useTestIntegration();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  function onTest() {
    setResult(null);
    test.mutate(integration.id, {
      onSuccess: (res) => setResult(res),
    });
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-fg">{integration.name}</div>
            <div className="text-xs text-fg-subtle">
              {layerLabel(integration.layer)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className={`text-xs font-medium ${status.text}`}>
            {status.label}
          </span>
        </div>
      </div>

      {schema && (
        <p className="mt-3 text-xs text-fg-muted">{schema.description}</p>
      )}

      <div className="mt-3 space-y-1 text-xs text-fg-subtle">
        {Object.entries(integration.config)
          .filter(([k]) => !k.startsWith("_"))
          .slice(0, 2)
          .map(([k, v]) => {
            const isSecret = schema?.fields.find((f) => f.key === k)?.secret;
            return (
              <div key={k} className="flex justify-between gap-2">
                <span>{k}</span>
                <span className="truncate font-mono text-fg-muted">
                  {isSecret ? "••••••" : String(v)}
                </span>
              </div>
            );
          })}
        {integration.lastSync && (
          <div className="flex justify-between gap-2">
            <span>last sync</span>
            <span className="text-fg-muted">
              {formatDateTime(integration.lastSync)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <button
          onClick={onTest}
          disabled={test.isPending}
          className="flex items-center gap-1.5 rounded-md border border-border bg-bg-panel px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg disabled:opacity-50"
        >
          {test.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlugZap className="h-3.5 w-3.5" />
          )}
          Test connection
        </button>

        {result && (
          <span
            className={`flex items-center gap-1 text-xs ${result.ok ? "text-severity-low" : "text-severity-critical"}`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.message}
          </span>
        )}
      </div>
    </Card>
  );
}
