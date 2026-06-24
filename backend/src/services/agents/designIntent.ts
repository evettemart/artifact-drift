import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  IntegrationError,
  ParseError,
  Provider,
  RelationshipType,
  ResourceSource,
  ResourceType,
  SecurityError,
  SharedValidationError,
} from '../../types/shared';
import type {
  NormalizedResource,
  ResourceRelationship,
  Result,
  ValidationError,
  ValidationResult,
} from '../../types/shared';

export interface DesignIntentAgentConfig {
  architectureFilePath: string;
  strictValidation: boolean;
  confluenceConfig?: ConfluenceConfig;
  customTypeMappings?: Record<string, ResourceType>;
}

export interface ConfluenceConfig {
  baseUrl: string;
  pageId: string;
  token?: string;
  enabled: boolean;
}

interface ArchitectureIntent {
  version: string;
  metadata: ArchitectureMetadata;
  regions: string[];
  resources: ArchitectureResources;
  relationships?: ArchitectureRelationship[];
}

interface ArchitectureMetadata {
  name: string;
  description?: string;
  owner: string;
  lastReviewed?: string;
  approvedBy?: string;
  tags?: Record<string, string>;
}

interface ArchitectureResources {
  vpcs?: VPCDefinition[];
  subnets?: SubnetDefinition[];
  securityGroups?: SecurityGroupDefinition[];
  ec2Instances?: EC2InstanceDefinition[];
  loadBalancers?: LoadBalancerDefinition[];
  routeTables?: RouteTableDefinition[];
  internetGateways?: InternetGatewayDefinition[];
  natGateways?: NATGatewayDefinition[];
}

interface VPCDefinition {
  logicalName: string;
  cidrBlock: string;
  region: string;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  tags: Record<string, string>;
}

interface SubnetDefinition {
  logicalName: string;
  vpcLogicalName: string;
  cidrBlock: string;
  availabilityZone: string;
  public: boolean;
  tags: Record<string, string>;
}

interface SecurityGroupDefinition {
  logicalName: string;
  vpcLogicalName: string;
  description: string;
  ingressRules: SecurityGroupRule[];
  egressRules: SecurityGroupRule[];
  tags: Record<string, string>;
}

interface SecurityGroupRule {
  protocol: string;
  fromPort: number;
  toPort: number;
  cidrBlocks?: string[];
  sourceSecurityGroupLogicalName?: string;
  description?: string;
}

interface EC2InstanceDefinition {
  logicalName: string;
  instanceType: string;
  subnetLogicalName: string;
  securityGroupLogicalNames: string[];
  ami: string;
  userData?: string;
  tags: Record<string, string>;
}

interface LoadBalancerDefinition {
  logicalName: string;
  type: 'application' | 'network';
  scheme: 'internet-facing' | 'internal';
  subnetLogicalNames: string[];
  securityGroupLogicalNames: string[];
  tags: Record<string, string>;
}

interface RouteTableDefinition {
  logicalName: string;
  vpcLogicalName: string;
  routes: RouteDefinition[];
  tags: Record<string, string>;
}

interface RouteDefinition {
  destinationCidrBlock: string;
  targetType: 'igw' | 'nat' | 'instance' | 'vpc-peering';
  targetLogicalName: string;
}

interface InternetGatewayDefinition {
  logicalName: string;
  vpcLogicalName: string;
  tags: Record<string, string>;
}

interface NATGatewayDefinition {
  logicalName: string;
  subnetLogicalName: string;
  allocationId?: string;
  tags: Record<string, string>;
}

interface ArchitectureRelationship {
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, unknown>;
}

interface LegacyArchitectureInput {
  version?: string;
  metadata?: Record<string, unknown>;
  provider?: { name?: string; region?: string };
  resources?: Array<{
    type?: string;
    name?: string;
    attributes?: Record<string, unknown>;
    tags?: Record<string, string>;
    relationships?: Array<{ type?: string; target?: string }>;
  }>;
}

function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function ensureRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, v]) => {
      if (typeof v === 'string') {
        acc[key] = v;
      }
      return acc;
    },
    {}
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function mapLegacyType(type: string): keyof ArchitectureResources | null {
  const normalized = type.toLowerCase();
  switch (normalized) {
    case 'vpc':
    case 'aws_vpc':
      return 'vpcs';
    case 'subnet':
    case 'aws_subnet':
      return 'subnets';
    case 'security_group':
    case 'aws_security_group':
      return 'securityGroups';
    case 'ec2_instance':
    case 'aws_instance':
      return 'ec2Instances';
    case 'alb':
    case 'aws_lb':
    case 'application_load_balancer':
      return 'loadBalancers';
    case 'route_table':
      return 'routeTables';
    case 'internet_gateway':
      return 'internetGateways';
    case 'nat_gateway':
      return 'natGateways';
    default:
      return null;
  }
}

function convertLegacyToArchitectureIntent(input: LegacyArchitectureInput): ArchitectureIntent {
  const resources: ArchitectureResources = {
    vpcs: [],
    subnets: [],
    securityGroups: [],
    ec2Instances: [],
    loadBalancers: [],
    routeTables: [],
    internetGateways: [],
    natGateways: [],
  };
  const relationships: ArchitectureRelationship[] = [];
  const fallbackRegion = input.provider?.region ?? 'us-east-1';

  for (const resource of input.resources ?? []) {
    const typeKey = mapLegacyType(String(resource.type ?? ''));
    const logicalName = String(resource.name ?? '').trim();
    if (!typeKey || !logicalName) {
      continue;
    }
    const attrs = resource.attributes ?? {};
    const tags = ensureRecord(resource.tags);

    if (typeKey === 'vpcs') {
      resources.vpcs?.push({
        logicalName,
        cidrBlock: String(attrs.cidrBlock ?? attrs.cidr_block ?? ''),
        region: String(attrs.region ?? fallbackRegion),
        enableDnsHostnames: toBoolean(attrs.enableDnsHostnames ?? attrs.enable_dns_hostnames, true),
        enableDnsSupport: toBoolean(attrs.enableDnsSupport ?? attrs.enable_dns_support, true),
        tags,
      });
    } else if (typeKey === 'subnets') {
      resources.subnets?.push({
        logicalName,
        vpcLogicalName: String(attrs.vpcLogicalName ?? attrs.vpc ?? ''),
        cidrBlock: String(attrs.cidrBlock ?? attrs.cidr_block ?? ''),
        availabilityZone: String(attrs.availabilityZone ?? attrs.availability_zone ?? ''),
        public: toBoolean(attrs.public ?? attrs.map_public_ip_on_launch, false),
        tags,
      });
    } else if (typeKey === 'securityGroups') {
      resources.securityGroups?.push({
        logicalName,
        vpcLogicalName: String(attrs.vpcLogicalName ?? attrs.vpc ?? ''),
        description: String(attrs.description ?? ''),
        ingressRules: Array.isArray(attrs.ingressRules ?? attrs.ingress_rules)
          ? (attrs.ingressRules ?? attrs.ingress_rules) as SecurityGroupRule[]
          : [],
        egressRules: Array.isArray(attrs.egressRules ?? attrs.egress_rules)
          ? (attrs.egressRules ?? attrs.egress_rules) as SecurityGroupRule[]
          : [],
        tags,
      });
    } else if (typeKey === 'ec2Instances') {
      resources.ec2Instances?.push({
        logicalName,
        instanceType: String(attrs.instanceType ?? attrs.instance_type ?? ''),
        subnetLogicalName: String(attrs.subnetLogicalName ?? attrs.subnet ?? ''),
        securityGroupLogicalNames: toStringArray(
          attrs.securityGroupLogicalNames ?? attrs.security_groups
        ),
        ami: String(attrs.ami ?? attrs.imageId ?? attrs.image_id ?? ''),
        userData: typeof attrs.userData === 'string' ? attrs.userData : undefined,
        tags,
      });
    } else if (typeKey === 'loadBalancers') {
      resources.loadBalancers?.push({
        logicalName,
        type: String(attrs.type ?? 'application') === 'network' ? 'network' : 'application',
        scheme: String(attrs.scheme ?? 'internet-facing') === 'internal' ? 'internal' : 'internet-facing',
        subnetLogicalNames: toStringArray(attrs.subnetLogicalNames ?? attrs.subnets),
        securityGroupLogicalNames: toStringArray(
          attrs.securityGroupLogicalNames ?? attrs.security_groups
        ),
        tags,
      });
    }

    for (const rel of resource.relationships ?? []) {
      if (!rel?.type || !rel?.target) {
        continue;
      }
      relationships.push({
        source: logicalName,
        target: String(rel.target),
        type: String(rel.type),
      });
    }
  }

  return {
    version: String(input.version ?? '1.0'),
    metadata: {
      name: String(input.metadata?.name ?? 'Architecture Intent'),
      description: typeof input.metadata?.description === 'string' ? input.metadata.description : undefined,
      owner: String(input.metadata?.owner ?? 'unknown'),
      lastReviewed:
        typeof input.metadata?.lastReviewed === 'string'
          ? input.metadata.lastReviewed
          : undefined,
      approvedBy:
        typeof input.metadata?.approvedBy === 'string'
          ? input.metadata.approvedBy
          : undefined,
      tags: ensureRecord(input.metadata?.tags),
    },
    regions: [fallbackRegion],
    resources,
    relationships,
  };
}

function parseIntentDocument(content: string): ArchitectureIntent {
  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (error) {
    throw new ParseError('Failed to parse architecture YAML', {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ParseError('Architecture document must be a YAML object');
  }

  const object = parsed as Record<string, unknown>;
  if (Array.isArray(object.resources)) {
    return convertLegacyToArchitectureIntent(object as LegacyArchitectureInput);
  }

  return object as unknown as ArchitectureIntent;
}

function relationshipTypeFromString(value: string): RelationshipType {
  const normalized = value.toLowerCase();
  if (normalized === 'contains') return RelationshipType.CONTAINS;
  if (normalized === 'attached_to' || normalized === 'attachedto') return RelationshipType.ATTACHED_TO;
  if (normalized === 'routes_to' || normalized === 'route_table') return RelationshipType.ROUTES_TO;
  if (normalized === 'depends_on') return RelationshipType.DEPENDS_ON;
  if (normalized === 'member_of') return RelationshipType.MEMBER_OF;
  if (normalized === 'targets') return RelationshipType.TARGETS;
  return RelationshipType.DEPENDS_ON;
}

function resourceTypeFor(
  key: keyof ArchitectureResources,
  customTypeMappings?: Record<string, ResourceType>
): ResourceType {
  const custom = customTypeMappings?.[key];
  if (custom) {
    return custom;
  }
  switch (key) {
    case 'vpcs':
      return ResourceType.VPC;
    case 'subnets':
      return ResourceType.SUBNET;
    case 'securityGroups':
      return ResourceType.SECURITY_GROUP;
    case 'ec2Instances':
      return ResourceType.EC2_INSTANCE;
    case 'loadBalancers':
      return ResourceType.ALB;
    case 'routeTables':
      return ResourceType.ROUTE_TABLE;
    case 'internetGateways':
      return ResourceType.INTERNET_GATEWAY;
    case 'natGateways':
      return ResourceType.NAT_GATEWAY;
    default:
      return ResourceType.PROVIDER;
  }
}

function normalizeArchitectureIntent(
  intent: ArchitectureIntent,
  sourceLocation: string,
  checksum: string,
  customTypeMappings?: Record<string, ResourceType>
): NormalizedResource[] {
  const capturedAt = new Date().toISOString();
  const regionFallback = intent.regions[0] ?? 'us-east-1';
  const relationshipsBySource = new Map<string, ResourceRelationship[]>();

  for (const relationship of intent.relationships ?? []) {
    const list = relationshipsBySource.get(relationship.source) ?? [];
    list.push({
      type: relationshipTypeFromString(relationship.type),
      targetLogicalName: relationship.target,
      targetType: ResourceType.PROVIDER,
      metadata: relationship.metadata,
    });
    relationshipsBySource.set(relationship.source, list);
  }

  const resources: NormalizedResource[] = [];
  const pushResource = (
    bucketKey: keyof ArchitectureResources,
    logicalName: string,
    region: string,
    attributes: Record<string, unknown>,
    tags: Record<string, string>,
    inlineRelationships: ResourceRelationship[] = []
  ) => {
    resources.push({
      id: `intent-${bucketKey}-${logicalName}`,
      logicalName,
      type: resourceTypeFor(bucketKey, customTypeMappings),
      provider: Provider.AWS,
      region,
      source: ResourceSource.INTENT,
      attributes,
      tags,
      relationships: [...inlineRelationships, ...(relationshipsBySource.get(logicalName) ?? [])],
      sensitiveRedacted: false,
      metadata: {
        capturedAt,
        sourceLocation,
        sourceChecksum: checksum,
      },
    });
  };

  for (const vpc of intent.resources.vpcs ?? []) {
    pushResource('vpcs', vpc.logicalName, vpc.region || regionFallback, {
      cidrBlock: vpc.cidrBlock,
      enableDnsHostnames: vpc.enableDnsHostnames ?? true,
      enableDnsSupport: vpc.enableDnsSupport ?? true,
    }, vpc.tags);
  }

  for (const subnet of intent.resources.subnets ?? []) {
    const inferredRegion =
      intent.resources.vpcs?.find((vpc) => vpc.logicalName === subnet.vpcLogicalName)?.region ||
      regionFallback;
    pushResource(
      'subnets',
      subnet.logicalName,
      inferredRegion,
      {
        cidrBlock: subnet.cidrBlock,
        availabilityZone: subnet.availabilityZone,
        public: subnet.public,
        vpcLogicalName: subnet.vpcLogicalName,
      },
      subnet.tags,
      [
        {
          type: RelationshipType.MEMBER_OF,
          targetLogicalName: subnet.vpcLogicalName,
          targetType: ResourceType.VPC,
        },
      ]
    );
  }

  for (const sg of intent.resources.securityGroups ?? []) {
    const inferredRegion =
      intent.resources.vpcs?.find((vpc) => vpc.logicalName === sg.vpcLogicalName)?.region ||
      regionFallback;
    pushResource(
      'securityGroups',
      sg.logicalName,
      inferredRegion,
      {
        description: sg.description,
        ingressRules: sg.ingressRules,
        egressRules: sg.egressRules,
        vpcLogicalName: sg.vpcLogicalName,
      },
      sg.tags,
      [
        {
          type: RelationshipType.MEMBER_OF,
          targetLogicalName: sg.vpcLogicalName,
          targetType: ResourceType.VPC,
        },
      ]
    );
  }

  for (const instance of intent.resources.ec2Instances ?? []) {
    const subnet = intent.resources.subnets?.find(
      (item) => item.logicalName === instance.subnetLogicalName
    );
    const vpc = subnet
      ? intent.resources.vpcs?.find((item) => item.logicalName === subnet.vpcLogicalName)
      : undefined;
    const inferredRegion = vpc?.region || regionFallback;
    const inlineRelationships: ResourceRelationship[] = [
      {
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: instance.subnetLogicalName,
        targetType: ResourceType.SUBNET,
      },
      ...instance.securityGroupLogicalNames.map((sg) => ({
        type: RelationshipType.ATTACHED_TO,
        targetLogicalName: sg,
        targetType: ResourceType.SECURITY_GROUP,
      })),
    ];
    pushResource(
      'ec2Instances',
      instance.logicalName,
      inferredRegion,
      {
        instanceType: instance.instanceType,
        subnetLogicalName: instance.subnetLogicalName,
        securityGroupLogicalNames: instance.securityGroupLogicalNames,
        ami: instance.ami,
        userData: instance.userData,
      },
      instance.tags,
      inlineRelationships
    );
  }

  for (const lb of intent.resources.loadBalancers ?? []) {
    const firstSubnet = intent.resources.subnets?.find(
      (item) => item.logicalName === lb.subnetLogicalNames[0]
    );
    const firstVpc = firstSubnet
      ? intent.resources.vpcs?.find((item) => item.logicalName === firstSubnet.vpcLogicalName)
      : undefined;
    const inferredRegion = firstVpc?.region || regionFallback;
    const inlineRelationships: ResourceRelationship[] = [
      ...lb.subnetLogicalNames.map((name) => ({
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: name,
        targetType: ResourceType.SUBNET,
      })),
      ...lb.securityGroupLogicalNames.map((name) => ({
        type: RelationshipType.ATTACHED_TO,
        targetLogicalName: name,
        targetType: ResourceType.SECURITY_GROUP,
      })),
    ];
    pushResource(
      'loadBalancers',
      lb.logicalName,
      inferredRegion,
      {
        type: lb.type,
        scheme: lb.scheme,
        subnetLogicalNames: lb.subnetLogicalNames,
        securityGroupLogicalNames: lb.securityGroupLogicalNames,
      },
      lb.tags,
      inlineRelationships
    );
  }

  for (const routeTable of intent.resources.routeTables ?? []) {
    const inferredRegion =
      intent.resources.vpcs?.find((vpc) => vpc.logicalName === routeTable.vpcLogicalName)?.region ||
      regionFallback;
    pushResource('routeTables', routeTable.logicalName, inferredRegion, {
      vpcLogicalName: routeTable.vpcLogicalName,
      routes: routeTable.routes,
    }, routeTable.tags);
  }

  for (const igw of intent.resources.internetGateways ?? []) {
    const inferredRegion =
      intent.resources.vpcs?.find((vpc) => vpc.logicalName === igw.vpcLogicalName)?.region ||
      regionFallback;
    pushResource('internetGateways', igw.logicalName, inferredRegion, {
      vpcLogicalName: igw.vpcLogicalName,
    }, igw.tags);
  }

  for (const nat of intent.resources.natGateways ?? []) {
    const subnet = intent.resources.subnets?.find((item) => item.logicalName === nat.subnetLogicalName);
    const inferredRegion = subnet
      ? intent.resources.vpcs?.find((vpc) => vpc.logicalName === subnet.vpcLogicalName)?.region ||
        regionFallback
      : regionFallback;
    pushResource('natGateways', nat.logicalName, inferredRegion, {
      subnetLogicalName: nat.subnetLogicalName,
      allocationId: nat.allocationId,
    }, nat.tags);
  }

  return resources;
}

function validateArchitectureIntent(intent: ArchitectureIntent): ValidationResult {
  const errors: ValidationError[] = [];

  if (!intent.version || typeof intent.version !== 'string') {
    errors.push({ field: 'version', message: 'Version is required', code: 'REQUIRED_FIELD' });
  }

  if (!intent.metadata || typeof intent.metadata !== 'object') {
    errors.push({ field: 'metadata', message: 'Metadata is required', code: 'REQUIRED_FIELD' });
  } else {
    if (!intent.metadata.name) {
      errors.push({
        field: 'metadata.name',
        message: 'Architecture name is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!intent.metadata.owner) {
      errors.push({
        field: 'metadata.owner',
        message: 'Owner is required',
        code: 'REQUIRED_FIELD',
      });
    }
  }

  if (!Array.isArray(intent.regions) || intent.regions.length === 0) {
    errors.push({
      field: 'regions',
      message: 'At least one region must be specified',
      code: 'REQUIRED_FIELD',
    });
  }

  if (!intent.resources || typeof intent.resources !== 'object') {
    errors.push({
      field: 'resources',
      message: 'Resources section is required',
      code: 'REQUIRED_FIELD',
    });
  }

  const logicalNames = new Set<string>();
  const duplicates: string[] = [];
  const buckets = Object.values(intent.resources ?? {});
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }
    for (const item of bucket as Array<{ logicalName?: string }>) {
      if (!item.logicalName) {
        continue;
      }
      if (logicalNames.has(item.logicalName)) {
        duplicates.push(item.logicalName);
      }
      logicalNames.add(item.logicalName);
    }
  }

  if (duplicates.length > 0) {
    errors.push({
      field: 'resources',
      message: `Duplicate logical names found: ${duplicates.join(', ')}`,
      code: 'DUPLICATE_LOGICAL_NAME',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function assertSafePath(filePath: string): void {
  if (filePath.includes('\u0000')) {
    throw new SecurityError('Invalid architecture path: null byte detected');
  }
}

function assertSupportedSource(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    throw new ParseError(
      `Deterministic image parsing is not implemented for ${ext} architecture inputs. Use YAML instead.`
    );
  }
  if (ext !== '.yaml' && ext !== '.yml') {
    throw new ParseError(`Unsupported architecture file extension: ${ext || '(none)'}`);
  }
}

function parseContentToResources(
  content: string,
  sourceLocation: string,
  strictValidation: boolean,
  customTypeMappings?: Record<string, ResourceType>
): NormalizedResource[] {
  const intent = parseIntentDocument(content);
  const validationResult = validateArchitectureIntent(intent);
  if (strictValidation && !validationResult.valid) {
    throw new SharedValidationError('Architecture schema validation failed', {
      errors: validationResult.errors,
    });
  }
  return normalizeArchitectureIntent(intent, sourceLocation, calculateChecksum(content), customTypeMappings);
}

export function parseDesignIntentFromFileSync(
  architectureFilePath: string,
  strictValidation = true,
  customTypeMappings?: Record<string, ResourceType>
): NormalizedResource[] {
  assertSafePath(architectureFilePath);
  assertSupportedSource(architectureFilePath);
  const content = fs.readFileSync(architectureFilePath, 'utf-8');
  return parseContentToResources(
    content,
    architectureFilePath,
    strictValidation,
    customTypeMappings
  );
}

export class DesignIntentAgent {
  private config: DesignIntentAgentConfig;

  constructor(config: DesignIntentAgentConfig) {
    this.config = config;
  }

  async parseArchitecture(): Promise<Result<NormalizedResource[], Error>> {
    try {
      const fileContent = await this.readArchitectureFile();
      const resources = parseContentToResources(
        fileContent,
        this.config.architectureFilePath,
        this.config.strictValidation,
        this.config.customTypeMappings
      );
      return { success: true, data: resources };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async readArchitectureFile(): Promise<string> {
    const inputPath = this.config.architectureFilePath;
    assertSafePath(inputPath);
    assertSupportedSource(inputPath);

    if (this.config.confluenceConfig?.enabled) {
      try {
        return await this.fetchFromConfluence(this.config.confluenceConfig.pageId);
      } catch (error) {
        console.warn(
          '[design-intent] Confluence fetch failed; falling back to local architecture file:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return await fsp.readFile(inputPath, 'utf-8');
  }

  private async fetchFromConfluence(_pageId: string): Promise<string> {
    throw new IntegrationError(
      'Confluence integration not yet implemented. Using local file fallback.'
    );
  }
}
