export declare enum ResourceType {
    VPC = "vpc",
    SUBNET = "subnet",
    SECURITY_GROUP = "security_group",
    EC2_INSTANCE = "ec2_instance",
    ALB = "alb",
    APPLICATION_LOAD_BALANCER = "application_load_balancer",
    TARGET_GROUP = "target_group",
    LISTENER = "listener",
    ROUTE_TABLE = "route_table",
    INTERNET_GATEWAY = "internet_gateway",
    NAT_GATEWAY = "nat_gateway",
    EIP = "elastic_ip",
    IAM_ROLE = "iam_role",
    IAM_POLICY = "iam_policy",
    S3_BUCKET = "s3_bucket",
    RDS_INSTANCE = "rds_instance",
    LAMBDA_FUNCTION = "lambda_function",
    PROVIDER = "provider"
}
export declare enum Provider {
    AWS = "aws"
}
export declare enum ResourceSource {
    INTENT = "intent",
    TERRAFORM = "terraform",
    AWS = "aws"
}
export declare enum DriftType {
    MISSING = "missing",
    UNEXPECTED = "unexpected",
    UNMANAGED = "unmanaged",
    CHANGED_OUTSIDE_TERRAFORM = "changed_outside_terraform",
    ATTRIBUTE_MISMATCH = "attribute",
    ATTRIBUTE_MISMATCH_LEGACY = "attribute_mismatch",
    TAG_MISMATCH = "tag",
    TAG_MISMATCH_LEGACY = "tag_mismatch",
    SECURITY_GROUP_MISMATCH = "security_group",
    REGION_MISMATCH = "region",
    DESIGN_MISMATCH = "design",
    EDGE_MISMATCH = "edge",
    CONFIGURATION_DRIFT = "configuration_drift",
    RELATIONSHIP_BROKEN = "relationship_broken",
    VERSION_MISMATCH = "version_mismatch",
    OTHER = "other"
}
export declare enum Severity {
    CRITICAL = "critical",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low",
    INFO = "info"
}
export declare enum DriftStatus {
    OPEN = "open",
    ACKNOWLEDGED = "acknowledged",
    RESOLVED = "resolved",
    SUPPRESSED = "suppressed"
}
export declare enum RelationshipType {
    CONTAINS = "contains",
    ATTACHED_TO = "attached_to",
    ROUTES_TO = "routes_to",
    DEPENDS_ON = "depends_on",
    MEMBER_OF = "member_of",
    TARGETS = "targets"
}
export declare const DEFAULT_SEVERITY_WEIGHTS: Record<Severity, number>;
export declare const MAX_BATCH_SIZE = 100;
export declare const API_TIMEOUT_MS = 30000;
export declare const MAX_RETRIES = 3;
export declare const SUPPORTED_REGIONS: readonly ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-northeast-1"];
export declare const SENSITIVE_PATTERNS: {
    AWS_ACCESS_KEY: RegExp;
    AWS_SECRET_KEY: RegExp;
    PRIVATE_KEY: RegExp;
    PASSWORD: RegExp;
    TOKEN: RegExp;
    CONNECTION_STRING: RegExp;
    API_KEY: RegExp;
};
export declare const SENSITIVE_FIELDS: readonly ["password", "secret", "token", "apiKey", "privateKey", "connectionString", "credentials", "accessKey", "secretKey"];
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
export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};
export interface GraphNode {
    id: string;
    logicalName: string;
    type: ResourceType;
    source: ResourceSource;
    hasDrift: boolean;
    driftSeverity?: Severity;
    position?: {
        x: number;
        y: number;
    };
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
export declare class AgentError extends Error {
    code: string;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
export declare class SharedValidationError extends AgentError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ParseError extends AgentError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class SecurityError extends AgentError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class IntegrationError extends AgentError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare function calculateComplianceScore(findings: DriftFinding[], weights?: Record<Severity, number>): number;
export declare function isNormalizedResource(obj: unknown): obj is NormalizedResource;
export declare function isDriftFinding(obj: unknown): obj is DriftFinding;
export declare function isWhitelistedFinding(obj: unknown): obj is WhitelistedFinding;
export declare function redactSensitiveData(obj: Record<string, unknown>, patterns?: RegExp[]): {
    data: Record<string, unknown>;
    redacted: boolean;
};
//# sourceMappingURL=shared.d.ts.map