"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationError = exports.SecurityError = exports.ParseError = exports.SharedValidationError = exports.AgentError = exports.SENSITIVE_FIELDS = exports.SENSITIVE_PATTERNS = exports.SUPPORTED_REGIONS = exports.MAX_RETRIES = exports.API_TIMEOUT_MS = exports.MAX_BATCH_SIZE = exports.DEFAULT_SEVERITY_WEIGHTS = exports.RelationshipType = exports.DriftStatus = exports.Severity = exports.DriftType = exports.ResourceSource = exports.Provider = exports.ResourceType = void 0;
exports.calculateComplianceScore = calculateComplianceScore;
exports.isNormalizedResource = isNormalizedResource;
exports.isDriftFinding = isDriftFinding;
exports.isWhitelistedFinding = isWhitelistedFinding;
exports.redactSensitiveData = redactSensitiveData;
var ResourceType;
(function (ResourceType) {
    ResourceType["VPC"] = "vpc";
    ResourceType["SUBNET"] = "subnet";
    ResourceType["SECURITY_GROUP"] = "security_group";
    ResourceType["EC2_INSTANCE"] = "ec2_instance";
    ResourceType["ALB"] = "alb";
    ResourceType["APPLICATION_LOAD_BALANCER"] = "application_load_balancer";
    ResourceType["TARGET_GROUP"] = "target_group";
    ResourceType["LISTENER"] = "listener";
    ResourceType["ROUTE_TABLE"] = "route_table";
    ResourceType["INTERNET_GATEWAY"] = "internet_gateway";
    ResourceType["NAT_GATEWAY"] = "nat_gateway";
    ResourceType["EIP"] = "elastic_ip";
    ResourceType["IAM_ROLE"] = "iam_role";
    ResourceType["IAM_POLICY"] = "iam_policy";
    ResourceType["S3_BUCKET"] = "s3_bucket";
    ResourceType["RDS_INSTANCE"] = "rds_instance";
    ResourceType["LAMBDA_FUNCTION"] = "lambda_function";
    ResourceType["PROVIDER"] = "provider";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
var Provider;
(function (Provider) {
    Provider["AWS"] = "aws";
})(Provider || (exports.Provider = Provider = {}));
var ResourceSource;
(function (ResourceSource) {
    ResourceSource["INTENT"] = "intent";
    ResourceSource["TERRAFORM"] = "terraform";
    ResourceSource["AWS"] = "aws";
})(ResourceSource || (exports.ResourceSource = ResourceSource = {}));
var DriftType;
(function (DriftType) {
    DriftType["MISSING"] = "missing";
    DriftType["UNEXPECTED"] = "unexpected";
    DriftType["UNMANAGED"] = "unmanaged";
    DriftType["CHANGED_OUTSIDE_TERRAFORM"] = "changed_outside_terraform";
    DriftType["ATTRIBUTE_MISMATCH"] = "attribute";
    DriftType["ATTRIBUTE_MISMATCH_LEGACY"] = "attribute_mismatch";
    DriftType["TAG_MISMATCH"] = "tag";
    DriftType["TAG_MISMATCH_LEGACY"] = "tag_mismatch";
    DriftType["SECURITY_GROUP_MISMATCH"] = "security_group";
    DriftType["REGION_MISMATCH"] = "region";
    DriftType["DESIGN_MISMATCH"] = "design";
    DriftType["EDGE_MISMATCH"] = "edge";
    DriftType["CONFIGURATION_DRIFT"] = "configuration_drift";
    DriftType["RELATIONSHIP_BROKEN"] = "relationship_broken";
    DriftType["VERSION_MISMATCH"] = "version_mismatch";
    DriftType["OTHER"] = "other";
})(DriftType || (exports.DriftType = DriftType = {}));
var Severity;
(function (Severity) {
    Severity["CRITICAL"] = "critical";
    Severity["HIGH"] = "high";
    Severity["MEDIUM"] = "medium";
    Severity["LOW"] = "low";
    Severity["INFO"] = "info";
})(Severity || (exports.Severity = Severity = {}));
var DriftStatus;
(function (DriftStatus) {
    DriftStatus["OPEN"] = "open";
    DriftStatus["ACKNOWLEDGED"] = "acknowledged";
    DriftStatus["RESOLVED"] = "resolved";
    DriftStatus["SUPPRESSED"] = "suppressed";
})(DriftStatus || (exports.DriftStatus = DriftStatus = {}));
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["CONTAINS"] = "contains";
    RelationshipType["ATTACHED_TO"] = "attached_to";
    RelationshipType["ROUTES_TO"] = "routes_to";
    RelationshipType["DEPENDS_ON"] = "depends_on";
    RelationshipType["MEMBER_OF"] = "member_of";
    RelationshipType["TARGETS"] = "targets";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
exports.DEFAULT_SEVERITY_WEIGHTS = {
    [Severity.CRITICAL]: -25,
    [Severity.HIGH]: -10,
    [Severity.MEDIUM]: -4,
    [Severity.LOW]: -1,
    [Severity.INFO]: 0,
};
exports.MAX_BATCH_SIZE = 100;
exports.API_TIMEOUT_MS = 30000;
exports.MAX_RETRIES = 3;
exports.SUPPORTED_REGIONS = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-central-1',
    'ap-southeast-1',
    'ap-northeast-1',
];
exports.SENSITIVE_PATTERNS = {
    AWS_ACCESS_KEY: /AKIA[0-9A-Z]{16}/,
    AWS_SECRET_KEY: /[A-Za-z0-9/+=]{40}/,
    PRIVATE_KEY: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
    PASSWORD: /password|passwd|pwd/i,
    TOKEN: /token|bearer|jwt/i,
    CONNECTION_STRING: /mongodb:\/\/|postgresql:\/\/|mysql:\/\//i,
    API_KEY: /api[_-]?key/i,
};
exports.SENSITIVE_FIELDS = [
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
class AgentError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AgentError';
    }
}
exports.AgentError = AgentError;
class SharedValidationError extends AgentError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'SharedValidationError';
    }
}
exports.SharedValidationError = SharedValidationError;
class ParseError extends AgentError {
    constructor(message, details) {
        super(message, 'PARSE_ERROR', details);
        this.name = 'ParseError';
    }
}
exports.ParseError = ParseError;
class SecurityError extends AgentError {
    constructor(message, details) {
        super(message, 'SECURITY_ERROR', details);
        this.name = 'SecurityError';
    }
}
exports.SecurityError = SecurityError;
class IntegrationError extends AgentError {
    constructor(message, details) {
        super(message, 'INTEGRATION_ERROR', details);
        this.name = 'IntegrationError';
    }
}
exports.IntegrationError = IntegrationError;
function calculateComplianceScore(findings, weights = exports.DEFAULT_SEVERITY_WEIGHTS) {
    const totalPenalty = findings.reduce((sum, finding) => {
        return sum + (weights[finding.severity] ?? 0);
    }, 0);
    return Math.max(0, Math.min(100, 100 + totalPenalty));
}
function isNormalizedResource(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const candidate = obj;
    return (typeof candidate.id === 'string' &&
        typeof candidate.logicalName === 'string' &&
        typeof candidate.type === 'string' &&
        typeof candidate.provider === 'string' &&
        typeof candidate.source === 'string');
}
function isDriftFinding(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const candidate = obj;
    return (typeof candidate.driftId === 'string' &&
        typeof candidate.driftType === 'string' &&
        typeof candidate.severity === 'string');
}
function isWhitelistedFinding(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const candidate = obj;
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
    return (Object.keys(candidate).every((key) => allowedKeys.includes(key)) &&
        typeof candidate.findingId === 'string' &&
        typeof candidate.logicalName === 'string');
}
function redactSensitiveData(obj, patterns = []) {
    let redacted = false;
    const allPatterns = [...Object.values(exports.SENSITIVE_PATTERNS), ...patterns];
    const redactValue = (value, key) => {
        if (key && exports.SENSITIVE_FIELDS.includes(key)) {
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
            return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [
                nestedKey,
                redactValue(nestedValue, nestedKey),
            ]));
        }
        return value;
    };
    return {
        data: Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, redactValue(value, key)])),
        redacted,
    };
}
// Made with Bob
//# sourceMappingURL=shared.js.map