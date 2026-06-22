import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "@/features/graph/nodes/nodeTypes";
import { layoutGraph } from "@/features/graph/layout";
import { SEVERITY_META } from "@/lib/severity";
import type { GraphSnapshot } from "@/api/types";
import type { ResourceNodeData } from "@/features/graph/nodes/ResourceNode";

export function GraphCanvas({
  snapshot,
  selectedNodeId,
  onSelectNode,
}: {
  snapshot: GraphSnapshot;
  selectedNodeId: string | null;
  onSelectNode: (uid: string | null) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node<ResourceNodeData>[] = snapshot.nodes.map((n) => ({
      id: n.uid,
      type: "resource",
      position: { x: 0, y: 0 },
      data: {
        name: n.name,
        kind: n.kind,
        drifted: n.drifted,
        driftSeverity: n.driftSeverity,
      },
    }));

    const rfEdges: Edge[] = snapshot.edges.map((e) => {
      const color = e.drifted
        ? SEVERITY_META[e.driftSeverity ?? "info"].hex
        : "#3a4453";
      return {
        id: e.uid,
        source: e.src,
        target: e.dst,
        label: e.kind.replace(/_/g, " "),
        animated: e.drifted,
        style: { stroke: color, strokeWidth: e.drifted ? 2 : 1.5 },
        labelStyle: { fill: "#9aa6b6", fontSize: 10 },
        labelBgStyle: { fill: "#11161f" },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });

    return { nodes: layoutGraph(rfNodes, rfEdges), edges: rfEdges };
  }, [snapshot]);

  const styledNodes = nodes.map((n) => ({
    ...n,
    selected: n.id === selectedNodeId,
  }));

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.3}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onPaneClick={() => onSelectNode(null)}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} color="#1f2733" />
      <Controls className="!border-border !bg-bg-panel" showInteractive={false} />
    </ReactFlow>
  );
}
