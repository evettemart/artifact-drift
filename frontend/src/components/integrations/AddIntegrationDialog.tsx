import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { INTEGRATION_SCHEMAS, schemaForKind, visibleFields } from './schemas';
import { IntegrationConfigForm, type ConfigValues } from './IntegrationConfigForm';
import {
  layerLabel,
  type Integration,
  type IntegrationKindSchema,
  type IntegrationPayload,
} from './types';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AddIntegrationDialog({
  onClose,
  onSave,
  existing,
}: {
  onClose: () => void;
  onSave: (payload: IntegrationPayload, existingId?: string) => Promise<void> | void;
  existing?: Integration;
}) {
  const isEdit = Boolean(existing);
  const [schema, setSchema] = useState<IntegrationKindSchema | null>(
    existing ? schemaForKind(existing.kind) ?? null : null,
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [values, setValues] = useState<ConfigValues>(existing?.config ?? {});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Static image integrations are identified solely by their diagram name.
  const usesDiagramNameOnly = schema?.kind === 'image';

  const missingRequired = schema
    ? visibleFields(schema, values).some((f) => f.required && !values[f.key])
    : true;

  function setFile(key: string, file: File | null) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
  }

  async function submit() {
    if (!schema) return;
    setSubmitting(true);
    setError(null);
    try {
      const config: Record<string, string> = {};
      const secrets: Record<string, string> = {};
      for (const field of schema.fields) {
        if (field.type === 'note' || field.type === 'file') continue;
        const v = values[field.key];
        if (v == null || v === '') continue;
        if (field.secret) secrets[field.key] = v;
        else config[field.key] = v;
      }
      const filePayload: Record<string, { name: string; dataUrl: string }> = {};
      for (const field of schema.fields) {
        if (field.type !== 'file') continue;
        const file = files[field.key];
        if (file) {
          filePayload[field.key] = { name: file.name, dataUrl: await readAsDataUrl(file) };
        }
      }
      const resolvedName = usesDiagramNameOnly
        ? values.diagram_name || schema.label
        : name || schema.label;
      await onSave(
        {
          kind: schema.kind,
          name: resolvedName,
          layer: schema.layer,
          config,
          secrets,
          files: filePayload,
        },
        existing?.id,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save integration');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">
            {isEdit ? 'Edit Integration' : 'Add Integration'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close dialog"
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
                    className="flex flex-col items-start gap-2 rounded-lg border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-sky-500/50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                      {s.label}
                      {s.readOnly && <Lock className="h-3 w-3 text-slate-500" />}
                    </div>
                    <div className="text-xs text-slate-500">{s.description}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {!isEdit && (
                <button
                  onClick={() => setSchema(null)}
                  className="text-xs text-sky-400 hover:underline"
                >
                  ← Choose a different source
                </button>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                <schema.icon className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-medium text-slate-100">{schema.label}</span>
                <span className="ml-auto text-xs text-slate-500">{layerLabel(schema.layer)}</span>
              </div>

              {!usesDiagramNameOnly && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Display name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={schema.label}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              )}

              <IntegrationConfigForm
                schema={schema}
                values={values}
                onChange={setValues}
                onFileChange={setFile}
              />
            </div>
          )}
        </div>

        {schema && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
            {error && <span className="mr-auto text-xs text-red-400">{error}</span>}
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={missingRequired || submitting}
              className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add integration'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
