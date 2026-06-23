import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import apiClient from '../lib/api';

const nodeTypes = {
  // We can add custom node types here later
};

export function GraphPage() {
  const [activeTab, setActiveTab] = useState<'planned' | 'terraform' | 'deployed'>('planned');

  const { data: graphData, isLoading, error } = useQuery({
    queryKey: ['graph'],
    queryFn: async () => {
      const response = await apiClient.getGraph();
      return response.data;
    },
  });

  // Transform graph data to React Flow format
  const transformToFlowData = useCallback((nodes: any[], edges: any[]) => {
    const flowNodes: Node[] = nodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      data: { 
        label: (
          <div className="text-center">
            <div className="font-semibold">{node.label}</div>
            <div className="text-xs text-gray-500">{node.type}</div>
          </div>
        ),
        ...node 
      },
      position: { 
        x: (index % 4) * 250, 
        y: Math.floor(index / 4) * 150 
      },
      style: {
        background: getNodeColor(node.type),
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '10px',
        minWidth: '150px',
      },
    }));

    const flowEdges: Edge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8' },
      label: edge.relationshipType,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, []);

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      vpc: '#dbeafe',
      subnet: '#bfdbfe',
      ec2_instance: '#fef3c7',
      security_group: '#fecaca',
      load_balancer: '#d1fae5',
      default: '#f3f4f6',
    };
    return colors[type] || colors.default;
  };

  // Filter nodes by source
  const getFilteredData = useCallback(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const sourceMap: Record<string, string> = {
      planned: 'intent',
      terraform: 'terraform',
      deployed: 'aws',
    };

    const filteredNodes = graphData.nodes.filter(
      (node: any) => node.source === sourceMap[activeTab]
    );
    const filteredNodeIds = new Set(filteredNodes.map((n: any) => n.id));
    const filteredEdges = graphData.edges.filter(
      (edge: any) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    return transformToFlowData(filteredNodes, filteredEdges);
  }, [graphData, activeTab, transformToFlowData]);

  const { nodes: flowNodes, edges: flowEdges } = getFilteredData();
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes and edges when data changes
  useState(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  });

  if (isLoading) {
    return <LoadingState message="Loading graph..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Failed to load graph"
        message={(error as any)?.message || 'An error occurred while loading the graph'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Architecture Graph</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visual representation of your infrastructure across different sources
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('planned')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'planned'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Planned (Intent)
            </button>
            <button
              onClick={() => setActiveTab('terraform')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'terraform'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Terraform State
            </button>
            <button
              onClick={() => setActiveTab('deployed')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'deployed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Deployed (AWS)
            </button>
          </nav>
        </div>

        {/* Graph Canvas */}
        <div className="h-[600px] bg-gray-50">
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No resources found for {activeTab} view
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  return node.style?.background as string || '#f3f4f6';
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-6 text-sm">
            <span className="font-medium text-gray-700">Legend:</span>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ background: '#dbeafe' }}></div>
              <span className="text-gray-600">VPC</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ background: '#bfdbfe' }}></div>
              <span className="text-gray-600">Subnet</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ background: '#fef3c7' }}></div>
              <span className="text-gray-600">EC2 Instance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ background: '#fecaca' }}></div>
              <span className="text-gray-600">Security Group</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ background: '#d1fae5' }}></div>
              <span className="text-gray-600">Load Balancer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Nodes</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{nodes.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Edges</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{edges.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Current View</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 capitalize">{activeTab}</p>
        </div>
      </div>
    </div>
  );
}
