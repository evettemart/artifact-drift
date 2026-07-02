import { SEVERITY_ORDER, type Severity } from './severity';

/**
 * Deterministic compliance scoring. Every environment starts at a perfect
 * baseline of 100 and each open drift finding contributes a weighted penalty.
 * The final score is a normalized exponential decay so heavily drifted
 * environments do not collapse too quickly to 0.
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
// Higher value means slower score decay as penalties accumulate.
export const SCORE_DECAY_FACTOR = 100;

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
  const normalized = SCORE_BASELINE * Math.exp(-penalty / SCORE_DECAY_FACTOR);
  return Math.max(0, Math.min(100, Math.round(normalized)));
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
