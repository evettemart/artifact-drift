# Terraform State Agent

## Overview

The **TerraformStateAgent** is responsible for parsing Terraform state and plan outputs, extracting managed resources, and normalizing them into the internal schema. It enforces strict security by redacting sensitive values at parse time, before they enter the application state.

### Responsibilities

1. Parse `terraform show -json` output from files or CLI execution
2. Extract Terraform-managed resources from state/plan
3. **Redact sensitive values at ingestion time** (critical security requirement)
4. Normalize Terraform resources into `NormalizedResource` schema
5. Track Terraform metadata (version, workspace, backend)
6. Identify resources changed outside Terraform

### Key Principles

- **Security First**: Redact sensitive data before it enters memory
- **Deterministic**: No LLM calls, pure parsing and transformation
- **Read-Only**: Never modify Terraform state
- **Graceful Degradation**: Handle missing Terraform CLI gracefully
- **Version Aware**: Support multiple Terraform versions

---

## Input Contract

### Terraform JSON Output

The agent accepts output from `terraform show -json` or `terraform show -json tfplan`:

```json
{
  "format_version": "1.0",
  "terraform_version": "1.5.0",
  "values": {
    "root_module": {
      "resources": [
        {
          "address": "aws_vpc.main",
          "mode": "managed",
          "type": "aws_vpc",
          "name": "main",
          "provider_name": "registry.terraform.io/hashicorp/aws",
          "schema_version": 1,
          "values": {
            "cidr_block": "10.0.0.0/16",
            "enable_dns_hostnames": true,
            "enable_dns_support": true,
            "tags": {
              "Name": "main-vpc",
              "Environment": "production"
            }
          },
          "sensitive_values": {
            "tags": {}
          }
        }
      ],
      "child_modules": []
    }
  },
  "resource_changes": [],
  "configuration": {}
}
```

---

## Output Contract

### Normalized Resources

```typescript
type TerraformStateOutput = {
  resources: NormalizedResource[];
  metadata: TerraformMetadata;
};

interface TerraformMetadata {
  terraformVersion: string;
  formatVersion: string;
  workspace?: string;
  backend?: string;
  lastModified: string;
  sourceChecksum: string;
}
```

---

## TypeScript Interfaces

### Configuration

```typescript
interface TerraformStateAgentConfig {
  /** Path to terraform show -json output file */
  stateFilePath?: string;
  
  /** Path to Terraform working directory (for CLI execution) */
  terraformDir?: string;
  
  /** Whether to execute terraform commands or use file */
  executeTerraform: boolean;
  
  /** Terraform CLI binary path */
  terraformBinary: string;
  
  /** Additional sensitive field patterns to redact */
  customSensitivePatterns?: RegExp[];
  
  /** Resource types to include (undefined = all) */
  resourceTypeFilter?: string[];
}
```

### Terraform JSON Schema Types

```typescript
interface TerraformJSON {
  format_version: string;
  terraform_version: string;
  values?: TerraformValues;
  resource_changes?: TerraformResourceChange[];
  configuration?: TerraformConfiguration;
  planned_values?: TerraformValues;
  prior_state?: TerraformJSON;
}

interface TerraformValues {
  root_module: TerraformModule;
}

interface TerraformModule {
  resources?: TerraformResource[];
  child_modules?: TerraformModule[];
}

interface TerraformResource {
  address: string;
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider_name: string;
  schema_version: number;
  values: Record<string, any>;
  sensitive_values?: Record<string, any>;
  depends_on?: string[];
  tainted?: boolean;
}

interface TerraformResourceChange {
  address: string;
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider_name: string;
  change: {
    actions: ('create' | 'update' | 'delete' | 'read' | 'no-op')[];
    before: Record<string, any> | null;
    after: Record<string, any> | null;
    after_unknown?: Record<string, boolean>;
    before_sensitive?: Record<string, boolean>;
    after_sensitive?: Record<string, boolean>;
  };
}

interface TerraformConfiguration {
  provider_config?: Record<string, any>;
  root_module?: {
    resources?: any[];
    module_calls?: Record<string, any>;
  };
}
```

### Redaction Types

```typescript
interface RedactionResult {
  /** Redacted data */
  data: Record<string, any>;
  
  /** Whether any values were redacted */
  redacted: boolean;
  
  /** Paths of redacted fields */
  redactedPaths: string[];
}

interface SensitiveFieldConfig {
  /** Field name patterns to always redact */
  fieldPatterns: RegExp[];
  
  /** Value patterns that indicate sensitive data */
  valuePatterns: RegExp[];
  
  /** Terraform-marked sensitive fields */
  terraformSensitive: Set<string>;
}
```

---

## Class Definition

```typescript
import { NormalizedResource, ResourceSource, Provider, Result } from './shared-types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

/**
 * TerraformStateAgent
 * 
 * Parses Terraform state/plan JSON and normalizes into internal schema.
 * CRITICAL: Redacts sensitive values at ingestion time.
 */
export class TerraformStateAgent {
  private config: TerraformStateAgentConfig;
  private sensitiveConfig: SensitiveFieldConfig;
  
  constructor(config: TerraformStateAgentConfig) {
    this.config = config;
    this.sensitiveConfig = this.initializeSensitiveConfig();
  }
  
  /**
   * Parse Terraform state and return normalized resources
   * 
   * @returns Normalized resources and metadata
   * @throws ParseError if JSON cannot be parsed
   * @throws SecurityError if redaction fails
   */
  async parseTerraformState(): Promise<Result<TerraformStateOutput, Error>> {
    try {
      // Get Terraform JSON
      const tfJson = await this.getTerraformJSON();
      
      // Extract resources from state
      const resources = this.extractResources(tfJson);
      
      // Redact sensitive values (CRITICAL SECURITY STEP)
      const redactedResources = resources.map((resource) => 
        this.redactSensitiveValues(resource)
      );
      
      // Normalize to internal schema
      const normalizedResources = redactedResources.map((resource) =>
        this.normalizeResource(resource, tfJson)
      );
      
      // Extract metadata
      const metadata: TerraformMetadata = {
        terraformVersion: tfJson.terraform_version,
        formatVersion: tfJson.format_version,
        lastModified: new Date().toISOString(),
        sourceChecksum: this.calculateChecksum(JSON.stringify(tfJson)),
      };
      
      return {
        success: true,
        data: {
          resources: normalizedResources,
          metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  
  /**
   * Get Terraform JSON from file or CLI execution
   * 
   * @returns Parsed Terraform JSON
   * @throws IntegrationError if Terraform execution fails
   */
  private async getTerraformJSON(): Promise<TerraformJSON> {
    if (this.config.executeTerraform && this.config.terraformDir) {
      return await this.executeTerraformShow();
    } else if (this.config.stateFilePath) {
      return await this.readTerraformFile();
    } else {
      throw new IntegrationError(
        'No Terraform source configured. Provide stateFilePath or terraformDir.',
        { config: this.config }
      );
    }
  }
  
  /**
   * Execute terraform show -json command
   * 
   * @returns Terraform JSON output
   * @throws IntegrationError if command fails
   */
  private async executeTerraformShow(): Promise<TerraformJSON> {
    try {
      const command = `${this.config.terraformBinary} show -json`;
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.config.terraformDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      if (stderr && !stderr.includes('Refreshing state')) {
        console.warn('Terraform stderr:', stderr);
      }
      
      return JSON.parse(stdout) as TerraformJSON;
    } catch (error) {
      throw new IntegrationError(
        'Failed to execute terraform show',
        { error, terraformDir: this.config.terraformDir }
      );
    }
  }
  
  /**
   * Read Terraform JSON from file
   * 
   * @returns Parsed Terraform JSON
   * @throws ParseError if file cannot be read or parsed
   */
  private async readTerraformFile(): Promise<TerraformJSON> {
    try {
      const content = await fs.readFile(this.config.stateFilePath!, 'utf-8');
      return JSON.parse(content) as TerraformJSON;
    } catch (error) {
      throw new ParseError(
        'Failed to read or parse Terraform JSON file',
        { error, filePath: this.config.stateFilePath }
      );
    }
  }
  
  /**
   * Extract all resources from Terraform JSON
   * 
   * @param tfJson - Terraform JSON output
   * @returns Array of Terraform resources
   */
  private extractResources(tfJson: TerraformJSON): TerraformResource[] {
    const resources: TerraformResource[] = [];
    
    // Extract from values (current state)
    if (tfJson.values?.root_module) {
      this.extractFromModule(tfJson.values.root_module, resources);
    }
    
    // Extract from planned_values (for plan output)
    if (tfJson.planned_values?.root_module) {
      this.extractFromModule(tfJson.planned_values.root_module, resources);
    }
    
    // Filter by resource type if configured
    if (this.config.resourceTypeFilter) {
      return resources.filter((r) =>
        this.config.resourceTypeFilter!.includes(r.type)
      );
    }
    
    return resources;
  }
  
  /**
   * Recursively extract resources from a module
   * 
   * @param module - Terraform module
   * @param resources - Array to accumulate resources
   */
  private extractFromModule(
    module: TerraformModule,
    resources: TerraformResource[]
  ): void {
    // Add resources from this module
    if (module.resources) {
      resources.push(...module.resources.filter((r) => r.mode === 'managed'));
    }
    
    // Recursively process child modules
    if (module.child_modules) {
      module.child_modules.forEach((childModule) => {
        this.extractFromModule(childModule, resources);
      });
    }
  }
  
  /**
   * CRITICAL SECURITY FUNCTION
   * Redact sensitive values from a Terraform resource
   * 
   * This is the enforcement point for the security requirement:
   * "Raw Terraform state, secrets, credentials, access keys, connection strings,
   * or full resource attributes must NEVER reach the LLM."
   * 
   * @param resource - Terraform resource
   * @returns Resource with sensitive values redacted
   */
  private redactSensitiveValues(resource: TerraformResource): TerraformResource {
    const redactionResult = this.redactObject(
      resource.values,
      resource.sensitive_values || {},
      []
    );
    
    return {
      ...resource,
      values: redactionResult.data,
      sensitive_values: {}, // Clear sensitive markers after redaction
    };
  }
  
  /**
   * Recursively redact sensitive fields in an object
   * 
   * @param obj - Object to redact
   * @param sensitiveMarkers - Terraform's sensitive value markers
   * @param path - Current path in object tree
   * @returns Redacted object
   */
  private redactObject(
    obj: any,
    sensitiveMarkers: any,
    path: string[]
  ): RedactionResult {
    if (obj === null || obj === undefined) {
      return { data: obj, redacted: false, redactedPaths: [] };
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      const results = obj.map((item, index) =>
        this.redactObject(item, sensitiveMarkers?.[index], [...path, String(index)])
      );
      return {
        data: results.map((r) => r.data),
        redacted: results.some((r) => r.redacted),
        redactedPaths: results.flatMap((r) => r.redactedPaths),
      };
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      const redactedObj: Record<string, any> = {};
      let anyRedacted = false;
      const redactedPaths: string[] = [];
      
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = [...path, key];
        const fieldPathStr = fieldPath.join('.');
        
        // Check if field should be redacted
        if (this.shouldRedactField(key, value, sensitiveMarkers?.[key])) {
          redactedObj[key] = '[REDACTED]';
          anyRedacted = true;
          redactedPaths.push(fieldPathStr);
        } else {
          // Recursively process nested objects
          const result = this.redactObject(
            value,
            sensitiveMarkers?.[key],
            fieldPath
          );
          redactedObj[key] = result.data;
          if (result.redacted) {
            anyRedacted = true;
            redactedPaths.push(...result.redactedPaths);
          }
        }
      }
      
      return { data: redactedObj, redacted: anyRedacted, redactedPaths };
    }
    
    // Primitive values - check value patterns
    if (typeof obj === 'string' && this.isSensitiveValue(obj)) {
      return {
        data: '[REDACTED]',
        redacted: true,
        redactedPaths: [path.join('.')],
      };
    }
    
    return { data: obj, redacted: false, redactedPaths: [] };
  }
  
  /**
   * Determine if a field should be redacted
   * 
   * @param fieldName - Field name
   * @param value - Field value
   * @param terraformSensitive - Terraform's sensitive marker
   * @returns True if field should be redacted
   */
  private shouldRedactField(
    fieldName: string,
    value: any,
    terraformSensitive: boolean | any
  ): boolean {
    // Terraform explicitly marked as sensitive
    if (terraformSensitive === true) {
      return true;
    }
    
    // Field name matches sensitive pattern
    if (this.sensitiveConfig.fieldPatterns.some((pattern) => pattern.test(fieldName))) {
      return true;
    }
    
    // Value matches sensitive pattern
    if (typeof value === 'string' && this.isSensitiveValue(value)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a string value appears to be sensitive
   * 
   * @param value - String value to check
   * @returns True if value matches sensitive patterns
   */
  private isSensitiveValue(value: string): boolean {
    return this.sensitiveConfig.valuePatterns.some((pattern) =>
      pattern.test(value)
    );
  }
  
  /**
   * Initialize sensitive field configuration
   * 
   * @returns Sensitive field configuration
   */
  private initializeSensitiveConfig(): SensitiveFieldConfig {
    const fieldPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /access[_-]?key/i,
      /private[_-]?key/i,
      /connection[_-]?string/i,
      /credentials?/i,
      /auth/i,
      /bearer/i,
      /jwt/i,
      /certificate/i,
      /cert/i,
      /key[_-]?pair/i,
    ];
    
    const valuePatterns = [
      /AKIA[0-9A-Z]{16}/, // AWS Access Key
      /[A-Za-z0-9/+=]{40}/, // AWS Secret Key (40 chars)
      /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, // Private keys
      /mongodb:\/\/[^@]+@/, // MongoDB connection strings
      /postgresql:\/\/[^@]+@/, // PostgreSQL connection strings
      /mysql:\/\/[^@]+@/, // MySQL connection strings
      /Bearer [A-Za-z0-9\-._~+/]+=*/, // Bearer tokens
      /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/, // JWT tokens
    ];
    
    // Add custom patterns from config
    if (this.config.customSensitivePatterns) {
      valuePatterns.push(...this.config.customSensitivePatterns);
    }
    
    return {
      fieldPatterns,
      valuePatterns,
      terraformSensitive: new Set(),
    };
  }
  
  /**
   * Normalize Terraform resource to internal schema
   * 
   * @param tfResource - Terraform resource (already redacted)
   * @param tfJson - Full Terraform JSON for context
   * @returns Normalized resource
   */
  private normalizeResource(
    tfResource: TerraformResource,
    tfJson: TerraformJSON
  ): NormalizedResource {
    const resourceType = this.mapTerraformTypeToInternal(tfResource.type);
    const region = this.extractRegion(tfResource);
    const relationships = this.extractRelationships(tfResource);
    
    return {
      id: this.generateId(tfResource),
      logicalName: this.extractLogicalName(tfResource),
      type: resourceType,
      provider: this.extractProvider(tfResource.provider_name),
      region,
      source: ResourceSource.TERRAFORM,
      attributes: this.extractSafeAttributes(tfResource),
      tags: tfResource.values.tags || {},
      relationships,
      sensitiveRedacted: true, // Always true after redaction
      metadata: {
        capturedAt: new Date().toISOString(),
        sourceLocation: this.config.stateFilePath || this.config.terraformDir || 'terraform',
        sourceChecksum: this.calculateChecksum(JSON.stringify(tfResource)),
        providerMetadata: {
          terraformAddress: tfResource.address,
          terraformType: tfResource.type,
          schemaVersion: tfResource.schema_version,
          tainted: tfResource.tainted || false,
        },
      },
    };
  }
  
  /**
   * Map Terraform resource type to internal ResourceType
   * 
   * @param tfType - Terraform resource type (e.g., 'aws_vpc')
   * @returns Internal resource type
   */
  private mapTerraformTypeToInternal(tfType: string): ResourceType {
    const typeMap: Record<string, ResourceType> = {
      aws_vpc: ResourceType.VPC,
      aws_subnet: ResourceType.SUBNET,
      aws_security_group: ResourceType.SECURITY_GROUP,
      aws_instance: ResourceType.EC2_INSTANCE,
      aws_lb: ResourceType.ALB,
      aws_alb: ResourceType.ALB,
      aws_lb_target_group: ResourceType.TARGET_GROUP,
      aws_lb_listener: ResourceType.LISTENER,
      aws_route_table: ResourceType.ROUTE_TABLE,
      aws_internet_gateway: ResourceType.INTERNET_GATEWAY,
      aws_nat_gateway: ResourceType.NAT_GATEWAY,
      aws_eip: ResourceType.EIP,
      aws_iam_role: ResourceType.IAM_ROLE,
      aws_iam_policy: ResourceType.IAM_POLICY,
      aws_s3_bucket: ResourceType.S3_BUCKET,
      aws_db_instance: ResourceType.RDS_INSTANCE,
      aws_lambda_function: ResourceType.LAMBDA_FUNCTION,
    };
    
    return typeMap[tfType] || ResourceType.OTHER;
  }
  
  /**
   * Extract logical name from Terraform resource
   * 
   * @param tfResource - Terraform resource
   * @returns Logical name
   */
  private extractLogicalName(tfResource: TerraformResource): string {
    // Try to get from tags first
    if (tfResource.values.tags?.Name) {
      return tfResource.values.tags.Name;
    }
    
    // Fall back to Terraform name
    return tfResource.name;
  }
  
  /**
   * Extract region from Terraform resource
   * 
   * @param tfResource - Terraform resource
   * @returns AWS region
   */
  private extractRegion(tfResource: TerraformResource): string {
    // Try various common region fields
    return (
      tfResource.values.region ||
      tfResource.values.availability_zone?.slice(0, -1) || // Remove AZ letter
      'us-east-1' // Default
    );
  }
  
  /**
   * Extract provider from provider name
   * 
   * @param providerName - Terraform provider name
   * @returns Provider enum
   */
  private extractProvider(providerName: string): Provider {
    if (providerName.includes('aws')) {
      return Provider.AWS;
    }
    // Add more providers as needed
    return Provider.AWS; // Default for MVP
  }
  
  /**
   * Extract safe (non-sensitive) attributes
   * 
   * @param tfResource - Terraform resource (already redacted)
   * @returns Safe attributes
   */
  private extractSafeAttributes(tfResource: TerraformResource): Record<string, any> {
    const { tags, ...attributes } = tfResource.values;
    
    // Remove known sensitive or unnecessary fields
    const fieldsToRemove = ['arn', 'id', 'owner_id', 'tags_all'];
    fieldsToRemove.forEach((field) => delete attributes[field]);
    
    return attributes;
  }
  
  /**
   * Extract relationships from Terraform resource
   * 
   * @param tfResource - Terraform resource
   * @returns Array of relationships
   */
  private extractRelationships(tfResource: TerraformResource): ResourceRelationship[] {
    const relationships: ResourceRelationship[] = [];
    
    // Extract from depends_on
    if (tfResource.depends_on) {
      tfResource.depends_on.forEach((dep) => {
        relationships.push({
          type: RelationshipType.DEPENDS_ON,
          targetLogicalName: this.extractNameFromAddress(dep),
          targetType: this.mapTerraformTypeToInternal(this.extractTypeFromAddress(dep)),
        });
      });
    }
    
    // Extract from common reference fields
    const referenceFields = [
      'vpc_id',
      'subnet_id',
      'security_group_ids',
      'subnet_ids',
    ];
    
    referenceFields.forEach((field) => {
      const value = tfResource.values[field];
      if (value) {
        // Handle arrays
        const values = Array.isArray(value) ? value : [value];
        values.forEach((v) => {
          if (typeof v === 'string' && v.startsWith('${')) {
            // Terraform reference
            const refName = this.extractNameFromReference(v);
            if (refName) {
              relationships.push({
                type: RelationshipType.ATTACHED_TO,
                targetLogicalName: refName,
                targetType: this.inferTypeFromFieldName(field),
              });
            }
          }
        });
      }
    });
    
    return relationships;
  }
  
  /**
   * Extract resource name from Terraform address
   */
  private extractNameFromAddress(address: string): string {
    const parts = address.split('.');
    return parts[parts.length - 1];
  }
  
  /**
   * Extract resource type from Terraform address
   */
  private extractTypeFromAddress(address: string): string {
    const parts = address.split('.');
    return parts.length > 1 ? parts[0] : '';
  }
  
  /**
   * Extract name from Terraform reference
   */
  private extractNameFromReference(ref: string): string | null {
    const match = ref.match(/\$\{([^}]+)\}/);
    if (match) {
      const parts = match[1].split('.');
      return parts[parts.length - 1];
    }
    return null;
  }
  
  /**
   * Infer resource type from field name
   */
  private inferTypeFromFieldName(fieldName: string): ResourceType {
    if (fieldName.includes('vpc')) return ResourceType.VPC;
    if (fieldName.includes('subnet')) return ResourceType.SUBNET;
    if (fieldName.includes('security_group')) return ResourceType.SECURITY_GROUP;
    return ResourceType.OTHER;
  }
  
  /**
   * Generate deterministic ID for a resource
   */
  private generateId(tfResource: TerraformResource): string {
    return `terraform-${tfResource.type}-${tfResource.name}`;
  }
  
  /**
   * Calculate checksum of content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

---

## Security Enforcement

### Redaction Rules (CRITICAL)

1. **Field Name Patterns**: Any field matching sensitive patterns is redacted
2. **Value Patterns**: Any value matching sensitive patterns is redacted
3. **Terraform Markers**: Any field marked sensitive by Terraform is redacted
4. **Whitelist Approach**: Only explicitly safe fields are preserved

### Redacted Field Examples

```typescript
// BEFORE redaction
{
  "db_password": "super-secret-password",
  "connection_string": "postgresql://user:pass@host/db",
  "access_key": "AKIAIOSFODNN7EXAMPLE",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n..."
}

// AFTER redaction
{
  "db_password": "[REDACTED]",
  "connection_string": "[REDACTED]",
  "access_key": "[REDACTED]",
  "private_key": "[REDACTED]"
}
```

### Security Validation

```typescript
/**
 * Validate that no sensitive data leaked through redaction
 * This should be called in tests to ensure redaction is working
 */
function validateNoSensitiveData(resource: NormalizedResource): boolean {
  const json = JSON.stringify(resource);
  
  // Check for AWS keys
  if (/AKIA[0-9A-Z]{16}/.test(json)) return false;
  
  // Check for private keys
  if (/-----BEGIN.*PRIVATE KEY-----/.test(json)) return false;
  
  // Check for connection strings
  if (/(mongodb|postgresql|mysql):\/\/[^@]+@/.test(json)) return false;
  
  return true;
}
```

---

## Error Handling

### Error Types

```typescript
- ParseError: JSON parsing failures
- IntegrationError: Terraform CLI execution failures
- SecurityError: Redaction failures (should never happen, but critical if it does)
```

### Error Handling Strategy

1. **CLI Failures**: Fall back to file-based parsing
2. **Parse Errors**: Return detailed error with line/column info
3. **Redaction Failures**: Fail fast with SecurityError (never proceed with unredacted data)

---

## Testing Strategy

### Unit Tests

```typescript
describe('TerraformStateAgent', () => {
  describe('redactSensitiveValues', () => {
    it('should redact AWS access keys', () => {
      // Test AWS key redaction
    });
    
    it('should redact password fields', () => {
      // Test password redaction
    });
    
    it('should redact connection strings', () => {
      // Test connection string redaction
    });
    
    it('should preserve safe attributes', () => {
      // Test that safe data is not redacted
    });
    
    it('should handle nested objects', () => {
      // Test recursive redaction
    });
  });
  
  describe('normalizeResource', () => {
    it('should map Terraform types correctly', () => {
      // Test type mapping
    });
    
    it('should extract relationships', () => {
      // Test relationship extraction
    });
  });
  
  describe('parseTerraformState', () => {
    it('should parse valid Terraform JSON', async () => {
      // Test with valid JSON
    });
    
    it('should handle missing Terraform CLI gracefully', async () => {
      // Test fallback to file
    });
  });
});
```

### Security Tests (CRITICAL)

```typescript
describe('TerraformStateAgent Security', () => {
  it('should never expose AWS access keys', async () => {
    const agent = new TerraformStateAgent(config);
    const result = await agent.parseTerraformState();
    
    const json = JSON.stringify(result.data);
    expect(json).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });
  
  it('should never expose private keys', async () => {
    // Test private key redaction
  });
  
  it('should never expose passwords', async () => {
    // Test password redaction
  });
  
  it('should mark all resources as sensitiveRedacted', async () => {
    const result = await agent.parseTerraformState();
    result.data.resources.forEach((resource) => {
      expect(resource.sensitiveRedacted).toBe(true);
    });
  });
});
```

---

## Usage Example

```typescript
import { TerraformStateAgent } from './agents/terraform-state-agent';

// Initialize agent with file-based parsing
const agent = new TerraformStateAgent({
  stateFilePath: './terraform-state.json',
  executeTerraform: false,
  terraformBinary: 'terraform',
});

// Parse Terraform state
const result = await agent.parseTerraformState();

if (result.success) {
  const { resources, metadata } = result.data;
  
  console.log(`Parsed ${resources.length} Terraform-managed resources`);
  console.log(`Terraform version: ${metadata.terraformVersion}`);
  
  // All resources have been redacted
  resources.forEach((resource) => {
    console.log(`${resource.type}: ${resource.logicalName}`);
    console.log(`  Sensitive data redacted: ${resource.sensitiveRedacted}`);
  });
} else {
  console.error('Failed to parse Terraform state:', result.error);
}
```

---

## Dependencies

### External Libraries

```json
{
  "child_process": "built-in",
  "crypto": "built-in"
}
```

### Internal Dependencies

- `shared-types.md`: All type definitions
- `utils/redaction.ts`: Redaction utilities
- `utils/terraform.ts`: Terraform-specific utilities

---

## Future Enhancements

1. **HCP Terraform Integration**: Fetch state from Terraform Cloud/Enterprise
2. **State Locking**: Respect Terraform state locks
3. **Drift Detection**: Compare current state with prior state
4. **Module Support**: Better handling of Terraform modules
5. **Provider Plugins**: Support for custom provider schemas