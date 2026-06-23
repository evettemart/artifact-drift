export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  mode: string;
  databasePath?: string;
}

export interface ReasoningResult {
  summary: string;
  likelyCause: string;
  impact?: string;
  terraformRemediation: string;
  generatedBy: 'llm' | 'deterministic';
}

export interface Finding {
  driftId: string;
  scanId: string;
  driftType: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  resourceType: string;
  provider: string;
  region: string;
  logicalName: string;
  diffSummary: string;
  detectedAt: string;
  reasoning?: ReasoningResult;
}

export interface FindingsResponse {
  scanId: string;
  findings: Finding[];
  total: number;
}

export interface ResourceRelationship {
  type: string;
  targetLogicalName: string;
  targetType: string;
}

export interface ResourceNode {
  id: string;
  logicalName: string;
  type: string;
  provider: string;
  region: string;
  source: string;
  attributes: Record<string, unknown>;
  tags: Record<string, string>;
  relationships: ResourceRelationship[];
  sensitiveRedacted: boolean;
  metadata: {
    capturedAt: string;
    sourceLocation: string;
    sourceChecksum: string;
    providerMetadata?: Record<string, unknown>;
  };
}

export interface ResourcesResponse {
  scanId: string;
  source: string;
  resources: ResourceNode[];
  total: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  source: string;
  region: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodes: number;
  totalEdges: number;
}

export interface AnalyzeResponse {
  scanId: string;
  status: string;
  complianceScore: number;
  findingsCount: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface ReportResponse {
  scan: {
    scanId: string;
    complianceScore: number;
    durationMs: number;
    startedAt: string;
    completedAt: string;
    status: string;
    statistics: {
      totalFindings: number;
      bySeverity: Record<string, number>;
    };
  };
  findings: Finding[];
  generatedAt: string;
}

// Made with Bob