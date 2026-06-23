import { SEVERITY_ORDER, type Severity } from './severity';

/**
 * Deterministic compliance scoring. Every environment starts at a perfect
 * baseline of 100 and each open drift finding subtracts a fixed weight by
 * severity. The result is clamped to [0, 100]. No randomness, no LLM —
 * identical inputs always produce the same score.
 */
export type SeverityCounts = Record<Severity, number>;

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 4,
  low: 1,
  info: 0,
};

export const SCORE_BASELINE = 100;

export interface ScoreBand {
  label: string;
  min: number;
  color: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  { label: 'Healthy', min: 85, color: '#22c55e' },
  { label: 'At risk', min: 65, color: '#eab308' },
  { label: 'Critical', min: 0, color: '#ef4444' },
];

export function computeComplianceScore(summary: SeverityCounts): number {
  const penalty = SEVERITY_ORDER.reduce(
    (sum, s) => sum + SEVERITY_WEIGHTS[s] * (summary[s] ?? 0),
    0
  );
  return Math.max(0, Math.min(100, SCORE_BASELINE - penalty));
}

export function scoreBand(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

/** Per-severity penalty contribution, for the methodology worked example. */
export function scoreBreakdown(summary: SeverityCounts) {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: summary[severity] ?? 0,
    weight: SEVERITY_WEIGHTS[severity],
    penalty: SEVERITY_WEIGHTS[severity] * (summary[severity] ?? 0),
  }));
}
