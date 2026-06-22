import { api } from "@/api/client";
import type {
  DriftRecord,
  DriftRecordFilters,
  DriftRun,
  Layer,
  Paginated,
  RecordStatus,
} from "@/api/types";

export function getRuns() {
  return api.get<Paginated<DriftRun>>("/drift/runs");
}

export function getRun(id: string) {
  return api.get<DriftRun>(`/drift/runs/${id}`);
}

export function getRecords(runId: string, filters: DriftRecordFilters = {}) {
  return api.get<Paginated<DriftRecord>>(`/drift/runs/${runId}/records`, {
    severity: filters.severity,
    status: filters.status,
    driftType: filters.driftType,
    search: filters.search,
  });
}

export function getRecord(id: string) {
  return api.get<DriftRecord>(`/drift/records/${id}`);
}

export function patchRecord(id: string, status: RecordStatus) {
  return api.patch<DriftRecord>(`/drift/records/${id}`, { status });
}

export function startScan(baseLayer: Layer, targetLayer: Layer) {
  return api.post<DriftRun>("/scans", { baseLayer, targetLayer });
}

export function getScanSchedule() {
  return api.get<{ schedule: string }>("/scans/schedule");
}

export function setScanSchedule(schedule: string) {
  return api.put<{ schedule: string }>("/scans/schedule", { schedule });
}
