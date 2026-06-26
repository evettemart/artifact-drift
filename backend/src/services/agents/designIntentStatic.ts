import path from 'path';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import {
  Provider,
  RelationshipType,
  ResourceSource,
  ResourceType,
  ParseError,
} from '../../types/shared';
import type { NormalizedResource } from '../../types/shared';
import { config } from '../../config';

interface StaticDiagramInput {
  integrationId: string;
  integrationName: string;
  storedPath?: string;
  originalFileName?: string;
}

interface GraphLayer {
  nodes: Array<{ id: string; label: string; type: string; status: string; confidence?: number }>;
  edges: Array<{ id: string; source: string; target: string; label: string; confidence?: number }>;
}

export interface InterpretedDiagramResult {
  resources: NormalizedResource[];
  graphModel: {
    planned: GraphLayer;
    terraform: GraphLayer;
    deployed: GraphLayer;
  };
}

interface VisionNode {
  type: string;
  label: string;
  confidence?: number;
}

interface VisionEdge {
  source: string;
  target: string;
  relation?: string;
  confidence?: number;
}

interface VisionExtraction {
  resources: VisionNode[];
  relationships?: VisionEdge[];
}

function logicalNameForType(type: ResourceType, ordinal: number): string {
  switch (type) {
    case ResourceType.VPC:
      return `VPC-${ordinal}`;
    case ResourceType.SUBNET:
      return `Subnet-${ordinal}`;
    case ResourceType.SECURITY_GROUP:
      return `SecurityGroup-${ordinal}`;
    case ResourceType.EC2_INSTANCE:
      return `EC2Instance-${ordinal}`;
    case ResourceType.ALB:
    case ResourceType.APPLICATION_LOAD_BALANCER:
      return `LoadBalancer-${ordinal}`;
    case ResourceType.TARGET_GROUP:
      return `TargetGroup-${ordinal}`;
    case ResourceType.LISTENER:
      return `Listener-${ordinal}`;
    case ResourceType.ROUTE_TABLE:
      return `RouteTable-${ordinal}`;
    case ResourceType.INTERNET_GATEWAY:
      return `InternetGateway-${ordinal}`;
    case ResourceType.NAT_GATEWAY:
      return `NatGateway-${ordinal}`;
    case ResourceType.EIP:
      return `ElasticIP-${ordinal}`;
    case ResourceType.S3_BUCKET:
      return `S3Bucket-${ordinal}`;
    case ResourceType.RDS_INSTANCE:
      return `RDSInstance-${ordinal}`;
    case ResourceType.LAMBDA_FUNCTION:
      return `Lambda-${ordinal}`;
    case ResourceType.IAM_ROLE:
      return `IamRole-${ordinal}`;
    case ResourceType.IAM_POLICY:
      return `IamPolicy-${ordinal}`;
    default:
      return `${String(type)}-${ordinal}`;
  }
}

function mediaTypeForPath(filePath: string): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }
  const objectLike = text.match(/\{[\s\S]*\}/);
  if (objectLike?.[0]) {
    return objectLike[0];
  }
  return text;
}

function parseVisionType(typeValue: string): ResourceType | null {
  const token = String(typeValue || '').trim().toLowerCase();
  const aliases: Record<string, ResourceType> = {
    vpc: ResourceType.VPC,
    subnet: ResourceType.SUBNET,
    security_group: ResourceType.SECURITY_GROUP,
    securitygroup: ResourceType.SECURITY_GROUP,
    sg: ResourceType.SECURITY_GROUP,
    ec2_instance: ResourceType.EC2_INSTANCE,
    ec2: ResourceType.EC2_INSTANCE,
    instance: ResourceType.EC2_INSTANCE,
    alb: ResourceType.ALB,
    load_balancer: ResourceType.ALB,
    internet_gateway: ResourceType.INTERNET_GATEWAY,
    route_table: ResourceType.ROUTE_TABLE,
    nat_gateway: ResourceType.NAT_GATEWAY,
    s3_bucket: ResourceType.S3_BUCKET,
    rds_instance: ResourceType.RDS_INSTANCE,
    lambda_function: ResourceType.LAMBDA_FUNCTION,
  };
  return aliases[token] ?? null;
}

async function readDiagramWithVision(referencePath: string): Promise<VisionExtraction> {
  if (!config.llm.enabled || !config.llm.apiKey) {
    throw new ParseError('LLM image interpretation is not configured. Set BOB_API_KEY + BOB_BASE_URL or ANTHROPIC_API_KEY.');
  }

  const imageBytes = await fs.readFile(referencePath);
  const imageBase64 = imageBytes.toString('base64');

  const client = new Anthropic({
    apiKey: config.llm.apiKey,
    baseURL: config.llm.baseUrl ?? undefined,
  });

  const response = await client.messages.create({
    model: config.llm.model,
    temperature: 0,
    max_tokens: 2200,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Read this architecture diagram and return ONLY valid JSON. Do not include markdown. Include only AWS resources explicitly visible in the diagram. No assumptions. JSON schema: {"resources":[{"type":"vpc|subnet|security_group|ec2_instance|alb|internet_gateway|route_table|nat_gateway|s3_bucket|rds_instance|lambda_function","label":"string","confidence":0-1}],"relationships":[{"source":"resource label","target":"resource label","relation":"contains|attached_to|routes_to|depends_on|member_of|targets","confidence":0-1}]}. If uncertain, omit the resource/edge.',
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaTypeForPath(referencePath),
              data: imageBase64,
            },
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new ParseError('LLM image interpretation returned no content');
  }

  const jsonText = extractJsonBlock(text);
  try {
    return JSON.parse(jsonText) as VisionExtraction;
  } catch {
    throw new ParseError('LLM image interpretation returned invalid JSON');
  }
}

export async function interpretStaticDiagram(input: StaticDiagramInput): Promise<InterpretedDiagramResult> {
  const referencePath = input.storedPath || input.originalFileName;
  if (!referencePath) {
    throw new ParseError('Static diagram integration is missing image file path');
  }

  const fileName = path.basename(referencePath);
  const extracted = await readDiagramWithVision(referencePath);
  const rawNodes = Array.isArray(extracted.resources) ? extracted.resources : [];
  if (rawNodes.length === 0) {
    throw new ParseError('No AWS resources were detected from diagram interpretation');
  }

  const now = new Date().toISOString();
  const typeCounters = new Map<ResourceType, number>();
  const labelToResource = new Map<string, NormalizedResource>();

  const resources: NormalizedResource[] = [];
  for (const [idx, node] of rawNodes.entries()) {
    const parsedType = parseVisionType(node.type);
    if (!parsedType) {
      continue;
    }

    const nextOrdinal = (typeCounters.get(parsedType) ?? 0) + 1;
    typeCounters.set(parsedType, nextOrdinal);
    const logicalName = String(node.label || '').trim() || logicalNameForType(parsedType, nextOrdinal);

    const resource: NormalizedResource = {
      id: `intent-image-${input.integrationId}-${idx + 1}`,
      logicalName,
      type: parsedType,
      provider: Provider.AWS,
      region: 'us-east-1',
      source: ResourceSource.INTENT,
      attributes: {
        interpretedFrom: 'static-image-vision',
        imageFile: fileName,
        integrationId: input.integrationId,
      },
      tags: {
        Name: logicalName,
        Source: 'static-image',
      },
      relationships: [],
      sensitiveRedacted: false,
      metadata: {
        capturedAt: now,
        sourceLocation: referencePath,
      },
    };

    labelToResource.set(logicalName.toLowerCase(), resource);
    resources.push(resource);
  }

  if (resources.length === 0) {
    throw new ParseError('Diagram interpretation returned no supported AWS resources');
  }

  const rawEdges = Array.isArray(extracted.relationships) ? extracted.relationships : [];
  for (const edge of rawEdges) {
    const sourceLabel = String(edge.source || '').trim().toLowerCase();
    const targetLabel = String(edge.target || '').trim().toLowerCase();
    if (!sourceLabel || !targetLabel) {
      continue;
    }
    const source = labelToResource.get(sourceLabel);
    const target = labelToResource.get(targetLabel);
    if (!source || !target) {
      continue;
    }
    source.relationships.push({
      type: RelationshipType.CONTAINS,
      targetLogicalName: target.logicalName,
      targetType: target.type,
      metadata: {
        extractedRelation: edge.relation ?? 'contains',
        confidence: clampConfidence(edge.confidence),
      },
    });
  }

  const nodes = resources.map((resource, idx) => ({
    id: resource.id,
    label: resource.logicalName,
    type: String(resource.type),
    status: 'planned',
    confidence: clampConfidence(rawNodes[idx]?.confidence),
  }));

  const edges = resources.flatMap((resource) =>
    resource.relationships.map((relationship) => ({
      id: `${resource.id}-${relationship.targetLogicalName}`,
      source: resource.id,
      target: resources.find((r) => r.logicalName === relationship.targetLogicalName)?.id || resource.id,
      label: String(relationship.type),
      confidence: clampConfidence((relationship.metadata as { confidence?: number } | undefined)?.confidence),
    }))
  );

  return {
    resources,
    graphModel: {
      planned: { nodes, edges },
      terraform: { nodes: [], edges: [] },
      deployed: { nodes: [], edges: [] },
    },
  };
}

function clampConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : 0.85;
  if (!Number.isFinite(numeric)) return 0.85;
  return Math.max(0, Math.min(1, numeric));
}
