export enum ResourceType {
  VPC = 'vpc',
  SUBNET = 'subnet',
  SECURITY_GROUP = 'security_group',
  EC2_INSTANCE = 'ec2_instance',
  ALB = 'alb',
  APPLICATION_LOAD_BALANCER = 'application_load_balancer',
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
  PROVIDER = 'provider',
}

export enum Provider {
  AWS = 'aws',
}

export enum ResourceSource {
  INTENT = 'intent',
  TERRAFORM = 'terraform',
  AWS = 'aws',
}

export enum DriftType {
  MISSING = 'missing',
  UNEXPECTED = 'unexpected',
  UNMANAGED = 'unmanaged',
  CHANGED_OUTSIDE_TERRAFORM = 'changed_outside_terraform',
  ATTRIBUTE_MISMATCH = 'attribute',
  ATTRIBUTE_MISMATCH_LEGACY = 'attribute_mismatch',
  TAG_MISMATCH = 'tag',
  TAG_MISMATCH_LEGACY = 'tag_mismatch',
  SECURITY_GROUP_MISMATCH = 'security_group',
  REGION_MISMATCH = 'region',
  DESIGN_MISMATCH = 'design',
  EDGE_MISMATCH = 'edge',
  CONFIGURATION_DRIFT = 'configuration_drift',
  RELATIONSHIP_BROKEN = 'relationship_broken',
  VERSION_MISMATCH = 'version_mismatch',
  OTHER = 'other',
}

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum DriftStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export enum RelationshipType {
  CONTAINS = 'contains',
  ATTACHED_TO = 'attached_to',
  ROUTES_TO = 'routes_to',
  DEPENDS_ON = 'depends_on',
  MEMBER_OF = 'member_of',
  TARGETS = 'targets',
}

export const DEFAULT_SEVERITY_WEIGHTS: Record<Severity, number> = {
  [Severity.CRITICAL]: -25,
  [Severity.HIGH]: -10,
  [Severity.MEDIUM]: -4,
  [Severity.LOW]: -1,
  [Severity.INFO]: 0,
};

export const MAX_BATCH_SIZE = 100;
export const API_TIMEOUT_MS = 30000;
export const MAX_RETRIES = 3;

export const SUPPORTED_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
] as const;

export const SENSITIVE_PATTERNS = {
  AWS_ACCESS_KEY: /AKIA[0-9A-Z]{16}/,
  AWS_SECRET_KEY: /[A-Za-z0-9/+=]{40}/,
  PRIVATE_KEY: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  PASSWORD: /password|passwd|pwd/i,
  TOKEN: /token|bearer|jwt/i,
  CONNECTION_STRING: /mongodb:\/\/|postgresql:\/\/|mysql:\/\//i,
  API_KEY: /api[_-]?key/i,
};

export const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'privateKey',
  'connectionString',
  'credentials',
  'accessKey',
  'secretKey',
] as const;

export interface ResourceMetadata {
  capturedAt: string;
  sourceLocation: string;
  sourceChecksum?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface ResourceRelationship {
  type: RelationshipType;
  targetLogicalName: string;
  targetType: ResourceType;
  metadata?: Record<string, unknown>;
}

export interface NormalizedResource {
  id: string;
  logicalName: string;
  type: ResourceType;
  provider: Provider;
  region: string;
  source: ResourceSource;
  attributes: Record<string, unknown>;
  tags: Record<string, string>;
  relationships: ResourceRelationship[];
  sensitiveRedacted: boolean;
  metadata: ResourceMetadata;
}

export interface AttributeDiff {
  path: string;
  expectedValue: unknown;
  observedValue: unknown;
  diffType: 'added' | 'removed' | 'modified';
}

export interface WhitelistedAttributes {
  type?: string;
  region?: string;
  cidrBlocks?: string[];
  ports?: number[];
  protocol?: string;
  instanceType?: string;
  availabilityZones?: string[];
  tagKeys?: string[];
  count?: number;
  flags?: Record<string, boolean>;
}

export interface WhitelistedFinding {
  findingId: string;
  driftType: DriftType | string;
  resourceType: ResourceType | string;
  provider: Provider | string;
  region: string;
  logicalName: string;
  expected: WhitelistedAttributes;
  observed: WhitelistedAttributes;
  diffSummary: string;
}

export interface ReasoningResult {
  summary: string;
  severity?: Severity;
  likelyCause: string;
  recommendedAction?: string;
  terraformRemediation: string;
  businessImpact?: string;
  impact?: string;
  generatedBy: 'llm' | 'deterministic';
  reasonedAt?: string;
  confidence?: number;
}

export interface DriftFinding {
  driftId: string;
  driftType: DriftType | string;
  severity: Severity;
  status: DriftStatus;
  resourceType: ResourceType | string;
  provider: Provider | string;
  region: string;
  logicalName: string;
  expected?: Partial<NormalizedResource> | null;
  observed?: Partial<NormalizedResource> | null;
  diffSummary: string;
  attributeDiffs?: AttributeDiff[];
  detectedAt: string;
  scanId?: string;
  reasoning?: ReasoningResult;
}

export interface ScanStatistics {
  totalResources?: number;
  matchedResources?: number;
  driftedResources?: number;
  unmanagedResources?: number;
  missingResources?: number;
  driftsBySeverity?: Record<string, number>;
  driftsByType?: Record<string, number>;
  totalFindings?: number;
  bySeverity?: Record<string, number>;
  byType?: Record<string, number>;
  byStatus?: Record<string, number>;
}

export interface SourceMetadata {
  architectureIntent?: {
    filePath: string;
    checksum: string;
    lastModified: string;
  };
  terraformState?: {
    filePath: string;
    checksum: string;
    lastModified: string;
    terraformVersion?: string;
  };
  awsInventory?: {
    source: 'live' | 'mock';
    regions: string[];
    capturedAt: string;
  };
  intent?: {
    type: string;
    path: string;
    resourceCount: number;
  };
  terraform?: {
    type: string;
    path: string;
    resourceCount: number;
    version?: string;
  };
  aws?: {
    type: string;
    path: string;
    resourceCount: number;
    region?: string;
  };
}

export interface ScanConfig {
  severityWeights?: Record<string, number>;
  regions: string[];
  resourceTypes?: ResourceType[];
  enableLLMReasoning: boolean;
  detectUnmanaged?: boolean;
}

export interface ScanResult {
  scanId: string;
  projectId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  complianceScore: number;
  findings?: DriftFinding[];
  statistics: ScanStatistics;
  sources: SourceMetadata;
  config: ScanConfig;
  status?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface GraphNode {
  id: string;
  logicalName: string;
  type: ResourceType;
  source: ResourceSource;
  hasDrift: boolean;
  driftSeverity?: Severity;
  position?: { x: number; y: number };
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string;
}

export interface GraphModel {
  scanId: string;
  source: ResourceSource;
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: string;
}

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class SharedValidationError extends AgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'SharedValidationError';
  }
}

export class ParseError extends AgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

export class SecurityError extends AgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', details);
    this.name = 'SecurityError';
  }
}

export class IntegrationError extends AgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INTEGRATION_ERROR', details);
    this.name = 'IntegrationError';
  }
}

export function calculateComplianceScore(
  findings: DriftFinding[],
  weights: Record<Severity, number> = DEFAULT_SEVERITY_WEIGHTS
): number {
  // Backward compatibility: default backend weights are negative penalties.
  // We normalize by absolute value so custom positive penalty maps also work.
  const totalPenalty = findings.reduce((sum, finding) => {
    return sum + Math.abs(weights[finding.severity] ?? 0);
  }, 0);

  const decayFactor = 100;
  const normalized = 100 * Math.exp(-totalPenalty / decayFactor);
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

export function isNormalizedResource(obj: unknown): obj is NormalizedResource {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.logicalName === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.provider === 'string' &&
    typeof candidate.source === 'string'
  );
}

export function isDriftFinding(obj: unknown): obj is DriftFinding {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.driftId === 'string' &&
    typeof candidate.driftType === 'string' &&
    typeof candidate.severity === 'string'
  );
}

export function isWhitelistedFinding(obj: unknown): obj is WhitelistedFinding {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;
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
    Object.keys(candidate).every((key) => allowedKeys.includes(key)) &&
    typeof candidate.findingId === 'string' &&
    typeof candidate.logicalName === 'string'
  );
}

export function redactSensitiveData(
  obj: Record<string, unknown>,
  patterns: RegExp[] = []
): { data: Record<string, unknown>; redacted: boolean } {
  let redacted = false;
  const allPatterns = [...Object.values(SENSITIVE_PATTERNS), ...patterns];

  const redactValue = (value: unknown, key?: string): unknown => {
    if (key && SENSITIVE_FIELDS.includes(key as (typeof SENSITIVE_FIELDS)[number])) {
      redacted = true;
      return '[REDACTED]';
    }

    if (typeof value === 'string') {
      const isSensitive = allPatterns.some((pattern) => pattern.test(value));
      if (isSensitive) {
        redacted = true;
        return '[REDACTED]';
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item));
    }

    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [
          nestedKey,
          redactValue(nestedValue, nestedKey),
        ])
      );
    }

    return value;
  };

  return {
    data: Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, redactValue(value, key)])
    ),
    redacted,
  };
}

// Made with Bob