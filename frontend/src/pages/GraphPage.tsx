import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { GraphLegend } from '../components/graph/GraphLegend';
import { LayerToggle } from '../components/graph/LayerToggle';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import type { GraphLayer, GraphNodeData, GraphResponse } from '../components/graph/types';
import apiClient from '../lib/api';

export function GraphPage() {
  const [layer, setLayer] = useState<GraphLayer>('deployed');
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);

  const { data, isLoading, error } = useQuery<GraphResponse>({
    queryKey: ['graph'],
    queryFn: async () => {
      const response = await apiClient.getGraph();
      return response.data as GraphResponse;
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading graph..." />;
  }

  if (error || !data) {
    return (
      <ErrorAlert
        title="Failed to load graph"
        message={(error as Error)?.message || 'An error occurred while loading the graph'}
      />
    );
  }

  const layerData = data[layer] ?? { nodes: [], edges: [] };
  const driftCount = layerData.nodes.filter((node) => node.drifted).length;

  const handleSelectLayer = (next: GraphLayer) => {
    setLayer(next);
    setSelectedNode(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Architecture Graph</h1>
          <p className="mt-1 text-sm text-gray-500">
            Deterministic topology with drift highlighting. Click a node for detail.
          </p>
        </div>
        <LayerToggle value={layer} onChange={handleSelectLayer} />
      </div>

      <div className="flex h-[640px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
        <div className="relative flex-1">
          {layerData.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No resources found for this layer.
            </div>
          ) : (
            <GraphCanvas
              data={layerData}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />
          )}

          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-[11px] text-slate-300 backdrop-blur">
            {layerData.nodes.length} resources · {driftCount} drifted
          </div>

          <div className="absolute bottom-3 right-3">
            <GraphLegend />
          </div>
        </div>

        {selectedNode && (
          <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </div>
    </div>
  );
}
