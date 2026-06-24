import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
} from '@aws-sdk/client-ec2';
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTagsCommand,
  DescribeLoadBalancerAttributesCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import {
  Provider,
  ResourceSource,
  ResourceType,
  RelationshipType,
} from '../../types/shared';
import type { NormalizedResource } from '../../types/shared';
import { config } from '../../config';

/**
 * Predefined resource types the live AWS inventory agent scans for. Kept
 * deliberately small and aligned with the drift detection engine. Multi-region
 * and additional resource types are future work.
 */
export const PREDEFINED_RESOURCE_TYPES: readonly ResourceType[] = [
  ResourceType.VPC,
  ResourceType.SUBNET,
  ResourceType.SECURITY_GROUP,
  ResourceType.EC2_INSTANCE,
  ResourceType.ALB,
] as const;

export type InventorySource = 'aws' | 'mock';

export interface AwsInventoryResult {
  resources: NormalizedResource[];
  source: InventorySource;
  region: string;
}

export interface FetchAwsInventoryOptions {
  /** Region to scan. Defaults to the configured single region. */
  region?: string;
  /** Force the mock-inventory fallback (skip all AWS SDK calls). */
  forceMock?: boolean;
}

/**
 * Raw inventory in AWS-cased shape (mirrors examples/aws-mock-inventory.json and
 * the AWS SDK Describe* responses). A single normalizer handles both the live
 * SDK path and the mock fallback.
 */
interface RawAwsInventory {
  metadata?: { region?: string; timestamp?: string };
  vpcs: Array<Record<string, unknown>>;
  subnets: Array<Record<string, unknown>>;
  security_groups: Array<Record<string, unknown>>;
  instances: Array<Record<string, unknown>>;
  load_balancers: Array<Record<string, unknown>>;
  load_balancer_attributes: Record<string, Array<{ Key: string; Value: string }>>;
}

function nowIso(): string {
  return new Date().toISOString();
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

/**
 * Heuristic detection of usable AWS credentials in the environment. Avoids
 * attempting SDK calls (and slow IMDS timeouts) when nothing is configured so we
 * can fall back to the mock inventory immediately.
 */
function hasAwsCredentials(): boolean {
  const env = process.env;
  return Boolean(
    (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) ||
      env.AWS_PROFILE ||
      env.AWS_WEB_IDENTITY_TOKEN_FILE ||
      env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
      env.AWS_CONTAINER_CREDENTIALS_FULL_URI
  );
}

function normalizeInventory(raw: RawAwsInventory, region: string): NormalizedResource[] {
  const capturedAt = raw.metadata?.timestamp ?? nowIso();
  const sourceLocation = 'aws-inventory';

  const vpcs = raw.vpcs.map((vpc) => ({
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
    metadata: { capturedAt, sourceLocation },
  }));

  const subnets = raw.subnets.map((subnet) => ({
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
    metadata: { capturedAt, sourceLocation },
  }));

  const securityGroups = raw.security_groups.map((sg) => ({
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
    metadata: { capturedAt, sourceLocation },
  }));

  const instances = raw.instances.map((instance) => ({
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
    metadata: { capturedAt, sourceLocation },
  }));

  const loadBalancers = raw.load_balancers.map((lb) => ({
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
      attributes: raw.load_balancer_attributes[String(lb.LoadBalancerArn)] ?? [],
    },
    tags: extractTags(lb.Tags),
    relationships: [],
    sensitiveRedacted: true,
    metadata: { capturedAt, sourceLocation },
  }));

  return [...vpcs, ...subnets, ...securityGroups, ...instances, ...loadBalancers];
}

function loadMockInventory(): RawAwsInventory {
  const content = readFileSync(examplesPath('aws-mock-inventory.json'), 'utf-8');
  const parsed = JSON.parse(content) as Partial<RawAwsInventory>;
  return {
    metadata: parsed.metadata,
    vpcs: parsed.vpcs ?? [],
    subnets: parsed.subnets ?? [],
    security_groups: parsed.security_groups ?? [],
    instances: parsed.instances ?? [],
    load_balancers: parsed.load_balancers ?? [],
    load_balancer_attributes: parsed.load_balancer_attributes ?? {},
  };
}

async function fetchFromAws(region: string): Promise<RawAwsInventory> {
  const ec2 = new EC2Client({ region });
  const elb = new ElasticLoadBalancingV2Client({ region });

  const [vpcsRes, subnetsRes, sgRes, reservationsRes, lbRes] = await Promise.all([
    ec2.send(new DescribeVpcsCommand({})),
    ec2.send(new DescribeSubnetsCommand({})),
    ec2.send(new DescribeSecurityGroupsCommand({})),
    ec2.send(new DescribeInstancesCommand({})),
    elb.send(new DescribeLoadBalancersCommand({})),
  ]);

  const instances = (reservationsRes.Reservations ?? []).flatMap(
    (reservation) => reservation.Instances ?? []
  );

  const loadBalancers = lbRes.LoadBalancers ?? [];
  const loadBalancerAttributes: RawAwsInventory['load_balancer_attributes'] = {};

  // Tags and attributes require per-load-balancer follow-up calls.
  await Promise.all(
    loadBalancers.map(async (lb) => {
      const arn = lb.LoadBalancerArn;
      if (!arn) {
        return;
      }
      const [tagsRes, attrRes] = await Promise.all([
        elb.send(new DescribeTagsCommand({ ResourceArns: [arn] })),
        elb.send(new DescribeLoadBalancerAttributesCommand({ LoadBalancerArn: arn })),
      ]);
      const tagDescription = tagsRes.TagDescriptions?.find((td) => td.ResourceArn === arn);
      (lb as Record<string, unknown>).Tags = tagDescription?.Tags ?? [];
      loadBalancerAttributes[arn] = (attrRes.Attributes ?? [])
        .filter((attr): attr is { Key: string; Value: string } =>
          Boolean(attr.Key && attr.Value)
        )
        .map((attr) => ({ Key: attr.Key, Value: attr.Value }));
    })
  );

  return {
    metadata: { region, timestamp: nowIso() },
    vpcs: (vpcsRes.Vpcs ?? []) as Array<Record<string, unknown>>,
    subnets: (subnetsRes.Subnets ?? []) as Array<Record<string, unknown>>,
    security_groups: (sgRes.SecurityGroups ?? []) as Array<Record<string, unknown>>,
    instances: instances as Array<Record<string, unknown>>,
    load_balancers: loadBalancers as Array<Record<string, unknown>>,
    load_balancer_attributes: loadBalancerAttributes,
  };
}

/**
 * Fetches AWS inventory for the predefined resource types in a single region.
 *
 * Uses the AWS read-only SDK when credentials are available, and automatically
 * falls back to the mock inventory (examples/aws-mock-inventory.json) when no
 * credentials are detected or an SDK call fails.
 */
export async function fetchAwsInventory(
  options: FetchAwsInventoryOptions = {}
): Promise<AwsInventoryResult> {
  const region = options.region ?? config.aws.region;

  if (options.forceMock || !hasAwsCredentials()) {
    if (!options.forceMock) {
      console.warn(
        '[aws-inventory] No AWS credentials detected; using mock inventory fallback.'
      );
    }
    const raw = loadMockInventory();
    return {
      resources: normalizeInventory(raw, raw.metadata?.region ?? region),
      source: 'mock',
      region: raw.metadata?.region ?? region,
    };
  }

  try {
    const raw = await fetchFromAws(region);
    return { resources: normalizeInventory(raw, region), source: 'aws', region };
  } catch (error) {
    console.error(
      '[aws-inventory] AWS inventory scan failed; falling back to mock inventory:',
      error instanceof Error ? error.message : error
    );
    const raw = loadMockInventory();
    return {
      resources: normalizeInventory(raw, raw.metadata?.region ?? region),
      source: 'mock',
      region: raw.metadata?.region ?? region,
    };
  }
}
