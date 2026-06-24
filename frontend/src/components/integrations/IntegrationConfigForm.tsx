import { Upload } from 'lucide-react';
import type { ConfigField, IntegrationKindSchema } from './types';
import { visibleFields } from './schemas';

export type ConfigValues = Record<string, string>;

const INPUT_CLS =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none';

export function IntegrationConfigForm({
  schema,
  values,
  onChange,
  onFileChange,
}: {
  schema: IntegrationKindSchema;
  values: ConfigValues;
  onChange: (values: ConfigValues) => void;
  onFileChange: (key: string, file: File | null) => void;
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
          value={values[field.key] ?? ''}
          onChange={(v) => set(field.key, v)}
          onFile={(file) => onFileChange(field.key, file)}
        />
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  onFile,
}: {
  field: ConfigField;
  value: string;
  onChange: (value: string) => void;
  onFile: (file: File | null) => void;
}) {
  if (field.type === 'note') {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5">
        <div className="text-xs font-medium text-slate-200">{field.label}</div>
        {field.help && (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{field.help}</p>
        )}
      </div>
    );
  }

  const labelEl = (
    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
      {field.label}
      {field.required && <span className="text-red-400">*</span>}
      {field.secret && (
        <span className="rounded bg-slate-800 px-1 text-[10px] text-slate-500">secret</span>
      )}
    </label>
  );

  return (
    <div>
      {labelEl}
      {field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'file' ? (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 hover:border-sky-500/60">
          <Upload className="h-4 w-4 shrink-0" />
          <span className="truncate">{value || 'Choose a file…'}</span>
          <input
            type="file"
            accept={field.accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onFile(file);
              onChange(file?.name ?? '');
            }}
          />
        </label>
      ) : (
        <input
          type={field.type === 'password' ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          autoComplete={field.secret ? 'new-password' : 'off'}
          className={INPUT_CLS}
        />
      )}
      {field.help && <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>}
    </div>
  );
}
