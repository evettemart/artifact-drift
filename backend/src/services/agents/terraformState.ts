import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  Provider,
  RelationshipType,
  ResourceSource,
  ResourceType,
  redactSensitiveData,
} from '../../types/shared';
import type { NormalizedResource } from '../../types/shared';
import type { IntegrationRow } from '../../db/schema';

interface TerraformStateFileResource {
  module?: string;
  mode?: string;
  type?: string;
  name?: string;
  provider?: string;
  instances?: Array<{
    attributes?: Record<string, unknown>;
  }>;
}

interface TerraformShowResource {
  address?: string;
  mode?: string;
  type?: string;
  name?: string;
  provider_name?: string;
  values?: Record<string, unknown>;
}

interface TerraformShowModule {
  resources?: TerraformShowResource[];
  child_modules?: TerraformShowModule[];
}

interface TerraformShowOutput {
  terraform_version?: string;
  format_version?: string;
  values?: {
    root_module?: TerraformShowModule;
  };
}

interface TerraformStateFileOutput {
  terraform_version?: string;
  resources?: TerraformStateFileResource[];
}

export interface TerraformStateAgentResult {
  resources: NormalizedResource[];
  parsedIntegrations: string[];
  warnings: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapResourceType(type: string): ResourceType {
  const normalized = type.toLowerCase();
  const mapping: Record<string, ResourceType> = {
    vpc: ResourceType.VPC,
    subnet: ResourceType.SUBNET,
    security_group: ResourceType.SECURITY_GROUP,
    ec2_instance: ResourceType.EC2_INSTANCE,
    alb: ResourceType.ALB,
    aws_vpc: ResourceType.VPC,
    aws_subnet: ResourceType.SUBNET,
    aws_security_group: ResourceType.SECURITY_GROUP,
    aws_instance: ResourceType.EC2_INSTANCE,
    aws_lb: ResourceType.ALB,
    provider: ResourceType.PROVIDER,
  };

  return mapping[normalized] ?? ResourceType.PROVIDER;
}

function inferTypeFromReferenceId(value: string): ResourceType {
  const normalized = value.toLowerCase();
  if (normalized.startsWith('vpc-')) return ResourceType.VPC;
  if (normalized.startsWith('subnet-')) return ResourceType.SUBNET;
  if (normalized.startsWith('sg-')) return ResourceType.SECURITY_GROUP;
  if (normalized.startsWith('i-')) return ResourceType.EC2_INSTANCE;
  if (normalized.startsWith('igw-')) return ResourceType.INTERNET_GATEWAY;
  if (normalized.startsWith('nat-')) return ResourceType.NAT_GATEWAY;
  if (normalized.startsWith('eni-')) return ResourceType.PROVIDER;
  if (normalized.startsWith('rtb-')) return ResourceType.ROUTE_TABLE;
  if (normalized.startsWith('tgw-')) return ResourceType.PROVIDER;
  return ResourceType.PROVIDER;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        const typed = item as Record<string, unknown>;
        const idLike =
          typed.group_id ?? typed.subnet_id ?? typed.vpc_id ?? typed.id ?? typed.arn;
        if (typeof idLike === 'string') {
          return idLike;
        }
      }
      return '';
    })
    .filter((item) => item.length > 0);
}

function deriveTerraformRelationships(resources: NormalizedResource[]): NormalizedResource[] {
  const referenceIndex = new Map<
    string,
    { logicalName: string; type: ResourceType }
  >();

  for (const resource of resources) {
    referenceIndex.set(resource.logicalName, {
      logicalName: resource.logicalName,
      type: resource.type,
    });

    const resourceId = resource.attributes.id;
    if (typeof resourceId === 'string' && resourceId.length > 0) {
      referenceIndex.set(resourceId, {
        logicalName: resource.logicalName,
        type: resource.type,
      });
    }

    const arn = resource.attributes.arn;
    if (typeof arn === 'string' && arn.length > 0) {
      referenceIndex.set(arn, {
        logicalName: resource.logicalName,
        type: resource.type,
      });
    }
  }

  return resources.map((resource) => {
    const attrs = resource.attributes;
    const refs: Array<{ value: string; relationshipType: RelationshipType }> = [
      ...asStringArray(attrs.vpc_id).map((value) => ({
        value,
        relationshipType: RelationshipType.MEMBER_OF,
      })),
      ...asStringArray(attrs.subnet_id).map((value) => ({
        value,
        relationshipType: RelationshipType.MEMBER_OF,
      })),
      ...asStringArray(attrs.route_table_id).map((value) => ({
        value,
        relationshipType: RelationshipType.ROUTES_TO,
      })),
      ...asStringArray(attrs.gateway_id).map((value) => ({
        value,
        relationshipType: RelationshipType.ATTACHED_TO,
      })),
      ...asStringArray(attrs.internet_gateway_id).map((value) => ({
        value,
        relationshipType: RelationshipType.ATTACHED_TO,
      })),
      ...asStringArray(attrs.nat_gateway_id).map((value) => ({
        value,
        relationshipType: RelationshipType.ATTACHED_TO,
      })),
      ...asStringArray(attrs.security_group_ids).map((value) => ({
        value,
        relationshipType: RelationshipType.ATTACHED_TO,
      })),
      ...asStringArray(attrs.vpc_security_group_ids).map((value) => ({
        value,
        relationshipType: RelationshipType.ATTACHED_TO,
      })),
      ...asStringArray(attrs.network_interface_id).map((value) => ({
        value,
        relationshipType: RelationshipType.ATTACHED_TO,
      })),
      ...asStringArray(attrs.target_group_arn).map((value) => ({
        value,
        relationshipType: RelationshipType.TARGETS,
      })),
    ];

    const seen = new Set<string>();
    const relationships = refs
      .map((ref) => {
        const resolved = referenceIndex.get(ref.value);
        const targetLogicalName = resolved?.logicalName ?? ref.value;
        if (!targetLogicalName || targetLogicalName === resource.logicalName) {
          return null;
        }

        const dedupe = `${String(ref.relationshipType)}::${targetLogicalName}`;
        if (seen.has(dedupe)) {
          return null;
        }
        seen.add(dedupe);

        return {
          type: ref.relationshipType,
          targetLogicalName,
          targetType: resolved?.type ?? inferTypeFromReferenceId(ref.value),
        };
      })
      .filter(
        (
          relationship
        ): relationship is {
          type: RelationshipType;
          targetLogicalName: string;
          targetType: ResourceType;
        } => relationship !== null
      );

    return {
      ...resource,
      relationships,
    };
  });
}

function collectShowResources(module: TerraformShowModule | undefined): TerraformShowResource[] {
  if (!module) {
    return [];
  }

  const current = module.resources ?? [];
  const nested = (module.child_modules ?? []).flatMap((child) => collectShowResources(child));
  return [...current, ...nested];
}

function extractTags(attributes: Record<string, unknown>): Record<string, string> {
  const tags = attributes.tags;
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
    return {};
  }

  return Object.entries(tags as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
}

function logicalNameFromAttributes(
  fallbackName: string,
  attributes: Record<string, unknown>,
  index: number
): string {
  const tags = extractTags(attributes);
  const tagName = tags.Name;
  if (tagName) {
    return tagName;
  }

  const directName = attributes.name;
  if (typeof directName === 'string' && directName.trim()) {
    return directName;
  }

  return `${fallbackName}-${index + 1}`;
}

function normalizeFromStateFile(
  input: TerraformStateFileOutput,
  integrationId: string,
  sourceLocation: string
): NormalizedResource[] {
  const capturedAt = nowIso();
  const resources = input.resources ?? [];

  return resources
    .filter((resource) => resource.mode === 'managed' && typeof resource.type === 'string')
    .flatMap((resource, blockIndex) =>
      (resource.instances ?? []).map((instance, index) => {
        const rawAttributes = instance.attributes ?? {};
        const redacted = redactSensitiveData(rawAttributes);
        const attributes = redacted.data;
        const logicalName = logicalNameFromAttributes(resource.name ?? 'resource', attributes, index);
        const resourceBlockId = [resource.module, resource.type, resource.name]
          .filter((part) => typeof part === 'string' && part.length > 0)
          .join('.');

        return {
          id: `terraform-${integrationId}-${resourceBlockId || resource.type || 'resource'}-${blockIndex + 1}-${index + 1}`,
          logicalName,
          type: mapResourceType(resource.type ?? 'provider'),
          provider: Provider.AWS,
          region: 'us-east-1',
          source: ResourceSource.TERRAFORM,
          attributes,
          tags: extractTags(attributes),
          relationships: [],
          sensitiveRedacted: true,
          metadata: {
            capturedAt,
            sourceLocation,
            providerMetadata: {
              terraformType: resource.type,
              terraformVersion: input.terraform_version,
              redactedAtIngest: redacted.redacted,
            },
          },
        };
      })
    );
}

function normalizeFromTerraformShow(
  input: TerraformShowOutput,
  integrationId: string,
  sourceLocation: string
): NormalizedResource[] {
  const capturedAt = nowIso();
  const resources = collectShowResources(input.values?.root_module);

  return resources
    .filter((resource) => resource.mode === 'managed' && typeof resource.type === 'string')
    .map((resource, index) => {
      const rawAttributes = resource.values ?? {};
      const redacted = redactSensitiveData(rawAttributes);
      const attributes = redacted.data;
      const logicalName = logicalNameFromAttributes(resource.name ?? 'resource', attributes, index);
      const resourceBlockId = resource.address || resource.name || resource.type || 'resource';

      return {
        id: `terraform-${integrationId}-${resourceBlockId}-${index + 1}`,
        logicalName,
        type: mapResourceType(resource.type ?? 'provider'),
        provider: Provider.AWS,
        region: 'us-east-1',
        source: ResourceSource.TERRAFORM,
        attributes,
        tags: extractTags(attributes),
        relationships: [],
        sensitiveRedacted: true,
        metadata: {
          capturedAt,
          sourceLocation,
          providerMetadata: {
            terraformType: resource.type,
            terraformVersion: input.terraform_version,
            formatVersion: input.format_version,
            address: resource.address,
            providerName: resource.provider_name,
            redactedAtIngest: redacted.redacted,
          },
        },
      };
    });
}

function resolveUploadPath(integrationId: string, configuredPath: string): string | null {
  const directCandidates = [
    path.resolve(process.cwd(), configuredPath),
    path.resolve(process.cwd(), '..', configuredPath),
    path.resolve(process.cwd(), 'data', 'uploads', integrationId, path.basename(configuredPath)),
    path.resolve(
      process.cwd(),
      '..',
      'data',
      'uploads',
      integrationId,
      path.basename(configuredPath)
    ),
  ];

  for (const candidate of directCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseTerraformDocument(content: string): TerraformStateFileOutput | TerraformShowOutput {
  return JSON.parse(content) as TerraformStateFileOutput | TerraformShowOutput;
}

function normalizeTerraformDocument(
  parsed: TerraformStateFileOutput | TerraformShowOutput,
  integrationId: string,
  sourceLocation: string
): NormalizedResource[] {
  const normalized =
    'values' in parsed
      ? normalizeFromTerraformShow(
          parsed as TerraformShowOutput,
          integrationId,
          sourceLocation
        )
      : normalizeFromStateFile(
          parsed as TerraformStateFileOutput,
          integrationId,
          sourceLocation
        );

  return deriveTerraformRelationships(normalized);
}

export async function fetchTerraformStateResources(
  terraformIntegrations: IntegrationRow[]
): Promise<TerraformStateAgentResult> {
  const resources: NormalizedResource[] = [];
  const parsedIntegrations: string[] = [];
  const warnings: string[] = [];

  for (const integration of terraformIntegrations) {
    const config = JSON.parse(integration.configJson || '{}') as Record<string, string>;
    const source = config.source ?? '';

    if (source === 'Terraform Cloud / Enterprise') {
      warnings.push(
        `Terraform integration ${integration.integrationId} uses Terraform Cloud source; live API fetch is not implemented yet.`
      );
      continue;
    }

    const configuredPath = config._state_file_path || config.state_file || '';
    if (!configuredPath) {
      warnings.push(
        `Terraform integration ${integration.integrationId} has no uploaded state file configured.`
      );
      continue;
    }

    const absolutePath = resolveUploadPath(integration.integrationId, configuredPath);
    if (!absolutePath) {
      warnings.push(
        `Terraform integration ${integration.integrationId} state file was not found on disk.`
      );
      continue;
    }

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      const parsed = parseTerraformDocument(content);
      const normalized = normalizeTerraformDocument(
        parsed,
        integration.integrationId,
        absolutePath
      );
      resources.push(...normalized);
      parsedIntegrations.push(integration.integrationId);
    } catch (error) {
      warnings.push(
        `Terraform integration ${integration.integrationId} could not be parsed: ${
          error instanceof Error ? error.message : 'Unknown parse error'
        }`
      );
    }
  }

  return {
    resources,
    parsedIntegrations,
    warnings,
  };
}
