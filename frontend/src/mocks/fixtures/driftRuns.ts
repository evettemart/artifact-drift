import type { DriftRun } from "@/api/types";

export const driftRuns: DriftRun[] = [
  {
    id: "run_intent_runtime",
    baseLayer: "intent",
    targetLayer: "runtime",
    status: "complete",
    summary: { critical: 2, high: 1, medium: 1, low: 1, info: 0 },
    complianceScore: 62,
    createdAt: "2026-06-22T08:01:00Z",
  },
  {
    id: "run_tf_runtime",
    baseLayer: "terraform",
    targetLayer: "runtime",
    status: "complete",
    summary: { critical: 0, high: 0, medium: 1, low: 0, info: 0 },
    complianceScore: 88,
    createdAt: "2026-06-22T08:02:00Z",
  },
  {
    id: "run_intent_tf",
    baseLayer: "intent",
    targetLayer: "terraform",
    status: "complete",
    summary: { critical: 1, high: 1, medium: 0, low: 1, info: 0 },
    complianceScore: 74,
    createdAt: "2026-06-22T08:03:00Z",
  },
];
