import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import yaml from 'yaml';
import { eq } from 'drizzle-orm';
import {
  Provider,
  ResourceSource,
  ResourceType,
  RelationshipType,
  DriftType,
  Severity,
  DriftStatus,
  calculateComplianceScore,
} from '../types/shared';
import type {
  DriftFinding,
  NormalizedResource,
  ReasoningResult,
  ResourceRelationship,
  ScanResult,
  ScanStatistics,
} from '../types/shared';
import { db } from '../db';
import {
  scans,
  findings as findingsTable,
  resources as resourcesTable,
} from '../db/schema';
import { fetchAwsInventory } from './agents/awsInventory';
import type { InventorySource } from './agents/awsInventory';

interface ArchitectureResourceInput {
  type: string;
  name: string;
  attributes?: Record<string, unknown>;
  tags?: Record<string, string>;
  relationships?: Array<{ type: string; target: string }>;
}

interface ArchitectureIntentInput {
  version: string;
  metadata: Record<string, unknown>;
  provider?: {
    name?: string;
    region?: string;
  };
  resources: ArchitectureResourceInput[];
}

interface TerraformStateInput {
  terraform_version?: string;
  resources: Array<{
    mode: string;
    type: string;
    name: string;
    provider?: string;
    instances?: Array<{
      schema_version?: number;
      attributes?: Record<string, unknown>;
    }>;
  }>;
}

interface AwsMockInventoryInput {
  metadata?: {
    source?: string;
    region?: string;
    timestamp?: string;
  };
  vpcs?: Array<Record<string, unknown>>;
  subnets?: Array<Record<string, unknown>>;
  security_groups?: Array<Record<string, unknown>>;
  instances?: Array<Record<string, unknown>>;
  load_balancers?: Array<Record<string, unknown>>;
  load_balancer_attributes?: Record<string, Array<{ Key: string; Value: string }>>;
}

interface AnalysisArtifacts {
  intentResources: NormalizedResource[];
  terraformResources: NormalizedResource[];
  awsResources: NormalizedResource[];
  findings: DriftFinding[];
  scan: ScanResult;
}

function sha(content: string): string {
  return createHash('sha256').update(content).digest('hex');
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

function buildRelationships(
  relationships: Array<{ type: string; target: string }> | undefined,
  targetType: ResourceType = ResourceType.SUBNET
): ResourceRelationship[] {
  return (relationships ?? []).map((relationship) => ({
    type: relationship.type as RelationshipType,
    targetLogicalName: relationship.target,
    targetType,
  }));
}

function parseArchitectureIntent(): NormalizedResource[] {
  const filePath = examplesPath('architecture.yaml');
  const content = readFileSync(filePath, 'utf-8');
  const parsed = yaml.parse(content) as ArchitectureIntentInput;
  const checksum = sha(content);
  const region = parsed.provider?.region ?? 'us-east-1';
  const capturedAt = nowIso();

  return parsed.resources.map((resource) => ({
    id: `intent-${resource.type}-${resource.name}`,
    logicalName: resource.name,
    type: mapResourceType(resource.type),
    provider: Provider.AWS,
    region,
    source: ResourceSource.INTENT,
    attributes: resource.attributes ?? {},
    tags: resource.tags ?? {},
    relationships: buildRelationships(resource.relationships),
    sensitiveRedacted: false,
    metadata: {
      capturedAt,
      sourceLocation: 'examples/architecture.yaml',
      sourceChecksum: checksum,
    },
  }));
}

function parseTerraformState(): NormalizedResource[] {
  const filePath = examplesPath('terraform-state.json');
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content) as TerraformStateInput;
  const checksum = sha(content);
  const capturedAt = nowIso();

  return parsed.resources
    .filter((resource) => resource.mode === 'managed')
    .flatMap((resource) =>
      (resource.instances ?? []).map((instance, index) => {
        const attributes = instance.attributes ?? {};
        const tags = (attributes.tags as Record<string, string> | undefined) ?? {};
        const logicalName =
          tags.Name ??
          (attributes.name as string | undefined) ??
          `${resource.name}-${index + 1}`;

        return {
          id: `terraform-${resource.type}-${logicalName}`,
          logicalName,
          type: mapResourceType(resource.type),
          provider: Provider.AWS,
          region: 'us-east-1',
          source: ResourceSource.TERRAFORM,
          attributes,
          tags,
          relationships: [],
          sensitiveRedacted: true,
          metadata: {
            capturedAt,
            sourceLocation: 'examples/terraform-state.json',
            sourceChecksum: checksum,
            providerMetadata: {
              terraformType: resource.type,
              terraformVersion: parsed.terraform_version,
            },
          },
        };
      })
    );
}

function extractTags(tags: unknown): Record<string, string> {
  if (!Array.isArray(tags)) {
    return {};
  }

  return tags.reduce<Record<string, string>>((acc, tag) => {
    const key = (tag as { Key?: string }).Key;
    const value = (tag as { Value?: string }).Value;
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function parseAwsInventory(): NormalizedResource[] {
  const filePath = examplesPath('aws-mock-inventory.json');
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content) as AwsMockInventoryInput;
  const checksum = sha(content);
  const region = parsed.metadata?.region ?? 'us-east-1';
  const capturedAt = parsed.metadata?.timestamp ?? nowIso();

  const vpcs = (parsed.vpcs ?? []).map((vpc) => ({
    id: `aws-vpc-${String(vpc.VpcId)}`,
    logicalName: extractTags(vpc.Tags).Name ?? String(vpc.VpcId),
    type: ResourceType.VPC,
    provider: Provider.AWS,
    region,
    source: ResourceSource.AWS,
    attributes: {
      cidrBlock: vpc.CidrBlock,
      state: vpc.State,
      enableDnsHostnames: vpc.EnableDnsHostnames,
      enableDnsSupport: vpc.EnableDnsSupport,
    },
    tags: extractTags(vpc.Tags),
    relationships: [],
    sensitiveRedacted: true,
    metadata: {
      capturedAt,
      sourceLocation: 'examples/aws-mock-inventory.json',
      sourceChecksum: checksum,
    },
  }));

  const subnets = (parsed.subnets ?? []).map((subnet) => ({
    id: `aws-subnet-${String(subnet.SubnetId)}`,
    logicalName: extractTags(subnet.Tags).Name ?? String(subnet.SubnetId),
    type: ResourceType.SUBNET,
    provider: Provider.AWS,
    region,
    source: ResourceSource.AWS,
    attributes: {
      cidrBlock: subnet.CidrBlock,
      availabilityZone: subnet.AvailabilityZone,
      mapPublicIpOnLaunch: subnet.MapPublicIpOnLaunch,
      vpcId: subnet.VpcId,
      state: subnet.State,
    },
    tags: extractTags(subnet.Tags),
    relationships: [
      {
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: String(subnet.VpcId),
        targetType: ResourceType.VPC,
      },
    ],
    sensitiveRedacted: true,
    metadata: {
      capturedAt,
      sourceLocation: 'examples/aws-mock-inventory.json',
      sourceChecksum: checksum,
    },
  }));

  const securityGroups = (parsed.security_groups ?? []).map((sg) => ({
    id: `aws-sg-${String(sg.GroupId)}`,
    logicalName: extractTags(sg.Tags).Name ?? String(sg.GroupName),
    type: ResourceType.SECURITY_GROUP,
    provider: Provider.AWS,
    region,
    source: ResourceSource.AWS,
    attributes: {
      groupName: sg.GroupName,
      description: sg.Description,
      vpcId: sg.VpcId,
      ingressRules: sg.IpPermissions ?? [],
      egressRules: sg.IpPermissionsEgress ?? [],
    },
    tags: extractTags(sg.Tags),
    relationships: [],
    sensitiveRedacted: true,
    metadata: {
      capturedAt,
      sourceLocation: 'examples/aws-mock-inventory.json',
      sourceChecksum: checksum,
    },
  }));

  const instances = (parsed.instances ?? []).map((instance) => ({
    id: `aws-instance-${String(instance.InstanceId)}`,
    logicalName: extractTags(instance.Tags).Name ?? String(instance.InstanceId),
    type: ResourceType.EC2_INSTANCE,
    provider: Provider.AWS,
    region,
    source: ResourceSource.AWS,
    attributes: {
      instanceType: instance.InstanceType,
      imageId: instance.ImageId,
      subnetId: instance.SubnetId,
      vpcId: instance.VpcId,
      privateIpAddress: instance.PrivateIpAddress,
      publicIpAddress: instance.PublicIpAddress,
      securityGroups: instance.SecurityGroups ?? [],
      state: (instance.State as { Name?: string } | undefined)?.Name,
    },
    tags: extractTags(instance.Tags),
    relationships: [],
    sensitiveRedacted: true,
    metadata: {
      capturedAt,
      sourceLocation: 'examples/aws-mock-inventory.json',
      sourceChecksum: checksum,
    },
  }));

  const loadBalancers = (parsed.load_balancers ?? []).map((lb) => ({
    id: `aws-alb-${String(lb.LoadBalancerName)}`,
    logicalName: extractTags(lb.Tags).Name ?? String(lb.LoadBalancerName),
    type: ResourceType.ALB,
    provider: Provider.AWS,
    region,
    source: ResourceSource.AWS,
    attributes: {
      dnsName: lb.DNSName,
      scheme: lb.Scheme,
      type: lb.Type,
      vpcId: lb.VpcId,
      securityGroups: lb.SecurityGroups ?? [],
      availabilityZones: lb.AvailabilityZones ?? [],
      attributes:
        parsed.load_balancer_attributes?.[String(lb.LoadBalancerArn)] ?? [],
    },
    tags: extractTags(lb.Tags),
    relationships: [],
    sensitiveRedacted: true,
    metadata: {
      capturedAt,
      sourceLocation: 'examples/aws-mock-inventory.json',
      sourceChecksum: checksum,
    },
  }));

  return [...vpcs, ...subnets, ...securityGroups, ...instances, ...loadBalancers];
}

function examplesPath(file: string): string {
  const candidates = [
    join(process.cwd(), '..', 'examples', file),
    join(process.cwd(), 'examples', file),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function readTerraformVersion(): string | undefined {
  try {
    const content = readFileSync(examplesPath('terraform-state.json'), 'utf-8');
    const parsed = JSON.parse(content) as TerraformStateInput;
    return parsed.terraform_version;
  } catch {
    return undefined;
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = key(item);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function indexByLogicalName(
  list: NormalizedResource[]
): Map<string, NormalizedResource> {
  const map = new Map<string, NormalizedResource>();
  for (const resource of list) {
    map.set(resource.logicalName, resource);
  }
  return map;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function getCidr(resource: NormalizedResource): string {
  const attrs = resource.attributes;
  return (attrs.cidr_block as string) ?? (attrs.cidrBlock as string) ?? 'n/a';
}

function getInstanceType(resource: NormalizedResource | undefined): string | undefined {
  if (!resource) {
    return undefined;
  }
  const attrs = resource.attributes;
  return (attrs.instance_type as string) ?? (attrs.instanceType as string);
}

function getIdleTimeout(resource: NormalizedResource | undefined): number | undefined {
  if (!resource) {
    return undefined;
  }
  const attrs = resource.attributes;
  const direct = toNumber(attrs.idle_timeout ?? attrs.idleTimeout);
  if (direct !== undefined) {
    return direct;
  }
  const lbAttributes = attrs.attributes as
    | Array<{ Key?: string; Value?: string }>
    | undefined;
  if (Array.isArray(lbAttributes)) {
    const match = lbAttributes.find(
      (entry) => entry.Key === 'idle_timeout.timeout_seconds'
    );
    if (match) {
      return toNumber(match.Value);
    }
  }
  return undefined;
}

function getIngressPorts(resource: NormalizedResource | undefined): number[] {
  if (!resource) {
    return [];
  }
  const attrs = resource.attributes;
  const rules = (attrs.ingress ?? attrs.ingress_rules ?? attrs.ingressRules) as
    | Array<Record<string, unknown>>
    | undefined;
  const ports = new Set<number>();
  if (Array.isArray(rules)) {
    for (const rule of rules) {
      const port = toNumber(rule.from_port ?? rule.FromPort);
      if (port !== undefined) {
        ports.add(port);
      }
    }
  }
  return Array.from(ports).sort((a, b) => a - b);
}

const TYPE_LABELS: Record<string, string> = {
  [ResourceType.VPC]: 'VPC',
  [ResourceType.SUBNET]: 'Subnet',
  [ResourceType.SECURITY_GROUP]: 'Security group',
  [ResourceType.EC2_INSTANCE]: 'EC2 instance',
  [ResourceType.ALB]: 'Load balancer',
  [ResourceType.PROVIDER]: 'Provider',
};

function labelType(type: ResourceType | string): string {
  return TYPE_LABELS[type as string] ?? String(type);
}

function buildReasoning(
  summary: string,
  likelyCause: string,
  impact: string,
  terraformRemediation: string,
  severity: Severity
): ReasoningResult {
  return {
    summary,
    severity,
    likelyCause,
    recommendedAction:
      'Reconcile Terraform with the approved design, then re-run the scan.',
    terraformRemediation,
    businessImpact: impact,
    impact,
    generatedBy: 'deterministic',
    reasonedAt: nowIso(),
  };
}

/**
 * Deterministic drift detection across the three normalized sources.
 * Pure code (no LLM): compares architecture intent, Terraform state, and AWS
 * inventory and produces findings for each supported drift type.
 */
export function detectDrift(
  intentResources: NormalizedResource[],
  terraformResources: NormalizedResource[],
  awsResources: NormalizedResource[],
  terraformVersionValue: string | undefined,
  region: string
): DriftFinding[] {
  const detectedAt = nowIso();
  const intentByName = indexByLogicalName(intentResources);
  const terraformByName = indexByLogicalName(terraformResources);
  const awsByName = indexByLogicalName(awsResources);

  const findingsList: DriftFinding[] = [];
  let counter = 0;
  const nextId = (): string => `drift-${String(++counter).padStart(3, '0')}`;

  // 1. MISSING — present in architecture and Terraform but absent from AWS
  for (const tfResource of terraformResources) {
    if (
      awsByName.has(tfResource.logicalName) ||
      !intentByName.has(tfResource.logicalName)
    ) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.MISSING,
      severity: Severity.HIGH,
      status: DriftStatus.OPEN,
      resourceType: tfResource.type,
      provider: tfResource.provider,
      region: tfResource.region,
      logicalName: tfResource.logicalName,
      expected: { logicalName: tfResource.logicalName, type: tfResource.type },
      observed: null,
      diffSummary: `${labelType(tfResource.type)} '${tfResource.logicalName}' (${getCidr(tfResource)}) defined in architecture and Terraform but not found in AWS`,
      attributeDiffs: [],
      detectedAt,
      reasoning: buildReasoning(
        `${labelType(tfResource.type)} missing from AWS deployment`,
        'Resource was defined in Terraform but never applied, or was manually deleted from AWS.',
        'Intended architecture is incomplete; dependent resources cannot be deployed.',
        'Run `terraform plan` then `terraform apply` to create the missing resource.',
        Severity.HIGH
      ),
    });
  }

  // 2. UNMANAGED — present in AWS but not managed by Terraform
  for (const awsResource of awsResources) {
    if (terraformByName.has(awsResource.logicalName)) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.UNMANAGED,
      severity: Severity.MEDIUM,
      status: DriftStatus.OPEN,
      resourceType: awsResource.type,
      provider: awsResource.provider,
      region: awsResource.region,
      logicalName: awsResource.logicalName,
      expected: null,
      observed: { logicalName: awsResource.logicalName, type: awsResource.type },
      diffSummary: `${labelType(awsResource.type)} '${awsResource.logicalName}' exists in AWS but is not managed by Terraform`,
      attributeDiffs: [],
      detectedAt,
      reasoning: buildReasoning(
        `Unmanaged ${labelType(awsResource.type).toLowerCase()} found in AWS`,
        'Resource was created manually in AWS and never added to Terraform.',
        'Resource is not version controlled and can be changed or deleted without tracking.',
        'Import the resource with `terraform import`, or remove it if it is no longer required.',
        Severity.MEDIUM
      ),
    });
  }

  // 3. CHANGED_OUTSIDE_TERRAFORM — security group rules added outside Terraform
  for (const awsResource of awsResources) {
    if (awsResource.type !== ResourceType.SECURITY_GROUP) {
      continue;
    }
    const tfResource = terraformByName.get(awsResource.logicalName);
    if (!tfResource) {
      continue;
    }
    const terraformPorts = getIngressPorts(tfResource);
    const awsPorts = getIngressPorts(awsResource);
    const extraPorts = awsPorts.filter((port) => !terraformPorts.includes(port));
    if (extraPorts.length === 0) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.CHANGED_OUTSIDE_TERRAFORM,
      severity: Severity.HIGH,
      status: DriftStatus.OPEN,
      resourceType: awsResource.type,
      provider: awsResource.provider,
      region: awsResource.region,
      logicalName: awsResource.logicalName,
      expected: { attributes: { ports: terraformPorts } },
      observed: { attributes: { ports: awsPorts } },
      diffSummary: `Security group '${awsResource.logicalName}' has port ${extraPorts.join(', ')} open in AWS that is not defined in Terraform`,
      attributeDiffs: extraPorts.map((port) => ({
        path: 'ingress.ports',
        expectedValue: null,
        observedValue: port,
        diffType: 'added' as const,
      })),
      detectedAt,
      reasoning: buildReasoning(
        'Security group rule added outside Terraform',
        'A port was opened manually in AWS and not reflected in Terraform.',
        extraPorts.includes(22)
          ? 'SSH exposed outside Terraform control — potential security risk.'
          : 'Network exposure changed outside Terraform control.',
        'Run `terraform apply` to remove the rule, or add it to Terraform with a restricted CIDR.',
        Severity.HIGH
      ),
    });
  }

  // 4. ATTRIBUTE_MISMATCH — instance type differs across sources
  for (const tfResource of terraformResources) {
    if (tfResource.type !== ResourceType.EC2_INSTANCE) {
      continue;
    }
    const awsResource = awsByName.get(tfResource.logicalName);
    const intentResource = intentByName.get(tfResource.logicalName);
    const intentType = getInstanceType(intentResource);
    const terraformType = getInstanceType(tfResource);
    const awsType = getInstanceType(awsResource);
    if (!awsType) {
      continue;
    }
    const mismatch =
      awsType !== terraformType ||
      (intentType !== undefined && intentType !== terraformType);
    if (!mismatch) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.ATTRIBUTE_MISMATCH_LEGACY,
      severity: Severity.MEDIUM,
      status: DriftStatus.OPEN,
      resourceType: tfResource.type,
      provider: tfResource.provider,
      region: tfResource.region,
      logicalName: tfResource.logicalName,
      expected: { attributes: { instanceType: intentType ?? terraformType } },
      observed: { attributes: { instanceType: awsType } },
      diffSummary: `Instance type mismatch: intent=${intentType ?? 'n/a'}, terraform=${terraformType ?? 'n/a'}, aws=${awsType}`,
      attributeDiffs: [
        {
          path: 'instanceType',
          expectedValue: intentType ?? terraformType,
          observedValue: awsType,
          diffType: 'modified' as const,
        },
      ],
      detectedAt,
      reasoning: buildReasoning(
        'EC2 instance type differs across sources',
        'The instance was resized in AWS while Terraform and the design specify different types.',
        'Cost and capacity differ from the approved design.',
        'Set the intended `instance_type` in Terraform and apply (note: resizing may replace the instance).',
        Severity.MEDIUM
      ),
    });
  }

  // 5. TAG_MISMATCH — tags defined in architecture but missing in AWS
  for (const intentResource of intentResources) {
    const awsResource = awsByName.get(intentResource.logicalName);
    if (!awsResource) {
      continue;
    }
    const missingTags = Object.keys(intentResource.tags).filter(
      (tagKey) => !(tagKey in awsResource.tags)
    );
    if (missingTags.length === 0) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.TAG_MISMATCH_LEGACY,
      severity: Severity.LOW,
      status: DriftStatus.OPEN,
      resourceType: intentResource.type,
      provider: intentResource.provider,
      region: intentResource.region,
      logicalName: intentResource.logicalName,
      expected: { tags: intentResource.tags },
      observed: { tags: awsResource.tags },
      diffSummary: `${labelType(intentResource.type)} '${intentResource.logicalName}' missing '${missingTags.join(', ')}' tag in AWS (present in intent and Terraform)`,
      attributeDiffs: missingTags.map((tagKey) => ({
        path: `tags.${tagKey}`,
        expectedValue: intentResource.tags[tagKey],
        observedValue: null,
        diffType: 'removed' as const,
      })),
      detectedAt,
      reasoning: buildReasoning(
        'Tag missing from deployed resource',
        'The tag was removed manually in AWS or never applied.',
        'Affects cost allocation, ownership, and resource organization.',
        'Run `terraform apply` to restore the tag (no resource recreation required).',
        Severity.LOW
      ),
    });
  }

  // 6. CONFIGURATION_DRIFT — load balancer attribute drift
  for (const tfResource of terraformResources) {
    if (tfResource.type !== ResourceType.ALB) {
      continue;
    }
    const awsResource = awsByName.get(tfResource.logicalName);
    if (!awsResource) {
      continue;
    }
    const terraformTimeout = getIdleTimeout(tfResource);
    const awsTimeout = getIdleTimeout(awsResource);
    if (
      terraformTimeout === undefined ||
      awsTimeout === undefined ||
      terraformTimeout === awsTimeout
    ) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.CONFIGURATION_DRIFT,
      severity: Severity.MEDIUM,
      status: DriftStatus.OPEN,
      resourceType: tfResource.type,
      provider: tfResource.provider,
      region: tfResource.region,
      logicalName: tfResource.logicalName,
      expected: { attributes: { idleTimeout: terraformTimeout } },
      observed: { attributes: { idleTimeout: awsTimeout } },
      diffSummary: `Load balancer idle timeout changed from ${terraformTimeout}s to ${awsTimeout}s`,
      attributeDiffs: [
        {
          path: 'idleTimeout',
          expectedValue: terraformTimeout,
          observedValue: awsTimeout,
          diffType: 'modified' as const,
        },
      ],
      detectedAt,
      reasoning: buildReasoning(
        'Load balancer configuration drifted',
        'The idle timeout was changed in AWS outside Terraform.',
        'May affect connection handling and resource utilization.',
        'Update the `idle_timeout` in Terraform to the intended value and apply.',
        Severity.MEDIUM
      ),
    });
  }

  // 7. RELATIONSHIP_BROKEN — required route table association absent in AWS
  for (const intentResource of intentResources) {
    const routeRelationships = intentResource.relationships.filter(
      (relationship) =>
        String(relationship.type) === 'route_table' ||
        relationship.type === RelationshipType.ROUTES_TO
    );
    if (routeRelationships.length === 0) {
      continue;
    }
    const awsResource = awsByName.get(intentResource.logicalName);
    if (!awsResource) {
      continue;
    }
    const hasRoute = awsResource.relationships.some(
      (relationship) =>
        String(relationship.type) === 'route_table' ||
        relationship.type === RelationshipType.ROUTES_TO
    );
    if (hasRoute) {
      continue;
    }
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.RELATIONSHIP_BROKEN,
      severity: Severity.HIGH,
      status: DriftStatus.OPEN,
      resourceType: intentResource.type,
      provider: intentResource.provider,
      region: intentResource.region,
      logicalName: intentResource.logicalName,
      expected: { relationships: intentResource.relationships },
      observed: { relationships: awsResource.relationships },
      diffSummary: `${labelType(intentResource.type)} '${intentResource.logicalName}' not associated with private route table as specified in architecture`,
      attributeDiffs: [],
      detectedAt,
      reasoning: buildReasoning(
        'Resource routing relationship broken',
        'The route table association was removed or never created.',
        'Resource may not have the intended routing or connectivity.',
        'Create the missing `aws_route_table_association` and apply.',
        Severity.HIGH
      ),
    });
  }

  // 8. VERSION_MISMATCH — informational provider version tracking
  if (terraformVersionValue) {
    findingsList.push({
      driftId: nextId(),
      driftType: DriftType.VERSION_MISMATCH,
      severity: Severity.INFO,
      status: DriftStatus.OPEN,
      resourceType: ResourceType.PROVIDER,
      provider: Provider.AWS,
      region,
      logicalName: 'hashicorp/aws',
      expected: null,
      observed: { attributes: { terraformVersion: terraformVersionValue } },
      diffSummary: `Terraform AWS provider version in state (${terraformVersionValue}) may differ from the current version`,
      attributeDiffs: [],
      detectedAt,
      reasoning: buildReasoning(
        'Provider version tracking',
        'Informational — records the provider version used in the last apply.',
        'Minimal impact, but important for reproducibility.',
        'Pin the AWS provider version in the `required_providers` block.',
        Severity.INFO
      ),
    });
  }

  return findingsList;
}

let cachedArtifacts: AnalysisArtifacts | null = null;

interface RunAnalysisOptions {
  /** Pre-fetched AWS inventory (e.g. from the live AWS agent). */
  awsResources?: NormalizedResource[];
  /** Where the AWS inventory came from. Defaults to the static mock file. */
  awsSource?: InventorySource;
  /** Region the AWS inventory was scanned in. */
  awsRegion?: string;
}

export function runFullAnalysis(options: RunAnalysisOptions = {}): AnalysisArtifacts {
  const startedAt = nowIso();
  const intentResources = parseArchitectureIntent();
  const terraformResources = parseTerraformState();
  const awsResources = options.awsResources ?? parseAwsInventory();
  const awsSource = options.awsSource ?? 'mock';
  const terraformVersionValue = readTerraformVersion();
  const region = options.awsRegion ?? intentResources[0]?.region ?? 'us-east-1';

  const findingsList = detectDrift(
    intentResources,
    terraformResources,
    awsResources,
    terraformVersionValue,
    region
  );

  const completedAt = nowIso();
  const complianceScore = calculateComplianceScore(findingsList);

  const statistics: ScanStatistics = {
    totalFindings: findingsList.length,
    totalResources:
      intentResources.length + terraformResources.length + awsResources.length,
    bySeverity: countBy(findingsList, (finding) => finding.severity),
    byType: countBy(findingsList, (finding) => String(finding.driftType)),
    byStatus: countBy(findingsList, (finding) => finding.status),
  };

  const scan: ScanResult = {
    scanId: 'scan-generated-latest',
    projectId: 'demo-project',
    startedAt,
    completedAt,
    durationMs: Math.max(
      1,
      new Date(completedAt).getTime() - new Date(startedAt).getTime()
    ),
    complianceScore,
    status: 'completed',
    findings: findingsList,
    statistics,
    sources: {
      intent: {
        type: 'yaml',
        path: 'examples/architecture.yaml',
        resourceCount: intentResources.length,
      },
      terraform: {
        type: 'state',
        path: 'examples/terraform-state.json',
        resourceCount: terraformResources.length,
        version: terraformVersionValue,
      },
      aws: {
        type: awsSource,
        path:
          awsSource === 'aws'
            ? `aws://${region}`
            : 'examples/aws-mock-inventory.json',
        resourceCount: awsResources.length,
        region,
      },
    },
    config: {
      enableLLMReasoning: false,
      regions: [region],
      detectUnmanaged: true,
    },
  };

  cachedArtifacts = {
    intentResources,
    terraformResources,
    awsResources,
    findings: findingsList,
    scan,
  };

  return cachedArtifacts;
}

/**
 * Live analysis orchestration: pulls real AWS inventory via the AWS agent
 * (single region, with automatic mock fallback), runs drift detection, and
 * caches the resulting artifacts.
 */
export async function runLiveAnalysis(): Promise<AnalysisArtifacts> {
  const inventory = await fetchAwsInventory();
  return runFullAnalysis({
    awsResources: inventory.resources,
    awsSource: inventory.source,
    awsRegion: inventory.region,
  });
}

export function getLatestArtifacts(): AnalysisArtifacts {
  if (!cachedArtifacts) {
    return runFullAnalysis();
  }
  return cachedArtifacts;
}

export function persistAnalysis(artifacts: AnalysisArtifacts): void {
  const now = nowIso();
  const scan = artifacts.scan;

  db.delete(scans).where(eq(scans.scanId, scan.scanId)).run();
  db.insert(scans)
    .values({
      scanId: scan.scanId,
      projectId: scan.projectId,
      status: scan.status ?? 'completed',
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      durationMs: scan.durationMs,
      complianceScore: Math.round(scan.complianceScore),
      statisticsJson: JSON.stringify(scan.statistics),
      sourcesJson: JSON.stringify(scan.sources),
      configJson: JSON.stringify(scan.config),
      createdAt: now,
    })
    .run();

  db.delete(findingsTable).where(eq(findingsTable.scanId, scan.scanId)).run();
  if (artifacts.findings.length > 0) {
    db.insert(findingsTable)
      .values(
        artifacts.findings.map((finding) => ({
          driftId: `${scan.scanId}:${finding.driftId}`,
          scanId: scan.scanId,
          driftType: String(finding.driftType),
          severity: finding.severity,
          status: finding.status,
          resourceType: String(finding.resourceType),
          provider: String(finding.provider),
          region: finding.region,
          logicalName: finding.logicalName,
          diffSummary: finding.diffSummary,
          expectedJson: finding.expected ? JSON.stringify(finding.expected) : null,
          observedJson: finding.observed ? JSON.stringify(finding.observed) : null,
          attributeDiffsJson: finding.attributeDiffs
            ? JSON.stringify(finding.attributeDiffs)
            : null,
          reasoningJson: finding.reasoning ? JSON.stringify(finding.reasoning) : null,
          detectedAt: finding.detectedAt,
          createdAt: now,
        }))
      )
      .run();
  }

  const allResources = [
    ...artifacts.intentResources,
    ...artifacts.terraformResources,
    ...artifacts.awsResources,
  ];
  db.delete(resourcesTable).where(eq(resourcesTable.scanId, scan.scanId)).run();
  if (allResources.length > 0) {
    db.insert(resourcesTable)
      .values(
        allResources.map((resource) => ({
          resourceId: `${scan.scanId}:${resource.id}`,
          scanId: scan.scanId,
          logicalName: resource.logicalName,
          type: String(resource.type),
          provider: String(resource.provider),
          region: resource.region,
          source: String(resource.source),
          attributesJson: JSON.stringify(resource.attributes),
          tagsJson: JSON.stringify(resource.tags),
          relationshipsJson: JSON.stringify(resource.relationships),
          sensitiveRedacted: resource.sensitiveRedacted,
          metadataJson: JSON.stringify(resource.metadata),
          createdAt: now,
        }))
      )
      .run();
  }
}