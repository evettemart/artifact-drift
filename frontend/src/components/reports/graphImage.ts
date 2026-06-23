import dagre from 'dagre';
import { kindMeta } from '../graph/kindMeta';
import { SEVERITY_META, type Severity } from '../../lib/severity';
import type { GraphImage } from './types';

// Minimal structural shape we need from a graph layer (matches the backend
// graph payload and buildReport's GraphLayerData without coupling to it).
export interface RenderGraphNode {
  id: string;
  name: string;
  kind: string;
  drifted?: boolean;
  driftSeverity?: string | null;
}

export interface RenderGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface RenderGraphLayer {
  nodes: RenderGraphNode[];
  edges: RenderGraphEdge[];
}

const NODE_WIDTH = 184;
const NODE_HEIGHT = 60;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;
}

/**
 * Render a graph layer (the same nodes/edges shown in the Graph view) to a
 * standalone, self-contained SVG string. Uses the same dagre left-to-right
 * layout as the interactive canvas so the diagram matches what the user sees
 * on screen, with drift highlighting carried over from severity colors.
 */
export function renderGraphSvg(layer: RenderGraphLayer): GraphImage | null {
  if (!layer.nodes.length) return null;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90, marginx: 24, marginy: 24 });
  layer.nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));

  const nodeIds = new Set(layer.nodes.map((n) => n.id));
  layer.edges.forEach((e) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  const width = Math.max(320, Math.ceil(g.graph().width ?? 320));
  const height = Math.max(160, Math.ceil(g.graph().height ?? 160));

  // Edges (drawn first so nodes paint on top).
  const edgeMarkup: string[] = [];
  for (const edge of layer.edges) {
    const sp = g.node(edge.source);
    const tp = g.node(edge.target);
    if (!sp || !tp) continue;
    const x1 = sp.x + NODE_WIDTH / 2;
    const y1 = sp.y;
    const x2 = tp.x - NODE_WIDTH / 2;
    const y2 = tp.y;
    const mx = (x1 + x2) / 2;
    const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    edgeMarkup.push(
      `<path d="${path}" fill="none" stroke="#3a4453" stroke-width="1.5" marker-end="url(#arrow)" />`,
    );
    if (edge.label) {
      const label = escapeXml(truncate(edge.label, 22));
      const lx = mx;
      const ly = (y1 + y2) / 2 - 4;
      const boxW = label.length * 6.2 + 10;
      edgeMarkup.push(
        `<rect x="${lx - boxW / 2}" y="${ly - 10}" width="${boxW}" height="15" rx="3" fill="#0f172a" />` +
          `<text x="${lx}" y="${ly + 1}" fill="#94a3b8" font-size="10" text-anchor="middle" ` +
          `font-family="ui-sans-serif, system-ui, sans-serif">${label}</text>`,
      );
    }
  }

  // Nodes.
  const nodeMarkup: string[] = [];
  for (const node of layer.nodes) {
    const pos = g.node(node.id);
    if (!pos) continue;
    const x = pos.x - NODE_WIDTH / 2;
    const y = pos.y - NODE_HEIGHT / 2;
    const sev: Severity | null =
      node.drifted && node.driftSeverity ? (node.driftSeverity as Severity) : null;
    const sevMeta = sev ? SEVERITY_META[sev] ?? null : null;
    const border = sevMeta ? sevMeta.hex : '#334155';
    const name = escapeXml(truncate(node.name, 24));
    const kindLabel = escapeXml(truncate(kindMeta(node.kind).label, 26));
    nodeMarkup.push(
      '<g>' +
        `<rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="9" ` +
        `fill="#1e293b" stroke="${border}" stroke-width="2" />` +
        `<rect x="${x + 12}" y="${y + 16}" width="28" height="28" rx="6" fill="#0ea5e9" fill-opacity="0.2" />` +
        `<text x="${x + 50}" y="${y + 26}" fill="#f1f5f9" font-size="12.5" font-weight="600" ` +
        `font-family="ui-sans-serif, system-ui, sans-serif">${name}</text>` +
        `<text x="${x + 50}" y="${y + 42}" fill="#94a3b8" font-size="10.5" ` +
        `font-family="ui-sans-serif, system-ui, sans-serif">${kindLabel}</text>` +
        (sevMeta
          ? `<circle cx="${x + NODE_WIDTH - 14}" cy="${y + 14}" r="4.5" fill="${sevMeta.hex}" />`
          : '') +
        '</g>',
    );
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img">` +
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ' +
    'orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3a4453" /></marker></defs>' +
    `<rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#0b1220" />` +
    edgeMarkup.join('') +
    nodeMarkup.join('') +
    '</svg>';

  return { svg, width, height };
}
