import { Upload } from "lucide-react";
import type { ConfigField, IntegrationKindSchema } from "@/features/integrations/schemas";

export type ConfigValues = Record<string, string>;

/** Fields visible given the current values (honours each field's showIf guard). */
export function visibleFields(
  schema: IntegrationKindSchema,
  values: ConfigValues,
): ConfigField[] {
  return schema.fields.filter((f) => !f.showIf || f.showIf(values));
}

export function IntegrationConfigForm({
  schema,
  values,
  onChange,
}: {
  schema: IntegrationKindSchema;
  values: ConfigValues;
  onChange: (values: ConfigValues) => void;
}) {
  function set(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-3">
      {visibleFields(schema, values).map((field) => (
        <Field
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          onChange={(v) => set(field.key, v)}
        />
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "note") {
    return (
      <div className="rounded-md border border-border bg-bg-panel px-3 py-2.5">
        <div className="text-xs font-medium text-fg">{field.label}</div>
        {field.help && (
          <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">
            {field.help}
          </p>
        )}
      </div>
    );
  }

  const labelEl = (
    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
      {field.label}
      {field.required && <span className="text-severity-critical">*</span>}
      {field.secret && (
        <span className="rounded bg-bg-panel px-1 text-[10px] text-fg-subtle">
          secret
        </span>
      )}
    </label>
  );

  const inputClass =
    "w-full rounded-md border border-border bg-bg-panel px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand focus:outline-none";

  return (
    <div>
      {labelEl}
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "file" ? (
        <div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-bg-panel px-3 py-2 text-sm text-fg-muted hover:border-brand/50">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{value || "Choose a file…"}</span>
            <input
              type="file"
              accept={field.accept}
              className="hidden"
              onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
            />
          </label>
        </div>
      ) : (
        <input
          type={field.type === "password" ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          autoComplete={field.secret ? "new-password" : "off"}
          className={inputClass}
        />
      )}
      {field.help && (
        <p className="mt-1 text-[11px] text-fg-subtle">{field.help}</p>
      )}
    </div>
  );
}
