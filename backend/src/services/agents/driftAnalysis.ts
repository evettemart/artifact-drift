import { calculateComplianceScore, Severity } from '../../types/shared';
import type {
  DriftFinding,
  NormalizedResource,
  ScanStatistics,
} from '../../types/shared';

type DriftComparator = (
  intentResources: NormalizedResource[],
  terraformResources: NormalizedResource[],
  awsResources: NormalizedResource[],
  terraformVersionValue: string | undefined,
  region: string
) => DriftFinding[];

export interface DriftAnalysisAgentInput {
  intentResources: NormalizedResource[];
  terraformResources: NormalizedResource[];
  awsResources: NormalizedResource[];
  terraformVersion?: string;
  region?: string;
  severityWeights?: Record<Severity, number>;
}

export interface DriftAnalysisAgentOutput {
  findings: DriftFinding[];
  statistics: ScanStatistics;
  complianceScore: number;
}

function countBy<T>(items: T[], toKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = toKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * DriftAnalysisAgent
 * Deterministic comparison of intent, terraform state, and runtime inventory.
 */
export class DriftAnalysisAgent {
  constructor(private compare: DriftComparator) {}

  analyze(input: DriftAnalysisAgentInput): DriftAnalysisAgentOutput {
    const findings = this.compare(
      input.intentResources,
      input.terraformResources,
      input.awsResources,
      input.terraformVersion,
      input.region ?? input.intentResources[0]?.region ?? 'us-east-1'
    );

    const statistics: ScanStatistics = {
      totalFindings: findings.length,
      totalResources:
        input.intentResources.length +
        input.terraformResources.length +
        input.awsResources.length,
      bySeverity: countBy(findings, (finding) => finding.severity),
      byType: countBy(findings, (finding) => String(finding.driftType)),
      byStatus: countBy(findings, (finding) => finding.status),
    };

    return {
      findings,
      statistics,
      complianceScore: calculateComplianceScore(findings, input.severityWeights),
    };
  }
}
