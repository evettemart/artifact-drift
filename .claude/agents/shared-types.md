# Shared Types and Interfaces

## Overview
This document defines all shared TypeScript interfaces, types, enums, and utility functions used across all agents in the Architecture Drift Copilot system.

## Core Data Models

### NormalizedResource

The canonical internal representation of any infrastructure resource, regardless of source.

```typescript
interface NormalizedResource {
  /** Unique identifier within the system */
  id: string;
  
  /** Human-readable logical name (not ARN/physical ID) */
  logicalName: string;
  
  /** Resource type (e.g., 'vpc', 'ec2_instance', 'security_group') */
  type: ResourceType;
  
  /** Cloud provider */
  provider: Provider;
  
  /** AWS region or equivalent */
  region: string;
  
  /** Source of this resource definition */
  source: ResourceSource;
  
  /** Non-sensitive resource attributes */
  attributes: Record<string, any>;
  
  /** Resource tags (values may be redacted if sensitive) */
  tags: Record<string, string>;
  
  /** Relationships to other resources */
  relationships: ResourceRelationship[];
  
  /** Flag indicating if sensitive data was redacted */
  sensitiveRedacted: boolean;
  
  /** Original source metadata for traceability */
  metadata: ResourceMetadata;
}

interface ResourceMetadata {
  /** Timestamp when resource was captured */
  capturedAt: string;
  
  /** Source file path or API endpoint */
  sourceLocation: string;
  
  /** Checksum of source data */
  sourceChecksum?: string;
  
  /** Additional provider-specific metadata */
  providerMetadata?: Record<string, any>;
}

interface ResourceRelationship {
  /** Type of relationship */
  type: RelationshipType;
  
  /** Target resource logical name */
  targetLogicalName: string;
  
  /** Target resource type */
  targetType: ResourceType;
  
  /** Optional relationship metadata */
  metadata?: Record<string, any>;
}
```

### DriftFinding

Represents a detected drift between expected and observed infrastructure state.

```typescript
interface DriftFinding {
  /** Unique identifier for this finding */
  driftId: string;
  
  /** Type of drift detected */
  driftType: DriftType;
  
  /** Severity level (assigned by ReasoningAgent or default) */
  severity: Severity;
  
  /** Current status of the drift */
  status: DriftStatus;
  
  /** Resource type affected */
  resourceType: ResourceType;
  
  /** Cloud provider */
  provider: Provider;
  
  /** Region where drift was detected */
  region: string;
  
  /** Logical name of the affected resource */
  logicalName: string;
  
  /** Expected state (from architecture intent) */
  expected: Partial<NormalizedResource> | null;
  
  /** Observed state (from Terraform or AWS) */
  observed: Partial<NormalizedResource> | null;
  
  /** Human-readable diff summary (pre-computed, redacted) */
  diffSummary: string;
  
  /** Detailed attribute-level differences */
  attributeDiffs: AttributeDiff[];
  
  /** Timestamp when drift was detected */
  detectedAt: string;
  
  /** Scan ID that detected this drift */
  scanId: string;
  
  /** Reasoning result from LLM or deterministic fallback */
  reasoning?: ReasoningResult;
}

interface AttributeDiff {
  /** Attribute path (e.g., 'tags.Environment') */
  path: string;
  
  /** Expected value (redacted if sensitive) */
  expectedValue: any;
  
  /** Observed value (redacted if sensitive) */
  observedValue: any;
  
  /** Type of difference */
  diffType: 'added' | 'removed' | 'modified';
}
```

### WhitelistedFinding

**SECURITY CRITICAL**: The ONLY data structure that may be sent to the LLM. This is a strict whitelist, not a blocklist.

```typescript
interface WhitelistedFinding {
  /** Finding identifier */
  findingId: string;
  
  /** Type of drift */
  driftType: DriftType;
  
  /** Resource type */
  resourceType: ResourceType;
  
  /** Cloud provider */
  provider: Provider;
  
  /** Region */
  region: string;
  
  /** Logical name only (never ARN, physical ID, or account ID) */
  logicalName: string;
  
  /** Whitelisted expected attributes only */
  expected: WhitelistedAttributes;
  
  /** Whitelisted observed attributes only */
  observed: WhitelistedAttributes;
  
  /** Pre-computed, redacted diff summary */
  diffSummary: string;
}

interface WhitelistedAttributes {
  /** Resource type */
  type?: string;
  
  /** Region */
  region?: string;
  
  /** CIDR blocks (safe to share) */
  cidrBlocks?: string[];
  
  /** Port ranges (safe to share) */
  ports?: number[];
  
  /** Protocol (safe to share) */
  protocol?: string;
  
  /** Instance type/size (safe to share) */
  instanceType?: string;
  
  /** Availability zones (safe to share) */
  availabilityZones?: string[];
  
  /** Tag keys only (never values that might contain secrets) */
  tagKeys?: string[];
  
  /** Count of resources */
  count?: number;
  
  /** Boolean flags */
  flags?: Record<string, boolean>;
  
  /** NO raw ARNs, IDs, secrets, credentials, or connection strings */
}
```

### ReasoningResult

Output from the ReasoningAgent (LLM or deterministic fallback).

```typescript
interface ReasoningResult {
  /** Plain-English explanation of the drift */
  summary: string;
  
  /** Assigned severity level */
  severity: Severity;
  
  /** Likely root cause */
  likelyCause: string;
  
  /** Recommended action */
  recommendedAction: string;
  
  /** Terraform-focused remediation steps */
  terraformRemediation: string;
  
  /** Business impact assessment */
  businessImpact: string;
  
  /** Whether this was generated by LLM or fallback */
  generatedBy: 'llm' | 'deterministic';
  
  /** Timestamp of reasoning */
  reasonedAt: string;
  
  /** Confidence score (0-1, only for LLM) */
  confidence?: number;
}
```

### ScanResult

Represents the outcome of a complete drift analysis scan.

```typescript
interface ScanResult {
  /** Unique scan identifier */
  scanId: string;
  
  /** Project identifier */
  projectId: string;
  
  /** Scan start timestamp */
  startedAt: string;
  
  /** Scan completion timestamp */
  completedAt: string;
  
  /** Scan duration in milliseconds */
  durationMs: number;
  
  /** Overall compliance score (0-100) */
  complianceScore: number;
  
  /** All detected drifts */
  findings: DriftFinding[];
  
  /** Summary statistics */
  statistics: ScanStatistics;
  
  /** Input source metadata */
  sources: SourceMetadata;
  
  /** Scan configuration */
  config: ScanConfig;
}

interface ScanStatistics {
  /** Total resources analyzed */
  totalResources: number;
  
  /** Resources matching expected state */
  matchedResources: number;
  
  /** Resources with drift */
  driftedResources: number;
  
  /** Unmanaged resources (in AWS, not in Terraform) */
  unmanagedResources: number;
  
  /** Missing resources (in intent/Terraform, not in AWS) */
  missingResources: number;
  
  /** Drift count by severity */
  driftsBySeverity: Record<Severity, number>;
  
  /** Drift count by type */
  driftsByType: Record<DriftType, number>;
}

interface SourceMetadata {
  /** Architecture intent source */
  architectureIntent: {
    filePath: string;
    checksum: string;
    lastModified: string;
  };
  
  /** Terraform state source */
  terraformState: {
    filePath: string;
    checksum: string;
    lastModified: string;
    terraformVersion?: string;
  };
  
  /** AWS inventory source */
  awsInventory: {
    source: 'live' | 'mock';
    regions: string[];
    capturedAt: string;
  };
}

interface ScanConfig {
  /** Severity weights for score calculation */
  severityWeights: Record<Severity, number>;
  
  /** Regions to scan */
  regions: string[];
  
  /** Resource types to include */
  resourceTypes?: ResourceType[];
  
  /** Whether to use LLM reasoning */
  enableLLMReasoning: boolean;
}
```

## Enums and Constants

### ResourceType

```typescript
enum ResourceType {
  VPC = 'vpc',
  SUBNET = 'subnet',
  SECURITY_GROUP = 'security_group',
  EC2_INSTANCE = 'ec2_instance',
  ALB = 'application_load_balancer',
  TARGET_GROUP = 'target_group',
  LISTENER = 'listener',
  ROUTE_TABLE = 'route_table',
  INTERNET_GATEWAY = 'internet_gateway',
  NAT_GATEWAY = 'nat_gateway',
  EIP = 'elastic_ip',
  IAM_ROLE = 'iam_role',
  IAM_POLICY = 'iam_policy',
  S3_BUCKET = 's3_bucket',
  RDS_INSTANCE = 'rds_instance',
  LAMBDA_FUNCTION = 'lambda_function',
}
```

### Provider

```typescript
enum Provider {
  AWS = 'aws',
  // Future: GCP = 'gcp', AZURE = 'azure'
}
```

### ResourceSource

```typescript
enum ResourceSource {
  INTENT = 'intent',
  TERRAFORM = 'terraform',
  AWS = 'aws',
}
```

### DriftType

```typescript
enum DriftType {
  /** Resource defined in intent/Terraform but missing in Terraform/AWS */
  MISSING = 'missing',
  
  /** Resource exists but not defined in intent/Terraform */
  UNEXPECTED = 'unexpected',
  
  /** Resource in AWS but not managed by Terraform */
  UNMANAGED = 'unmanaged',
  
  /** Terraform-managed resource changed outside Terraform */
  CHANGED_OUTSIDE_TERRAFORM = 'changed_outside_terraform',
  
  /** Resource attributes don't match expected values */
  ATTRIBUTE_MISMATCH = 'attribute',
  
  /** Tag mismatch */
  TAG_MISMATCH = 'tag',
  
  /** Security group rule mismatch */
  SECURITY_GROUP_MISMATCH = 'security_group',
  
  /** Region mismatch */
  REGION_MISMATCH = 'region',
  
  /** Resource exists but doesn't match approved design */
  DESIGN_MISMATCH = 'design',
  
  /** Relationship/edge mismatch */
  EDGE_MISMATCH = 'edge',
  
  /** Other drift types */
  OTHER = 'other',
}
```

### Severity

```typescript
enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

/** Default severity weights for score calculation */
const DEFAULT_SEVERITY_WEIGHTS: Record<Severity, number> = {
  [Severity.CRITICAL]: -25,
  [Severity.HIGH]: -10,
  [Severity.MEDIUM]: -4,
  [Severity.LOW]: -1,
  [Severity.INFO]: 0,
};
```

### DriftStatus

```typescript
enum DriftStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}
```

### RelationshipType

```typescript
enum RelationshipType {
  CONTAINS = 'contains',
  ATTACHED_TO = 'attached_to',
  ROUTES_TO = 'routes_to',
  DEPENDS_ON = 'depends_on',
  MEMBER_OF = 'member_of',
  TARGETS = 'targets',
}
```

## Utility Types

### Result Type (for error handling)

```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

### Validation Schemas

```typescript
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

## Security Utilities

### Sensitive Pattern Detection

```typescript
/** Patterns that indicate sensitive data */
const SENSITIVE_PATTERNS = {
  AWS_ACCESS_KEY: /AKIA[0-9A-Z]{16}/,
  AWS_SECRET_KEY: /[A-Za-z0-9/+=]{40}/,
  PRIVATE_KEY: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  PASSWORD: /password|passwd|pwd/i,
  TOKEN: /token|bearer|jwt/i,
  CONNECTION_STRING: /mongodb:\/\/|postgresql:\/\/|mysql:\/\//i,
  API_KEY: /api[_-]?key/i,
};

/** Fields that should always be redacted */
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'privateKey',
  'connectionString',
  'credentials',
  'accessKey',
  'secretKey',
];
```

### Redaction Function Signature

```typescript
/**
 * Redacts sensitive values from an object
 * @param obj - Object to redact
 * @param patterns - Additional patterns to check
 * @returns Redacted object with sensitiveRedacted flag
 */
function redactSensitiveData(
  obj: Record<string, any>,
  patterns?: RegExp[]
): { data: Record<string, any>; redacted: boolean };
```

## Score Calculation

```typescript
/**
 * Calculate compliance score based on drift findings
 * Formula: score = max(0, 100 + Σ(weight per drift))
 * Clamped to 0-100 range
 */
function calculateComplianceScore(
  findings: DriftFinding[],
  weights: Record<Severity, number> = DEFAULT_SEVERITY_WEIGHTS
): number {
  const totalPenalty = findings.reduce((sum, finding) => {
    return sum + weights[finding.severity];
  }, 0);
  
  return Math.max(0, Math.min(100, 100 + totalPenalty));
}
```

## Graph Model

```typescript
interface GraphNode {
  id: string;
  logicalName: string;
  type: ResourceType;
  source: ResourceSource;
  hasDrift: boolean;
  driftSeverity?: Severity;
  position?: { x: number; y: number };
  metadata: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string;
}

interface GraphModel {
  scanId: string;
  source: ResourceSource;
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: string;
}
```

## Error Types

```typescript
class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

class ValidationError extends AgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class ParseError extends AgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

class SecurityError extends AgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SECURITY_ERROR', details);
    this.name = 'SecurityError';
  }
}

class IntegrationError extends AgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INTEGRATION_ERROR', details);
    this.name = 'IntegrationError';
  }
}
```

## Type Guards

```typescript
function isNormalizedResource(obj: any): obj is NormalizedResource {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.logicalName === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.provider === 'string' &&
    typeof obj.source === 'string'
  );
}

function isDriftFinding(obj: any): obj is DriftFinding {
  return (
    typeof obj === 'object' &&
    typeof obj.driftId === 'string' &&
    typeof obj.driftType === 'string' &&
    typeof obj.severity === 'string'
  );
}

function isWhitelistedFinding(obj: any): obj is WhitelistedFinding {
  const allowedKeys = [
    'findingId',
    'driftType',
    'resourceType',
    'provider',
    'region',
    'logicalName',
    'expected',
    'observed',
    'diffSummary',
  ];
  
  return (
    typeof obj === 'object' &&
    Object.keys(obj).every(key => allowedKeys.includes(key)) &&
    typeof obj.findingId === 'string' &&
    typeof obj.logicalName === 'string'
  );
}
```

## Constants

```typescript
/** Maximum number of resources to process in a single batch */
const MAX_BATCH_SIZE = 100;

/** Timeout for external API calls (ms) */
const API_TIMEOUT_MS = 30000;

/** Maximum retries for transient failures */
const MAX_RETRIES = 3;

/** Supported AWS regions */
const SUPPORTED_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
];
```

## Usage Notes

1. **Type Safety**: All agents must use these shared types for interoperability
2. **Security**: Never extend WhitelistedFinding without security review
3. **Validation**: Always validate external data against these schemas
4. **Immutability**: Treat all data structures as immutable; create new objects for modifications
5. **Error Handling**: Use Result type for operations that may fail
6. **Redaction**: Apply redaction at ingestion time, never after