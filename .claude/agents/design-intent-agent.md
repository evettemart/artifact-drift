# Design Intent Agent

## Overview

The **DesignIntentAgent** is responsible for parsing and normalizing the approved architecture intent from `architecture.yaml` files. It serves as the source of truth for what the infrastructure *should* look like according to the approved design.

### Responsibilities

1. Parse and validate `architecture.yaml` files
2. Normalize architecture definitions into the internal `NormalizedResource` schema
3. Extract resource relationships and dependencies
4. Provide a placeholder interface for future Confluence integration
5. Validate schema compliance and data integrity

### Key Principles

- **Deterministic**: No LLM calls, pure parsing and transformation
- **Validation First**: Strict schema validation before normalization
- **Security**: No sensitive data in architecture files (by design)
- **Extensibility**: Support for future diagram sources (draw.io XML, Confluence)

---

## Input Contract

### Architecture YAML Schema

```yaml
# architecture.yaml
version: "1.0"
metadata:
  name: "Production Infrastructure"
  description: "Approved architecture for production environment"
  owner: "Platform Team"
  lastReviewed: "2026-06-01"
  approvedBy: "CTO"

regions:
  - us-east-1
  - us-west-2

resources:
  vpcs:
    - logicalName: "prod-vpc"
      cidrBlock: "10.0.0.0/16"
      region: "us-east-1"
      tags:
        Environment: "production"
        ManagedBy: "terraform"
        Owner: "platform-team"
      
  subnets:
    - logicalName: "prod-public-subnet-1a"
      vpcLogicalName: "prod-vpc"
      cidrBlock: "10.0.1.0/24"
      availabilityZone: "us-east-1a"
      public: true
      tags:
        Environment: "production"
        Type: "public"
    
    - logicalName: "prod-private-subnet-1a"
      vpcLogicalName: "prod-vpc"
      cidrBlock: "10.0.10.0/24"
      availabilityZone: "us-east-1a"
      public: false
      tags:
        Environment: "production"
        Type: "private"
  
  securityGroups:
    - logicalName: "web-sg"
      vpcLogicalName: "prod-vpc"
      description: "Security group for web servers"
      ingressRules:
        - protocol: "tcp"
          fromPort: 443
          toPort: 443
          cidrBlocks: ["0.0.0.0/0"]
          description: "HTTPS from internet"
        - protocol: "tcp"
          fromPort: 80
          toPort: 80
          cidrBlocks: ["0.0.0.0/0"]
          description: "HTTP from internet"
      egressRules:
        - protocol: "-1"
          fromPort: 0
          toPort: 0
          cidrBlocks: ["0.0.0.0/0"]
          description: "All outbound traffic"
      tags:
        Environment: "production"
        Purpose: "web-tier"
  
  ec2Instances:
    - logicalName: "web-server-1"
      instanceType: "t3.medium"
      subnetLogicalName: "prod-public-subnet-1a"
      securityGroupLogicalNames: ["web-sg"]
      ami: "ami-0c55b159cbfafe1f0"
      tags:
        Environment: "production"
        Role: "web-server"
        Name: "web-server-1"
  
  loadBalancers:
    - logicalName: "prod-alb"
      type: "application"
      scheme: "internet-facing"
      subnetLogicalNames:
        - "prod-public-subnet-1a"
        - "prod-public-subnet-1b"
      securityGroupLogicalNames: ["web-sg"]
      tags:
        Environment: "production"
        Purpose: "web-traffic"

relationships:
  - source: "prod-vpc"
    target: "prod-public-subnet-1a"
    type: "contains"
  - source: "prod-public-subnet-1a"
    target: "web-server-1"
    type: "contains"
  - source: "web-server-1"
    target: "web-sg"
    type: "member_of"
```

---

## Output Contract

### Normalized Resources

The agent outputs an array of `NormalizedResource` objects (see `shared-types.md`).

```typescript
type DesignIntentOutput = NormalizedResource[];
```

---

## TypeScript Interfaces

### Configuration

```typescript
interface DesignIntentAgentConfig {
  /** Path to architecture.yaml file */
  architectureFilePath: string;
  
  /** Whether to validate against strict schema */
  strictValidation: boolean;
  
  /** Confluence integration config (placeholder) */
  confluenceConfig?: ConfluenceConfig;
  
  /** Custom resource type mappings */
  customTypeMappings?: Record<string, ResourceType>;
}

interface ConfluenceConfig {
  /** Confluence base URL */
  baseUrl: string;
  
  /** Page ID containing architecture diagram */
  pageId: string;
  
  /** Authentication token (placeholder) */
  token?: string;
  
  /** Whether to use Confluence or fall back to local file */
  enabled: boolean;
}
```

### Architecture Schema Types

```typescript
interface ArchitectureIntent {
  version: string;
  metadata: ArchitectureMetadata;
  regions: string[];
  resources: ArchitectureResources;
  relationships?: ArchitectureRelationship[];
}

interface ArchitectureMetadata {
  name: string;
  description: string;
  owner: string;
  lastReviewed: string;
  approvedBy: string;
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
  description: string;
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
  type: RelationshipType;
  metadata?: Record<string, any>;
}
```

---

## Class Definition

```typescript
import { NormalizedResource, ResourceSource, Provider, Result } from './shared-types';
import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

/**
 * DesignIntentAgent
 * 
 * Parses approved architecture intent from YAML files and normalizes
 * into the internal resource schema.
 */
export class DesignIntentAgent {
  private config: DesignIntentAgentConfig;
  
  constructor(config: DesignIntentAgentConfig) {
    this.config = config;
  }
  
  /**
   * Parse architecture file and return normalized resources
   * 
   * @returns Array of normalized resources representing approved architecture
   * @throws ParseError if file cannot be read or parsed
   * @throws ValidationError if schema validation fails
   */
  async parseArchitecture(): Promise<Result<NormalizedResource[], Error>> {
    try {
      // Read file
      const fileContent = await this.readArchitectureFile();
      
      // Parse YAML
      const architectureIntent = this.parseYAML(fileContent);
      
      // Validate schema
      const validationResult = this.validateSchema(architectureIntent);
      if (!validationResult.valid) {
        return {
          success: false,
          error: new ValidationError(
            'Architecture schema validation failed',
            { errors: validationResult.errors }
          ),
        };
      }
      
      // Normalize to internal schema
      const normalizedResources = this.normalizeToInternalSchema(architectureIntent);
      
      return { success: true, data: normalizedResources };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  
  /**
   * Read architecture file from disk or Confluence
   * 
   * @returns File content as string
   * @throws IntegrationError if Confluence fetch fails
   */
  private async readArchitectureFile(): Promise<string> {
    // Check if Confluence integration is enabled
    if (this.config.confluenceConfig?.enabled) {
      return await this.fetchFromConfluence(
        this.config.confluenceConfig.pageId
      );
    }
    
    // Read from local file
    return await fs.readFile(this.config.architectureFilePath, 'utf-8');
  }
  
  /**
   * Parse YAML content into ArchitectureIntent object
   * 
   * @param content - YAML string content
   * @returns Parsed architecture intent
   * @throws ParseError if YAML is invalid
   */
  private parseYAML(content: string): ArchitectureIntent {
    try {
      return yaml.parse(content) as ArchitectureIntent;
    } catch (error) {
      throw new ParseError(
        'Failed to parse architecture YAML',
        { originalError: error }
      );
    }
  }
  
  /**
   * Validate architecture schema against expected structure
   * 
   * @param intent - Parsed architecture intent
   * @returns Validation result with errors if any
   */
  private validateSchema(intent: ArchitectureIntent): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Version check
    if (!intent.version) {
      errors.push({
        field: 'version',
        message: 'Version is required',
        code: 'REQUIRED_FIELD',
      });
    }
    
    // Metadata validation
    if (!intent.metadata) {
      errors.push({
        field: 'metadata',
        message: 'Metadata is required',
        code: 'REQUIRED_FIELD',
      });
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
    
    // Regions validation
    if (!intent.regions || intent.regions.length === 0) {
      errors.push({
        field: 'regions',
        message: 'At least one region must be specified',
        code: 'REQUIRED_FIELD',
      });
    }
    
    // Resources validation
    if (!intent.resources) {
      errors.push({
        field: 'resources',
        message: 'Resources section is required',
        code: 'REQUIRED_FIELD',
      });
    }
    
    // Validate logical name uniqueness
    const logicalNames = new Set<string>();
    const duplicates: string[] = [];
    
    Object.values(intent.resources || {}).forEach((resourceList: any[]) => {
      resourceList?.forEach((resource: any) => {
        if (resource.logicalName) {
          if (logicalNames.has(resource.logicalName)) {
            duplicates.push(resource.logicalName);
          }
          logicalNames.add(resource.logicalName);
        }
      });
    });
    
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
  
  /**
   * Normalize architecture intent into internal NormalizedResource schema
   * 
   * @param intent - Validated architecture intent
   * @returns Array of normalized resources
   */
  private normalizeToInternalSchema(
    intent: ArchitectureIntent
  ): NormalizedResource[] {
    const resources: NormalizedResource[] = [];
    const timestamp = new Date().toISOString();
    const sourceChecksum = this.calculateChecksum(JSON.stringify(intent));
    
    // Normalize VPCs
    intent.resources.vpcs?.forEach((vpc) => {
      resources.push(this.normalizeVPC(vpc, intent, timestamp, sourceChecksum));
    });
    
    // Normalize Subnets
    intent.resources.subnets?.forEach((subnet) => {
      resources.push(this.normalizeSubnet(subnet, intent, timestamp, sourceChecksum));
    });
    
    // Normalize Security Groups
    intent.resources.securityGroups?.forEach((sg) => {
      resources.push(this.normalizeSecurityGroup(sg, intent, timestamp, sourceChecksum));
    });
    
    // Normalize EC2 Instances
    intent.resources.ec2Instances?.forEach((instance) => {
      resources.push(this.normalizeEC2Instance(instance, intent, timestamp, sourceChecksum));
    });
    
    // Normalize Load Balancers
    intent.resources.loadBalancers?.forEach((lb) => {
      resources.push(this.normalizeLoadBalancer(lb, intent, timestamp, sourceChecksum));
    });
    
    // Add more resource types as needed...
    
    return resources;
  }
  
  /**
   * Normalize VPC definition
   */
  private normalizeVPC(
    vpc: VPCDefinition,
    intent: ArchitectureIntent,
    timestamp: string,
    checksum: string
  ): NormalizedResource {
    const relationships: ResourceRelationship[] = [];
    
    // Find subnets in this VPC
    intent.resources.subnets?.forEach((subnet) => {
      if (subnet.vpcLogicalName === vpc.logicalName) {
        relationships.push({
          type: RelationshipType.CONTAINS,
          targetLogicalName: subnet.logicalName,
          targetType: ResourceType.SUBNET,
        });
      }
    });
    
    return {
      id: this.generateId('vpc', vpc.logicalName),
      logicalName: vpc.logicalName,
      type: ResourceType.VPC,
      provider: Provider.AWS,
      region: vpc.region,
      source: ResourceSource.INTENT,
      attributes: {
        cidrBlock: vpc.cidrBlock,
        enableDnsHostnames: vpc.enableDnsHostnames ?? true,
        enableDnsSupport: vpc.enableDnsSupport ?? true,
      },
      tags: vpc.tags,
      relationships,
      sensitiveRedacted: false,
      metadata: {
        capturedAt: timestamp,
        sourceLocation: this.config.architectureFilePath,
        sourceChecksum: checksum,
      },
    };
  }
  
  /**
   * Normalize Subnet definition
   */
  private normalizeSubnet(
    subnet: SubnetDefinition,
    intent: ArchitectureIntent,
    timestamp: string,
    checksum: string
  ): NormalizedResource {
    const relationships: ResourceRelationship[] = [
      {
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: subnet.vpcLogicalName,
        targetType: ResourceType.VPC,
      },
    ];
    
    return {
      id: this.generateId('subnet', subnet.logicalName),
      logicalName: subnet.logicalName,
      type: ResourceType.SUBNET,
      provider: Provider.AWS,
      region: this.findRegionForVPC(subnet.vpcLogicalName, intent),
      source: ResourceSource.INTENT,
      attributes: {
        cidrBlock: subnet.cidrBlock,
        availabilityZone: subnet.availabilityZone,
        public: subnet.public,
        vpcLogicalName: subnet.vpcLogicalName,
      },
      tags: subnet.tags,
      relationships,
      sensitiveRedacted: false,
      metadata: {
        capturedAt: timestamp,
        sourceLocation: this.config.architectureFilePath,
        sourceChecksum: checksum,
      },
    };
  }
  
  /**
   * Normalize Security Group definition
   */
  private normalizeSecurityGroup(
    sg: SecurityGroupDefinition,
    intent: ArchitectureIntent,
    timestamp: string,
    checksum: string
  ): NormalizedResource {
    const relationships: ResourceRelationship[] = [
      {
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: sg.vpcLogicalName,
        targetType: ResourceType.VPC,
      },
    ];
    
    return {
      id: this.generateId('sg', sg.logicalName),
      logicalName: sg.logicalName,
      type: ResourceType.SECURITY_GROUP,
      provider: Provider.AWS,
      region: this.findRegionForVPC(sg.vpcLogicalName, intent),
      source: ResourceSource.INTENT,
      attributes: {
        description: sg.description,
        vpcLogicalName: sg.vpcLogicalName,
        ingressRules: sg.ingressRules,
        egressRules: sg.egressRules,
      },
      tags: sg.tags,
      relationships,
      sensitiveRedacted: false,
      metadata: {
        capturedAt: timestamp,
        sourceLocation: this.config.architectureFilePath,
        sourceChecksum: checksum,
      },
    };
  }
  
  /**
   * Normalize EC2 Instance definition
   */
  private normalizeEC2Instance(
    instance: EC2InstanceDefinition,
    intent: ArchitectureIntent,
    timestamp: string,
    checksum: string
  ): NormalizedResource {
    const relationships: ResourceRelationship[] = [
      {
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: instance.subnetLogicalName,
        targetType: ResourceType.SUBNET,
      },
    ];
    
    // Add security group relationships
    instance.securityGroupLogicalNames.forEach((sgName) => {
      relationships.push({
        type: RelationshipType.ATTACHED_TO,
        targetLogicalName: sgName,
        targetType: ResourceType.SECURITY_GROUP,
      });
    });
    
    return {
      id: this.generateId('instance', instance.logicalName),
      logicalName: instance.logicalName,
      type: ResourceType.EC2_INSTANCE,
      provider: Provider.AWS,
      region: this.findRegionForSubnet(instance.subnetLogicalName, intent),
      source: ResourceSource.INTENT,
      attributes: {
        instanceType: instance.instanceType,
        ami: instance.ami,
        subnetLogicalName: instance.subnetLogicalName,
        securityGroupLogicalNames: instance.securityGroupLogicalNames,
      },
      tags: instance.tags,
      relationships,
      sensitiveRedacted: false,
      metadata: {
        capturedAt: timestamp,
        sourceLocation: this.config.architectureFilePath,
        sourceChecksum: checksum,
      },
    };
  }
  
  /**
   * Normalize Load Balancer definition
   */
  private normalizeLoadBalancer(
    lb: LoadBalancerDefinition,
    intent: ArchitectureIntent,
    timestamp: string,
    checksum: string
  ): NormalizedResource {
    const relationships: ResourceRelationship[] = [];
    
    // Add subnet relationships
    lb.subnetLogicalNames.forEach((subnetName) => {
      relationships.push({
        type: RelationshipType.MEMBER_OF,
        targetLogicalName: subnetName,
        targetType: ResourceType.SUBNET,
      });
    });
    
    // Add security group relationships
    lb.securityGroupLogicalNames.forEach((sgName) => {
      relationships.push({
        type: RelationshipType.ATTACHED_TO,
        targetLogicalName: sgName,
        targetType: ResourceType.SECURITY_GROUP,
      });
    });
    
    return {
      id: this.generateId('alb', lb.logicalName),
      logicalName: lb.logicalName,
      type: ResourceType.ALB,
      provider: Provider.AWS,
      region: this.findRegionForSubnet(lb.subnetLogicalNames[0], intent),
      source: ResourceSource.INTENT,
      attributes: {
        type: lb.type,
        scheme: lb.scheme,
        subnetLogicalNames: lb.subnetLogicalNames,
        securityGroupLogicalNames: lb.securityGroupLogicalNames,
      },
      tags: lb.tags,
      relationships,
      sensitiveRedacted: false,
      metadata: {
        capturedAt: timestamp,
        sourceLocation: this.config.architectureFilePath,
        sourceChecksum: checksum,
      },
    };
  }
  
  /**
   * Fetch architecture from Confluence (placeholder implementation)
   * 
   * @param pageId - Confluence page ID
   * @returns YAML content from Confluence page
   * @throws IntegrationError if fetch fails
   */
  private async fetchFromConfluence(pageId: string): Promise<string> {
    // Placeholder implementation
    // In MVP, this falls back to local file
    throw new IntegrationError(
      'Confluence integration not yet implemented. Using local file fallback.',
      { pageId }
    );
  }
  
  /**
   * Generate deterministic ID for a resource
   */
  private generateId(type: string, logicalName: string): string {
    return `intent-${type}-${logicalName}`;
  }
  
  /**
   * Calculate checksum of content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Find region for a VPC by logical name
   */
  private findRegionForVPC(
    vpcLogicalName: string,
    intent: ArchitectureIntent
  ): string {
    const vpc = intent.resources.vpcs?.find(
      (v) => v.logicalName === vpcLogicalName
    );
    return vpc?.region || intent.regions[0];
  }
  
  /**
   * Find region for a subnet by logical name
   */
  private findRegionForSubnet(
    subnetLogicalName: string,
    intent: ArchitectureIntent
  ): string {
    const subnet = intent.resources.subnets?.find(
      (s) => s.logicalName === subnetLogicalName
    );
    if (subnet) {
      return this.findRegionForVPC(subnet.vpcLogicalName, intent);
    }
    return intent.regions[0];
  }
}
```

---

## Error Handling

### Error Types

```typescript
// Defined in shared-types.md
- ParseError: YAML parsing failures
- ValidationError: Schema validation failures
- IntegrationError: Confluence fetch failures
```

### Error Handling Strategy

1. **File Read Errors**: Return Result with error, include file path in details
2. **YAML Parse Errors**: Wrap in ParseError with line/column information
3. **Validation Errors**: Collect all errors, return comprehensive ValidationResult
4. **Confluence Errors**: Fall back to local file automatically in MVP

---

## Testing Strategy

### Unit Tests

```typescript
describe('DesignIntentAgent', () => {
  describe('parseArchitecture', () => {
    it('should parse valid architecture.yaml', async () => {
      // Test with valid YAML
    });
    
    it('should reject invalid YAML syntax', async () => {
      // Test with malformed YAML
    });
    
    it('should validate required fields', async () => {
      // Test with missing required fields
    });
    
    it('should detect duplicate logical names', async () => {
      // Test with duplicate names
    });
  });
  
  describe('normalizeToInternalSchema', () => {
    it('should normalize VPCs correctly', () => {
      // Test VPC normalization
    });
    
    it('should create correct relationships', () => {
      // Test relationship creation
    });
    
    it('should preserve all tags', () => {
      // Test tag preservation
    });
  });
  
  describe('validateSchema', () => {
    it('should accept valid schema', () => {
      // Test valid schema
    });
    
    it('should reject missing version', () => {
      // Test version validation
    });
    
    it('should require at least one region', () => {
      // Test region validation
    });
  });
});
```

### Integration Tests

```typescript
describe('DesignIntentAgent Integration', () => {
  it('should read and parse real architecture.yaml', async () => {
    // Test with actual file
  });
  
  it('should handle file not found gracefully', async () => {
    // Test error handling
  });
});
```

---

## Usage Example

```typescript
import { DesignIntentAgent } from './agents/design-intent-agent';

// Initialize agent
const agent = new DesignIntentAgent({
  architectureFilePath: './examples/architecture.yaml',
  strictValidation: true,
  confluenceConfig: {
    baseUrl: 'https://company.atlassian.net',
    pageId: '123456',
    enabled: false, // Use local file in MVP
  },
});

// Parse architecture
const result = await agent.parseArchitecture();

if (result.success) {
  const resources = result.data;
  console.log(`Parsed ${resources.length} resources from architecture intent`);
  
  // Resources are now in normalized format
  resources.forEach((resource) => {
    console.log(`${resource.type}: ${resource.logicalName}`);
  });
} else {
  console.error('Failed to parse architecture:', result.error);
}
```

---

## Dependencies

### External Libraries

```json
{
  "yaml": "^2.3.4",
  "zod": "^3.22.4"
}
```

### Internal Dependencies

- `shared-types.md`: All type definitions
- `utils/validation.ts`: Validation utilities
- `utils/crypto.ts`: Checksum calculation

---

## Security Considerations

1. **No Sensitive Data**: Architecture files should never contain secrets by design
2. **Path Validation**: Validate file paths to prevent directory traversal
3. **Schema Validation**: Strict validation prevents injection attacks
4. **Checksum Verification**: Track file integrity for audit trail

---

## Future Enhancements

1. **Confluence Integration**: Implement actual Confluence API client
2. **draw.io XML Parsing**: Parse draw.io diagrams for visual architecture
3. **Multi-file Support**: Support splitting architecture across multiple YAML files
4. **Schema Versioning**: Support multiple architecture.yaml schema versions
5. **Custom Validators**: Allow custom validation rules per organization