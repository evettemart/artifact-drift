import express, { Request, Response } from 'express';
import { db } from '../db';
import { projects, integrations } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  runFullAnalysis,
  persistAnalysis,
  getLatestArtifacts,
} from '../services/analysis';
import {
  NormalizedResource,
  DriftFinding,
  ResourceType,
} from '../types/shared';

const router = express.Router();

// --- Graph helpers -------------------------------------------------------

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// --- Drift run / comparison helpers --------------------------------------

type DriftLayer = 'planned' | 'terraform' | 'deployed';

const LAYER_LABELS: Record<DriftLayer, string> = {
  planned: 'Planned Architecture',
  terraform: 'Terraform State',
  deployed: 'Deployed Infrastructure',
};

// Fixed display order for the available drift runs (base -> target).
const RUN_ORDER: Array<{ base: DriftLayer; target: DriftLayer }> = [
  { base: 'planned', target: 'deployed' },
  { base: 'terraform', target: 'deployed' },
  { base: 'planned', target: 'terraform' },
];

function runId(base: DriftLayer, target: DriftLayer): string {
  return `${base}__${target}`;
}

// Map each drift type to the source comparison (scan run) that produced it.
function driftComparison(driftType: string): { base: DriftLayer; target: DriftLayer } {
  switch (driftType) {
    case 'missing':
    case 'relationship_broken':
    case 'edge':
    case 'design':
      return { base: 'planned', target: 'deployed' };
    case 'version_mismatch':
      return { base: 'planned', target: 'terraform' };
    default:
      // unmanaged, unexpected, changed_outside_terraform, attribute(_mismatch),
      // tag(_mismatch), configuration_drift, security_group, region, ...
      return { base: 'terraform', target: 'deployed' };
  }
}

// Collapse our many internal drift types into the four UI categories.
function driftCategory(driftType: string): 'missing' | 'unexpected' | 'attribute' | 'edge' {
  switch (driftType) {
    case 'missing':
      return 'missing';
    case 'unmanaged':
    case 'unexpected':
      return 'unexpected';
    case 'relationship_broken':
    case 'edge':
      return 'edge';
    default:
      return 'attribute';
  }
}

// Attach scan + run/comparison metadata to a finding so the UI can group and
// filter drifts by project, scan, and scan run.
function enrichFinding(finding: DriftFinding, scanId: string): Record<string, unknown> {
  const comparison = driftComparison(String(finding.driftType));
  return {
    ...finding,
    scanId,
    runId: runId(comparison.base, comparison.target),
    comparison: {
      baseLayer: comparison.base,
      targetLayer: comparison.target,
      baseLabel: LAYER_LABELS[comparison.base],
      targetLabel: LAYER_LABELS[comparison.target],
    },
    category: driftCategory(String(finding.driftType)),
  };
}

// Build the list of drift runs (base -> target comparisons) present for a scan,
// each carrying a severity summary derived from its findings.
function buildDriftRuns(
  findings: DriftFinding[],
  scanId: string,
  projectId: string
): Array<Record<string, unknown>> {
  const byRun = new Map<string, DriftFinding[]>();
  for (const finding of findings) {
    const comparison = driftComparison(String(finding.driftType));
    const id = runId(comparison.base, comparison.target);
    const list = byRun.get(id) ?? [];
    list.push(finding);
    byRun.set(id, list);
  }

  return RUN_ORDER.filter(({ base, target }) => byRun.has(runId(base, target))).map(
    ({ base, target }) => {
      const id = runId(base, target);
      const list = byRun.get(id) ?? [];
      const summary: Record<string, number> = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };
      for (const finding of list) {
        const sev = String(finding.severity);
        if (sev in summary) summary[sev] += 1;
      }
      return {
        id,
        scanId,
        projectId,
        baseLayer: base,
        targetLayer: target,
        baseLabel: LAYER_LABELS[base],
        targetLabel: LAYER_LABELS[target],
        label: `${LAYER_LABELS[base]} → ${LAYER_LABELS[target]}`,
        total: list.length,
        summary,
      };
    }
  );
}

// --- Graph helpers -------------------------------------------------------

function resourceKind(type: ResourceType | string): string {
  const mapping: Record<string, string> = {
    [ResourceType.VPC]: 'aws_vpc',
    [ResourceType.SUBNET]: 'aws_subnet',
    [ResourceType.SECURITY_GROUP]: 'aws_security_group',
    [ResourceType.EC2_INSTANCE]: 'aws_instance',
    [ResourceType.ALB]: 'aws_lb',
    [ResourceType.APPLICATION_LOAD_BALANCER]: 'aws_lb',
    [ResourceType.TARGET_GROUP]: 'aws_lb_target_group',
    [ResourceType.INTERNET_GATEWAY]: 'aws_internet_gateway',
    [ResourceType.NAT_GATEWAY]: 'aws_nat_gateway',
    [ResourceType.IAM_ROLE]: 'aws_iam_role',
    [ResourceType.S3_BUCKET]: 'aws_s3_bucket',
    [ResourceType.RDS_INSTANCE]: 'aws_db_instance',
  };
  return mapping[String(type)] ?? String(type);
}

// Build one layer's graph (nodes + edges) from a set of resources, attaching
// any drift findings that affect each resource so the UI can highlight them.
function buildGraphLayer(
  resources: NormalizedResource[],
  layer: string,
  findings: DriftFinding[],
  physicalToLogical: Map<string, string>
): { nodes: unknown[]; edges: unknown[] } {
  const findingsByName = new Map<string, DriftFinding[]>();
  for (const finding of findings) {
    const list = findingsByName.get(finding.logicalName) ?? [];
    list.push(finding);
    findingsByName.set(finding.logicalName, list);
  }

  const visible = resources.filter(
    (resource) => resource.type !== ResourceType.PROVIDER
  );

  // Resolve relationship targets by either logical name or physical id, since
  // intent uses logical names while terraform/aws use physical resource ids.
  const idByKey = new Map<string, string>();
  for (const resource of visible) {
    idByKey.set(resource.logicalName, resource.id);
    const physicalId = resource.attributes['id'];
    if (typeof physicalId === 'string') {
      idByKey.set(physicalId, resource.id);
    }
  }

  const nodes = visible.map((resource) => {
    const related = findingsByName.get(resource.logicalName) ?? [];
    let driftSeverity: string | null = null;
    for (const finding of related) {
      const sev = String(finding.severity);
      if (
        driftSeverity === null ||
        (SEVERITY_RANK[sev] ?? 99) < (SEVERITY_RANK[driftSeverity] ?? 99)
      ) {
        driftSeverity = sev;
      }
    }

    return {
      id: resource.id,
      uid: resource.id,
      name: resource.logicalName,
      kind: resourceKind(resource.type),
      type: resource.type,
      layer,
      region: resource.region,
      source: resource.source,
      attributes: resource.attributes,
      tags: resource.tags,
      drifted: related.length > 0,
      driftSeverity,
      drifts: related.map((finding) => ({
        driftId: finding.driftId,
        driftType: finding.driftType,
        severity: finding.severity,
        diffSummary: finding.diffSummary,
        title: finding.reasoning?.summary ?? finding.diffSummary,
      })),
    };
  });

  // Resolve a reference (logical name or physical id) to a node id in this layer.
  const resolveNodeId = (key: unknown): string | undefined => {
    const raw = String(key);
    const direct = idByKey.get(raw);
    if (direct) return direct;
    const logical = physicalToLogical.get(raw);
    if (logical) return idByKey.get(logical);
    return undefined;
  };

  const edges: unknown[] = [];
  const seen = new Set<string>();
  const addEdge = (
    sourceKey: unknown,
    targetKey: unknown,
    label: string
  ): void => {
    const sourceId = resolveNodeId(sourceKey);
    const targetId = resolveNodeId(targetKey);
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }
    const kind = label.replace(/\s+/g, '_');
    const id = `${sourceId}__${kind}__${targetId}`;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    edges.push({ id, source: sourceId, target: targetId, kind, label });
  };

  const asKeys = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    return [];
  };

  for (const resource of visible) {
    const attributes = resource.attributes;
    const vpcRef = attributes['vpc'] ?? attributes['vpc_id'] ?? attributes['vpcId'];
    const subnetRef =
      attributes['subnet'] ?? attributes['subnet_id'] ?? attributes['subnetId'];
    const securityGroupRefs = [
      ...asKeys(attributes['security_groups']),
      ...asKeys(attributes['vpc_security_group_ids']),
      ...asKeys(attributes['security_group_ids']),
      ...asKeys(attributes['securityGroups']),
      ...asKeys(attributes['securityGroupIds']),
    ];

    switch (resource.type) {
      case ResourceType.SUBNET:
      case ResourceType.SECURITY_GROUP:
        if (vpcRef) addEdge(vpcRef, resource.logicalName, 'contains');
        break;
      case ResourceType.EC2_INSTANCE:
        if (subnetRef) addEdge(subnetRef, resource.logicalName, 'hosts');
        for (const sg of securityGroupRefs) {
          addEdge(resource.logicalName, sg, 'secured by');
        }
        break;
      case ResourceType.ALB:
      case ResourceType.APPLICATION_LOAD_BALANCER:
        for (const subnet of [
          ...asKeys(attributes['subnets']),
          ...asKeys(attributes['subnetIds']),
        ]) {
          addEdge(subnet, resource.logicalName, 'hosts');
        }
        for (const sg of securityGroupRefs) {
          addEdge(resource.logicalName, sg, 'secured by');
        }
        break;
      default:
        break;
    }

    // Fall back to any explicit relationships captured on the resource.
    for (const relationship of resource.relationships) {
      const target = relationship.targetLogicalName;
      if (relationship.type === 'member_of' || relationship.type === 'contains') {
        addEdge(target, resource.logicalName, 'contains');
      } else {
        addEdge(resource.logicalName, target, String(relationship.type).replace(/_/g, ' '));
      }
    }
  }

  return { nodes, edges };
}

// Map physical resource ids (e.g. vpc-0a1b...) to their logical names using the
// terraform layer, which records both. This lets us resolve AWS-layer edges
// whose attributes reference physical ids only.
function buildPhysicalIdIndex(
  ...resourceSets: NormalizedResource[][]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const set of resourceSets) {
    for (const resource of set) {
      const physicalId = resource.attributes['id'];
      if (typeof physicalId === 'string') {
        map.set(physicalId, resource.logicalName);
      }
    }
  }
  return map;
}

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all projects
router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const allProjects = await db.select().from(projects);
    if (allProjects.length > 0) {
      res.json(allProjects);
      return;
    }
    // Fall back to a synthesized demo project so the UI (Reports, Settings)
    // stays consistent with the generated scan/findings/graph artifacts, which
    // reference this projectId even when the projects table has not been seeded.
    const now = new Date().toISOString();
    res.json([
      {
        id: 1,
        projectId: getLatestArtifacts().scan.projectId,
        name: 'Demo Infrastructure Project',
        description: 'Sample project demonstrating architecture drift detection',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  } catch (error) {
    console.error('Error in projects endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project by ID
router.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);
    
    if (project.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    res.json(project[0]);
  } catch (error) {
    console.error('Error in project endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Get integrations for a project
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    
    if (projectId) {
      const projectIntegrations = await db
        .select()
        .from(integrations)
        .where(eq(integrations.projectId, projectId as string));
      res.json(projectIntegrations);
    } else {
      const allIntegrations = await db.select().from(integrations);
      res.json(allIntegrations);
    }
  } catch (error) {
    console.error('Error in integrations endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Run analysis (deterministic drift detection over local sources)
router.post('/analyze', async (_req: Request, res: Response) => {
  try {
    const artifacts = runFullAnalysis();
    persistAnalysis(artifacts);
    const scan = artifacts.scan;
    res.json({
      scanId: scan.scanId,
      status: 'completed',
      complianceScore: scan.complianceScore,
      findingsCount: artifacts.findings.length,
      durationMs: scan.durationMs,
    });
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    res.status(500).json({ error: 'Failed to run analysis' });
  }
});

// Get findings for a scan
router.get('/findings', async (req: Request, res: Response) => {
  try {
    const artifacts = getLatestArtifacts();
    const scanId = artifacts.scan.scanId;
    const { severity, type, runId: runIdFilter } = req.query;
    let results = artifacts.findings;
    if (severity) {
      results = results.filter((finding) => finding.severity === severity);
    }
    if (type) {
      results = results.filter((finding) => String(finding.driftType) === type);
    }
    let enriched = results.map((finding) => enrichFinding(finding, scanId));
    if (runIdFilter) {
      enriched = enriched.filter((finding) => finding.runId === runIdFilter);
    }
    res.json({ scanId, findings: enriched });
  } catch (error) {
    console.error('Error in findings endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

// Get the drift runs (base -> target comparisons) available for the latest scan
router.get('/drift-runs', async (_req: Request, res: Response) => {
  try {
    const artifacts = getLatestArtifacts();
    const { scanId, projectId } = artifacts.scan;
    res.json({
      scanId,
      projectId,
      runs: buildDriftRuns(artifacts.findings, scanId, projectId),
    });
  } catch (error) {
    console.error('Error in drift-runs endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch drift runs' });
  }
});

// Get resources for a scan, grouped by source
router.get('/resources', async (req: Request, res: Response) => {
  try {
    const artifacts = getLatestArtifacts();
    const { source } = req.query;
    const groups = {
      intentResources: artifacts.intentResources,
      terraformResources: artifacts.terraformResources,
      awsResources: artifacts.awsResources,
    };
    if (source === 'intent') {
      res.json({ intentResources: groups.intentResources, terraformResources: [], awsResources: [] });
    } else if (source === 'terraform') {
      res.json({ intentResources: [], terraformResources: groups.terraformResources, awsResources: [] });
    } else if (source === 'aws') {
      res.json({ intentResources: [], terraformResources: [], awsResources: groups.awsResources });
    } else {
      res.json(groups);
    }
  } catch (error) {
    console.error('Error in resources endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get list of scans
router.get('/scans', async (_req: Request, res: Response) => {
  try {
    const artifacts = getLatestArtifacts();
    const scan = artifacts.scan;
    res.json([
      {
        id: scan.scanId,
        scanId: scan.scanId,
        projectId: scan.projectId,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        durationMs: scan.durationMs,
        complianceScore: scan.complianceScore,
        status: 'completed',
      },
    ]);
  } catch (error) {
    console.error('Error in scans endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// Get graph data
router.get('/graph', async (_req: Request, res: Response) => {
  try {
    const artifacts = getLatestArtifacts();
    const { findings } = artifacts;
    const physicalToLogical = buildPhysicalIdIndex(
      artifacts.terraformResources,
      artifacts.intentResources,
      artifacts.awsResources
    );

    res.json({
      planned: buildGraphLayer(artifacts.intentResources, 'planned', findings, physicalToLogical),
      terraform: buildGraphLayer(artifacts.terraformResources, 'terraform', findings, physicalToLogical),
      deployed: buildGraphLayer(artifacts.awsResources, 'deployed', findings, physicalToLogical),
    });
  } catch (error) {
    console.error('Error in graph endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
});

// Generate report
router.get('/report', async (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query;
    const artifacts = getLatestArtifacts();
    const reportData = {
      ...artifacts.scan,
      findings: artifacts.findings,
    };

    if (format === 'html') {
      const html = generateHTMLReport(reportData);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } else {
      res.json(reportData);
    }
  } catch (error) {
    console.error('Error in report endpoint:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

function generateHTMLReport(data: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architecture Drift Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .score { font-size: 48px; font-weight: bold; color: #4CAF50; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9f9f9; padding: 20px; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #333; }
    .stat-label { color: #666; margin-top: 5px; }
    .finding { background: #fff; border-left: 4px solid #ff9800; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .finding.critical { border-left-color: #f44336; }
    .finding.high { border-left-color: #ff9800; }
    .finding.medium { border-left-color: #ffc107; }
    .finding.low { border-left-color: #4caf50; }
    .severity { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .severity.critical { background: #f44336; color: white; }
    .severity.high { background: #ff9800; color: white; }
    .severity.medium { background: #ffc107; color: black; }
    .severity.low { background: #4caf50; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Architecture Drift Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Executive Summary</h2>
    <div class="score">Compliance Score: ${data.complianceScore || 0}/100</div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.totalFindings || 0}</div>
        <div class="stat-label">Total Findings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.bySeverity?.critical || 0}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.bySeverity?.high || 0}</div>
        <div class="stat-label">High</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.bySeverity?.medium || 0}</div>
        <div class="stat-label">Medium</div>
      </div>
    </div>
    
    <h2>Findings</h2>
    ${(data.findings || []).map((f: any) => `
      <div class="finding ${f.severity}">
        <div>
          <span class="severity ${f.severity}">${f.severity}</span>
          <strong>${f.driftType}</strong> - ${f.resourceType} (${f.logicalName})
        </div>
        <p>${f.diffSummary}</p>
        ${f.reasoning ? `
          <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <strong>Analysis:</strong> ${f.reasoning.summary}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
}

export default router;
