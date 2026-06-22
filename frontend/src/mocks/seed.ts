import type {
  DriftRecord,
  DriftRun,
  GraphSnapshot,
  Integration,
  Layer,
  Report,
} from "@/api/types";
import { graphSnapshots } from "@/mocks/fixtures/graph";
import { driftRecords } from "@/mocks/fixtures/driftRecords";
import { driftRuns } from "@/mocks/fixtures/driftRuns";
import { integrations } from "@/mocks/fixtures/integrations";
import { reports } from "@/mocks/fixtures/reports";

export interface MockState {
  graphs: Record<Layer, GraphSnapshot>;
  runs: DriftRun[];
  records: DriftRecord[];
  integrations: Integration[];
  reports: Report[];
  scanSchedule: string; // "off" | "hourly" | "daily" | "weekly"
}

/** Deep clone so the in-memory store never mutates the fixture modules. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

export function buildSeed(): MockState {
  return {
    graphs: clone(graphSnapshots),
    runs: clone(driftRuns),
    records: clone(driftRecords),
    integrations: clone(integrations),
    reports: clone(reports),
    scanSchedule: "off",
  };
}
