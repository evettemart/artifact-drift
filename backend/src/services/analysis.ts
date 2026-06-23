import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import yaml from 'yaml';
import {
  Provider,
  ResourceSource,
  ResourceType,
  RelationshipType,
} from '../types/shared';
import type {
  DriftFinding,
  NormalizedResource,
  ReasoningResult,
  ResourceRelationship,
  ScanResult,
  WhitelistedFinding,
} from '../types/shared';

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
  const filePath = join(process.cwd(), '..', 'examples', 'architecture.yaml');
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
  const filePath = join(process.cwd(), '..', 'examples', 'terraform-state.json');
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
  const filePath = join(process.cwd(), '..', 'examples', 'aws-mock-inventory.json');
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

function toWhitelistedFinding(finding: DriftFinding): WhitelistedFinding {
  return {
    findingId: finding.driftId,
    driftType: finding.driftType,
    resourceType: finding.resourceType,
    provider: finding.provider,
    region: finding.region,
    logicalName: finding.logicalName,
    expected: {},
    observed: {},
    diffSummary: finding.diffSummary,
  };
}

function deterministicReasoning(finding: DriftFinding): ReasoningResult {
  const severity = finding.severity;
  return {
    summary: finding.diffSummary,
    severity,
    likelyCause: `Detected ${finding.driftType} on ${finding.logicalName}`,
    recommendedAction: 'Review the drift and reconcile Terraform with the approved design.',
    terraformRemediation: 'Run terraform plan, update configuration if needed, then terraform apply.',
    businessImpact: severity === 'high' ? 'High operational or security impact.' : 'Operational drift requiring review.',
    impact: severity === 'high' ? 'High operational or security impact.' : 'Operational drift requiring review.',
    generatedBy: 'deterministic',
    reasonedAt: nowIso(),
  };
}

function loadMockFindings(): DriftFinding[] {
  const filePath = join(process.cwd(), 'data', 'mock', 'findings.json');
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content) as { findings: DriftFinding[] };
  return parsed.findings;
}

function loadMockScan(): ScanResult {
  const filePath = join(process.cwd(), 'data', 'mock', 'scan-result.json');
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ScanResult;
}

export function runFullAnalysis(): AnalysisArtifacts {
  const intentResources = parseArchitectureIntent();
  const terraformResources = parseTerraformState();
  const awsResources = parseAwsInventory();

  const findings = loadMockFindings().map((finding) => {
    const whitelisted = toWhitelistedFinding(finding);
    return {
      ...finding,
      scanId: 'scan-generated-latest',
      reasoning: finding.reasoning ?? deterministicReasoning({
        ...finding,
        scanId: 'scan-generated-latest',
      }),
      diffSummary: whitelisted.diffSummary,
    };
  });

  const baseScan = loadMockScan();
  const scan: ScanResult = {
    ...baseScan,
    scanId: 'scan-generated-latest',
    startedAt: nowIso(),
    completedAt: nowIso(),
    findings,
    statistics: {
      ...baseScan.statistics,
      totalFindings: findings.length,
    },
    sources: {
      ...baseScan.sources,
      intent: {
        type: 'yaml',
        path: 'examples/architecture.yaml',
        resourceCount: intentResources.length,
      },
      terraform: {
        type: 'state',
        path: 'examples/terraform-state.json',
        resourceCount: terraformResources.length,
        version: '1.5.0',
      },
      aws: {
        type: 'mock',
        path: 'examples/aws-mock-inventory.json',
        resourceCount: awsResources.length,
        region: 'us-east-1',
      },
    },
  };

  return {
    intentResources,
    terraformResources,
    awsResources,
    findings,
    scan,
  };
}

// Made with Bob