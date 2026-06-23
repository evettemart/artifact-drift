# AWS Inventory Agent

## Overview

The **AWSInventoryAgent** is responsible for fetching live AWS infrastructure resources via read-only AWS SDK APIs or loading from a mock inventory file. It automatically falls back to mock data when AWS credentials are not available, ensuring the demo never fails.

### Responsibilities

1. Fetch AWS resources using read-only SDK APIs (EC2, VPC, ELBv2, IAM)
2. Auto-detect AWS credentials and fall back to mock inventory gracefully
3. Normalize AWS resources into the internal `NormalizedResource` schema
4. Handle pagination, rate limiting, and multi-region queries
5. Redact sensitive AWS metadata (account IDs, ARNs with sensitive info)

### Key Principles

- **Read-Only**: Only describe/list APIs, never modify AWS resources
- **Graceful Degradation**: Auto-fallback to mock when no credentials
- **Security**: Redact account IDs and sensitive ARN components
- **Deterministic**: No LLM calls, pure API interaction and transformation
- **Multi-Region**: Support scanning multiple regions in parallel

---

## Input Contract

### AWS Credentials

The agent uses standard AWS credential chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. AWS credentials file (`~/.aws/credentials`)
3. IAM role (if running on EC2/ECS/Lambda)
4. **Fallback**: Mock inventory file if no credentials found

### Mock Inventory File

```json
{
  "version": "1.0",
  "capturedAt": "2026-06-23T10:00:00Z",
  "regions": ["us-east-1", "us-west-2"],
  "resources": {
    "vpcs": [
      {
        "VpcId": "vpc-mock-12345",
        "CidrBlock": "10.0.0.0/16",
        "State": "available",
        "Tags": [
          { "Key": "Name", "Value": "prod-vpc" },
          { "Key": "Environment", "Value": "production" }
        ],
        "Region": "us-east-1"
      }
    ],
    "subnets": [
      {
        "SubnetId": "subnet-mock-67890",
        "VpcId": "vpc-mock-12345",
        "CidrBlock": "10.0.1.0/24",
        "AvailabilityZone": "us-east-1a",
        "MapPublicIpOnLaunch": true,
        "Tags": [
          { "Key": "Name", "Value": "prod-public-subnet-1a" }
        ],
        "Region": "us-east-1"
      }
    ],
    "securityGroups": [
      {
        "GroupId": "sg-mock-11111",
        "GroupName": "web-sg",
        "Description": "Security group for web servers",
        "VpcId": "vpc-mock-12345",
        "IpPermissions": [
          {
            "IpProtocol": "tcp",
            "FromPort": 443,
            "ToPort": 443,
            "IpRanges": [{ "CidrIp": "0.0.0.0/0" }]
          }
        ],
        "IpPermissionsEgress": [
          {
            "IpProtocol": "-1",
            "IpRanges": [{ "CidrIp": "0.0.0.0/0" }]
          }
        ],
        "Tags": [
          { "Key": "Name", "Value": "web-sg" }
        ],
        "Region": "us-east-1"
      }
    ],
    "instances": [
      {
        "InstanceId": "i-mock-22222",
        "InstanceType": "t3.medium",
        "State": { "Name": "running" },
        "SubnetId": "subnet-mock-67890",
        "VpcId": "vpc-mock-12345",
        "SecurityGroups": [
          { "GroupId": "sg-mock-11111", "GroupName": "web-sg" }
        ],
        "Tags": [
          { "Key": "Name", "Value": "web-server-1" },
          { "Key": "Role", "Value": "web-server" }
        ],
        "Region": "us-east-1"
      }
    ],
    "loadBalancers": [
      {
        "LoadBalancerArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/prod-alb/1234567890abcdef",
        "LoadBalancerName": "prod-alb",
        "Scheme": "internet-facing",
        "VpcId": "vpc-mock-12345",
        "Type": "application",
        "State": { "Code": "active" },
        "AvailabilityZones": [
          { "SubnetId": "subnet-mock-67890", "ZoneName": "us-east-1a" }
        ],
        "SecurityGroups": ["sg-mock-11111"],
        "Tags": [
          { "Key": "Name", "Value": "prod-alb" }
        ],
        "Region": "us-east-1"
      }
    ]
  }
}
```

---

## Output Contract

### Normalized Resources

```typescript
type AWSInventoryOutput = {
  resources: NormalizedResource[];
  metadata: AWSInventoryMetadata;
};

interface AWSInventoryMetadata {
  source: 'live' | 'mock';
  regions: string[];
  capturedAt: string;
  accountId?: string; // Redacted in output
  credentialsFound: boolean;
}
```

---

## TypeScript Interfaces

### Configuration

```typescript
interface AWSInventoryAgentConfig {
  /** AWS regions to scan */
  regions: string[];
  
  /** Path to mock inventory file */
  mockInventoryPath?: string;
  
  /** Force use of mock inventory (for testing) */
  forceMock?: boolean;
  
  /** AWS SDK configuration */
  awsConfig?: {
    maxRetries?: number;
    timeout?: number;
    region?: string;
  };
  
  /** Resource types to fetch (undefined = all) */
  resourceTypeFilter?: ResourceType[];
  
  /** Whether to redact account IDs from ARNs */
  redactAccountIds: boolean;
}
```

### AWS Resource Types

```typescript
interface AWSVpc {
  VpcId: string;
  CidrBlock: string;
  State: string;
  Tags?: AWSTag[];
  Region: string;
  IsDefault?: boolean;
  EnableDnsHostnames?: boolean;
  EnableDnsSupport?: boolean;
}

interface AWSSubnet {
  SubnetId: string;
  VpcId: string;
  CidrBlock: string;
  AvailabilityZone: string;
  State: string;
  MapPublicIpOnLaunch: boolean;
  Tags?: AWSTag[];
  Region: string;
}

interface AWSSecurityGroup {
  GroupId: string;
  GroupName: string;
  Description: string;
  VpcId: string;
  IpPermissions: AWSIpPermission[];
  IpPermissionsEgress: AWSIpPermission[];
  Tags?: AWSTag[];
  Region: string;
}

interface AWSIpPermission {
  IpProtocol: string;
  FromPort?: number;
  ToPort?: number;
  IpRanges?: Array<{ CidrIp: string; Description?: string }>;
  Ipv6Ranges?: Array<{ CidrIpv6: string; Description?: string }>;
  UserIdGroupPairs?: Array<{ GroupId: string; Description?: string }>;
}

interface AWSInstance {
  InstanceId: string;
  InstanceType: string;
  State: { Name: string; Code: number };
  SubnetId: string;
  VpcId: string;
  PrivateIpAddress?: string;
  PublicIpAddress?: string;
  SecurityGroups: Array<{ GroupId: string; GroupName: string }>;
  Tags?: AWSTag[];
  Region: string;
  ImageId?: string;
  LaunchTime?: string;
}

interface AWSLoadBalancer {
  LoadBalancerArn: string;
  LoadBalancerName: string;
  Scheme: 'internet-facing' | 'internal';
  VpcId: string;
  Type: 'application' | 'network' | 'gateway';
  State: { Code: string };
  AvailabilityZones: Array<{ SubnetId: string; ZoneName: string }>;
  SecurityGroups?: string[];
  Tags?: AWSTag[];
  Region: string;
}

interface AWSTag {
  Key: string;
  Value: string;
}

interface MockInventory {
  version: string;
  capturedAt: string;
  regions: string[];
  resources: {
    vpcs?: AWSVpc[];
    subnets?: AWSSubnet[];
    securityGroups?: AWSSecurityGroup[];
    instances?: AWSInstance[];
    loadBalancers?: AWSLoadBalancer[];
  };
}
```

---

## Class Definition

```typescript
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
  DescribeTagsCommand as DescribeELBTagsCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { NormalizedResource, ResourceSource, Provider, Result } from './shared-types';
import * as fs from 'fs/promises';

/**
 * AWSInventoryAgent
 * 
 * Fetches AWS infrastructure resources via SDK or mock file.
 * Auto-falls back to mock when credentials are unavailable.
 */
export class AWSInventoryAgent {
  private config: AWSInventoryAgentConfig;
  private credentialsAvailable: boolean = false;
  
  constructor(config: AWSInventoryAgentConfig) {
    this.config = {
      ...config,
      redactAccountIds: config.redactAccountIds ?? true,
    };
  }
  
  /**
   * Fetch AWS inventory and return normalized resources
   * 
   * @returns Normalized resources and metadata
   * @throws IntegrationError if both live and mock fetching fail
   */
  async fetchInventory(): Promise<Result<AWSInventoryOutput, Error>> {
    try {
      // Check if we should use mock
      if (this.config.forceMock) {
        return await this.loadMockInventory();
      }
      
      // Try to detect AWS credentials
      this.credentialsAvailable = await this.detectCredentials();
      
      if (this.credentialsAvailable) {
        // Attempt live fetch
        try {
          return await this.fetchLiveInventory();
        } catch (error) {
          console.warn('Live AWS fetch failed, falling back to mock:', error);
          return await this.loadMockInventory();
        }
      } else {
        // No credentials, use mock
        console.info('No AWS credentials detected, using mock inventory');
        return await this.loadMockInventory();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  
  /**
   * Detect if AWS credentials are available
   * 
   * @returns True if credentials are available
   */
  private async detectCredentials(): Promise<boolean> {
    try {
      // Try to create a client and make a simple call
      const ec2 = new EC2Client({
        region: this.config.regions[0],
        ...this.config.awsConfig,
      });
      
      // Attempt a lightweight call
      await ec2.send(new DescribeVpcsCommand({ MaxResults: 1 }));
      return true;
    } catch (error: any) {
      // Check if it's a credentials error
      if (
        error.name === 'CredentialsProviderError' ||
        error.message?.includes('credentials') ||
        error.message?.includes('Unable to locate credentials')
      ) {
        return false;
      }
      // Other errors might indicate credentials are present but other issues
      return true;
    }
  }
  
  /**
   * Fetch inventory from live AWS APIs
   * 
   * @returns Normalized resources from AWS
   */
  private async fetchLiveInventory(): Promise<Result<AWSInventoryOutput, Error>> {
    const allResources: NormalizedResource[] = [];
    const capturedAt = new Date().toISOString();
    
    // Fetch from each region in parallel
    const regionPromises = this.config.regions.map(async (region) => {
      const resources = await this.fetchRegionResources(region);
      return resources;
    });
    
    const regionResults = await Promise.all(regionPromises);
    regionResults.forEach((resources) => allResources.push(...resources));
    
    const metadata: AWSInventoryMetadata = {
      source: 'live',
      regions: this.config.regions,
      capturedAt,
      credentialsFound: true,
    };
    
    return {
      success: true,
      data: {
        resources: allResources,
        metadata,
      },
    };
  }
  
  /**
   * Fetch resources from a single AWS region
   * 
   * @param region - AWS region
   * @returns Normalized resources from the region
   */
  private async fetchRegionResources(region: string): Promise<NormalizedResource[]> {
    const resources: NormalizedResource[] = [];
    
    // Initialize AWS clients for this region
    const ec2 = new EC2Client({
      region,
      maxAttempts: this.config.awsConfig?.maxRetries || 3,
    });
    
    const elbv2 = new ElasticLoadBalancingV2Client({
      region,
      maxAttempts: this.config.awsConfig?.maxRetries || 3,
    });
    
    // Fetch VPCs
    if (this.shouldFetchResourceType(ResourceType.VPC)) {
      const vpcs = await this.fetchVPCs(ec2, region);
      resources.push(...vpcs);
    }
    
    // Fetch Subnets
    if (this.shouldFetchResourceType(ResourceType.SUBNET)) {
      const subnets = await this.fetchSubnets(ec2, region);
      resources.push(...subnets);
    }
    
    // Fetch Security Groups
    if (this.shouldFetchResourceType(ResourceType.SECURITY_GROUP)) {
      const securityGroups = await this.fetchSecurityGroups(ec2, region);
      resources.push(...securityGroups);
    }
    
    // Fetch EC2 Instances
    if (this.shouldFetchResourceType(ResourceType.EC2_INSTANCE)) {
      const instances = await this.fetchInstances(ec2, region);
      resources.push(...instances);
    }
    
    // Fetch Load Balancers
    if (this.shouldFetchResourceType(ResourceType.ALB)) {
      const loadBalancers = await this.fetchLoadBalancers(elbv2, region);
      resources.push(...loadBalancers);
    }
    
    return resources;
  }
  
  /**
   * Check if a resource type should be fetched
   */
  private shouldFetchResourceType(type: ResourceType): boolean {
    if (!this.config.resourceTypeFilter) return true;
    return this.config.resourceTypeFilter.includes(type);
  }
  
  /**
   * Fetch VPCs from AWS
   */
  private async fetchVPCs(
    ec2: EC2Client,
    region: string
  ): Promise<NormalizedResource[]> {
    try {
      const command = new DescribeVpcsCommand({});
      const response = await ec2.send(command);
      
      return (response.Vpcs || []).map((vpc) =>
        this.normalizeVPC(vpc, region)
      );
    } catch (error) {
      console.error(`Failed to fetch VPCs in ${region}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch Subnets from AWS
   */
  private async fetchSubnets(
    ec2: EC2Client,
    region: string
  ): Promise<NormalizedResource[]> {
    try {
      const command = new DescribeSubnetsCommand({});
      const response = await ec2.send(command);
      
      return (response.Subnets || []).map((subnet) =>
        this.normalizeSubnet(subnet, region)
      );
    } catch (error) {
      console.error(`Failed to fetch Subnets in ${region}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch Security Groups from AWS
   */
  private async fetchSecurityGroups(
    ec2: EC2Client,
    region: string
  ): Promise<NormalizedResource[]> {
    try {
      const command = new DescribeSecurityGroupsCommand({});
      const response = await ec2.send(command);
      
      return (response.SecurityGroups || []).map((sg) =>
        this.normalizeSecurityGroup(sg, region)
      );
    } catch (error) {
      console.error(`Failed to fetch Security Groups in ${region}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch EC2 Instances from AWS
   */
  private async fetchInstances(
    ec2: EC2Client,
    region: string
  ): Promise<NormalizedResource[]> {
    try {
      const command = new DescribeInstancesCommand({});
      const response = await ec2.send(command);
      
      const instances: NormalizedResource[] = [];
      
      (response.Reservations || []).forEach((reservation) => {
        (reservation.Instances || []).forEach((instance) => {
          instances.push(this.normalizeInstance(instance, region));
        });
      });
      
      return instances;
    } catch (error) {
      console.error(`Failed to fetch EC2 Instances in ${region}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch Load Balancers from AWS
   */
  private async fetchLoadBalancers(
    elbv2: ElasticLoadBalancingV2Client,
    region: string
  ): Promise<NormalizedResource[]> {
    try {
      const command = new DescribeLoadBalancersCommand({});
      const response = await elbv2.send(command);
      
      // Fetch tags for all load balancers
      const lbArns = (response.LoadBalancers || []).map((lb) => lb.LoadBalancerArn!);
      const tagsMap = await this.fetchLoadBalancerTags(elbv2, lbArns);
      
      return (response.LoadBalancers || []).map((lb) =>
        this.normalizeLoadBalancer(lb, region, tagsMap.get(lb.LoadBalancerArn!) || [])
      );
    } catch (error) {
      console.error(`Failed to fetch Load Balancers in ${region}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch tags for load balancers
   */
  private async fetchLoadBalancerTags(
    elbv2: ElasticLoadBalancingV2Client,
    arns: string[]
  ): Promise<Map<string, AWSTag[]>> {
    if (arns.length === 0) return new Map();
    
    try {
      const command = new DescribeELBTagsCommand({ ResourceArns: arns });
      const response = await elbv2.send(command);
      
      const tagsMap = new Map<string, AWSTag[]>();
      (response.TagDescriptions || []).forEach((tagDesc) => {
        if (tagDesc.ResourceArn && tagDesc.Tags) {
          tagsMap.set(
            tagDesc.ResourceArn,
            tagDesc.Tags.map((t) => ({ Key: t.Key!, Value: t.Value! }))
          );
        }
      });
      
      return tagsMap;
    } catch (error) {
      console.error('Failed to fetch load balancer tags:', error);
      return new Map();
    }
  }
  
  /**
   * Load inventory from mock file
   */
  private async loadMockInventory(): Promise<Result<AWSInventoryOutput, Error>> {
    try {
      const mockPath = this.config.mockInventoryPath || './aws-mock-inventory.json';
      const content = await fs.readFile(mockPath, 'utf-8');
      const mockData: MockInventory = JSON.parse(content);
      
      const resources: NormalizedResource[] = [];
      
      // Normalize mock VPCs
      mockData.resources.vpcs?.forEach((vpc) => {
        resources.push(this.normalizeVPC(vpc, vpc.Region));
      });
      
      // Normalize mock Subnets
      mockData.resources.subnets?.forEach((subnet) => {
        resources.push(this.normalizeSubnet(subnet, subnet.Region));
      });
      
      // Normalize mock Security Groups
      mockData.resources.securityGroups?.forEach((sg) => {
        resources.push(this.normalizeSecurityGroup(sg, sg.Region));
      });
      
      // Normalize mock Instances
      mockData.resources.instances?.forEach((instance) => {
        resources.push(this.normalizeInstance(instance, instance.Region));
      });
      
      // Normalize mock Load Balancers
      mockData.resources.loadBalancers?.forEach((lb) => {
        resources.push(this.normalizeLoadBalancer(lb, lb.Region, lb.Tags || []));
      });
      
      const metadata: AWSInventoryMetadata = {
        source: 'mock',
        regions: mockData.regions,
        capturedAt: mockData.capturedAt,
        credentialsFound: false,
      };
      
      return {
        success: true,
        data: {
          resources,
          metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new ParseError('Failed to load mock inventory', { error }),
      };
    }
  }
  
  /**
   * Normalize AWS VPC to internal schema
   */
  private normalizeVPC(vpc: any, region: string): NormalizedResource {
    const tags = this.extractTags(vpc.Tags);
    const logicalName = tags.Name || vpc.VpcId;
    
    return {
      id: this.generateId('vpc', vpc.VpcId),
      logicalName,
      type: ResourceType.VPC,
      provider: Provider.AWS,
      region,
      source: ResourceSource.AWS,
      attributes: {
        cidrBlock: vpc.CidrBlock,
        state: vpc.State,
        isDefault: vpc.IsDefault || false,
        enableDnsHostnames: vpc.EnableDnsHostnames,
        enableDnsSupport: vpc.EnableDnsSupport,
      },
      tags,
      relationships: [],
      sensitiveRedacted: this.config.redactAccountIds,
      metadata: {
        capturedAt: new Date().toISOString(),
        sourceLocation: 'aws-api',
        providerMetadata: {
          vpcId: vpc.VpcId,
          awsRegion: region,
        },
      },
    };
  }
  
  /**
   * Normalize AWS Subnet to internal schema
   */
  private normalizeSubnet(subnet: any, region: string): NormalizedResource {
    const tags = this.extractTags(subnet.Tags);
    const logicalName = tags.Name || subnet.SubnetId;
    
    return {
      id: this.generateId('subnet', subnet.SubnetId),
      logicalName,
      type: ResourceType.SUBNET,
      provider: Provider.AWS,
      region,
      source: ResourceSource.AWS,
      attributes: {
        cidrBlock: subnet.CidrBlock,
        availabilityZone: subnet.AvailabilityZone,
        state: subnet.State,
        public: subnet.MapPublicIpOnLaunch || false,
        vpcId: subnet.VpcId,
      },
      tags,
      relationships: [
        {
          type: RelationshipType.MEMBER_OF,
          targetLogicalName: subnet.VpcId,
          targetType: ResourceType.VPC,
        },
      ],
      sensitiveRedacted: this.config.redactAccountIds,
      metadata: {
        capturedAt: new Date().toISOString(),
        sourceLocation: 'aws-api',
        providerMetadata: {
          subnetId: subnet.SubnetId,
          vpcId: subnet.VpcId,
          awsRegion: region,
        },
      },
    };
  }
  
  /**
   * Normalize AWS Security Group to internal schema
   */
  private normalizeSecurityGroup(sg: any, region: string): NormalizedResource {
    const tags = this.extractTags(sg.Tags);
    const logicalName = tags.Name || sg.GroupName;
    
    return {
      id: this.generateId('sg', sg.GroupId),
      logicalName,
      type: ResourceType.SECURITY_GROUP,
      provider: Provider.AWS,
      region,
      source: ResourceSource.AWS,
      attributes: {
        groupName: sg.GroupName,
        description: sg.Description,
        vpcId: sg.VpcId,
        ingressRules: this.normalizeIpPermissions(sg.IpPermissions || []),
        egressRules: this.normalizeIpPermissions(sg.IpPermissionsEgress || []),
      },
      tags,
      relationships: [
        {
          type: RelationshipType.MEMBER_OF,
          targetLogicalName: sg.VpcId,
          targetType: ResourceType.VPC,
        },
      ],
      sensitiveRedacted: this.config.redactAccountIds,
      metadata: {
        capturedAt: new Date().toISOString(),
        sourceLocation: 'aws-api',
        providerMetadata: {
          groupId: sg.GroupId,
          vpcId: sg.VpcId,
          awsRegion: region,
        },
      },
    };
  }
  
  /**
   * Normalize AWS EC2 Instance to internal schema
   */
  private normalizeInstance(instance: any, region: string): NormalizedResource {
    const tags = this.extractTags(instance.Tags);
    const logicalName = tags.Name || instance.InstanceId;
    
    const relationships: ResourceRelationship[] = [
      {
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: instance.SubnetId,
        targetType: ResourceType.SUBNET,
      },
    ];
    
    // Add security group relationships
    (instance.SecurityGroups || []).forEach((sg: any) => {
      relationships.push({
        type: RelationshipType.ATTACHED_TO,
        targetLogicalName: sg.GroupId,
        targetType: ResourceType.SECURITY_GROUP,
      });
    });
    
    return {
      id: this.generateId('instance', instance.InstanceId),
      logicalName,
      type: ResourceType.EC2_INSTANCE,
      provider: Provider.AWS,
      region,
      source: ResourceSource.AWS,
      attributes: {
        instanceType: instance.InstanceType,
        state: instance.State?.Name,
        subnetId: instance.SubnetId,
        vpcId: instance.VpcId,
        imageId: instance.ImageId,
        launchTime: instance.LaunchTime,
      },
      tags,
      relationships,
      sensitiveRedacted: this.config.redactAccountIds,
      metadata: {
        capturedAt: new Date().toISOString(),
        sourceLocation: 'aws-api',
        providerMetadata: {
          instanceId: instance.InstanceId,
          vpcId: instance.VpcId,
          awsRegion: region,
        },
      },
    };
  }
  
  /**
   * Normalize AWS Load Balancer to internal schema
   */
  private normalizeLoadBalancer(
    lb: any,
    region: string,
    tags: AWSTag[]
  ): NormalizedResource {
    const tagsMap = this.extractTags(tags);
    const logicalName = tagsMap.Name || lb.LoadBalancerName;
    
    const relationships: ResourceRelationship[] = [];
    
    // Add subnet relationships
    (lb.AvailabilityZones || []).forEach((az: any) => {
      relationships.push({
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: az.SubnetId,
        targetType: ResourceType.SUBNET,
      });
    });
    
    // Add security group relationships
    (lb.SecurityGroups || []).forEach((sgId: string) => {
      relationships.push({
        type: RelationshipType.ATTACHED_TO,
        targetLogicalName: sgId,
        targetType: ResourceType.SECURITY_GROUP,
      });
    });
    
    return {
      id: this.generateId('alb', lb.LoadBalancerName),
      logicalName,
      type: ResourceType.ALB,
      provider: Provider.AWS,
      region,
      source: ResourceSource.AWS,
      attributes: {
        loadBalancerName: lb.LoadBalancerName,
        type: lb.Type,
        scheme: lb.Scheme,
        state: lb.State?.Code,
        vpcId: lb.VpcId,
      },
      tags: tagsMap,
      relationships,
      sensitiveRedacted: this.config.redactAccountIds,
      metadata: {
        capturedAt: new Date().toISOString(),
        sourceLocation: 'aws-api',
        providerMetadata: {
          loadBalancerArn: this.redactArn(lb.LoadBalancerArn),
          vpcId: lb.VpcId,
          awsRegion: region,
        },
      },
    };
  }
  
  /**
   * Normalize IP permissions (security group rules)
   */
  private normalizeIpPermissions(permissions: any[]): any[] {
    return permissions.map((perm) => ({
      protocol: perm.IpProtocol,
      fromPort: perm.FromPort,
      toPort: perm.ToPort,
      cidrBlocks: (perm.IpRanges || []).map((r: any) => r.CidrIp),
      ipv6CidrBlocks: (perm.Ipv6Ranges || []).map((r: any) => r.CidrIpv6),
      sourceSecurityGroups: (perm.UserIdGroupPairs || []).map((p: any) => p.GroupId),
    }));
  }
  
  /**
   * Extract tags from AWS tag array
   */
  private extractTags(tags?: AWSTag[]): Record<string, string> {
    if (!tags) return {};
    
    const tagsMap: Record<string, string> = {};
    tags.forEach((tag) => {
      tagsMap[tag.Key] = tag.Value;
    });
    
    return tagsMap;
  }
  
  /**
   * Redact account ID from ARN
   */
  private redactArn(arn: string): string {
    if (!this.config.redactAccountIds) return arn;
    
    // Replace account ID in ARN with [REDACTED]
    return arn.replace(/:\d{12}:/, ':[REDACTED]:');
  }
  
  /**
   * Generate deterministic ID for a resource
   */
  private generateId(type: string, awsId: string): string {
    return `aws-${type}-${awsId}`;
  }
}
```

---

## Error Handling

### Error Types

```typescript
- IntegrationError: AWS API failures, credential issues
- ParseError: Mock file parsing failures
```

### Error Handling Strategy

1. **Credential Errors**: Auto-fallback to mock inventory
2. **API Errors**: Log warning, continue with other resources
3. **Rate Limiting**: Implement exponential backoff with retries
4. **Region Failures**: Continue with other regions

---

## Testing Strategy

### Unit Tests

```typescript
describe('AWSInventoryAgent', () => {
  describe('fetchInventory', () => {
    it('should use mock when forceMock is true', async () => {
      // Test forced mock mode
    });
    
    it('should fallback to mock when no credentials', async () => {
      // Test auto-fallback
    });
    
    it('should fetch live inventory when credentials available', async () => {
      // Test live fetch
    });
  });
  
  describe('normalizeVPC', () => {
    it('should normalize AWS VPC correctly', () => {
      // Test VPC normalization
    });
    
    it('should extract tags correctly', () => {
      // Test tag extraction
    });
  });
  
  describe('redactArn', () => {
    it('should redact account ID from ARN', () => {
      const arn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/abc';
      const redacted = agent.redactArn(arn);
      expect(redacted).toBe('arn:aws:elasticloadbalancing:us-east-1:[REDACTED]:loadbalancer/app/test/abc');
    });
  });
});
```

### Integration Tests

```typescript
describe('AWSInventoryAgent Integration', () => {
  it('should load mock inventory file', async () => {
    // Test with real mock file
  });
  
  it('should handle missing mock file gracefully', async () => {
    // Test error handling
  });
});
```

---

## Usage Example

```typescript
import { AWSInventoryAgent } from './agents/aws-inventory-agent';

// Initialize agent
const agent = new AWSInventoryAgent({
  regions: ['us-east-1', 'us-west-2'],
  mockInventoryPath: './examples/aws-mock-inventory.json',
  forceMock: false, // Auto-detect credentials
  redactAccountIds: true,
});

// Fetch inventory
const result = await agent.fetchInventory();

if (result.success) {
  const { resources, metadata } = result.data;
  
  console.log(`Source: ${metadata.source}`);
  console.log(`Fetched ${resources.length} AWS resources`);
  console.log(`Regions: ${metadata.regions.join(', ')}`);
  
  // Resources are normalized
  resources.forEach((resource) => {
    console.log(`${resource.type}: ${resource.logicalName} (${resource.region})`);
  });
} else {
  console.error('Failed to fetch AWS inventory:', result.error);
}
```

---

## Dependencies

### External Libraries

```json
{
  "@aws-sdk/client-ec2": "^3.400.0",
  "@aws-sdk/client-elastic-load-balancing-v2": "^3.400.0"
}
```

### Internal Dependencies

- `shared-types.md`: All type definitions
- `utils/aws.ts`: AWS-specific utilities

---

## Security Considerations

1. **Read-Only**: Only use describe/list APIs, never modify operations
2. **Account ID Redaction**: Redact account IDs from ARNs by default
3. **Credential Safety**: Never log or expose AWS credentials
4. **Mock Fallback**: Ensure demo works without credentials

---

## Future Enhancements

1. **More Resource Types**: RDS, Lambda, S3, CloudFront, etc.
2. **Pagination**: Handle large inventories with pagination
3. **Caching**: Cache inventory results to reduce API calls
4. **Incremental Updates**: Only fetch changed resources
5. **Multi-Account**: Support AWS Organizations and cross-account access