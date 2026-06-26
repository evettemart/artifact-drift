import {
  DriftType,
  DriftStatus,
  Severity,
  ResourceType,
  calculateComplianceScore,
} from '../../types/shared';
import type {
  DriftFinding,
  NormalizedResource,
  AttributeDiff,
  WhitelistedFinding,
  WhitelistedAttributes,
  ReasoningResult,
} from '../../types/shared';

// ---------------------------------------------------------------------------
// Public input / output contracts
// ---------------------------------------------------------------------------

export interface DriftAnalysisConfig {
  /** Whether to perform generic key-by-key attribute comparison */
  deepCompare: boolean;
  /** Attribute keys to skip during attribute comparison */
  ignoreAttributes?: string[];
  /** Tag keys to skip during tag comparison */
  ignoreTags?: string[];
  /** Whether to emit UNMANAGED findings for AWS resources not in Terraform */
  detectUnmanaged: boolean;
  /** Severity weights for compliance score (defaults to DEFAULT_SEVERITY_WEIGHTS) */
  severityWeights?: Record<Severity, number>;
}

export interface DriftAnalysisAgentInput {
  intentResources: NormalizedResource[];
  terraformResources: NormalizedResource[];
  awsResources: NormalizedResource[];
  /** Used for VERSION_MISMATCH findings */
  terraformVersion?: string;
  /** Fallback region when no resources are present */
  region?: string;
  /** Legacy compat: when provided, severityWeights is merged from here */
  severityWeights?: Record<Severity, number>;
}

export interface DriftStatistics {
  totalResourcesAnalyzed: number;
  matchedResources: number;
  driftedResources: number;
  unmanagedResources: number;
  missingResources: number;
  driftsByType: Record<string, number>;
  driftsBySeverity: Record<string, number>;
  /** Legacy aliases consumed by runFullAnalysis */
  totalFindings: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface DriftAnalysisAgentOutput {
  findings: DriftFinding[];
  statistics: DriftStatistics;
  complianceScore: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ResourceIndex {
  byLogicalName: Map<string, NormalizedResource>;
  byType: Map<string, NormalizedResource[]>;
  byRegion: Map<string, NormalizedResource[]>;
}

interface ComparisonContext {
  intentIndex: ResourceIndex;
  terraformIndex: ResourceIndex;
  awsIndex: ResourceIndex;
  config: DriftAnalysisConfig;
}

function nowIso(): string {
  return new Date().toISOString();
}

let _idCounter = 0;
function nextDriftId(): string {
  return `drift-${String(++_idCounter).padStart(3, '0')}-${Date.now().toString(36)}`;
}

function buildReasoning(
  summary: string,
  likelyCause: string,
  impact: string,
  terraformRemediation: string,
  severity: Severity
): ReasoningResult {
  return {
    summary,
    severity,
    likelyCause,
    recommendedAction: 'Reconcile Terraform with the approved design, then re-run the scan.',
    terraformRemediation,
    businessImpact: impact,
    impact,
    generatedBy: 'deterministic',
    reasonedAt: nowIso(),
  };
}

function labelType(type: string): string {
  const labels: Record<string, string> = {
    [ResourceType.VPC]: 'VPC',
    [ResourceType.SUBNET]: 'Subnet',
    [ResourceType.SECURITY_GROUP]: 'Security Group',
    [ResourceType.EC2_INSTANCE]: 'EC2 Instance',
    [ResourceType.ALB]: 'Load Balancer',
    [ResourceType.ROUTE_TABLE]: 'Route Table',
    [ResourceType.INTERNET_GATEWAY]: 'Internet Gateway',
    [ResourceType.NAT_GATEWAY]: 'NAT Gateway',
    [ResourceType.RDS_INSTANCE]: 'RDS Instance',
    [ResourceType.LAMBDA_FUNCTION]: 'Lambda Function',
    [ResourceType.S3_BUCKET]: 'S3 Bucket',
  };
  return labels[type] ?? String(type);
}

function attr(resource: NormalizedResource, ...keys: string[]): unknown {
  for (const key of keys) {
    if (resource.attributes[key] !== undefined) return resource.attributes[key];
  }
  return undefined;
}

function getIngressPorts(resource: NormalizedResource): number[] {
  const rules = (
    resource.attributes.ingress ??
    resource.attributes.ingress_rules ??
    resource.attributes.ingressRules ??
    resource.attributes.IpPermissions
  ) as Array<Record<string, unknown>> | undefined;

  const ports = new Set<number>();
  if (Array.isArray(rules)) {
    for (const rule of rules) {
      const raw = rule.from_port ?? rule.FromPort ?? rule.fromPort;
      if (raw !== undefined && raw !== null) {
        const n = Number(raw);
        if (!Number.isNaN(n)) ports.add(n);
      }
    }
  }
  return Array.from(ports).sort((a, b) => a - b);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => valuesEqual(v, (b as unknown[])[i]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) =>
      valuesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    );
  }
  return false;
}

function diffSummaryFromDiffs(diffs: AttributeDiff[]): string {
  if (diffs.length === 0) return 'No differences';
  const parts = diffs.slice(0, 3).map((d) => {
    if (d.diffType === 'added') return `${d.path} added`;
    if (d.diffType === 'removed') return `${d.path} removed`;
    return `${d.path} changed`;
  });
  return diffs.length > 3 ? `${parts.join(', ')}, and ${diffs.length - 3} more` : parts.join(', ');
}

// ---------------------------------------------------------------------------
// DriftAnalysisAgent
// ---------------------------------------------------------------------------

/**
 * Self-contained deterministic drift detection engine.
 *
 * Compares three normalized resource sets (Intent, Terraform, AWS) and
 * produces structured DriftFindings. No LLM calls; all logic is deterministic.
 *
 * Backward-compatible with the legacy `new DriftAnalysisAgent(comparatorFn)`
 * call site in analysis.ts — when a comparator is injected, the agent falls
 * back to it (legacy mode). When instantiated without arguments or with a
 * config object, the full engine runs.
 */
export class DriftAnalysisAgent {
  private cfg: DriftAnalysisConfig;
  /** Legacy comparator injected by runFullAnalysis (kept for backward compat) */
  private _legacyComparator: LegacyComparator | null;

  constructor(configOrComparator?: DriftAnalysisConfig | LegacyComparator) {
    if (typeof configOrComparator === 'function') {
      // Legacy: new DriftAnalysisAgent(detectDrift)
      this._legacyComparator = configOrComparator as LegacyComparator;
      this.cfg = { deepCompare: true, detectUnmanaged: true };
    } else {
      this._legacyComparator = null;
      this.cfg = {
        deepCompare: true,
        detectUnmanaged: true,
        ...(configOrComparator ?? {}),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  analyze(input: DriftAnalysisAgentInput): DriftAnalysisAgentOutput {
    const cfg: DriftAnalysisConfig = {
      ...this.cfg,
      ...(input.severityWeights ? { severityWeights: input.severityWeights } : {}),
    };

    const region =
      input.region ??
      input.intentResources[0]?.region ??
      input.terraformResources[0]?.region ??
      'us-east-1';

    let findings: DriftFinding[];

    if (this._legacyComparator) {
      // Legacy path: delegate to the injected function then supplement with
      // the new comparisons the legacy function doesn't cover.
      findings = this._legacyComparator(
        input.intentResources,
        input.terraformResources,
        input.awsResources,
        input.terraformVersion,
        region
      );
    } else {
      findings = this._runEngine(input, cfg, region);
    }

    const statistics = this._buildStatistics(input, findings);

    return {
      findings,
      statistics,
      complianceScore: calculateComplianceScore(findings, cfg.severityWeights),
    };
  }

  // -------------------------------------------------------------------------
  // Index construction
  // -------------------------------------------------------------------------

  private _buildIndex(resources: NormalizedResource[]): ResourceIndex {
    const idx: ResourceIndex = {
      byLogicalName: new Map(),
      byType: new Map(),
      byRegion: new Map(),
    };
    for (const r of resources) {
      idx.byLogicalName.set(r.logicalName, r);

      const typeList = idx.byType.get(String(r.type)) ?? [];
      typeList.push(r);
      idx.byType.set(String(r.type), typeList);

      const regionList = idx.byRegion.get(r.region) ?? [];
      regionList.push(r);
      idx.byRegion.set(r.region, regionList);
    }
    return idx;
  }

  // -------------------------------------------------------------------------
  // Main engine
  // -------------------------------------------------------------------------

  private _runEngine(
    input: DriftAnalysisAgentInput,
    cfg: DriftAnalysisConfig,
    region: string
  ): DriftFinding[] {
    const ctx: ComparisonContext = {
      intentIndex: this._buildIndex(input.intentResources),
      terraformIndex: this._buildIndex(input.terraformResources),
      awsIndex: this._buildIndex(input.awsResources),
      config: cfg,
    };

    const findings: DriftFinding[] = [
      ...this._compareIntentVsTerraform(ctx),
      ...this._compareTerraformVsAWS(ctx),
      ...this._compareIntentVsAWS(ctx),
      ...(cfg.detectUnmanaged ? this._detectUnmanaged(ctx) : []),
      ...this._detectRegionMismatches(ctx),
      ...(input.terraformVersion ? [this._versionFinding(input.terraformVersion, region)] : []),
    ];

    // Fill in any missing default severities
    for (const f of findings) {
      if (!f.severity) f.severity = this._defaultSeverity(f.driftType as DriftType);
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // 1. Intent vs Terraform — missing in TF, attribute/tag/SG mismatch
  // -------------------------------------------------------------------------

  private _compareIntentVsTerraform(ctx: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const detectedAt = nowIso();

    for (const [name, intentR] of ctx.intentIndex.byLogicalName) {
      const tfR = ctx.terraformIndex.byLogicalName.get(name);
      if (!tfR) {
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.MISSING,
          severity: Severity.HIGH,
          status: DriftStatus.OPEN,
          resourceType: intentR.type,
          provider: intentR.provider,
          region: intentR.region,
          logicalName: name,
          expected: { logicalName: name, type: intentR.type },
          observed: null,
          diffSummary: `${labelType(String(intentR.type))} '${name}' defined in architecture intent but missing from Terraform`,
          attributeDiffs: [],
          detectedAt,
          reasoning: buildReasoning(
            `${labelType(String(intentR.type))} missing from Terraform`,
            'Resource is part of the approved architecture but has not been added to Terraform.',
            'Architecture intent is not tracked in IaC; risk of manual or uncontrolled provisioning.',
            `Add a \`${String(intentR.type)}\` resource block to the Terraform configuration.`,
            Severity.HIGH
          ),
        });
        continue;
      }

      // Attribute comparison
      if (ctx.config.deepCompare) {
        const attrDiffs = this._compareAttributes(intentR, tfR, ctx.config);
        if (attrDiffs.length > 0) {
          findings.push({
            driftId: nextDriftId(),
            driftType: DriftType.ATTRIBUTE_MISMATCH,
            severity: Severity.MEDIUM,
            status: DriftStatus.OPEN,
            resourceType: intentR.type,
            provider: intentR.provider,
            region: intentR.region,
            logicalName: name,
            expected: intentR,
            observed: tfR,
            diffSummary: `Terraform resource does not match architecture intent: ${diffSummaryFromDiffs(attrDiffs)}`,
            attributeDiffs: attrDiffs,
            detectedAt,
            reasoning: buildReasoning(
              'Attribute mismatch between intent and Terraform',
              'The Terraform resource was configured differently from the approved architecture.',
              'Deployed infrastructure may not reflect the intended design.',
              'Align the Terraform resource attributes with the architecture specification.',
              Severity.MEDIUM
            ),
          });
        }
      }

      // Tag comparison
      const tagDiffs = this._compareTags(intentR.tags, tfR.tags, ctx.config);
      if (tagDiffs.length > 0) {
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.TAG_MISMATCH,
          severity: Severity.LOW,
          status: DriftStatus.OPEN,
          resourceType: intentR.type,
          provider: intentR.provider,
          region: intentR.region,
          logicalName: name,
          expected: { tags: intentR.tags },
          observed: { tags: tfR.tags },
          diffSummary: `${labelType(String(intentR.type))} '${name}' tag mismatch between intent and Terraform: ${tagDiffs.length} tag(s) differ`,
          attributeDiffs: tagDiffs,
          detectedAt,
          reasoning: buildReasoning(
            'Tag mismatch between intent and Terraform',
            'Required tags specified in the architecture are missing or different in Terraform.',
            'Affects resource governance, cost allocation, and compliance tagging.',
            'Add or correct the tags in the Terraform resource block.',
            Severity.LOW
          ),
        });
      }

      // Security group comparison
      if (String(intentR.type) === ResourceType.SECURITY_GROUP) {
        const sgDiffs = this._compareSecurityGroupRules(intentR, tfR);
        if (sgDiffs.length > 0) {
          findings.push({
            driftId: nextDriftId(),
            driftType: DriftType.SECURITY_GROUP_MISMATCH,
            severity: Severity.HIGH,
            status: DriftStatus.OPEN,
            resourceType: intentR.type,
            provider: intentR.provider,
            region: intentR.region,
            logicalName: name,
            expected: intentR,
            observed: tfR,
            diffSummary: `Security group '${name}' rules differ between architecture intent and Terraform`,
            attributeDiffs: sgDiffs,
            detectedAt,
            reasoning: buildReasoning(
              'Security group rules differ from architecture intent',
              'Security group was configured with different rules than the approved architecture specifies.',
              'Network exposure may not match the intended security posture.',
              'Update the security group ingress/egress rules in Terraform to match the architecture.',
              Severity.HIGH
            ),
          });
        }
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // 2. Terraform vs AWS — changed outside TF, missing in AWS, tag drift
  // -------------------------------------------------------------------------

  private _compareTerraformVsAWS(ctx: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const detectedAt = nowIso();

    for (const [name, tfR] of ctx.terraformIndex.byLogicalName) {
      const awsR = this._findMatchingAWS(tfR, ctx.awsIndex);

      if (!awsR) {
        // Only report as MISSING if intent also includes this resource
        if (!ctx.intentIndex.byLogicalName.has(name)) continue;
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.MISSING,
          severity: Severity.HIGH,
          status: DriftStatus.OPEN,
          resourceType: tfR.type,
          provider: tfR.provider,
          region: tfR.region,
          logicalName: name,
          expected: { logicalName: name, type: tfR.type },
          observed: null,
          diffSummary: `${labelType(String(tfR.type))} '${name}' defined in Terraform but not found in AWS`,
          attributeDiffs: [],
          detectedAt,
          reasoning: buildReasoning(
            `${labelType(String(tfR.type))} not deployed in AWS`,
            'Terraform resource exists but was never applied or was manually deleted from AWS.',
            'Intended infrastructure is absent; dependent resources may fail.',
            'Run `terraform plan` then `terraform apply` to create the missing resource.',
            Severity.HIGH
          ),
        });
        continue;
      }

      // CHANGED_OUTSIDE_TERRAFORM for security group ingress ports
      if (String(tfR.type) === ResourceType.SECURITY_GROUP) {
        const tfPorts = getIngressPorts(tfR);
        const awsPorts = getIngressPorts(awsR);
        const extra = awsPorts.filter((p) => !tfPorts.includes(p));
        if (extra.length > 0) {
          findings.push({
            driftId: nextDriftId(),
            driftType: DriftType.CHANGED_OUTSIDE_TERRAFORM,
            severity: Severity.HIGH,
            status: DriftStatus.OPEN,
            resourceType: tfR.type,
            provider: tfR.provider,
            region: tfR.region,
            logicalName: name,
            expected: { attributes: { ports: tfPorts } },
            observed: { attributes: { ports: awsPorts } },
            diffSummary: `Security group '${name}' has port ${extra.join(', ')} open in AWS not defined in Terraform`,
            attributeDiffs: extra.map((port) => ({
              path: 'ingress.ports',
              expectedValue: null,
              observedValue: port,
              diffType: 'added' as const,
            })),
            detectedAt,
            reasoning: buildReasoning(
              'Security group rule added outside Terraform',
              'A port was opened manually in AWS and is not reflected in Terraform state.',
              extra.includes(22)
                ? 'SSH exposed outside Terraform control — potential security risk.'
                : 'Network exposure changed outside Terraform control.',
              'Run `terraform apply` to remove the rule, or add it to Terraform with a restricted CIDR.',
              Severity.HIGH
            ),
          });
        }
      }

      // Generic attribute drift
      if (ctx.config.deepCompare) {
        const attrDiffs = this._compareAttributes(tfR, awsR, ctx.config);
        if (attrDiffs.length > 0) {
          findings.push({
            driftId: nextDriftId(),
            driftType: DriftType.CHANGED_OUTSIDE_TERRAFORM,
            severity: Severity.MEDIUM,
            status: DriftStatus.OPEN,
            resourceType: tfR.type,
            provider: tfR.provider,
            region: tfR.region,
            logicalName: name,
            expected: tfR,
            observed: awsR,
            diffSummary: `${labelType(String(tfR.type))} '${name}' modified outside Terraform: ${diffSummaryFromDiffs(attrDiffs)}`,
            attributeDiffs: attrDiffs,
            detectedAt,
            reasoning: buildReasoning(
              'Resource modified outside Terraform',
              'Resource attributes in AWS differ from the Terraform state.',
              'Infrastructure no longer matches its IaC definition.',
              'Run `terraform apply` to reconcile, or import and update the configuration.',
              Severity.MEDIUM
            ),
          });
        }
      }

      // Tag drift
      const tagDiffs = this._compareTags(tfR.tags, awsR.tags, ctx.config);
      if (tagDiffs.length > 0) {
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.TAG_MISMATCH,
          severity: Severity.LOW,
          status: DriftStatus.OPEN,
          resourceType: tfR.type,
          provider: tfR.provider,
          region: tfR.region,
          logicalName: name,
          expected: { tags: tfR.tags },
          observed: { tags: awsR.tags },
          diffSummary: `${labelType(String(tfR.type))} '${name}' has ${tagDiffs.length} tag(s) out of sync between Terraform and AWS`,
          attributeDiffs: tagDiffs,
          detectedAt,
          reasoning: buildReasoning(
            'Tag drift between Terraform and AWS',
            'Tags were modified or removed in AWS without updating Terraform.',
            'Affects cost allocation, ownership tracking, and compliance posture.',
            'Run `terraform apply` to restore the expected tags.',
            Severity.LOW
          ),
        });
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // 3. Intent vs AWS (resources not managed by Terraform)
  // -------------------------------------------------------------------------

  private _compareIntentVsAWS(ctx: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const detectedAt = nowIso();

    for (const [name, intentR] of ctx.intentIndex.byLogicalName) {
      if (ctx.terraformIndex.byLogicalName.has(name)) continue; // covered by TF comparisons
      const awsR = this._findMatchingAWS(intentR, ctx.awsIndex);
      if (!awsR) {
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.MISSING,
          severity: Severity.HIGH,
          status: DriftStatus.OPEN,
          resourceType: intentR.type,
          provider: intentR.provider,
          region: intentR.region,
          logicalName: name,
          expected: { logicalName: name, type: intentR.type },
          observed: null,
          diffSummary: `${labelType(String(intentR.type))} '${name}' defined in architecture but not deployed in AWS`,
          attributeDiffs: [],
          detectedAt,
          reasoning: buildReasoning(
            'Architecture resource not deployed',
            'Resource is in the approved design but not found in AWS.',
            'Intended architecture is incomplete.',
            'Add this resource to Terraform and apply, or provision it manually if intentional.',
            Severity.HIGH
          ),
        });
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // 4. Unmanaged AWS resources (in AWS but not in Terraform)
  // -------------------------------------------------------------------------

  private _detectUnmanaged(ctx: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const detectedAt = nowIso();

    for (const [, awsR] of ctx.awsIndex.byLogicalName) {
      const tfR = this._findMatchingTF(awsR, ctx.terraformIndex);
      if (!tfR) {
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.UNMANAGED,
          severity: Severity.MEDIUM,
          status: DriftStatus.OPEN,
          resourceType: awsR.type,
          provider: awsR.provider,
          region: awsR.region,
          logicalName: awsR.logicalName,
          expected: null,
          observed: { logicalName: awsR.logicalName, type: awsR.type },
          diffSummary: `${labelType(String(awsR.type))} '${awsR.logicalName}' exists in AWS but is not managed by Terraform`,
          attributeDiffs: [],
          detectedAt,
          reasoning: buildReasoning(
            `Unmanaged ${labelType(String(awsR.type)).toLowerCase()} found in AWS`,
            'Resource was created manually in AWS and never added to Terraform.',
            'Resource is not version-controlled and can be changed or deleted without tracking.',
            'Import the resource with `terraform import`, or remove it if no longer required.',
            Severity.MEDIUM
          ),
        });
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // 5. Region mismatches
  // -------------------------------------------------------------------------

  private _detectRegionMismatches(ctx: ComparisonContext): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const detectedAt = nowIso();

    for (const [name, intentR] of ctx.intentIndex.byLogicalName) {
      const tfR = ctx.terraformIndex.byLogicalName.get(name);
      const awsR = ctx.awsIndex.byLogicalName.get(name);
      const effectiveExpected = intentR.region;
      const observed = awsR?.region ?? tfR?.region;
      if (observed && observed !== effectiveExpected) {
        findings.push({
          driftId: nextDriftId(),
          driftType: DriftType.REGION_MISMATCH,
          severity: Severity.HIGH,
          status: DriftStatus.OPEN,
          resourceType: intentR.type,
          provider: intentR.provider,
          region: effectiveExpected,
          logicalName: name,
          expected: { attributes: { region: effectiveExpected } },
          observed: { attributes: { region: observed } },
          diffSummary: `${labelType(String(intentR.type))} '${name}' expected in region ${effectiveExpected} but found in ${observed}`,
          attributeDiffs: [
            {
              path: 'region',
              expectedValue: effectiveExpected,
              observedValue: observed,
              diffType: 'modified' as const,
            },
          ],
          detectedAt,
          reasoning: buildReasoning(
            'Resource deployed in wrong region',
            'Resource was provisioned in a different region than the architecture specifies.',
            'May violate data-residency requirements or increase cross-region latency.',
            'Redeploy the resource in the correct region and update the Terraform configuration.',
            Severity.HIGH
          ),
        });
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // Version finding (informational)
  // -------------------------------------------------------------------------

  private _versionFinding(terraformVersion: string, region: string): DriftFinding {
    return {
      driftId: nextDriftId(),
      driftType: DriftType.VERSION_MISMATCH,
      severity: Severity.INFO,
      status: DriftStatus.OPEN,
      resourceType: 'provider',
      provider: 'aws',
      region,
      logicalName: 'hashicorp/aws',
      expected: null,
      observed: { attributes: { terraformVersion } },
      diffSummary: `Terraform AWS provider version in state (${terraformVersion}) may differ from the current registry version`,
      attributeDiffs: [],
      detectedAt: nowIso(),
      reasoning: buildReasoning(
        'Provider version tracking',
        'Informational — records the provider version used in the last apply.',
        'Minimal impact, but important for reproducibility.',
        'Pin the AWS provider version in the `required_providers` block.',
        Severity.INFO
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Fuzzy resource matching
  // -------------------------------------------------------------------------

  private _findMatchingAWS(r: NormalizedResource, awsIdx: ResourceIndex): NormalizedResource | undefined {
    const exact = awsIdx.byLogicalName.get(r.logicalName);
    if (exact) return exact;
    const candidates = awsIdx.byType.get(String(r.type)) ?? [];
    return candidates.find((c) => this._resourcesMatch(r, c));
  }

  private _findMatchingTF(r: NormalizedResource, tfIdx: ResourceIndex): NormalizedResource | undefined {
    const exact = tfIdx.byLogicalName.get(r.logicalName);
    if (exact) return exact;
    const candidates = tfIdx.byType.get(String(r.type)) ?? [];
    return candidates.find((c) => this._resourcesMatch(r, c));
  }

  private _resourcesMatch(a: NormalizedResource, b: NormalizedResource): boolean {
    if (String(a.type) !== String(b.type)) return false;
    switch (String(a.type)) {
      case ResourceType.VPC:
        return attr(a, 'cidrBlock', 'cidr_block') === attr(b, 'cidrBlock', 'cidr_block');
      case ResourceType.SUBNET:
        return (
          attr(a, 'cidrBlock', 'cidr_block') === attr(b, 'cidrBlock', 'cidr_block') &&
          attr(a, 'vpcId', 'vpc_id') === attr(b, 'vpcId', 'vpc_id')
        );
      case ResourceType.SECURITY_GROUP:
        return (
          attr(a, 'groupName', 'group_name', 'name') === attr(b, 'groupName', 'group_name', 'name') &&
          attr(a, 'vpcId', 'vpc_id') === attr(b, 'vpcId', 'vpc_id')
        );
      case ResourceType.EC2_INSTANCE:
        return attr(a, 'instanceType', 'instance_type') === attr(b, 'instanceType', 'instance_type');
      default:
        return a.logicalName === b.logicalName;
    }
  }

  // -------------------------------------------------------------------------
  // Attribute & tag comparison
  // -------------------------------------------------------------------------

  private _compareAttributes(
    expected: NormalizedResource,
    observed: NormalizedResource,
    config: DriftAnalysisConfig
  ): AttributeDiff[] {
    const ignore = new Set(config.ignoreAttributes ?? [
      // Meta-attributes that always differ between sources
      'id', 'arn', 'resourceId', 'resource_id',
      'interpretedFrom', 'imageFile', 'integrationId',
      'capturedAt', 'sourceLocation',
    ]);
    const diffs: AttributeDiff[] = [];
    const allKeys = new Set([
      ...Object.keys(expected.attributes),
      ...Object.keys(observed.attributes),
    ]);
    for (const key of allKeys) {
      if (ignore.has(key)) continue;
      const ev = expected.attributes[key];
      const ov = observed.attributes[key];
      if (ev === undefined && ov === undefined) continue;
      if (!valuesEqual(ev, ov)) {
        diffs.push({
          path: key,
          expectedValue: ev ?? null,
          observedValue: ov ?? null,
          diffType: ev === undefined ? 'added' : ov === undefined ? 'removed' : 'modified',
        });
      }
    }
    return diffs;
  }

  private _compareTags(
    expected: Record<string, string>,
    observed: Record<string, string>,
    config: DriftAnalysisConfig
  ): AttributeDiff[] {
    const ignore = new Set(config.ignoreTags ?? ['Source', 'LastScanned', 'ManagedBy']);
    const diffs: AttributeDiff[] = [];
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(observed)]);
    for (const key of allKeys) {
      if (ignore.has(key)) continue;
      const ev = expected[key];
      const ov = observed[key];
      if (ev !== ov) {
        diffs.push({
          path: `tags.${key}`,
          expectedValue: ev ?? null,
          observedValue: ov ?? null,
          diffType: ev === undefined ? 'added' : ov === undefined ? 'removed' : 'modified',
        });
      }
    }
    return diffs;
  }

  private _compareSecurityGroupRules(
    expected: NormalizedResource,
    observed: NormalizedResource
  ): AttributeDiff[] {
    const diffs: AttributeDiff[] = [];
    const expectedIngress = expected.attributes.ingressRules ?? expected.attributes.ingress ?? [];
    const observedIngress = observed.attributes.ingressRules ?? observed.attributes.ingress ?? [];
    const expectedEgress = expected.attributes.egressRules ?? expected.attributes.egress ?? [];
    const observedEgress = observed.attributes.egressRules ?? observed.attributes.egress ?? [];

    if (!valuesEqual(expectedIngress, observedIngress)) {
      diffs.push({
        path: 'ingressRules',
        expectedValue: expectedIngress,
        observedValue: observedIngress,
        diffType: 'modified',
      });
    }
    if (!valuesEqual(expectedEgress, observedEgress)) {
      diffs.push({
        path: 'egressRules',
        expectedValue: expectedEgress,
        observedValue: observedEgress,
        diffType: 'modified',
      });
    }
    return diffs;
  }

  // -------------------------------------------------------------------------
  // Statistics & severity helpers
  // -------------------------------------------------------------------------

  private _buildStatistics(input: DriftAnalysisAgentInput, findings: DriftFinding[]): DriftStatistics {
    const driftsByType: Record<string, number> = {};
    const driftsBySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const f of findings) {
      const t = String(f.driftType);
      driftsByType[t] = (driftsByType[t] ?? 0) + 1;
      driftsBySeverity[f.severity] = (driftsBySeverity[f.severity] ?? 0) + 1;
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    }

    const allNames = new Set([
      ...input.intentResources.map((r) => r.logicalName),
      ...input.terraformResources.map((r) => r.logicalName),
      ...input.awsResources.map((r) => r.logicalName),
    ]);
    const total = allNames.size;

    return {
      totalResourcesAnalyzed: total,
      matchedResources: Math.max(0, total - findings.length),
      driftedResources: findings.length,
      unmanagedResources: driftsByType[DriftType.UNMANAGED] ?? 0,
      missingResources: driftsByType[DriftType.MISSING] ?? 0,
      driftsByType,
      driftsBySeverity,
      // Legacy aliases
      totalFindings: findings.length,
      bySeverity: driftsBySeverity,
      byType: driftsByType,
      byStatus,
    };
  }

  private _defaultSeverity(driftType: DriftType): Severity {
    switch (driftType) {
      case DriftType.SECURITY_GROUP_MISMATCH:
      case DriftType.CHANGED_OUTSIDE_TERRAFORM:
      case DriftType.MISSING:
      case DriftType.REGION_MISMATCH:
        return Severity.HIGH;
      case DriftType.UNMANAGED:
      case DriftType.ATTRIBUTE_MISMATCH:
      case DriftType.ATTRIBUTE_MISMATCH_LEGACY:
        return Severity.MEDIUM;
      case DriftType.TAG_MISMATCH:
      case DriftType.TAG_MISMATCH_LEGACY:
        return Severity.LOW;
      case DriftType.VERSION_MISMATCH:
        return Severity.INFO;
      default:
        return Severity.MEDIUM;
    }
  }

  // -------------------------------------------------------------------------
  // Whitelisted finding (safe for LLM consumption)
  // -------------------------------------------------------------------------

  generateWhitelistedFinding(finding: DriftFinding): WhitelistedFinding {
    return {
      findingId: finding.driftId,
      driftType: finding.driftType,
      resourceType: finding.resourceType,
      provider: finding.provider,
      region: finding.region,
      logicalName: finding.logicalName,
      expected: this._safeAttributes(finding.expected as NormalizedResource | null),
      observed: this._safeAttributes(finding.observed as NormalizedResource | null),
      diffSummary: finding.diffSummary,
    };
  }

  private _safeAttributes(resource: NormalizedResource | null | undefined): WhitelistedAttributes {
    if (!resource) return {};
    const a = resource.attributes ?? {};
    const w: WhitelistedAttributes = {
      type: resource.type ? String(resource.type) : undefined,
      region: resource.region,
    };
    if (a.cidrBlock ?? a.cidr_block) w.cidrBlocks = [String(a.cidrBlock ?? a.cidr_block)];
    if (a.instanceType ?? a.instance_type) w.instanceType = String(a.instanceType ?? a.instance_type);
    if (resource.tags) w.tagKeys = Object.keys(resource.tags);
    return w;
  }
}

// ---------------------------------------------------------------------------
// Legacy comparator type (kept for backward compat with analysis.ts)
// ---------------------------------------------------------------------------

type LegacyComparator = (
  intentResources: NormalizedResource[],
  terraformResources: NormalizedResource[],
  awsResources: NormalizedResource[],
  terraformVersion: string | undefined,
  region: string
) => DriftFinding[];
