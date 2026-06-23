import type { LucideIcon } from 'lucide-react';

export type IntegrationStatus = 'connected' | 'error' | 'unconfigured' | 'syncing';

export type Layer = 'intent' | 'terraform' | 'runtime';

export type FieldType = 'text' | 'password' | 'select' | 'file' | 'note';

export interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  secret?: boolean;
  help?: string;
  /** For file inputs, e.g. ".drawio,.xml,.png,.jpg". */
  accept?: string;
  /** Only show (and validate) this field when the predicate passes. */
  showIf?: (values: Record<string, string>) => boolean;
}

export interface IntegrationKindSchema {
  kind: string;
  label: string;
  description: string;
  layer: Layer;
  icon: LucideIcon;
  /** Drift only ever reads from this source — surfaced as a badge on the card. */
  readOnly?: boolean;
  fields: ConfigField[];
}

export interface Integration {
  id: string;
  kind: string;
  name: string;
  layer: Layer;
  status: IntegrationStatus;
  config: Record<string, string>;
  lastSync?: string;
}

export const LAYER_LABELS: Record<Layer, string> = {
  intent: 'Planned Architecture',
  terraform: 'Terraform State',
  runtime: 'Deployed Infrastructure',
};

export function layerLabel(layer: Layer): string {
  return LAYER_LABELS[layer] ?? layer;
}
