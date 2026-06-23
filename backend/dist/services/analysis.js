"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFullAnalysis = runFullAnalysis;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const path_1 = require("path");
const yaml_1 = __importDefault(require("yaml"));
const shared_1 = require("../types/shared");
function sha(content) {
    return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
}
function nowIso() {
    return new Date().toISOString();
}
function mapResourceType(type) {
    const normalized = type.toLowerCase();
    const mapping = {
        vpc: shared_1.ResourceType.VPC,
        subnet: shared_1.ResourceType.SUBNET,
        security_group: shared_1.ResourceType.SECURITY_GROUP,
        ec2_instance: shared_1.ResourceType.EC2_INSTANCE,
        alb: shared_1.ResourceType.ALB,
        aws_vpc: shared_1.ResourceType.VPC,
        aws_subnet: shared_1.ResourceType.SUBNET,
        aws_security_group: shared_1.ResourceType.SECURITY_GROUP,
        aws_instance: shared_1.ResourceType.EC2_INSTANCE,
        aws_lb: shared_1.ResourceType.ALB,
        provider: shared_1.ResourceType.PROVIDER,
    };
    return mapping[normalized] ?? shared_1.ResourceType.PROVIDER;
}
function buildRelationships(relationships, targetType = shared_1.ResourceType.SUBNET) {
    return (relationships ?? []).map((relationship) => ({
        type: relationship.type,
        targetLogicalName: relationship.target,
        targetType,
    }));
}
function parseArchitectureIntent() {
    const filePath = (0, path_1.join)(process.cwd(), '..', 'examples', 'architecture.yaml');
    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
    const parsed = yaml_1.default.parse(content);
    const checksum = sha(content);
    const region = parsed.provider?.region ?? 'us-east-1';
    const capturedAt = nowIso();
    return parsed.resources.map((resource) => ({
        id: `intent-${resource.type}-${resource.name}`,
        logicalName: resource.name,
        type: mapResourceType(resource.type),
        provider: shared_1.Provider.AWS,
        region,
        source: shared_1.ResourceSource.INTENT,
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
function parseTerraformState() {
    const filePath = (0, path_1.join)(process.cwd(), '..', 'examples', 'terraform-state.json');
    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const checksum = sha(content);
    const capturedAt = nowIso();
    return parsed.resources
        .filter((resource) => resource.mode === 'managed')
        .flatMap((resource) => (resource.instances ?? []).map((instance, index) => {
        const attributes = instance.attributes ?? {};
        const tags = attributes.tags ?? {};
        const logicalName = tags.Name ??
            attributes.name ??
            `${resource.name}-${index + 1}`;
        return {
            id: `terraform-${resource.type}-${logicalName}`,
            logicalName,
            type: mapResourceType(resource.type),
            provider: shared_1.Provider.AWS,
            region: 'us-east-1',
            source: shared_1.ResourceSource.TERRAFORM,
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
    }));
}
function extractTags(tags) {
    if (!Array.isArray(tags)) {
        return {};
    }
    return tags.reduce((acc, tag) => {
        const key = tag.Key;
        const value = tag.Value;
        if (key && value) {
            acc[key] = value;
        }
        return acc;
    }, {});
}
function parseAwsInventory() {
    const filePath = (0, path_1.join)(process.cwd(), '..', 'examples', 'aws-mock-inventory.json');
    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const checksum = sha(content);
    const region = parsed.metadata?.region ?? 'us-east-1';
    const capturedAt = parsed.metadata?.timestamp ?? nowIso();
    const vpcs = (parsed.vpcs ?? []).map((vpc) => ({
        id: `aws-vpc-${String(vpc.VpcId)}`,
        logicalName: extractTags(vpc.Tags).Name ?? String(vpc.VpcId),
        type: shared_1.ResourceType.VPC,
        provider: shared_1.Provider.AWS,
        region,
        source: shared_1.ResourceSource.AWS,
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
        type: shared_1.ResourceType.SUBNET,
        provider: shared_1.Provider.AWS,
        region,
        source: shared_1.ResourceSource.AWS,
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
                type: shared_1.RelationshipType.MEMBER_OF,
                targetLogicalName: String(subnet.VpcId),
                targetType: shared_1.ResourceType.VPC,
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
        type: shared_1.ResourceType.SECURITY_GROUP,
        provider: shared_1.Provider.AWS,
        region,
        source: shared_1.ResourceSource.AWS,
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
        type: shared_1.ResourceType.EC2_INSTANCE,
        provider: shared_1.Provider.AWS,
        region,
        source: shared_1.ResourceSource.AWS,
        attributes: {
            instanceType: instance.InstanceType,
            imageId: instance.ImageId,
            subnetId: instance.SubnetId,
            vpcId: instance.VpcId,
            privateIpAddress: instance.PrivateIpAddress,
            publicIpAddress: instance.PublicIpAddress,
            securityGroups: instance.SecurityGroups ?? [],
            state: instance.State?.Name,
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
        type: shared_1.ResourceType.ALB,
        provider: shared_1.Provider.AWS,
        region,
        source: shared_1.ResourceSource.AWS,
        attributes: {
            dnsName: lb.DNSName,
            scheme: lb.Scheme,
            type: lb.Type,
            vpcId: lb.VpcId,
            securityGroups: lb.SecurityGroups ?? [],
            availabilityZones: lb.AvailabilityZones ?? [],
            attributes: parsed.load_balancer_attributes?.[String(lb.LoadBalancerArn)] ?? [],
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
function toWhitelistedFinding(finding) {
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
function deterministicReasoning(finding) {
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
function loadMockFindings() {
    const filePath = (0, path_1.join)(process.cwd(), 'data', 'mock', 'findings.json');
    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed.findings;
}
function loadMockScan() {
    const filePath = (0, path_1.join)(process.cwd(), 'data', 'mock', 'scan-result.json');
    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
    return JSON.parse(content);
}
function runFullAnalysis() {
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
    const scan = {
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
//# sourceMappingURL=analysis.js.map