import { ResourceType } from '../../types/shared';

export interface CanonicalGraphNode {
  id: string;
  label: string;
  type: string;
  status: string;
  confidence?: number;
}

export interface CanonicalGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence?: number;
}

export interface CanonicalGraphLayer {
  nodes: CanonicalGraphNode[];
  edges: CanonicalGraphEdge[];
}

export interface CanonicalGraphModel {
  planned: CanonicalGraphLayer;
  terraform: CanonicalGraphLayer;
  deployed: CanonicalGraphLayer;
}

export interface GraphValidationIssue {
  code: string;
  message: string;
}

export interface GraphValidationResult {
  valid: boolean;
  issues: GraphValidationIssue[];
}

const ALLOWED_TYPES = new Set<string>(Object.values(ResourceType));
const MIN_CONFIDENCE = 0.8;

function clampConfidence(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function sanitizeNode(node: CanonicalGraphNode, issues: GraphValidationIssue[]): CanonicalGraphNode | null {
  const type = String(node.type || '').toLowerCase();
  if (!node.id || !node.label) {
    issues.push({ code: 'NODE_INVALID', message: `Node missing required id/label: ${JSON.stringify(node)}` });
    return null;
  }

  if (!ALLOWED_TYPES.has(type)) {
    issues.push({ code: 'NODE_TYPE_UNKNOWN', message: `Unknown node type "${type}" for node ${node.id}` });
    return null;
  }

  return {
    id: node.id,
    label: node.label,
    type,
    status: node.status || 'planned',
    confidence: clampConfidence(node.confidence),
  };
}

function sanitizeLayer(layer: CanonicalGraphLayer, issues: GraphValidationIssue[]): CanonicalGraphLayer {
  const nodes = (layer.nodes || [])
    .map((node) => sanitizeNode(node, issues))
    .filter((node): node is CanonicalGraphNode => node !== null);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenEdgeIds = new Set<string>();

  const edges: CanonicalGraphEdge[] = [];
  for (const edge of layer.edges || []) {
    if (!edge.id || !edge.source || !edge.target) {
      issues.push({ code: 'EDGE_INVALID', message: `Edge missing required fields: ${JSON.stringify(edge)}` });
      continue;
    }
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({ code: 'EDGE_DANGLING', message: `Edge ${edge.id} references unknown node(s)` });
      continue;
    }
    if (seenEdgeIds.has(edge.id)) {
      issues.push({ code: 'EDGE_DUPLICATE', message: `Duplicate edge id ${edge.id}` });
      continue;
    }

    seenEdgeIds.add(edge.id);
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || 'connects',
      confidence: clampConfidence(edge.confidence),
    });
  }

  return { nodes, edges };
}

export function normalizeAndValidateGraphModel(model: CanonicalGraphModel): {
  graphModel: CanonicalGraphModel;
  validation: GraphValidationResult;
  requiresReview: boolean;
} {
  const issues: GraphValidationIssue[] = [];

  const graphModel: CanonicalGraphModel = {
    planned: sanitizeLayer(model.planned || { nodes: [], edges: [] }, issues),
    terraform: sanitizeLayer(model.terraform || { nodes: [], edges: [] }, issues),
    deployed: sanitizeLayer(model.deployed || { nodes: [], edges: [] }, issues),
  };

  const lowConfidenceNode = graphModel.planned.nodes.find(
    (node) => node.confidence !== undefined && node.confidence < MIN_CONFIDENCE
  );
  const lowConfidenceEdge = graphModel.planned.edges.find(
    (edge) => edge.confidence !== undefined && edge.confidence < MIN_CONFIDENCE
  );

  if (lowConfidenceNode) {
    issues.push({
      code: 'LOW_CONFIDENCE_NODE',
      message: `Node ${lowConfidenceNode.id} has low confidence (${lowConfidenceNode.confidence})`,
    });
  }
  if (lowConfidenceEdge) {
    issues.push({
      code: 'LOW_CONFIDENCE_EDGE',
      message: `Edge ${lowConfidenceEdge.id} has low confidence (${lowConfidenceEdge.confidence})`,
    });
  }

  return {
    graphModel,
    validation: {
      valid: issues.length === 0,
      issues,
    },
    requiresReview: issues.length > 0,
  };
}

function mermaidLabelForType(type: string): string {
  switch (type) {
    case ResourceType.VPC:
      return 'AWS VPC';
    case ResourceType.SUBNET:
      return 'AWS Subnet';
    case ResourceType.EC2_INSTANCE:
      return 'AWS EC2';
    case ResourceType.SECURITY_GROUP:
      return 'AWS Security Group';
    case ResourceType.ALB:
    case ResourceType.APPLICATION_LOAD_BALANCER:
      return 'AWS ALB';
    case ResourceType.ROUTE_TABLE:
      return 'AWS Route Table';
    case ResourceType.INTERNET_GATEWAY:
      return 'AWS Internet Gateway';
    case ResourceType.NAT_GATEWAY:
      return 'AWS NAT Gateway';
    case ResourceType.S3_BUCKET:
      return 'AWS S3';
    case ResourceType.RDS_INSTANCE:
      return 'AWS RDS';
    default:
      return `AWS ${type}`;
  }
}

export function renderMermaidFromGraphModel(
  model: CanonicalGraphModel,
  layer: keyof CanonicalGraphModel = 'planned'
): string {
  const selected = model[layer] || { nodes: [], edges: [] };
  const lines: string[] = ['flowchart LR'];

  for (const node of selected.nodes) {
    const safeLabel = `${mermaidLabelForType(node.type)}\\n${node.label}`.replace(/"/g, '\\"');
    lines.push(`  ${node.id}["${safeLabel}"]`);
  }

  for (const edge of selected.edges) {
    const rel = (edge.label || 'connects').replace(/"/g, '\\"');
    lines.push(`  ${edge.source} -->|${rel}| ${edge.target}`);
  }

  if (selected.nodes.length === 0) {
    lines.push('  Empty["No resources detected"]');
  }

  return lines.join('\n');
}
