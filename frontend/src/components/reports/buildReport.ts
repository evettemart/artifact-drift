import type { Integration, Layer } from '../integrations/types';
import { layerLabel } from '../integrations/types';
import type { Report, ReportFormat, ReportSection } from './types';
import { renderGraphSvg } from './graphImage';

// --- Backend shapes (subset we consume) ----------------------------------

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  type: string;
  drifted?: boolean;
  driftSeverity?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphLayerData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphData {
  planned: GraphLayerData;
  terraform: GraphLayerData;
  deployed: GraphLayerData;
}

export interface ReportFinding {
  driftId: string;
  driftType: string;
  severity: string;
  diffSummary: string;
  logicalName: string;
  resourceType: string;
  region?: string;
  runId: string;
  category: string;
  comparison?: { baseLabel: string; targetLabel: string };
  reasoning?: {
    summary?: string;
    likelyCause?: string;
    impact?: string;
    businessImpact?: string;
    recommendedAction?: string;
    terraformRemediation?: string;
  };
}

export interface DriftRun {
  id: string;
  baseLayer: string;
  targetLayer: string;
  baseLabel: string;
  targetLabel: string;
  label: string;
  total: number;
  summary: Record<string, number>;
}

export interface BuildReportInput {
  format: ReportFormat;
  runId: string; // specific run id or 'all'
  projectId: string;
  projectName: string;
  scanId: string;
  scanRunAt: string;
  complianceScore?: number;
  runs: DriftRun[];
  findings: ReportFinding[];
  graph: GraphData;
  integrations: Integration[];
}

interface BuildReportScopedInput extends BuildReportInput {
  findings: ReportFinding[];
}

// Map a graph layer key to the integration layer that feeds it.
const LAYER_BY_GRAPH: Record<keyof GraphData, Layer> = {
  planned: 'intent',
  terraform: 'terraform',
  deployed: 'runtime',
};

const GRAPH_LABELS: Record<keyof GraphData, string> = {
  planned: 'Planned Architecture',
  terraform: 'Terraform State',
  deployed: 'Deployed Infrastructure',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function summarizeSeverity(summary: Record<string, number>): string {
  const parts = SEVERITY_ORDER.filter((s) => (summary[s] ?? 0) > 0).map(
    (s) => `${summary[s]} ${s}`,
  );
  return parts.length ? parts.join(', ') : 'none';
}

function nodeNameIndex(layer: GraphLayerData): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of layer.nodes) map.set(node.id, node.name);
  return map;
}

function severityRank(severity: string): number {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    case 'info':
      return 1;
    default:
      return 0;
  }
}

function tableCell(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ')
    .trim();
}

// Build the overview section: project, scan, scan-run timestamp, integrations.
function buildOverviewSection(input: BuildReportScopedInput): ReportSection {
  const lines: string[] = [
    `- **Project:** ${input.projectName} (\`${input.projectId}\`)`,
    `- **Scan:** \`${input.scanId}\``,
    `- **Scan run:** ${new Date(input.scanRunAt).toLocaleString()}`,
  ];
  if (typeof input.complianceScore === 'number') {
    lines.push(`- **Compliance score:** ${input.complianceScore}/100`);
  }
  const totalDrifts = input.findings.length;
  lines.push(`- **Total drift findings:** ${totalDrifts}`);

  lines.push('');
  lines.push('**Connected sources**');
  if (input.integrations.length === 0) {
    lines.push('- No integrations configured.');
  } else {
    for (const integration of input.integrations) {
      lines.push(
        `- ${integration.name} — ${layerLabel(integration.layer)} (${integration.status})`,
      );
    }
  }

  return { id: 'overview', title: 'Overview', body: lines.join('\n'), citations: [] };
}

// Build one section per scan-type graph (planned / terraform / deployed),
// associating each with its integration source.
function buildGraphSections(input: BuildReportScopedInput, layers: Array<keyof GraphData>): ReportSection[] {
  const driftByResource = new Map<string, string>();
  for (const finding of input.findings) {
    const key = String(finding.logicalName ?? '').trim().toLowerCase();
    if (!key) continue;
    const sev = String(finding.severity ?? '').toLowerCase();
    const current = driftByResource.get(key);
    if (!current || severityRank(sev) > severityRank(current)) {
      driftByResource.set(key, sev);
    }
  }

  return layers.map((layerKey) => {
    const layer = input.graph[layerKey];
    const sources = input.integrations.filter(
      (i) => i.layer === LAYER_BY_GRAPH[layerKey],
    );
    const sourceLabel = sources.length
      ? sources.map((s) => s.name).join(', ')
      : 'no source connected';
    const names = nodeNameIndex(layer);

    const lines: string[] = [
      `Source: ${sourceLabel}.`,
      `- **Resources:** ${layer.nodes.length}`,
      `- **Relationships:** ${layer.edges.length}`,
    ];

    if (layer.nodes.length) {
      lines.push('');
      lines.push('**Resources**');
      lines.push('| Kind | Name | Drift |');
      lines.push('| --- | --- | --- |');
      for (const node of layer.nodes) {
        const lookup = driftByResource.get(node.name.trim().toLowerCase());
        const derived = lookup ? `Yes (${lookup.toUpperCase()})` : 'No';
        const drift = node.drifted ? `Yes (${String(node.driftSeverity ?? lookup ?? 'detected').toUpperCase()})` : derived;
        lines.push(
          `| ${tableCell(node.kind)} | ${tableCell(node.name)} | ${tableCell(drift)} |`,
        );
      }
    }

    if (layer.edges.length) {
      lines.push('');
      lines.push('**Relationships**');
      lines.push('| From | Relationship | To |');
      lines.push('| --- | --- | --- |');
      for (const edge of layer.edges) {
        const from = names.get(edge.source) ?? edge.source;
        const to = names.get(edge.target) ?? edge.target;
        lines.push(
          `| ${tableCell(from)} | ${tableCell(edge.label)} | ${tableCell(to)} |`,
        );
      }
    }

    return {
      id: `graph-${layerKey}`,
      title: `${GRAPH_LABELS[layerKey]} Graph`,
      body: lines.join('\n'),
      citations: [],
      image: renderGraphSvg(layer) ?? undefined,
    };
  });
}

// Build one section per comparison (drift run) with its drifts + recommendations.
function buildComparisonSections(input: BuildReportScopedInput, runs: DriftRun[]): ReportSection[] {
  return runs.map((run) => {
    const drifts = input.findings.filter((f) => f.runId === run.id);
    const lines: string[] = [
      `Comparison of **${run.baseLabel}** against **${run.targetLabel}**.`,
      `- **Drifts detected:** ${drifts.length} (${summarizeSeverity(run.summary)})`,
      '',
    ];

    if (drifts.length === 0) {
      lines.push('No drift detected for this comparison.');
    } else {
      lines.push('| Drift ID | Severity | Resource | Summary | Likely Cause | Impact | Recommendation |');
      lines.push('| --- | --- | --- | --- | --- | --- | --- |');
      for (const drift of drifts) {
        const title = tableCell(drift.reasoning?.summary ?? drift.diffSummary);
        const likelyCause = tableCell(drift.reasoning?.likelyCause);
        const impact = drift.reasoning?.impact ?? drift.reasoning?.businessImpact;
        const impactText = tableCell(impact);
        const recommendation =
          drift.reasoning?.recommendedAction ?? drift.reasoning?.terraformRemediation;
        const recommendationText = tableCell(recommendation);
        lines.push(
          `| ${tableCell(drift.driftId)} | ${tableCell(drift.severity.toUpperCase())} | ${tableCell(
            `${drift.resourceType}${drift.logicalName ? ` (${drift.logicalName})` : ''}`,
          )} | ${title} | ${likelyCause || '-'} | ${impactText || '-'} | ${recommendationText || '-'} |`,
        );
      }
    }

    return {
      id: `drift-${run.id}`,
      title: `Drift — ${run.label}`,
      body: lines.join('\n').trimEnd(),
      citations: drifts.map((d) => d.driftId),
    };
  });
}

let reportCounter = 0;

export function buildReport(input: BuildReportInput): Report {
  const isAll = input.runId === 'all';
  const selectedRuns = isAll
    ? input.runs
    : input.runs.filter((run) => run.id === input.runId);
  const scopedRunIds = new Set(selectedRuns.map((run) => run.id));
  const scopedFindings = isAll
    ? input.findings
    : input.findings.filter((finding) => scopedRunIds.has(finding.runId));
  const scopedInput: BuildReportScopedInput = {
    ...input,
    findings: scopedFindings,
  };

  // Which graph layers to include: for a single comparison, just the two it
  // spans; for "all", every layer.
  const layerKeys: Array<keyof GraphData> = isAll
    ? ['planned', 'terraform', 'deployed']
    : (() => {
        const run = selectedRuns[0];
        const keys = new Set<keyof GraphData>();
        const toKey = (layer: string): keyof GraphData =>
          layer === 'planned' ? 'planned' : layer === 'terraform' ? 'terraform' : 'deployed';
        if (run) {
          keys.add(toKey(run.baseLayer));
          keys.add(toKey(run.targetLayer));
        }
        return [...keys];
      })();

  const title = isAll
    ? `Architecture Drift Report — ${input.projectName}`
    : `Architecture Drift — ${selectedRuns[0]?.baseLabel ?? ''} vs ${selectedRuns[0]?.targetLabel ?? ''}`;

  const sections: ReportSection[] = [
    buildOverviewSection(scopedInput),
    ...buildGraphSections(scopedInput, layerKeys),
    ...buildComparisonSections(scopedInput, selectedRuns),
  ];

  return {
    id: `rep_${String(++reportCounter).padStart(3, '0')}`,
    title,
    format: input.format,
    status: 'ready',
    createdAt: new Date().toISOString(),
    projectId: input.projectId,
    projectName: input.projectName,
    scanId: input.scanId,
    scanRunAt: input.scanRunAt,
    runId: input.runId,
    sections,
  };
}
