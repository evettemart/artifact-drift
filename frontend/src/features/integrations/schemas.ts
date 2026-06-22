import {
  Cloud,
  FileCode2,
  BookText,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Layer } from "@/api/types";

export type FieldType = "text" | "password" | "select" | "file" | "note";

export interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  secret?: boolean;
  help?: string;
  accept?: string; // for file inputs, e.g. ".drawio,.xml,.png"
  /** Only show (and validate) this field when the predicate passes. */
  showIf?: (values: Record<string, string>) => boolean;
}

export interface IntegrationKindSchema {
  kind: string;
  label: string;
  description: string;
  layer: Layer;
  icon: LucideIcon;
  fields: ConfigField[];
}

/**
 * Mock plugin config schemas. In the real backend each plugin publishes its own
 * JSON schema; the form renders generically from this descriptor.
 */
export const INTEGRATION_SCHEMAS: IntegrationKindSchema[] = [
  {
    kind: "aws",
    label: "AWS Runtime",
    description: "Read live resource state via AWS SDK / Config (read-only role).",
    layer: "runtime",
    icon: Cloud,
    fields: [
      { key: "account_id", label: "Account ID", type: "text", placeholder: "1234-5678-9012", required: true },
      { key: "region", label: "Region", type: "select", options: ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-2"], required: true },
      {
        key: "credential_source",
        label: "Credential source",
        type: "select",
        options: ["Environment variables", "Assume role (STS)", "Static access keys"],
        required: true,
      },
      {
        key: "_env_note",
        label: "Environment variables",
        type: "note",
        help: "Reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN from the host/agent environment at scan time. No credentials are stored by Drift Copilot.",
        showIf: (v) => v.credential_source === "Environment variables",
      },
      {
        key: "role",
        label: "Assume Role ARN",
        type: "text",
        placeholder: "arn:aws:iam::role/drift-readonly",
        required: true,
        showIf: (v) => v.credential_source === "Assume role (STS)",
      },
      {
        key: "external_id",
        label: "External ID",
        type: "password",
        secret: true,
        showIf: (v) => v.credential_source === "Assume role (STS)",
      },
      {
        key: "access_key_id",
        label: "Access Key ID",
        type: "text",
        placeholder: "AKIA…",
        required: true,
        showIf: (v) => v.credential_source === "Static access keys",
      },
      {
        key: "secret_access_key",
        label: "Secret Access Key",
        type: "password",
        secret: true,
        required: true,
        showIf: (v) => v.credential_source === "Static access keys",
      },
    ],
  },
  {
    kind: "terraform",
    label: "Terraform State",
    description: "Pull planned + applied state from Terraform Cloud / Enterprise.",
    layer: "terraform",
    icon: FileCode2,
    fields: [
      { key: "organization", label: "Organization", type: "text", placeholder: "acme", required: true },
      { key: "workspace", label: "Workspace", type: "text", placeholder: "prod-network", required: true },
      { key: "token", label: "API Token", type: "password", secret: true, required: true },
    ],
  },
  {
    kind: "confluence",
    label: "Confluence",
    description: "Parse architecture intent from Confluence pages and diagrams.",
    layer: "intent",
    icon: BookText,
    fields: [
      { key: "base_url", label: "Base URL", type: "text", placeholder: "https://acme.atlassian.net/wiki", required: true },
      { key: "space", label: "Space Key", type: "text", placeholder: "ARCH", required: true },
      { key: "email", label: "Email", type: "text", placeholder: "bot@acme.com", required: true },
      { key: "api_token", label: "API Token", type: "password", secret: true, required: true },
    ],
  },
  {
    kind: "drawio",
    label: "Draw.io / Diagram",
    description: "Import intent topology from a Draw.io / diagram file (lower-trust source).",
    layer: "intent",
    icon: Workflow,
    fields: [
      {
        key: "diagram_file",
        label: "Diagram file",
        type: "file",
        accept: ".drawio,.xml,.png,.jpg,.jpeg,.svg",
        required: true,
        help: "Upload a Draw.io XML (.drawio/.xml) or an exported image (.png/.jpg/.svg).",
      },
      { key: "diagram_name", label: "Diagram name", type: "text", placeholder: "Production network" },
    ],
  },
];

export function schemaForKind(kind: string): IntegrationKindSchema | undefined {
  return INTEGRATION_SCHEMAS.find((s) => s.kind === kind);
}
