# Drift Analysis Agent

## Overview

The **DriftAnalysisAgent** is the core deterministic engine that compares approved architecture intent against Terraform state and live AWS resources to detect infrastructure drift. It produces structured drift findings that are later enriched by the ReasoningAgent.

### Responsibilities

1. Compare three normalized resource sets (Intent, Terraform, AWS)
2. Detect 8 types of drift deterministically
3. Generate pre-computed, redacted diff summaries
4. Produce whitelisted finding objects for LLM consumption
5. Calculate compliance scores based on drift severity

### Key Principles

- **Deterministic**: No LLM calls, pure comparison logic
- **Security**: Generate whitelisted findings, never expose raw data
- **Comprehensive**: Detect all drift types specified in requirements
- **Traceable**: Each finding links back to specific resources
- **Efficient**: Use indexing and caching for large resource sets

---

## Drift Types Detected

### 1. Missing Resource
Resource defined in architecture intent or Terraform but not found in the target layer.

### 2. Unexpected Resource
Resource exists but was not defined in architecture intent or Terraform.

### 3. Unmanaged Resource
Resource exists in AWS but is not managed by Terraform (shadow IT).

### 4. Changed Outside Terraform
Terraform-managed resource was modified directly in AWS.

### 5. Attribute Mismatch
Resource attributes don't match expected values from architecture intent.

### 6. Tag Mismatch
Resource tags differ from expected tags.

### 7. Security Group Mismatch
Security group rules differ from expected configuration.

### 8. Region Mismatch
Resource is in a different region than specified.

---

## Input Contract

### Three Normalized Resource Sets

```typescript
interface DriftAnalysisInput {
  /** Resources from architecture intent */
  intentResources: NormalizedResource[];
  
  /** Resources from Terraform state */
  terraformResources: NormalizedResource[];
  
  /** Resources from AWS (live or mock) */
  awsResources: NormalizedResource[];
  
  /** Configuration for analysis */
  config: DriftAnalysisConfig;
}

interface DriftAnalysisConfig {
  /** Severity weights for score calculation */
  severityWeights?: Record<Severity, number>;
  
  /** Whether to perform deep attribute comparison */
  deepCompare: boolean;
  
  /** Attributes to ignore in comparison */
  ignoreAttributes?: string[];
  
  /** Tags to ignore in comparison */
  ignoreTags?: string[];
  
  /** Whether to detect unmanaged resources */
  detectUnmanaged: boolean;
}
```

---

## Output Contract

### Drift Findings

```typescript
interface DriftAnalysisOutput {
  /** All detected drift findings */
  findings: DriftFinding[];
  
  /** Summary statistics */
  statistics: DriftStatistics;
  
  /** Compliance score (0-100) */
  complianceScore: number;
  
  /** Analysis metadata */
  metadata: AnalysisMetadata;
}

interface DriftStatistics {
  totalResourcesAnalyzed: number;
  matchedResources: number;
  driftedResources: number;
  unmanagedResources: number;
  missingResources: number;
  driftsByType: Record<DriftType, number>;
  driftsBySeverity: Record<Severity, number>;
}

interface AnalysisMetadata {
  analyzedAt: string;
  durationMs: number;
  intentResourceCount: number;
  terraformResourceCount: number;
  awsResourceCount: number;
}
```

---

## TypeScript Interfaces

### Resource Index

```typescript
interface ResourceIndex {
  /** Index by logical name */
  byLogicalName: Map<string, NormalizedResource>;
  
  /** Index by type */
  byType: Map<ResourceType, NormalizedResource[]>;
  
  /** Index by region */
  byRegion: Map<string, NormalizedResource[]>;
  
  /** Index by VPC (for network resources) */
  byVpc: Map<string, NormalizedResource[]>;
}

interface ComparisonContext {
  intentIndex: ResourceIndex;
  terraformIndex: ResourceIndex;
  awsIndex: ResourceIndex;
  config: DriftAnalysisConfig;
}
```

### Comparison Result

```typescript
interface ResourceComparison {
  /** Resource logical name */
  logicalName: string;
  
  /** Resource type */
  type: ResourceType;
  
  /** Comparison status */
  status: 'matched' | 'drifted' | 'missing' | 'unexpected';
  
  /** Detected drifts for this resource */
  drifts: DriftFinding[];
}
```

---

## Class Definition

```typescript
import {
  NormalizedResource,
  DriftFinding,
  DriftType,
  Severity,
  WhitelistedFinding,
  Result,
} from './shared-types';

/**
 * DriftAnalysisAgent
 * 
 * Deterministic drift detection engine that compares three resource sets
 * and produces structured drift findings.
 */
export class DriftAnalysisAgent {
  private config: DriftAnalysisConfig;
  
  constructor(config: DriftAnalysisConfig) {
    this.config = {
      deepCompare: true,
      detectUnmanaged: true,
      ...config,
    };
  }
  
  /**
   * Analyze drift across three resource sets
   * 
   * @param input - Intent, Terraform, and AWS resources
   * @returns Drift findings and statistics
   */
  async analyzeDrift(
    input: DriftAnalysisInput
  ): Promise<Result<DriftAnalysisOutput, Error>> {
    const startTime = Date.now();
    
    try {
      // Build indexes for efficient lookup
      const context: ComparisonContext = {
        intentIndex: this.buildIndex(input.intentResources),
        terraformIndex: this.buildIndex(input.terraformResources),
        awsIndex: this.buildIndex(input.awsResources),
        config: this.config,
      };
      
      // Detect all drift types
      const findings: DriftFinding[] = [];
      
      // 1. Compare Intent vs Terraform
      findings.push(...this.compareIntentVsTerraform(context));
      
      // 2. Compare Terraform vs AWS
      findings.push(...this.compareTerraformVsAWS(context));
      
      // 3. Compare Intent vs AWS (for resources not in Terraform)
      findings.push(...this.compareIntentVsAWS(context));
      
      // 4. Detect unmanaged resources (in AWS but not in Terraform)
      if (this.config.detectUnmanaged) {
        findings.push(...this.detectUnmanagedResources(context));
      }
      
      // Assign default severity (will be overridden by ReasoningAgent)
      findings.forEach((finding) => {
        if (!finding.severity) {
          finding.severity = this.assignDefaultSeverity(finding);
        }
      });
      
      // Calculate statistics
      const statistics = this.calculateStatistics(input, findings);
      
      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(
        findings,
        this.config.severityWeights
      );
      
      const durationMs = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          findings,
          statistics,
          complianceScore,
          metadata: {
            analyzedAt: new Date().toISOString(),
            durationMs,
            intentResourceCount: input.intentResources.length,
            terraformResourceCount: input.terraformResources.length,
            awsResourceCount: input.awsResources.length,
          },
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
   * Build resource index for efficient lookup
   */
  private buildIndex(resources: NormalizedResource[]): ResourceIndex {
    const index: ResourceIndex = {
      byLogicalName: new Map(),
      byType: new Map(),
      byRegion: new Map(),
      byVpc: new Map(),
    };
    
    resources.forEach((resource) => {
      // Index by logical name
      index.byLogicalName.set(resource.logicalName, resource);
      
      // Index by type
      if (!index.byType.has(resource.type)) {
        index.byType.set(resource.type, []);
      }
      index.byType.get(resource.type)!.push(resource);
      
      // Index by region
      if (!index.byRegion.has(resource.region)) {
        index.byRegion.set(resource.region, []);
      }
      index.byRegion.get(resource.region)!.push(resource);
      
      // Index by VPC (if applicable)
      const vpcId = resource.attributes.vpcId || resource.attributes.vpcLogicalName;
      if (vpcId) {
        if (!index.byVpc.has(vpcId)) {
          index.byVpc.set(vpcId, []);
        }
        index.byVpc.get(vpcId)!.push(resource);
      }
    });
    
    return index;
  }
  
  /**
   * Compare Intent vs Terraform
   * Detects: missing resources in Terraform, attribute mismatches
   */
  private compareIntentVsTerraform(context: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    
    context.intentIndex.byLogicalName.forEach((intentResource, logicalName) => {
      const terraformResource = context.terraformIndex.byLogicalName.get(logicalName);
      
      if (!terraformResource) {
        // Resource defined in intent but missing in Terraform
        findings.push(
          this.createMissingResourceFinding(
            intentResource,
            'terraform',
            'Resource defined in architecture but not in Terraform'
          )
        );
      } else {
        // Resource exists in both, compare attributes
        const attributeDrifts = this.compareAttributes(
          intentResource,
          terraformResource,
          context.config
        );
        
        if (attributeDrifts.length > 0) {
          findings.push(
            this.createAttributeDriftFinding(
              intentResource,
              terraformResource,
              attributeDrifts,
              'Terraform resource does not match architecture intent'
            )
          );
        }
        
        // Compare tags
        const tagDrifts = this.compareTags(
          intentResource.tags,
          terraformResource.tags,
          context.config
        );
        
        if (tagDrifts.length > 0) {
          findings.push(
            this.createTagDriftFinding(
              intentResource,
              terraformResource,
              tagDrifts
            )
          );
        }
        
        // Compare security group rules if applicable
        if (intentResource.type === ResourceType.SECURITY_GROUP) {
          const sgDrifts = this.compareSecurityGroupRules(
            intentResource,
            terraformResource
          );
          
          if (sgDrifts.length > 0) {
            findings.push(
              this.createSecurityGroupDriftFinding(
                intentResource,
                terraformResource,
                sgDrifts
              )
            );
          }
        }
      }
    });
    
    return findings;
  }
  
  /**
   * Compare Terraform vs AWS
   * Detects: missing resources in AWS, resources changed outside Terraform
   */
  private compareTerraformVsAWS(context: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    
    context.terraformIndex.byLogicalName.forEach((terraformResource, logicalName) => {
      const awsResource = this.findMatchingAWSResource(
        terraformResource,
        context.awsIndex
      );
      
      if (!awsResource) {
        // Terraform resource not found in AWS
        findings.push(
          this.createMissingResourceFinding(
            terraformResource,
            'aws',
            'Terraform-managed resource not found in AWS'
          )
        );
      } else {
        // Resource exists in both, check for drift
        const attributeDrifts = this.compareAttributes(
          terraformResource,
          awsResource,
          context.config
        );
        
        if (attributeDrifts.length > 0) {
          findings.push(
            this.createChangedOutsideTerraformFinding(
              terraformResource,
              awsResource,
              attributeDrifts
            )
          );
        }
        
        // Compare tags
        const tagDrifts = this.compareTags(
          terraformResource.tags,
          awsResource.tags,
          context.config
        );
        
        if (tagDrifts.length > 0) {
          findings.push(
            this.createTagDriftFinding(
              terraformResource,
              awsResource,
              tagDrifts
            )
          );
        }
      }
    });
    
    return findings;
  }
  
  /**
   * Compare Intent vs AWS (for resources not managed by Terraform)
   * Detects: missing resources in AWS, unexpected configurations
   */
  private compareIntentVsAWS(context: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    
    context.intentIndex.byLogicalName.forEach((intentResource, logicalName) => {
      // Skip if resource is managed by Terraform
      if (context.terraformIndex.byLogicalName.has(logicalName)) {
        return;
      }
      
      const awsResource = this.findMatchingAWSResource(
        intentResource,
        context.awsIndex
      );
      
      if (!awsResource) {
        // Resource defined in intent but not in AWS
        findings.push(
          this.createMissingResourceFinding(
            intentResource,
            'aws',
            'Resource defined in architecture but not deployed in AWS'
          )
        );
      }
    });
    
    return findings;
  }
  
  /**
   * Detect unmanaged resources (in AWS but not in Terraform)
   */
  private detectUnmanagedResources(context: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    
    context.awsIndex.byLogicalName.forEach((awsResource, logicalName) => {
      // Check if resource is managed by Terraform
      const terraformResource = this.findMatchingTerraformResource(
        awsResource,
        context.terraformIndex
      );
      
      if (!terraformResource) {
        // Resource exists in AWS but not managed by Terraform
        findings.push(
          this.createUnmanagedResourceFinding(awsResource)
        );
      }
    });
    
    return findings;
  }
  
  /**
   * Find matching AWS resource by logical name or attributes
   */
  private findMatchingAWSResource(
    resource: NormalizedResource,
    awsIndex: ResourceIndex
  ): NormalizedResource | undefined {
    // Try exact logical name match first
    let match = awsIndex.byLogicalName.get(resource.logicalName);
    if (match) return match;
    
    // Try to match by type and key attributes
    const candidates = awsIndex.byType.get(resource.type) || [];
    
    for (const candidate of candidates) {
      if (this.resourcesMatch(resource, candidate)) {
        return candidate;
      }
    }
    
    return undefined;
  }
  
  /**
   * Find matching Terraform resource
   */
  private findMatchingTerraformResource(
    awsResource: NormalizedResource,
    terraformIndex: ResourceIndex
  ): NormalizedResource | undefined {
    // Try exact logical name match
    let match = terraformIndex.byLogicalName.get(awsResource.logicalName);
    if (match) return match;
    
    // Try to match by type and key attributes
    const candidates = terraformIndex.byType.get(awsResource.type) || [];
    
    for (const candidate of candidates) {
      if (this.resourcesMatch(awsResource, candidate)) {
        return candidate;
      }
    }
    
    return undefined;
  }
  
  /**
   * Check if two resources represent the same infrastructure component
   */
  private resourcesMatch(
    resource1: NormalizedResource,
    resource2: NormalizedResource
  ): boolean {
    // Must be same type
    if (resource1.type !== resource2.type) return false;
    
    // Must be in same region
    if (resource1.region !== resource2.region) return false;
    
    // Type-specific matching logic
    switch (resource1.type) {
      case ResourceType.VPC:
        return resource1.attributes.cidrBlock === resource2.attributes.cidrBlock;
      
      case ResourceType.SUBNET:
        return (
          resource1.attributes.cidrBlock === resource2.attributes.cidrBlock &&
          resource1.attributes.vpcId === resource2.attributes.vpcId
        );
      
      case ResourceType.SECURITY_GROUP:
        return (
          resource1.attributes.groupName === resource2.attributes.groupName &&
          resource1.attributes.vpcId === resource2.attributes.vpcId
        );
      
      case ResourceType.EC2_INSTANCE:
        return (
          resource1.attributes.instanceType === resource2.attributes.instanceType &&
          resource1.attributes.subnetId === resource2.attributes.subnetId
        );
      
      default:
        // Generic matching by logical name
        return resource1.logicalName === resource2.logicalName;
    }
  }
  
  /**
   * Compare attributes between two resources
   */
  private compareAttributes(
    expected: NormalizedResource,
    observed: NormalizedResource,
    config: DriftAnalysisConfig
  ): AttributeDiff[] {
    const diffs: AttributeDiff[] = [];
    const ignoreAttrs = new Set(config.ignoreAttributes || []);
    
    // Get all attribute keys
    const allKeys = new Set([
      ...Object.keys(expected.attributes),
      ...Object.keys(observed.attributes),
    ]);
    
    allKeys.forEach((key) => {
      // Skip ignored attributes
      if (ignoreAttrs.has(key)) return;
      
      const expectedValue = expected.attributes[key];
      const observedValue = observed.attributes[key];
      
      // Skip if both undefined
      if (expectedValue === undefined && observedValue === undefined) return;
      
      // Check for differences
      if (!this.valuesEqual(expectedValue, observedValue)) {
        if (expectedValue === undefined) {
          diffs.push({
            path: key,
            expectedValue: null,
            observedValue,
            diffType: 'added',
          });
        } else if (observedValue === undefined) {
          diffs.push({
            path: key,
            expectedValue,
            observedValue: null,
            diffType: 'removed',
          });
        } else {
          diffs.push({
            path: key,
            expectedValue,
            observedValue,
            diffType: 'modified',
          });
        }
      }
    });
    
    return diffs;
  }
  
  /**
   * Compare tags between two resources
   */
  private compareTags(
    expectedTags: Record<string, string>,
    observedTags: Record<string, string>,
    config: DriftAnalysisConfig
  ): AttributeDiff[] {
    const diffs: AttributeDiff[] = [];
    const ignoreTags = new Set(config.ignoreTags || []);
    
    const allKeys = new Set([
      ...Object.keys(expectedTags),
      ...Object.keys(observedTags),
    ]);
    
    allKeys.forEach((key) => {
      if (ignoreTags.has(key)) return;
      
      const expectedValue = expectedTags[key];
      const observedValue = observedTags[key];
      
      if (expectedValue !== observedValue) {
        if (expectedValue === undefined) {
          diffs.push({
            path: `tags.${key}`,
            expectedValue: null,
            observedValue,
            diffType: 'added',
          });
        } else if (observedValue === undefined) {
          diffs.push({
            path: `tags.${key}`,
            expectedValue,
            observedValue: null,
            diffType: 'removed',
          });
        } else {
          diffs.push({
            path: `tags.${key}`,
            expectedValue,
            observedValue,
            diffType: 'modified',
          });
        }
      }
    });
    
    return diffs;
  }
  
  /**
   * Compare security group rules
   */
  private compareSecurityGroupRules(
    expected: NormalizedResource,
    observed: NormalizedResource
  ): AttributeDiff[] {
    const diffs: AttributeDiff[] = [];
    
    // Compare ingress rules
    const ingressDiffs = this.compareRuleSets(
      expected.attributes.ingressRules || [],
      observed.attributes.ingressRules || []
    );
    
    if (ingressDiffs.length > 0) {
      diffs.push({
        path: 'ingressRules',
        expectedValue: expected.attributes.ingressRules,
        observedValue: observed.attributes.ingressRules,
        diffType: 'modified',
      });
    }
    
    // Compare egress rules
    const egressDiffs = this.compareRuleSets(
      expected.attributes.egressRules || [],
      observed.attributes.egressRules || []
    );
    
    if (egressDiffs.length > 0) {
      diffs.push({
        path: 'egressRules',
        expectedValue: expected.attributes.egressRules,
        observedValue: observed.attributes.egressRules,
        diffType: 'modified',
      });
    }
    
    return diffs;
  }
  
  /**
   * Compare two sets of security group rules
   */
  private compareRuleSets(expected: any[], observed: any[]): string[] {
    const diffs: string[] = [];
    
    // Simple comparison - in production, would need more sophisticated rule matching
    if (expected.length !== observed.length) {
      diffs.push('Rule count mismatch');
    }
    
    // Check for missing or extra rules
    // This is simplified - production would need deep rule comparison
    
    return diffs;
  }
  
  /**
   * Check if two values are equal (deep comparison for objects/arrays)
   */
  private valuesEqual(value1: any, value2: any): boolean {
    if (value1 === value2) return true;
    
    if (typeof value1 !== typeof value2) return false;
    
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) return false;
      return value1.every((v, i) => this.valuesEqual(v, value2[i]));
    }
    
    if (typeof value1 === 'object' && value1 !== null && value2 !== null) {
      const keys1 = Object.keys(value1);
      const keys2 = Object.keys(value2);
      
      if (keys1.length !== keys2.length) return false;
      
      return keys1.every((key) => this.valuesEqual(value1[key], value2[key]));
    }
    
    return false;
  }
  
  /**
   * Create a missing resource finding
   */
  private createMissingResourceFinding(
    resource: NormalizedResource,
    missingFrom: 'terraform' | 'aws',
    description: string
  ): DriftFinding {
    return {
      driftId: this.generateDriftId(),
      driftType: DriftType.MISSING,
      severity: Severity.HIGH,
      status: DriftStatus.OPEN,
      resourceType: resource.type,
      provider: resource.provider,
      region: resource.region,
      logicalName: resource.logicalName,
      expected: resource,
      observed: null,
      diffSummary: description,
      attributeDiffs: [],
      detectedAt: new Date().toISOString(),
      scanId: '', // Will be set by caller
    };
  }
  
  /**
   * Create an attribute drift finding
   */
  private createAttributeDriftFinding(
    expected: NormalizedResource,
    observed: NormalizedResource,
    diffs: AttributeDiff[],
    description: string
  ): DriftFinding {
    return {
      driftId: this.generateDriftId(),
      driftType: DriftType.ATTRIBUTE_MISMATCH,
      severity: Severity.MEDIUM,
      status: DriftStatus.OPEN,
      resourceType: expected.type,
      provider: expected.provider,
      region: expected.region,
      logicalName: expected.logicalName,
      expected,
      observed,
      diffSummary: this.generateDiffSummary(diffs),
      attributeDiffs: diffs,
      detectedAt: new Date().toISOString(),
      scanId: '',
    };
  }
  
  /**
   * Create a tag drift finding
   */
  private createTagDriftFinding(
    expected: NormalizedResource,
    observed: NormalizedResource,
    diffs: AttributeDiff[]
  ): DriftFinding {
    return {
      driftId: this.generateDriftId(),
      driftType: DriftType.TAG_MISMATCH,
      severity: Severity.LOW,
      status: DriftStatus.OPEN,
      resourceType: expected.type,
      provider: expected.provider,
      region: expected.region,
      logicalName: expected.logicalName,
      expected,
      observed,
      diffSummary: `Tag mismatch: ${diffs.length} tag(s) differ`,
      attributeDiffs: diffs,
      detectedAt: new Date().toISOString(),
      scanId: '',
    };
  }
  
  /**
   * Create a security group drift finding
   */
  private createSecurityGroupDriftFinding(
    expected: NormalizedResource,
    observed: NormalizedResource,
    diffs: AttributeDiff[]
  ): DriftFinding {
    return {
      driftId: this.generateDriftId(),
      driftType: DriftType.SECURITY_GROUP_MISMATCH,
      severity: Severity.HIGH,
      status: DriftStatus.OPEN,
      resourceType: expected.type,
      provider: expected.provider,
      region: expected.region,
      logicalName: expected.logicalName,
      expected,
      observed,
      diffSummary: 'Security group rules differ from expected configuration',
      attributeDiffs: diffs,
      detectedAt: new Date().toISOString(),
      scanId: '',
    };
  }
  
  /**
   * Create a changed-outside-Terraform finding
   */
  private createChangedOutsideTerraformFinding(
    expected: NormalizedResource,
    observed: NormalizedResource,
    diffs: AttributeDiff[]
  ): DriftFinding {
    return {
      driftId: this.generateDriftId(),
      driftType: DriftType.CHANGED_OUTSIDE_TERRAFORM,
      severity: Severity.HIGH,
      status: DriftStatus.OPEN,
      resourceType: expected.type,
      provider: expected.provider,
      region: expected.region,
      logicalName: expected.logicalName,
      expected,
      observed,
      diffSummary: 'Resource modified outside Terraform',
      attributeDiffs: diffs,
      detectedAt: new Date().toISOString(),
      scanId: '',
    };
  }
  
  /**
   * Create an unmanaged resource finding
   */
  private createUnmanagedResourceFinding(
    resource: NormalizedResource
  ): DriftFinding {
    return {
      driftId: this.generateDriftId(),
      driftType: DriftType.UNMANAGED,
      severity: Severity.MEDIUM,
      status: DriftStatus.OPEN,
      resourceType: resource.type,
      provider: resource.provider,
      region: resource.region,
      logicalName: resource.logicalName,
      expected: null,
      observed: resource,
      diffSummary: 'Resource exists in AWS but not managed by Terraform',
      attributeDiffs: [],
      detectedAt: new Date().toISOString(),
      scanId: '',
    };
  }
  
  /**
   * Generate human-readable diff summary
   */
  private generateDiffSummary(diffs: AttributeDiff[]): string {
    if (diffs.length === 0) return 'No differences';
    
    const summary = diffs
      .slice(0, 3) // Show first 3 diffs
      .map((diff) => {
        switch (diff.diffType) {
          case 'added':
            return `${diff.path} added`;
          case 'removed':
            return `${diff.path} removed`;
          case 'modified':
            return `${diff.path} changed`;
        }
      })
      .join(', ');
    
    if (diffs.length > 3) {
      return `${summary}, and ${diffs.length - 3} more`;
    }
    
    return summary;
  }
  
  /**
   * Generate whitelisted finding for LLM consumption
   * SECURITY CRITICAL: Only include whitelisted fields
   */
  generateWhitelistedFinding(finding: DriftFinding): WhitelistedFinding {
    return {
      findingId: finding.driftId,
      driftType: finding.driftType,
      resourceType: finding.resourceType,
      provider: finding.provider,
      region: finding.region,
      logicalName: finding.logicalName,
      expected: this.extractWhitelistedAttributes(finding.expected),
      observed: this.extractWhitelistedAttributes(finding.observed),
      diffSummary: finding.diffSummary,
    };
  }
  
  /**
   * Extract only whitelisted attributes from a resource
   * SECURITY CRITICAL: Never include ARNs, IDs, secrets
   */
  private extractWhitelistedAttributes(
    resource: NormalizedResource | null
  ): WhitelistedAttributes {
    if (!resource) return {};
    
    const whitelisted: WhitelistedAttributes = {
      type: resource.type,
      region: resource.region,
    };
    
    // Add safe attributes based on resource type
    if (resource.attributes.cidrBlocks) {
      whitelisted.cidrBlocks = resource.attributes.cidrBlocks;
    }
    
    if (resource.attributes.instanceType) {
      whitelisted.instanceType = resource.attributes.instanceType;
    }
    
    if (resource.attributes.availabilityZones) {
      whitelisted.availabilityZones = resource.attributes.availabilityZones;
    }
    
    // Add tag keys only (never values that might contain secrets)
    if (resource.tags) {
      whitelisted.tagKeys = Object.keys(resource.tags);
    }
    
    return whitelisted;
  }
  
  /**
   * Assign default severity based on drift type
   */
  private assignDefaultSeverity(finding: DriftFinding): Severity {
    switch (finding.driftType) {
      case DriftType.SECURITY_GROUP_MISMATCH:
      case DriftType.CHANGED_OUTSIDE_TERRAFORM:
        return Severity.HIGH;
      
      case DriftType.MISSING:
      case DriftType.UNMANAGED:
        return Severity.MEDIUM;
      
      case DriftType.TAG_MISMATCH:
        return Severity.LOW;
      
      default:
        return Severity.MEDIUM;
    }
  }
  
  /**
   * Calculate statistics from findings
   */
  private calculateStatistics(
    input: DriftAnalysisInput,
    findings: DriftFinding[]
  ): DriftStatistics {
    const driftsByType: Record<DriftType, number> = {} as any;
    const driftsBySeverity: Record<Severity, number> = {} as any;
    
    findings.forEach((finding) => {
      driftsByType[finding.driftType] = (driftsByType[finding.driftType] || 0) + 1;
      driftsBySeverity[finding.severity] = (driftsBySeverity[finding.severity] || 0) + 1;
    });
    
    const totalResources = new Set([
      ...input.intentResources.map((r) => r.logicalName),
      ...input.terraformResources.map((r) => r.logicalName),
      ...input.awsResources.map((r) => r.logicalName),
    ]).size;
    
    return {
      totalResourcesAnalyzed: totalResources,
      matchedResources: totalResources - findings.length,
      driftedResources: findings.length,
      unmanagedResources: driftsByType[DriftType.UNMANAGED] || 0,
      missingResources: driftsByType[DriftType.MISSING] || 0,
      driftsByType,
      driftsBySeverity,
    };
  }
  
  /**
   * Calculate compliance score
   * Formula: score = max(0, 100 + Σ(weight per drift))
   */
  private calculateComplianceScore(
    findings: DriftFinding[],
    weights?: Record<Severity, number>
  ): number {
    const defaultWeights = weights || DEFAULT_SEVERITY_WEIGHTS;
    
    const totalPenalty = findings.reduce((sum, finding) => {
      return sum + defaultWeights[finding.severity];
    }, 0);
    
    return Math.max(0, Math.min(100, 100 + totalPenalty));
  }
  
  /**
   * Generate unique drift ID
   */
  private generateDriftId(): string {
    return `drift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## Error Handling

### Error Types

```typescript
- ValidationError: Invalid input data
- AgentError: General analysis failures
```

### Error Handling Strategy

1. **Invalid Input**: Validate resource arrays before analysis
2. **Comparison Failures**: Log and continue with other resources
3. **Index Failures**: Fail fast if indexes cannot be built

---

## Testing Strategy

### Unit Tests

```typescript
describe('DriftAnalysisAgent', () => {
  describe('compareIntentVsTerraform', () => {
    it('should detect missing resources', () => {
      // Test missing resource detection
    });
    
    it('should detect attribute mismatches', () => {
      // Test attribute comparison
    });
    
    it('should detect tag mismatches', () => {
      // Test tag comparison
    });
  });
  
  describe('compareTerraformVsAWS', () => {
    it('should detect resources changed outside Terraform', () => {
      // Test drift detection
    });
  });
  
  describe('detectUnmanagedResources', () => {
    it('should detect unmanaged AWS resources', () => {
      // Test unmanaged detection
    });
  });
  
  describe('generateWhitelistedFinding', () => {
    it('should only include whitelisted fields', () => {
      // Test whitelist enforcement
    });
    
    it('should never include ARNs or account IDs', () => {
      // Test security
    });
  });
  
  describe('calculateComplianceScore', () => {
    it('should calculate score correctly', () => {
      // Test score calculation
    });
    
    it('should clamp score to 0-100', () => {
      // Test clamping
    });
  });
});
```

---

## Usage Example

```typescript
import { DriftAnalysisAgent } from './agents/drift-analysis-agent';

// Initialize agent
const agent = new DriftAnalysisAgent({
  deepCompare: true,
  detectUnmanaged: true,
  ignoreAttributes: ['lastModified', 'createdAt'],
  ignoreTags: ['LastScanned'],
});

// Analyze drift
const result = await agent.analyzeDrift({
  intentResources,
  terraformResources,
  awsResources,
  config: agent.config,
});

if (result.success) {
  const { findings, statistics, complianceScore } = result.data;
  
  console.log(`Compliance Score: ${complianceScore}/100`);
  console.log(`Total Drifts: ${findings.length}`);
  console.log(`Unmanaged Resources: ${statistics.unmanagedResources}`);
  
  // Generate whitelisted findings for LLM
  const whitelistedFindings = findings.map((f) =>
    agent.generateWhitelistedFinding(f)
  );
}
```

---

## Dependencies

### Internal Dependencies

- `shared-types.md`: All type definitions

---

## Security Considerations

1. **Whitelist Enforcement**: Only whitelisted fields sent to LLM
2. **No Raw Data**: Never expose raw Terraform state or AWS responses
3. **Redacted Diffs**: Diff summaries are pre-computed and redacted

---

## Future Enhancements

1. **Machine Learning**: Learn from historical drift patterns
2. **Custom Rules**: User-defined drift detection rules
3. **Drift Prediction**: Predict likely drift based on patterns
4. **Auto-Remediation**: Generate Terraform code to fix drift
5. **Drift Trends**: Track drift over time