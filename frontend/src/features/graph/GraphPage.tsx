import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { useGraph } from "@/hooks/useGraph";
import { useDriftRuns } from "@/hooks/useDriftRuns";
import { useDriftRecords } from "@/hooks/useDriftRecords";
import { LayerToggle } from "@/features/graph/LayerToggle";
import { GraphCanvas } from "@/features/graph/GraphCanvas";
import { GraphLegend } from "@/features/graph/GraphLegend";
import { NodeDetailPanel } from "@/features/graph/NodeDetailPanel";
import type { Layer } from "@/api/types";

export function GraphPage() {
  const [layer, setLayer] = useState<Layer>("runtime");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const graphQuery = useGraph(layer);
  const runsQuery = useDriftRuns();
  const latestRunId = runsQuery.data?.items[0]?.id;
  const recordsQuery = useDriftRecords(latestRunId);
  const records = recordsQuery.data?.items ?? [];

  const snapshot = graphQuery.data;
  const selectedNode =
    snapshot?.nodes.find((n) => n.uid === selectedNodeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <div>
          <h1 className="text-xl font-semibold text-fg">Architecture Graph</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Deterministic topology with drift highlighting. Click a node for
            detail.
          </p>
        </div>
        <LayerToggle
          value={layer}
          onChange={(l) => {
            setLayer(l);
            setSelectedNodeId(null);
          }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {graphQuery.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner label="Loading graph…" />
            </div>
          )}
          {graphQuery.error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-severity-critical">
                <AlertCircle className="h-4 w-4" /> Failed to load graph.
              </div>
            </div>
          )}
          {snapshot && (
            <GraphCanvas
              snapshot={snapshot}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          )}

          <div className="pointer-events-none absolute bottom-4 right-4">
            <GraphLegend />
          </div>
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            records={records}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
