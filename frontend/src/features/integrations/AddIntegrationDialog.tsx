import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useCreateIntegration } from "@/hooks/useIntegrations";
import {
  INTEGRATION_SCHEMAS,
  type IntegrationKindSchema,
} from "@/features/integrations/schemas";
import {
  IntegrationConfigForm,
  visibleFields,
  type ConfigValues,
} from "@/features/integrations/IntegrationConfigForm";
import { layerLabel } from "@/lib/layers";

export function AddIntegrationDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateIntegration();
  const [schema, setSchema] = useState<IntegrationKindSchema | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState<ConfigValues>({});

  const missingRequired = schema
    ? visibleFields(schema, values).some((f) => f.required && !values[f.key])
    : true;

  function submit() {
    if (!schema) return;
    create.mutate(
      {
        kind: schema.kind,
        name: name || schema.label,
        layer: schema.layer,
        config: values,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-bg-subtle shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-fg">Add Integration</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-fg-subtle hover:bg-bg-panel hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-5 py-4">
          {!schema ? (
            <div className="grid grid-cols-2 gap-3">
              {INTEGRATION_SCHEMAS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.kind}
                    onClick={() => setSchema(s)}
                    className="flex flex-col items-start gap-2 rounded-lg border border-border bg-bg-panel p-4 text-left transition-colors hover:border-brand/50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold text-fg">{s.label}</div>
                    <div className="text-xs text-fg-subtle">{s.description}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSchema(null)}
                className="text-xs text-brand hover:underline"
              >
                ← Choose a different source
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-panel px-3 py-2">
                <schema.icon className="h-4 w-4 text-brand" />
                <span className="text-sm font-medium text-fg">
                  {schema.label}
                </span>
                <span className="ml-auto text-xs text-fg-subtle">
                  {layerLabel(schema.layer)}
                </span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">
                  Display name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={schema.label}
                  className="w-full rounded-md border border-border bg-bg-panel px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand focus:outline-none"
                />
              </div>

              <IntegrationConfigForm
                schema={schema}
                values={values}
                onChange={setValues}
              />
            </div>
          )}
        </div>

        {schema && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={missingRequired || create.isPending}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add integration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
