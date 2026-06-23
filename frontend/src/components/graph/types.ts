import type { Severity } from '../../lib/severity';

export type GraphLayer = 'planned' | 'terraform' | 'deployed';

export interface GraphNodeDrift {
  driftId: string;
  driftType: string;
  severity: Severity;
  diffSummary: string;
  title: string;
}

export interface GraphNodeData {
  id: string;
  uid: string;
  name: string;
  kind: string;
  type: string;
  layer: string;
  region: string;
  source: string;
  attributes: Record<string, unknown>;
  tags: Record<string, string>;
  drifted: boolean;
  driftSeverity: Severity | null;
  drifts: GraphNodeDrift[];
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  kind: string;
  label: string;
}

export interface GraphLayerData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

export type GraphResponse = Record<GraphLayer, GraphLayerData>;
