import { Cloud, FileCode2, BookText, Workflow, Vault, Image } from 'lucide-react';
import type { ConfigField, IntegrationKindSchema, Layer } from './types';

/**
 * Plugin config schemas. Each source declares the fields its connector needs;
 * the Add-integration form renders generically from this descriptor.
 */
export const INTEGRATION_SCHEMAS: IntegrationKindSchema[] = [
  {
    kind: 'aws',
    label: 'AWS Infrastructure',
    description: 'Read live resource state via the AWS SDK / Config (read-only role).',
    layer: 'runtime',
    icon: Cloud,
    readOnly: true,
    fields: [
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: '1234-5678-9012', required: true },
      {
        key: 'region',
        label: 'Region',
        type: 'select',
        options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-2'],
        required: true,
      },
      {
        key: 'credential_source',
        label: 'Credential source',
        type: 'select',
        options: ['Environment variables', 'Assume role (STS)', 'Static access keys'],
        required: true,
      },
      {
        key: '_env_note',
        label: 'Environment variables',
        type: 'note',
        help: 'Reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN from the host/agent environment at scan time. No credentials are stored by Drift Copilot.',
        showIf: (v) => v.credential_source === 'Environment variables',
      },
      {
        key: 'role',
        label: 'Assume Role ARN',
        type: 'text',
        placeholder: 'arn:aws:iam::role/drift-readonly',
        required: true,
        showIf: (v) => v.credential_source === 'Assume role (STS)',
      },
      {
        key: 'external_id',
        label: 'External ID',
        type: 'password',
        secret: true,
        showIf: (v) => v.credential_source === 'Assume role (STS)',
      },
      {
        key: 'access_key_id',
        label: 'Access Key ID',
        type: 'text',
        placeholder: 'AKIA…',
        required: true,
        showIf: (v) => v.credential_source === 'Static access keys',
      },
      {
        key: 'secret_access_key',
        label: 'Secret Access Key',
        type: 'password',
        secret: true,
        required: true,
        showIf: (v) => v.credential_source === 'Static access keys',
      },
    ],
  },
  {
    kind: 'terraform',
    label: 'Terraform State',
    description: 'Pull planned + applied state from Terraform Cloud / Enterprise (read-only).',
    layer: 'terraform',
    icon: FileCode2,
    readOnly: true,
    fields: [
      { key: 'organization', label: 'Organization', type: 'text', placeholder: 'acme', required: true },
      { key: 'workspace', label: 'Workspace', type: 'text', placeholder: 'prod-network', required: true },
      { key: 'token', label: 'API Token', type: 'password', secret: true, required: true },
    ],
  },
  {
    kind: 'vault',
    label: 'HCP Vault',
    description: 'Read secret engine mounts and metadata from HCP Vault (read-only).',
    layer: 'runtime',
    icon: Vault,
    readOnly: true,
    fields: [
      {
        key: 'address',
        label: 'Vault Address',
        type: 'text',
        placeholder: 'https://vault-cluster.hashicorp.cloud:8200',
        required: true,
      },
      { key: 'namespace', label: 'Namespace', type: 'text', placeholder: 'admin', required: true },
      {
        key: 'auth_method',
        label: 'Auth method',
        type: 'select',
        options: ['Token', 'AppRole'],
        required: true,
      },
      {
        key: 'token',
        label: 'Vault Token',
        type: 'password',
        secret: true,
        required: true,
        showIf: (v) => v.auth_method === 'Token',
      },
      {
        key: 'role_id',
        label: 'Role ID',
        type: 'text',
        placeholder: 'db02de05-fa39-…',
        required: true,
        showIf: (v) => v.auth_method === 'AppRole',
      },
      {
        key: 'secret_id',
        label: 'Secret ID',
        type: 'password',
        secret: true,
        required: true,
        showIf: (v) => v.auth_method === 'AppRole',
      },
    ],
  },
  {
    kind: 'drawio',
    label: 'Draw.io / Diagram',
    description: 'Import intent topology from a Draw.io XML or an exported diagram image.',
    layer: 'intent',
    icon: Workflow,
    fields: [
      {
        key: 'diagram_file',
        label: 'Diagram file',
        type: 'file',
        accept: '.drawio,.xml,.png,.jpg,.jpeg,.svg',
        required: true,
        help: 'Upload a Draw.io XML (.drawio/.xml) or an exported image (.png/.jpg/.svg).',
      },
      { key: 'diagram_name', label: 'Diagram name', type: 'text', placeholder: 'Production network' },
    ],
  },
  {
    kind: 'image',
    label: 'Static Diagram / Image',
    description: 'Upload a static architecture diagram or screenshot (JPG, PNG, etc.).',
    layer: 'intent',
    icon: Image,
    fields: [
      {
        key: 'image_file',
        label: 'Image file',
        type: 'file',
        accept: '.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf',
        required: true,
        help: 'Upload a static image (.png/.jpg/.jpeg/.gif/.webp/.svg) or PDF export.',
      },
      { key: 'diagram_name', label: 'Diagram name', type: 'text', placeholder: 'Network topology' },
    ],
  },
  {
    kind: 'confluence',
    label: 'Confluence',
    description: 'Parse architecture intent from Confluence pages and diagrams.',
    layer: 'intent',
    icon: BookText,
    fields: [
      { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://acme.atlassian.net/wiki', required: true },
      { key: 'space', label: 'Space Key', type: 'text', placeholder: 'ARCH', required: true },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'bot@acme.com', required: true },
      { key: 'api_token', label: 'API Token', type: 'password', secret: true, required: true },
    ],
  },
];

export function schemaForKind(kind: string): IntegrationKindSchema | undefined {
  return INTEGRATION_SCHEMAS.find((s) => s.kind === kind);
}

/** Fields visible given the current values (honours each field's showIf guard). */
export function visibleFields(
  schema: IntegrationKindSchema,
  values: Record<string, string>,
): ConfigField[] {
  return schema.fields.filter((f) => !f.showIf || f.showIf(values));
}

export const LAYER_OF_KIND: Record<string, Layer> = Object.fromEntries(
  INTEGRATION_SCHEMAS.map((s) => [s.kind, s.layer]),
);
