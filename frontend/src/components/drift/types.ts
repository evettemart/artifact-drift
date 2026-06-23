import type { Severity } from '../../lib/severity';

export type DriftCategory = 'missing' | 'unexpected' | 'attribute' | 'edge';

export type DriftStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';

export interface AttributeDiff {
  path: string;
  expectedValue: unknown;
  observedValue: unknown;
  diffType: string;
}

export interface DriftReasoning {
  summary: string;
  likelyCause: string;
  impact?: string;
  businessImpact?: string;
  recommendedAction?: string;
  terraformRemediation: string;
}

export interface DriftComparison {
  baseLayer: string;
  targetLayer: string;
  baseLabel: string;
  targetLabel: string;
}

export interface DriftFinding {
  driftId: string;
  driftType: string;
  severity: Severity;
  status: DriftStatus;
  resourceType: string;
  logicalName: string;
  region: string;
  diffSummary: string;
  category: DriftCategory;
  runId: string;
  scanId: string;
  comparison: DriftComparison;
  reasoning?: DriftReasoning;
  expected?: unknown;
  observed?: unknown;
  attributeDiffs?: AttributeDiff[];
  detectedAt: string;
}

export interface DriftRun {
  id: string;
  scanId: string;
  projectId: string;
  baseLayer: string;
  targetLayer: string;
  baseLabel: string;
  targetLabel: string;
  label: string;
  total: number;
  summary: Record<Severity, number>;
}

export interface DriftFilterState {
  search: string;
  severity: Severity[];
  category: DriftCategory[];
  status: DriftStatus[];
}
