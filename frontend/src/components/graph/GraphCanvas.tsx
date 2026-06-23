import { useMemo } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from './nodeTypes';
import { layoutGraph } from './layout';
import type { GraphLayerData, GraphNodeData } from './types';

const DEFAULT_EDGE_COLOR = '#3a4453';

export function GraphCanvas({
  data,
  selectedNodeId,
  onSelectNode,
}: {
  data: GraphLayerData;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodeData | null) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node[] = data.nodes.map((node) => ({
      id: node.id,
      type: 'resource',
      position: { x: 0, y: 0 },
      data: {
        name: node.name,
        kind: node.kind,
        drifted: node.drifted,
        driftSeverity: node.driftSeverity,
        selected: node.id === selectedNodeId,
      },
    }));

    const rfEdges: Edge[] = data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      labelStyle: { fill: '#94a3b8', fontSize: 10 },
      labelBgStyle: { fill: '#0f172a' },
      style: { stroke: DEFAULT_EDGE_COLOR },
      markerEnd: { type: MarkerType.ArrowClosed, color: DEFAULT_EDGE_COLOR },
    }));

    return { nodes: layoutGraph(rfNodes, rfEdges), edges: rfEdges };
  }, [data, selectedNodeId]);

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNodeData>();
    data.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [data]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_event, node) => onSelectNode(nodeById.get(node.id) ?? null)}
      onPaneClick={() => onSelectNode(null)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      <Controls className="!border-slate-700 !bg-slate-800" />
    </ReactFlow>
  );
}
