// DTOs mirroring the backend Pydantic schemas. This is the contract the mock
// layer (Phase 2) and the real FastAPI backend (later) both satisfy.

export type Layer = "intent" | "terraform" | "runtime";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type DriftType =
  | "missing" // present in base (intent), absent in target (runtime)
  | "unexpected" // present in target, not intended
  | "attribute_mismatch"
  | "edge_drift";

export type RecordStatus = "open" | "acknowledged" | "resolved" | "suppressed";

export type IntegrationStatus =
  | "connected"
  | "error"
  | "unconfigured"
  | "syncing";

export type ReportFormat = "html" | "pdf" | "json";

export type ReportStatus = "ready" | "generating" | "failed";

export interface Provenance {
  source: string; // e.g. "architecture.yaml", "terraform plan", "aws:ec2"
  ref?: string; // file line, ARN, terraform address
  ingestionId?: string;
}

export interface CanonicalNode {
  uid: string;
  kind: string; // "aws_vpc", "aws_security_group", "aws_s3_bucket", ...
  name: string;
  layer: Layer;
  attributes: Record<string, unknown>;
  provenance: Provenance;
  drifted?: boolean;
  driftSeverity?: Severity;
}

export interface CanonicalEdge {
  uid: string;
  kind: string; // "contains", "routes_to", "allows_ingress", "depends_on"
  src: string; // node uid
  dst: string; // node uid
  layer: Layer;
  attributes: Record<string, unknown>;
  drifted?: boolean;
  driftSeverity?: Severity;
}

export interface GraphSnapshot {
  id: string;
  layer: Layer;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  nodes: CanonicalNode[];
  edges: CanonicalEdge[];
}

export type SeverityCounts = Record<Severity, number>;

export interface DriftRun {
  id: string;
  baseLayer: Layer;
  targetLayer: Layer;
  status: "complete" | "running" | "failed";
  summary: SeverityCounts;
  complianceScore: number; // 0-100, deterministic from records
  createdAt: string;
}

export interface AttributeDelta {
  path: string;
  base: unknown;
  target: unknown;
}

export interface DriftRecord {
  id: string;
  runId: string;
  driftType: DriftType;
  severity: Severity;
  title: string;
  resourceKind: string;
  nodeUid?: string;
  edgeUid?: string;
  baseValue: unknown;
  targetValue: unknown;
  diff: AttributeDelta[];
  status: RecordStatus;
  createdAt: string;
}

export interface Integration {
  id: string;
  kind: string; // "aws", "terraform", "confluence", "drawio"
  name: string;
  layer: Layer;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  lastSync?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  body: string; // markdown
  citations: string[]; // drift record ids
}

export interface Report {
  id: string;
  runId: string;
  format: ReportFormat;
  status: ReportStatus;
  title: string;
  sections: ReportSection[];
  createdAt: string;
  uri?: string;
}

export type CopilotRole = "user" | "assistant";

export interface CopilotMessage {
  id: string;
  role: CopilotRole;
  content: string;
  citations: string[]; // drift record ids the answer is grounded on
}

export interface Paginated<T> {
  items: T[];
  total: number;
  cursor?: string | null;
}

export interface DriftRecordFilters {
  runId?: string;
  severity?: Severity[];
  driftType?: DriftType[];
  status?: RecordStatus[];
  search?: string;
}
