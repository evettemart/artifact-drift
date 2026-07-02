import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  scans,
  projects,
  integrations,
  findings as findingsTable,
  resources as resourcesTable,
} from '../db/schema';
import type { IntegrationRow } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { getLatestArtifacts, runFullAnalysis, persistAnalysis } from '../services/analysis';
import { interpretStaticDiagram } from '../services/agents/designIntentStatic';
import { fetchTerraformStateResources } from '../services/agents/terraformState';
import { fetchAwsInventory } from '../services/agents/awsInventory';
import {
  normalizeAndValidateGraphModel,
  renderMermaidFromGraphModel,
  type CanonicalGraphModel,
} from '../services/agents/graphModel';
import type { NormalizedResource } from '../types/shared';
import { config } from '../config';

const router = express.Router();

// Integrations persistence ---------------------------------------------------
const DEFAULT_PROJECT_ID = 'demo-project';
const PROJECT_ROOT = path.join(__dirname, '../..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'data', 'uploads');
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Maps a frontend integration kind to its drift layer (mirrors the UI schema).
const KIND_LAYER: Record<string, 'intent' | 'terraform' | 'runtime'> = {
  aws: 'runtime',
  terraform: 'terraform',
  vault: 'runtime',
  drawio: 'intent',
  image: 'intent',
  confluence: 'intent',
};

interface UploadPayload {
  name: string;
  dataUrl: string;
}

interface ClientIntegration {
  id: string;
  projectId: string;
  kind: string;
  name: string;
  layer: 'intent' | 'terraform' | 'runtime';
  status: string;
  config: Record<string, string>;
  lastSync?: string;
}

// Frontend integration card only understands these statuses; older/seeded rows
// may carry other values (e.g. 'active'), which we normalize so the UI renders.
const CLIENT_STATUSES = new Set(['connected', 'error', 'unconfigured', 'syncing']);

function normalizeStatus(status: string): string {
  if (CLIENT_STATUSES.has(status)) {
    return status;
  }
  return status === 'active' ? 'connected' : 'unconfigured';
}

// Maps a stored row to the shape the Integrations UI expects. Secrets stored in
// `credentials_json` are never included in the response.
function toClientIntegration(row: IntegrationRow): ClientIntegration {
  return {
    id: row.integrationId,
    projectId: row.projectId,
    kind: row.type,
    name: row.name,
    layer: KIND_LAYER[row.type] ?? 'intent',
    status: normalizeStatus(row.status),
    config: parseJson<Record<string, string>>(row.configJson, {}),
    lastSync: row.lastSyncAt ?? undefined,
  };
}

// Decodes a base64 data-URL upload to disk under data/uploads/<integrationId>/
// and returns the project-relative stored path.
async function saveUpload(
  integrationId: string,
  key: string,
  file: UploadPayload,
): Promise<string> {
  const match = /^data:[^;]*;base64,(.*)$/s.exec(file?.dataUrl ?? '');
  if (!match) {
    throw new Error('Invalid file upload payload');
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Uploaded file exceeds the maximum allowed size');
  }
  const safeName = path.basename(file.name || `${key}.bin`).replace(/[^\w.\-]+/g, '_');
  const dir = path.join(UPLOADS_DIR, path.basename(integrationId));
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, safeName);
  await fs.writeFile(dest, buffer);
  return path.relative(PROJECT_ROOT, dest);
}

// Persists uploads referenced in a create/update payload into the config map.
async function applyUploads(
  integrationId: string,
  config: Record<string, string>,
  files: Record<string, UploadPayload> | undefined,
): Promise<void> {
  for (const [key, file] of Object.entries(files ?? {})) {
    const rel = await saveUpload(integrationId, key, file);
    config[key] = path.basename(rel); // shown on the card
    config[`_${key}_path`] = rel; // hidden stored reference
  }
}

// Ensures the project an integration is attached to exists, so the integrations
// foreign key constraint is satisfied even in live mode (no seeded projects).
async function ensureProject(projectId: string): Promise<void> {
  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.projectId, projectId))
    .limit(1);
  if (existing.length > 0) {
    return;
  }
  const now = new Date().toISOString();
  await db.insert(projects).values({
    projectId,
    name: projectId === DEFAULT_PROJECT_ID ? 'Demo Infrastructure Project' : projectId,
    description: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

// Live-mode reads come from the persisted DB tables (no bundled example data).
// Returns the most recently created *completed* scan row, or null when none
// exist. Configured-but-unexecuted scans (status 'configured') are ignored so
// Reports/Graphs stay empty until an analysis has actually produced results.
async function latestScanRow() {
  const rows = await db
    .select()
    .from(scans)
    .where(eq(scans.status, 'completed'))
    .orderBy(desc(scans.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

type ScanRow = typeof scans.$inferSelect;

function scanConfig(row: ScanRow): Record<string, unknown> {
  return parseJson<Record<string, unknown>>(row.configJson, {});
}

function workspaceIdForRun(row: ScanRow): string | null {
  const config = scanConfig(row);
  return typeof config.workspaceId === 'string' ? config.workspaceId : null;
}

async function latestRunForWorkspace(workspaceId: string): Promise<ScanRow | null> {
  const completed = await db
    .select()
    .from(scans)
    .where(eq(scans.status, 'completed'))
    .orderBy(desc(scans.createdAt));
  const matched = completed.find((row) => workspaceIdForRun(row) === workspaceId);
  return matched ?? null;
}

async function resolveRequestedScan(requestedScanId: string): Promise<ScanRow | null> {
  if (!requestedScanId) {
    return latestScanRow();
  }

  const byId = (
    await db.select().from(scans).where(eq(scans.scanId, requestedScanId)).limit(1)
  )[0] ?? null;

  if (!byId) {
    return null;
  }

  if (byId.status !== 'configured') {
    return byId;
  }

  return latestRunForWorkspace(byId.scanId);
}

// Maps a persisted finding row back to the API finding shape.
function rowToFinding(row: typeof findingsTable.$inferSelect) {
  const prefix = `${row.scanId}:`;
  const driftId = row.driftId.startsWith(prefix)
    ? row.driftId.slice(prefix.length)
    : row.driftId;
  return {
    driftId,
    driftType: row.driftType,
    severity: row.severity,
    status: row.status,
    resourceType: row.resourceType,
    provider: row.provider,
    region: row.region,
    logicalName: row.logicalName,
    diffSummary: row.diffSummary,
    expected: parseJson<unknown>(row.expectedJson, null),
    observed: parseJson<unknown>(row.observedJson, null),
    attributeDiffs: parseJson<unknown>(row.attributeDiffsJson, undefined),
    reasoning: parseJson<unknown>(row.reasoningJson, undefined),
    detectedAt: row.detectedAt,
    scanId: row.scanId,
  };
}

// Maps a persisted resource row to the normalized shape used by the graph.
function rowToResource(row: typeof resourcesTable.$inferSelect): NormalizedResource {
  return {
    id: row.resourceId,
    logicalName: row.logicalName,
    type: row.type,
    provider: row.provider,
    region: row.region,
    source: row.source,
    attributes: parseJson<Record<string, unknown>>(row.attributesJson, {}),
    tags: parseJson<Record<string, string>>(row.tagsJson, {}),
    relationships: parseJson<NormalizedResource['relationships']>(row.relationshipsJson, []),
    sensitiveRedacted: row.sensitiveRedacted,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
  } as unknown as NormalizedResource;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function deriveComplianceScore(statisticsJson: string | null | undefined, fallback: number): number {
  const stats = parseJson<{
    bySeverity?: Record<string, number>;
    driftsBySeverity?: Record<string, number>;
  }>(statisticsJson, {});

  const bySeverity = stats.bySeverity ?? stats.driftsBySeverity ?? {};
  const counts = {
    critical: Number(bySeverity.critical ?? 0),
    high: Number(bySeverity.high ?? 0),
    medium: Number(bySeverity.medium ?? 0),
    low: Number(bySeverity.low ?? 0),
    info: Number(bySeverity.info ?? 0),
  };

  const penalty =
    counts.critical * 25 +
    counts.high * 10 +
    counts.medium * 4 +
    counts.low * 1 +
    counts.info * 0;

  // Normalized decay keeps scores meaningful across large finding sets.
  const normalized = 100 * Math.exp(-penalty / 100);
  const derived = Math.max(0, Math.min(100, Math.round(normalized)));

  if (!Number.isFinite(derived)) {
    return fallback;
  }
  return derived;
}

type DriftLayer = 'planned' | 'terraform' | 'deployed';

function runId(base: DriftLayer, target: DriftLayer): string {
  return `${base}__${target}`;
}

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
      return { base: 'terraform', target: 'deployed' };
  }
}

function labelForLayer(layer: DriftLayer): string {
  if (layer === 'planned') return 'Planned Architecture';
  if (layer === 'terraform') return 'Terraform State';
  return 'Deployed Infrastructure';
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  status: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

// Build a single graph layer (nodes + edges) from normalized resources.
function buildLayerGraph(
  resources: NormalizedResource[],
  status: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = resources.map((resource) => ({
    id: resource.logicalName,
    label: resource.logicalName,
    type: String(resource.type),
    status,
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const resource of resources) {
    for (const relationship of resource.relationships ?? []) {
      const source = resource.logicalName;
      const target = relationship.targetLogicalName;
      // Skip dangling edges so React Flow doesn't reference missing nodes.
      if (!nodeIds.has(source) || !nodeIds.has(target)) {
        continue;
      }
      const id = `${source}->${target}:${String(relationship.type)}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      edges.push({ id, source, target, label: String(relationship.type) });
    }
  }
  return { nodes, edges };
}

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    demoMode: process.env.DEMO_MODE === 'true',
    timestamp: new Date().toISOString(),
    llm: {
      enabled: config.llm.enabled,
      provider: config.llm.provider,
      model: config.llm.model,
    },
  });
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

// Create project (settings workflow)
router.post('/projects', async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const now = new Date().toISOString();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project';
    const projectId = `proj-${slug}-${Date.now().toString(36)}`;

    await db.insert(projects).values({
      projectId,
      name,
      description: description || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (created[0]) {
      return res.status(201).json(created[0]);
    }

    return res.status(201).json({
      projectId,
      name,
      description: description || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: string }).message === 'string' &&
      (error as { message: string }).message.toLowerCase().includes('unique')
    ) {
      return res.status(409).json({ error: 'A project with this identifier already exists' });
    }
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// Settings view of projects with scan counts
router.get('/settings/projects', async (_req: Request, res: Response) => {
  try {
    const allProjects = await db.select().from(projects);
    const allScans = await db.select().from(scans).where(eq(scans.status, 'configured'));

    const scanCountByProject = new Map<string, number>();
    for (const scan of allScans) {
      const current = scanCountByProject.get(scan.projectId) ?? 0;
      scanCountByProject.set(scan.projectId, current + 1);
    }

    const payload = allProjects.map((project) => ({
      ...project,
      scanCount: scanCountByProject.get(project.projectId) ?? 0,
    }));

    res.json(payload);
  } catch (error) {
    console.error('Error in settings projects endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch settings projects' });
  }
});

// Settings view of scans for a project
router.get('/settings/scans', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.query.projectId ?? '').trim();
    const projectScans = projectId
      ? await db
          .select()
          .from(scans)
          .where(eq(scans.projectId, projectId))
      : await db.select().from(scans);

    const workspaceRows = projectScans.filter((scan) => scan.status === 'configured');

    const payload = workspaceRows.map((scan) => {
      const config = parseJson<{ name?: string; selectedIntegrations?: string[] }>(
        scan.configJson,
        {}
      );
      const selectedIntegrations = Array.isArray(config.selectedIntegrations)
        ? config.selectedIntegrations
        : [];

      return {
        scanId: scan.scanId,
        projectId: scan.projectId,
        name: config.name ?? scan.scanId,
        status: scan.status ?? 'configured',
        createdAt: scan.createdAt,
        selectedIntegrations,
        outputPlan: {
          driftItems: 'generated per scan',
          graphOutputs: selectedIntegrations.length,
        },
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error('Error in settings scans endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch settings scans' });
  }
});

// Create scan configuration for a project with selected integrations
router.post('/settings/scans', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.body?.projectId ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const selectedIntegrationsRaw = req.body?.selectedIntegrations;
    const selectedIntegrations = Array.isArray(selectedIntegrationsRaw)
      ? selectedIntegrationsRaw
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
      : [];

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (selectedIntegrations.length === 0) {
      return res.status(400).json({ error: 'Select at least one integration' });
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const now = new Date().toISOString();
    const scanId = `scan-${Date.now().toString(36)}`;

    await db.insert(scans).values({
      scanId,
      projectId,
      status: 'configured',
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      complianceScore: 0,
      statisticsJson: JSON.stringify({ totalFindings: 0, bySeverity: {} }),
      sourcesJson: JSON.stringify(selectedIntegrations),
      configJson: JSON.stringify({
        name,
        selectedIntegrations,
      }),
      createdAt: now,
    });

    return res.status(201).json({
      scanId,
      projectId,
      name,
      status: 'configured',
      createdAt: now,
      selectedIntegrations,
      outputPlan: {
        driftItems: 'generated per scan',
        graphOutputs: selectedIntegrations.length,
      },
    });
  } catch (error) {
    console.error('Error creating settings scan:', error);
    return res.status(500).json({ error: 'Failed to create scan' });
  }
});

// Update a configured scan (workspace) selection.
router.patch('/settings/scans/:scanId', async (req: Request, res: Response) => {
  try {
    const { scanId } = req.params;
    const selectedIntegrationsRaw = req.body?.selectedIntegrations;
    const selectedIntegrations = Array.isArray(selectedIntegrationsRaw)
      ? selectedIntegrationsRaw
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
      : [];
    const maybeName = req.body?.name;

    if (selectedIntegrations.length === 0) {
      return res.status(400).json({ error: 'Select at least one integration' });
    }

    const existing = await db
      .select()
      .from(scans)
      .where(eq(scans.scanId, scanId))
      .limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const scan = existing[0];
    const currentConfig = parseJson<{ name?: string; selectedIntegrations?: string[] }>(
      scan.configJson,
      {}
    );
    const name =
      typeof maybeName === 'string' && maybeName.trim().length > 0
        ? maybeName.trim()
        : currentConfig.name ?? scan.scanId;

    await db
      .update(scans)
      .set({
        sourcesJson: JSON.stringify(selectedIntegrations),
        configJson: JSON.stringify({
          ...currentConfig,
          name,
          selectedIntegrations,
        }),
      })
      .where(eq(scans.scanId, scanId));

    const updated = await db
      .select()
      .from(scans)
      .where(eq(scans.scanId, scanId))
      .limit(1);
    const row = updated[0];
    const cfg = parseJson<{ name?: string; selectedIntegrations?: string[] }>(row.configJson, {});
    const selected = Array.isArray(cfg.selectedIntegrations) ? cfg.selectedIntegrations : [];

    return res.json({
      scanId: row.scanId,
      projectId: row.projectId,
      name: cfg.name ?? row.scanId,
      status: row.status ?? 'configured',
      createdAt: row.createdAt,
      selectedIntegrations: selected,
      outputPlan: {
        driftItems: 'generated per scan',
        graphOutputs: selected.length,
      },
    });
  } catch (error) {
    console.error('Error updating settings scan:', error);
    return res.status(500).json({ error: 'Failed to update scan' });
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
      return res.status(404).json({ error: 'Project not found' });
    }
    
    return res.json(project[0]);
  } catch (error) {
    console.error('Error in project endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Delete a project and everything attached to it (integrations + uploaded files,
// scans and their findings/resources).
router.delete('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove integrations (and their uploaded files) for this project.
    const projectIntegrations = await db
      .select()
      .from(integrations)
      .where(eq(integrations.projectId, projectId));
    for (const integration of projectIntegrations) {
      await fs.rm(path.join(UPLOADS_DIR, path.basename(integration.integrationId)), {
        recursive: true,
        force: true,
      });
    }
    await db.delete(integrations).where(eq(integrations.projectId, projectId));

    // Remove scans and their findings/resources.
    const projectScans = await db
      .select()
      .from(scans)
      .where(eq(scans.projectId, projectId));
    for (const scan of projectScans) {
      await db.delete(findingsTable).where(eq(findingsTable.scanId, scan.scanId));
      await db.delete(resourcesTable).where(eq(resourcesTable.scanId, scan.scanId));
    }
    await db.delete(scans).where(eq(scans.projectId, projectId));

    await db.delete(projects).where(eq(projects.projectId, projectId));
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get integrations for a project
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = projectId
      ? await db
          .select()
          .from(integrations)
          .where(eq(integrations.projectId, projectId as string))
      : await db.select().from(integrations);
    res.json(rows.map(toClientIntegration));
  } catch (error) {
    console.error('Error in integrations endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Create an integration (live mode). Non-secret values are stored in
// config_json; secret values in credentials_json; uploaded files on disk.
router.post('/integrations', async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const kind = String(body.kind ?? '').trim();
    if (!kind || !(kind in KIND_LAYER)) {
      return res.status(400).json({ error: 'Unknown integration kind' });
    }
    const config: Record<string, string> = { ...(body.config ?? {}) };
    const secrets: Record<string, string> = { ...(body.secrets ?? {}) };
    const integrationId = `int-${kind}-${randomUUID().slice(0, 8)}`;
    await applyUploads(integrationId, config, body.files);

    const name = String(body.name ?? '').trim() || config.diagram_name || kind;
    const projectId = String(body.projectId ?? DEFAULT_PROJECT_ID);
    await ensureProject(projectId);
    const now = new Date().toISOString();
    await db.insert(integrations).values({
      integrationId,
      projectId,
      name,
      type: kind,
      status: 'connected',
      configJson: JSON.stringify(config),
      credentialsJson: Object.keys(secrets).length ? JSON.stringify(secrets) : null,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.integrationId, integrationId));
    return res.status(201).json(toClientIntegration(row));
  } catch (error) {
    console.error('Error creating integration:', error);
    return res.status(500).json({ error: 'Failed to create integration' });
  }
});

// Update an existing integration.
router.put('/integrations/:integrationId', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const [existing] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.integrationId, integrationId));
    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    const body = req.body ?? {};
    const config: Record<string, string> = {
      ...parseJson<Record<string, string>>(existing.configJson, {}),
      ...(body.config ?? {}),
    };
    await applyUploads(integrationId, config, body.files);

    const incomingSecrets: Record<string, string> = body.secrets ?? {};
    const credentialsJson = Object.keys(incomingSecrets).length
      ? JSON.stringify({
          ...parseJson<Record<string, string>>(existing.credentialsJson ?? null, {}),
          ...incomingSecrets,
        })
      : existing.credentialsJson;
    const name = String(body.name ?? '').trim() || config.diagram_name || existing.name;
    const now = new Date().toISOString();
    await db
      .update(integrations)
      .set({ name, configJson: JSON.stringify(config), credentialsJson, updatedAt: now })
      .where(eq(integrations.integrationId, integrationId));

    const [row] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.integrationId, integrationId));
    return res.json(toClientIntegration(row));
  } catch (error) {
    console.error('Error updating integration:', error);
    return res.status(500).json({ error: 'Failed to update integration' });
  }
});

// Delete an integration and any uploaded files it owns. Deletion is blocked
// when a scan in the same project still references the integration's kind.
router.delete('/integrations/:integrationId', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const [existing] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.integrationId, integrationId));
    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // An integration is "associated" to a scan when that scan (in the same
    // project) selected the integration's kind. Block deletion in that case.
    const projectScans = await db
      .select()
      .from(scans)
      .where(eq(scans.projectId, existing.projectId));
    const associatedScans = projectScans.filter((scan) => {
      const config = parseJson<{ name?: string; selectedIntegrations?: string[] }>(
        scan.configJson,
        {}
      );
      const selected = Array.isArray(config.selectedIntegrations)
        ? config.selectedIntegrations
        : [];
      return selected.includes(existing.type);
    });
    if (associatedScans.length > 0) {
      const scanNames = associatedScans.map((scan) => {
        const config = parseJson<{ name?: string }>(scan.configJson, {});
        return config.name || scan.scanId;
      });
      return res.status(409).json({
        error: `Cannot delete "${existing.name}" because it is used by ${associatedScans.length} scan(s): ${scanNames.join(', ')}. Remove it from those scans first.`,
      });
    }

    await db.delete(integrations).where(eq(integrations.integrationId, integrationId));
    await fs.rm(path.join(UPLOADS_DIR, path.basename(integrationId)), {
      recursive: true,
      force: true,
    });
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting integration:', error);
    return res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// Run analysis (mock mode)
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const requestedWorkspaceScanId = String(req.body?.scanId ?? '').trim();
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Load mock scan result
      const mockDataPath = path.join(__dirname, '../../data/mock/scan-result.json');
      const mockData = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
      return res.json(mockData);
    } else {
      if (!requestedWorkspaceScanId) {
        return res.status(400).json({
          error: 'scanId is required for static-image analysis',
        });
      }

      const workspace = (
        await db
          .select()
          .from(scans)
          .where(eq(scans.scanId, requestedWorkspaceScanId))
          .limit(1)
      )[0];

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace scan not found' });
      }

      const workspaceConfig = parseJson<{ name?: string; selectedIntegrations?: string[] }>(
        workspace.configJson,
        {}
      );
      const selectedKinds = Array.isArray(workspaceConfig.selectedIntegrations)
        ? workspaceConfig.selectedIntegrations
        : [];
      const selectedTokens = new Set(selectedKinds.map((value) => value.toLowerCase()));
      const integrationMatchesSelection = (integration: IntegrationRow): boolean => {
        const typeToken = integration.type.toLowerCase();
        const idToken = integration.integrationId.toLowerCase();
        const nameToken = integration.name.toLowerCase();
        return (
          selectedTokens.has(typeToken) ||
          selectedTokens.has(idToken) ||
          selectedTokens.has(nameToken)
        );
      };

      const allProjectIntegrations = await db
        .select()
        .from(integrations)
        .where(eq(integrations.projectId, workspace.projectId));
      const selectedIntegrations = allProjectIntegrations.filter(integrationMatchesSelection);

      const terraformIntegrations = selectedIntegrations.filter(
        (integration) => integration.type === 'terraform'
      );
      if (terraformIntegrations.length === 0 && selectedTokens.has('terraform')) {
        const allTerraformIntegrations = await db.select().from(integrations);
        terraformIntegrations.push(
          ...allTerraformIntegrations.filter(
            (integration) =>
              integration.type === 'terraform' && integrationMatchesSelection(integration)
          )
        );
      }
      const terraformAgentResult =
        terraformIntegrations.length > 0
          ? await fetchTerraformStateResources(terraformIntegrations)
          : { resources: [], parsedIntegrations: [], warnings: [] };

      for (const warning of terraformAgentResult.warnings) {
        console.warn('[terraform-state-agent]', warning);
      }

      // Sub-Task 1: filter AWS integrations from the workspace selection
      // Mirrors the 3-level fallback used by terraform integrations above:
      //   1. selected integrations for this project
      //   2. all integrations for this project
      //   3. all integrations globally (integrations may live under 'demo-project')
      let awsIntegrations = selectedIntegrations.filter(
        (integration) => integration.type === 'aws'
      );
      if (awsIntegrations.length === 0) {
        awsIntegrations = allProjectIntegrations.filter(
          (integration) => integration.type === 'aws'
        );
      }
      if (awsIntegrations.length === 0 && selectedTokens.has('aws')) {
        const allGlobalIntegrations = await db.select().from(integrations);
        awsIntegrations = allGlobalIntegrations.filter(
          (integration) => integration.type === 'aws'
        );
      }

      // Sub-Task 2: call fetchAwsInventory using the integration's configured region
      const awsAgentResult =
        awsIntegrations.length > 0
          ? await fetchAwsInventory({
              region: parseJson<{ region?: string }>(awsIntegrations[0].configJson, {}).region,
            })
          : { resources: [], source: 'mock' as const, region: '' };
      console.info(
        `[aws-inventory-agent] source=${awsAgentResult.source} resources=${awsAgentResult.resources.length}`
      );

      let staticDiagramIntegrations = selectedIntegrations.filter(
        (integration) => integration.type === 'image' || integration.type === 'drawio'
      );

      if (staticDiagramIntegrations.length === 0) {
        staticDiagramIntegrations = allProjectIntegrations.filter(
          (integration) => integration.type === 'image' || integration.type === 'drawio'
        );
      }

      if (staticDiagramIntegrations.length === 0) {
        const allStaticIntegrations = await db
          .select()
          .from(integrations);
        staticDiagramIntegrations = allStaticIntegrations.filter(
          (integration) => integration.type === 'image' || integration.type === 'drawio'
        );
      }

      if (staticDiagramIntegrations.length === 0) {
        return res.status(400).json({
          error: 'No static image integration found in workspace project or globally',
        });
      }

      const interpretationErrors: string[] = [];
      const interpreted = (
        await Promise.all(
          staticDiagramIntegrations.map(async (integration) => {
            try {
              const config = parseJson<Record<string, string>>(integration.configJson, {});
              const storedPath =
                config._image_file_path ||
                config._diagram_file_path ||
                config.image_file ||
                config.diagram_file;
              return await interpretStaticDiagram({
                integrationId: integration.integrationId,
                integrationName: integration.name,
                storedPath,
                originalFileName: config.image_file || config.diagram_file,
              });
            } catch (error) {
              interpretationErrors.push(
                error instanceof Error ? error.message : 'Unknown interpretation error'
              );
              return null;
            }
          })
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);

      if (interpreted.length === 0) {
        return res.status(400).json({
          error:
            interpretationErrors[0] ??
            'Static image integration found but interpretation could not be performed',
        });
      }

      const combinedResources = interpreted.flatMap((result) => result.resources);
      const rawGraph = interpreted.reduce(
        (acc, result) => {
          acc.planned.nodes.push(...result.graphModel.planned.nodes);
          acc.planned.edges.push(...result.graphModel.planned.edges);
          return acc;
        },
        {
          planned: {
            nodes: [] as Array<{
              id: string;
              label: string;
              type: string;
              status: string;
              confidence?: number;
            }>,
            edges: [] as Array<{
              id: string;
              source: string;
              target: string;
              label: string;
              confidence?: number;
            }>,
          },
          terraform: {
            nodes: [] as Array<{
              id: string;
              label: string;
              type: string;
              status: string;
              confidence?: number;
            }>,
            edges: [] as Array<{
              id: string;
              source: string;
              target: string;
              label: string;
              confidence?: number;
            }>,
          },
          deployed: {
            nodes: [] as Array<{
              id: string;
              label: string;
              type: string;
              status: string;
              confidence?: number;
            }>,
            edges: [] as Array<{
              id: string;
              source: string;
              target: string;
              label: string;
              confidence?: number;
            }>,
          },
        }
      );

      const normalizedGraph = normalizeAndValidateGraphModel(rawGraph as CanonicalGraphModel);
      const mermaid = renderMermaidFromGraphModel(normalizedGraph.graphModel, 'planned');
      const terraformGraphLayer = buildLayerGraph(terraformAgentResult.resources, 'managed');
      // Sub-Task 3: build the deployed graph layer from AWS inventory results
      const deployedGraphLayer = buildLayerGraph(awsAgentResult.resources, 'deployed');

      const artifacts = runFullAnalysis({
        scanId: `scan-${Date.now().toString(36)}`,
        projectId: workspace.projectId,
        intentResources: combinedResources,
        terraformResources: terraformAgentResult.resources,
        awsResources: awsAgentResult.resources,
        awsSource: awsAgentResult.source,
        scanConfig: {
          workspaceId: workspace.scanId,
          workspaceName: workspaceConfig.name ?? workspace.scanId,
          name: workspaceConfig.name ?? workspace.scanId,
          selectedIntegrations: selectedKinds,
        },
        sourceMetadata: {
          graphModel: {
            planned: normalizedGraph.graphModel.planned,
            terraform: terraformGraphLayer,
            deployed: deployedGraphLayer,
          },
          graphModelValidation: normalizedGraph.validation,
          requiresHumanReview: normalizedGraph.requiresReview,
          mermaidDiagram: {
            planned: mermaid,
          },
          intent: {
            type: 'static-image',
            path: 'integration-upload',
            resourceCount: combinedResources.length,
          },
          terraform: {
            type: terraformIntegrations.length > 0 ? 'integration' : 'state',
            path:
              terraformAgentResult.parsedIntegrations.length > 0
                ? `integration:${terraformAgentResult.parsedIntegrations.join(',')}`
                : 'not-configured',
            resourceCount: terraformAgentResult.resources.length,
          },
          aws: {
            source: awsAgentResult.source,
            region: awsAgentResult.region,
            resourceCount: awsAgentResult.resources.length,
          },
        },
      });
      persistAnalysis(artifacts);
      return res.json(artifacts.scan);
    }
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return res.status(500).json({ error: 'Failed to run analysis' });
  }
});

// Get findings for a scan
router.get('/findings', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Load mock findings
      const mockDataPath = path.join(__dirname, '../../data/mock/findings.json');
      const mockData = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
      res.json(mockData);
    } else {
      // Live mode: read findings for a requested scan (workspace) when provided,
      // otherwise fall back to the latest completed scan.
      const requestedScanId = String(req.query.scanId ?? '').trim();
      const scan = await resolveRequestedScan(requestedScanId);
      if (!scan) {
        res.json({ scanId: null, findings: [] });
        return;
      }
      const rows = await db
        .select()
        .from(findingsTable)
        .where(eq(findingsTable.scanId, scan.scanId));
      res.json({ scanId: scan.scanId, findings: rows.map(rowToFinding) });
    }
  } catch (error) {
    console.error('Error in findings endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

// Get resources for a scan
router.get('/resources', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Return mock resources
      res.json({
        intentResources: [],
        terraformResources: [],
        awsResources: []
      });
    } else {
      // Live mode: grouped resources for requested workspace/run when provided,
      // otherwise from the latest completed scan.
      const requestedScanId = String(req.query.scanId ?? '').trim();
      const scan = requestedScanId
        ? await resolveRequestedScan(requestedScanId)
        : await latestScanRow();
      if (!scan) {
        res.json({ intentResources: [], terraformResources: [], awsResources: [] });
        return;
      }
      const rows = (
        await db
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.scanId, scan.scanId))
      ).map(rowToResource);
      res.json({
        intentResources: rows.filter((r) => String(r.source) === 'intent'),
        terraformResources: rows.filter((r) => String(r.source) === 'terraform'),
        awsResources: rows.filter((r) => String(r.source) === 'aws'),
      });
    }
  } catch (error) {
    console.error('Error in resources endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get list of scans
router.get('/scans', async (_req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Return mock scan list
      res.json([
        {
          id: 'mock-scan-1',
          projectId: 'demo-project',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 5000,
          complianceScore: 68,
          status: 'completed'
        }
      ]);
    } else {
      // Live mode: list completed scans from the DB (most recent first).
      // Configured-but-unexecuted scans are excluded so Reports only shows
      // scans that actually produced results.
      const rows = await db
        .select()
        .from(scans)
        .where(eq(scans.status, 'completed'))
        .orderBy(desc(scans.createdAt));
      res.json(
        rows.map((scan) => ({
          id: scan.scanId,
          scanId: scan.scanId,
          projectId: scan.projectId,
          startedAt: scan.startedAt,
          completedAt: scan.completedAt,
          durationMs: scan.durationMs,
          complianceScore: deriveComplianceScore(scan.statisticsJson, scan.complianceScore),
          status: scan.status,
        }))
      );
    }
  } catch (error) {
    console.error('Error in scans endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// Delete a completed scan run
router.delete('/scans/:scanId', async (req: Request, res: Response) => {
  try {
    const scanId = String(req.params.scanId ?? '').trim();
    if (!scanId) {
      return res.status(400).json({ error: 'scanId is required' });
    }

    const existing = (
      await db
        .select()
        .from(scans)
        .where(eq(scans.scanId, scanId))
        .limit(1)
    )[0] ?? null;

    if (!existing) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    if (existing.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed scan runs can be deleted' });
    }

    await db.delete(findingsTable).where(eq(findingsTable.scanId, scanId));
    await db.delete(resourcesTable).where(eq(resourcesTable.scanId, scanId));
    await db.delete(scans).where(eq(scans.scanId, scanId));

    return res.json({ deleted: true, scanId });
  } catch (error) {
    console.error('Error deleting scan:', error);
    return res.status(500).json({ error: 'Failed to delete scan' });
  }
});

// Get drift runs (scan run comparisons)
router.get('/drift-runs', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';

    if (demoMode) {
      const findingsPath = path.join(__dirname, '../../data/mock/findings.json');
      const scanPath = path.join(__dirname, '../../data/mock/scan-result.json');

      const findingsPayload = JSON.parse(await fs.readFile(findingsPath, 'utf-8')) as {
        scanId?: string;
        findings?: Array<{ driftType?: string; severity?: string }>;
      };
      const scanPayload = JSON.parse(await fs.readFile(scanPath, 'utf-8')) as {
        projectId?: string;
        scanId?: string;
      };

      const findingsList = Array.isArray(findingsPayload.findings)
        ? findingsPayload.findings
        : [];

      const byRun = new Map<
        string,
        {
          base: DriftLayer;
          target: DriftLayer;
          summary: Record<string, number>;
          total: number;
        }
      >();

      for (const finding of findingsList) {
        const comparison = driftComparison(String(finding.driftType ?? ''));
        const id = runId(comparison.base, comparison.target);
        const existing = byRun.get(id) ?? {
          base: comparison.base,
          target: comparison.target,
          summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          total: 0,
        };

        const severity = String(finding.severity ?? 'info');
        if (severity in existing.summary) {
          existing.summary[severity] += 1;
        }
        existing.total += 1;
        byRun.set(id, existing);
      }

      const runs = Array.from(byRun.entries()).map(([id, value]) => ({
        id,
        scanId: findingsPayload.scanId ?? scanPayload.scanId ?? 'mock-scan-1',
        projectId: scanPayload.projectId ?? 'demo-project',
        baseLayer: value.base,
        targetLayer: value.target,
        baseLabel: labelForLayer(value.base),
        targetLabel: labelForLayer(value.target),
        label: `${labelForLayer(value.base)} → ${labelForLayer(value.target)}`,
        createdAt: null,
        total: value.total,
        summary: value.summary,
      }));

      return res.json({
        scanId: findingsPayload.scanId ?? scanPayload.scanId ?? 'mock-scan-1',
        projectId: scanPayload.projectId ?? 'demo-project',
        runs,
      });
    }

    const requestedScanId = String(req.query.scanId ?? '').trim();

    if (requestedScanId) {
      const requestedRow = (
        await db
          .select()
          .from(scans)
          .where(eq(scans.scanId, requestedScanId))
          .limit(1)
      )[0] ?? null;

      if (requestedRow?.status === 'configured') {
        const completed = await db
          .select()
          .from(scans)
          .where(eq(scans.status, 'completed'))
          .orderBy(desc(scans.createdAt));

        const workspaceRuns = completed.filter(
          (row) => workspaceIdForRun(row) === requestedRow.scanId
        );

        const runPayload = await Promise.all(
          workspaceRuns.map(async (run) => {
            const runFindings = await db
              .select()
              .from(findingsTable)
              .where(eq(findingsTable.scanId, run.scanId));

            const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
            for (const finding of runFindings) {
              const severity = String(finding.severity ?? 'info') as keyof typeof summary;
              if (severity in summary) {
                summary[severity] += 1;
              }
            }

            const sources = parseJson<Record<string, unknown>>(run.sourcesJson, {});
            const hasGraphModel = Boolean(sources.graphModel && typeof sources.graphModel === 'object');
            const total = runFindings.length;

            const runAt = run.completedAt || run.startedAt || run.createdAt;
            const runLabel = runAt
              ? `${new Date(runAt).toLocaleString()} · ${total} finding${total !== 1 ? 's' : ''}`
              : `${run.scanId} · ${total} finding${total !== 1 ? 's' : ''}`;
            return {
              id: run.scanId,
              scanId: run.scanId,
              projectId: run.projectId,
              baseLayer: 'planned',
              targetLayer: 'deployed',
              baseLabel: 'Planned Architecture',
              targetLabel: hasGraphModel ? 'Interpreted Graph' : 'Detected Drift',
              label: runLabel,
              createdAt: runAt,
              total,
              summary,
            };
          })
        );

        return res.json({
          scanId: requestedRow.scanId,
          projectId: requestedRow.projectId,
          runs: runPayload,
        });
      }
    }

    const scan = await resolveRequestedScan(requestedScanId);
    if (!scan) {
      return res.json({ scanId: null, projectId: null, runs: [] });
    }
    const findingRows = await db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.scanId, scan.scanId));
    const liveByRun = new Map<
      string,
      { base: DriftLayer; target: DriftLayer; summary: Record<string, number>; total: number }
    >();

    for (const finding of findingRows) {
      const comparison = driftComparison(String(finding.driftType ?? ''));
      const id = runId(comparison.base, comparison.target);
      const existing = liveByRun.get(id) ?? {
        base: comparison.base,
        target: comparison.target,
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        total: 0,
      };
      const severity = String(finding.severity ?? 'info');
      if (severity in existing.summary) {
        existing.summary[severity] += 1;
      }
      existing.total += 1;
      liveByRun.set(id, existing);
    }

    const runs = Array.from(liveByRun.entries()).map(([id, value]) => ({
      id,
      scanId: scan.scanId,
      projectId: scan.projectId,
      baseLayer: value.base,
      targetLayer: value.target,
      baseLabel: labelForLayer(value.base),
      targetLabel: labelForLayer(value.target),
      label: `${labelForLayer(value.base)} → ${labelForLayer(value.target)}`,
      createdAt: scan.completedAt || scan.startedAt || scan.createdAt,
      total: value.total,
      summary: value.summary,
    }));

    if (runs.length === 0) {
      const sources = parseJson<Record<string, unknown>>(scan.sourcesJson, {});
      if (sources.graphModel && typeof sources.graphModel === 'object') {
        runs.push({
          id: 'interpreted_graph',
          scanId: scan.scanId,
          projectId: scan.projectId,
          baseLayer: 'planned',
          targetLayer: 'deployed',
          baseLabel: 'Planned Architecture',
          targetLabel: 'Interpreted Graph',
          label: 'Interpreted Diagram Graph',
          createdAt: scan.completedAt || scan.startedAt || scan.createdAt,
          total: 0,
          summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        });
      }
    }

    return res.json({
      scanId: scan.scanId,
      projectId: scan.projectId,
      runs,
    });
  } catch (error) {
    console.error('Error in drift-runs endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch drift runs' });
  }
});

// Get graph data
router.get('/graph', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Return mock graph data
      const mockGraph = {
        planned: {
          nodes: [
            { id: 'vpc-1', label: 'VPC', type: 'AWS::EC2::VPC', status: 'planned' },
            { id: 'subnet-1', label: 'Public Subnet', type: 'AWS::EC2::Subnet', status: 'planned' },
            { id: 'subnet-2', label: 'Private Subnet', type: 'AWS::EC2::Subnet', status: 'planned' },
            { id: 'igw-1', label: 'Internet Gateway', type: 'AWS::EC2::InternetGateway', status: 'planned' },
            { id: 'ec2-1', label: 'Web Server', type: 'AWS::EC2::Instance', status: 'planned' },
            { id: 'rds-1', label: 'Database', type: 'AWS::RDS::DBInstance', status: 'planned' },
          ],
          edges: [
            { id: 'e1', source: 'vpc-1', target: 'subnet-1', label: 'contains' },
            { id: 'e2', source: 'vpc-1', target: 'subnet-2', label: 'contains' },
            { id: 'e3', source: 'vpc-1', target: 'igw-1', label: 'attached' },
            { id: 'e4', source: 'subnet-1', target: 'ec2-1', label: 'hosts' },
            { id: 'e5', source: 'subnet-2', target: 'rds-1', label: 'hosts' },
          ]
        },
        terraform: {
          nodes: [
            { id: 'vpc-1', label: 'VPC', type: 'aws_vpc', status: 'managed' },
            { id: 'subnet-1', label: 'Public Subnet', type: 'aws_subnet', status: 'managed' },
            { id: 'subnet-2', label: 'Private Subnet', type: 'aws_subnet', status: 'managed' },
            { id: 'igw-1', label: 'Internet Gateway', type: 'aws_internet_gateway', status: 'managed' },
            { id: 'ec2-1', label: 'Web Server', type: 'aws_instance', status: 'managed' },
          ],
          edges: [
            { id: 'e1', source: 'vpc-1', target: 'subnet-1', label: 'contains' },
            { id: 'e2', source: 'vpc-1', target: 'subnet-2', label: 'contains' },
            { id: 'e3', source: 'vpc-1', target: 'igw-1', label: 'attached' },
            { id: 'e4', source: 'subnet-1', target: 'ec2-1', label: 'hosts' },
          ]
        },
        deployed: {
          nodes: [
            { id: 'vpc-1', label: 'VPC', type: 'AWS::EC2::VPC', status: 'deployed' },
            { id: 'subnet-1', label: 'Public Subnet', type: 'AWS::EC2::Subnet', status: 'deployed' },
            { id: 'subnet-2', label: 'Private Subnet', type: 'AWS::EC2::Subnet', status: 'deployed' },
            { id: 'igw-1', label: 'Internet Gateway', type: 'AWS::EC2::InternetGateway', status: 'deployed' },
            { id: 'ec2-1', label: 'Web Server', type: 'AWS::EC2::Instance', status: 'deployed' },
            { id: 'sg-1', label: 'Security Group', type: 'AWS::EC2::SecurityGroup', status: 'unmanaged' },
          ],
          edges: [
            { id: 'e1', source: 'vpc-1', target: 'subnet-1', label: 'contains' },
            { id: 'e2', source: 'vpc-1', target: 'subnet-2', label: 'contains' },
            { id: 'e3', source: 'vpc-1', target: 'igw-1', label: 'attached' },
            { id: 'e4', source: 'subnet-1', target: 'ec2-1', label: 'hosts' },
            { id: 'e5', source: 'ec2-1', target: 'sg-1', label: 'uses' },
          ]
        }
      };
      
      return res.json(mockGraph);
    } else {
      const requestedScanId = String(req.query.scanId ?? '').trim();
      const requestedRunId = String(req.query.runId ?? '').trim();
      const requestedRunScan = requestedRunId
        ? (
            await db
              .select()
              .from(scans)
              .where(eq(scans.scanId, requestedRunId))
              .limit(1)
          )[0] ?? null
        : null;
      const scan = requestedRunScan ?? (await resolveRequestedScan(requestedScanId));
      const emptyLayer = { nodes: [], edges: [] };
      if (!scan) {
        res.json({ planned: emptyLayer, terraform: emptyLayer, deployed: emptyLayer });
        return;
      }

      const sources = parseJson<Record<string, unknown>>(scan.sourcesJson, {});
      const storedGraph = sources.graphModel;
      const rows = (
        await db
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.scanId, scan.scanId))
      ).map(rowToResource);
      const resourceGraph = {
        planned: buildLayerGraph(rows.filter((r) => String(r.source) === 'intent'), 'planned'),
        terraform: buildLayerGraph(rows.filter((r) => String(r.source) === 'terraform'), 'managed'),
        deployed: buildLayerGraph(rows.filter((r) => String(r.source) === 'aws'), 'deployed'),
      };

      const hasLayerNodes = (layer: unknown): boolean => {
        if (!layer || typeof layer !== 'object') {
          return false;
        }
        const nodes = (layer as { nodes?: unknown }).nodes;
        return Array.isArray(nodes) && nodes.length > 0;
      };

      if (
        storedGraph &&
        typeof storedGraph === 'object' &&
        'planned' in storedGraph &&
        'terraform' in storedGraph &&
        'deployed' in storedGraph
      ) {
        const graph = storedGraph as {
          planned: { nodes: unknown[]; edges: unknown[] };
          terraform: { nodes: unknown[]; edges: unknown[] };
          deployed: { nodes: unknown[]; edges: unknown[] };
        };

        return res.json({
          planned: hasLayerNodes(graph.planned) ? graph.planned : resourceGraph.planned,
          terraform: hasLayerNodes(graph.terraform)
            ? graph.terraform
            : resourceGraph.terraform,
          deployed: hasLayerNodes(graph.deployed) ? graph.deployed : resourceGraph.deployed,
        });
      }

      res.json(resourceGraph);
      return;
    }
  } catch (error) {
    console.error('Error in graph endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch graph data' });
  }
});

// Generate report
router.get('/report', async (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query;
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      const mockDataPath = path.join(__dirname, '../../data/mock/scan-result.json');
      const mockData = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
      
      if (format === 'html') {
        // Generate simple HTML report
        const html = generateHTMLReport(mockData);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } else {
        res.json(mockData);
      }
    } else {
      // Live mode: report from the latest persisted scan.
      const scan = await latestScanRow();
      const data = scan
        ? {
            scanId: scan.scanId,
            projectId: scan.projectId,
            startedAt: scan.startedAt,
            completedAt: scan.completedAt,
            durationMs: scan.durationMs,
            complianceScore: scan.complianceScore,
            status: scan.status,
            statistics: parseJson<Record<string, unknown>>(scan.statisticsJson, {}),
            sources: parseJson<Record<string, unknown>>(scan.sourcesJson, {}),
            config: parseJson<Record<string, unknown>>(scan.configJson, {}),
            findings: (
              await db
                .select()
                .from(findingsTable)
                .where(eq(findingsTable.scanId, scan.scanId))
            ).map(rowToFinding),
          }
        : { scanId: null, complianceScore: 0, statistics: {}, sources: {}, findings: [] };
      if (format === 'html') {
        const html = generateHTMLReport(data);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } else {
        res.json(data);
      }
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
  <title>Drifters Report</title>
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
    <h1>Drifters Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Executive Summary</h2>
    <div class="score">Compliance Score: ${data.complianceScore || 0}/100</div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.totalFindings || 0}</div>
        <div class="stat-label">Total Findings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.critical || 0}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.high || 0}</div>
        <div class="stat-label">High</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.medium || 0}</div>
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
