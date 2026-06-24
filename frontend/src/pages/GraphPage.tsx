import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  ConnectionMode,
  Controls,
  Edge,
  MiniMap,
  Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { LoadingState } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import apiClient from '../lib/api';

interface ProjectRow {
  projectId: string;
  name: string;
}

interface WorkspaceRow {
  scanId: string;
  projectId: string;
  name?: string;
  createdAt?: string;
}

interface DriftRunRow {
  id: string;
  label: string;
}

const nodeTypes = {};

const SELECT_CLS =
  'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30';

export function GraphPage() {
  const [activeTab, setActiveTab] = useState<'planned' | 'terraform' | 'deployed'>('planned');
  const [projectId, setProjectId] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [runId, setRunId] = useState<string>('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.getProjects()).data as ProjectRow[],
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['settings-scans', projectId],
    queryFn: async () =>
      (await apiClient.getSettingsScans({ projectId })).data as WorkspaceRow[],
    enabled: Boolean(projectId),
  });

  const { data: runsData } = useQuery({
    queryKey: ['drift-runs', workspaceId],
    queryFn: async () =>
      (await apiClient.getDriftRuns({ scanId: workspaceId })).data as { runs: DriftRunRow[] },
    enabled: Boolean(workspaceId),
  });

  const runs = runsData?.runs ?? [];

  const shouldLoadGraph = Boolean(projectId && workspaceId && runId);
  const { data: graphData, isLoading, error } = useQuery({
    queryKey: ['graph', workspaceId, runId],
    queryFn: async () => {
      const response = await apiClient.getGraph({ scanId: workspaceId });
      return response.data;
    },
    enabled: shouldLoadGraph,
  });

  useEffect(() => {
    if (!projectId) {
      setWorkspaceId('');
      setRunId('');
      return;
    }
    if (workspaceId && !workspaces.some((w) => w.scanId === workspaceId)) {
      setWorkspaceId('');
      setRunId('');
    }
  }, [projectId, workspaces, workspaceId]);

  useEffect(() => {
    if (runId && !runs.some((run) => run.id === runId)) {
      setRunId('');
    }
  }, [runId, runs]);

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

  const transformToFlowData = (nodes: any[], edges: any[]) => {
    const flowNodes: Node[] = nodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      data: {
        label: (
          <div className="text-center">
            <div className="text-sm font-semibold">{node.label}</div>
            <div className="text-[10px] text-gray-500">{node.type}</div>
          </div>
        ),
        ...node,
      },
      position: {
        x: (index % 4) * 220,
        y: Math.floor(index / 4) * 130,
      },
      style: {
        background: getNodeColor(node.type),
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '8px',
        minWidth: '130px',
      },
    }));

    const flowEdges: Edge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8' },
      label: edge.relationshipType || edge.label,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  };

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!graphData) {
      return { nodes: [], edges: [] };
    }
    const viewData = graphData[activeTab];
    if (!viewData) {
      return { nodes: [], edges: [] };
    }
    return transformToFlowData(viewData.nodes || [], viewData.edges || []);
  }, [graphData, activeTab]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Architecture Graph</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select a project, workspace, and scan run to render the graph.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
            Project
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Select project...</option>
              {projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
            Workspace
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Select workspace...</option>
              {workspaces.length === 0 ? (
                <option value="">No workspaces available</option>
              ) : (
                workspaces.map((workspace) => (
                  <option key={workspace.scanId} value={workspace.scanId}>
                    {workspace.name || workspace.scanId}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
            Scan run
            <select
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Select scan run...</option>
              {runs.length === 0 ? (
                <option value="">No scan runs available</option>
              ) : (
                runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      {!shouldLoadGraph && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
          Select project, workspace, and scan run to view graph data.
        </div>
      )}

      {shouldLoadGraph && isLoading && <LoadingState message="Loading graph..." />}

      {shouldLoadGraph && error && (
        <ErrorAlert
          title="Failed to load graph"
          message={(error as any)?.message || 'An error occurred while loading the graph'}
        />
      )}

      {shouldLoadGraph && !isLoading && !error && (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
            <div className="border-b border-slate-800">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('planned')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'planned'
                      ? 'border-sky-500 text-sky-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Planned (Intent)
                </button>
                <button
                  onClick={() => setActiveTab('terraform')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'terraform'
                      ? 'border-sky-500 text-sky-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Terraform State
                </button>
                <button
                  onClick={() => setActiveTab('deployed')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'deployed'
                      ? 'border-sky-500 text-sky-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Deployed (AWS)
                </button>
              </nav>
            </div>

            <div className="h-[600px] bg-slate-900/40">
              {nodes.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500">
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
                  <Background color="#1e293b" />
                  <Controls />
                  <MiniMap
                    nodeColor={(node) => (node.style?.background as string) || '#334155'}
                    maskColor="rgba(2, 6, 23, 0.6)"
                  />
                </ReactFlow>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-sm font-medium text-slate-400">Total Nodes</h3>
              <p className="mt-2 text-3xl font-bold text-slate-100">{nodes.length}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-sm font-medium text-slate-400">Total Edges</h3>
              <p className="mt-2 text-3xl font-bold text-slate-100">{edges.length}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-sm font-medium text-slate-400">Current View</h3>
              <p className="mt-2 text-3xl font-bold capitalize text-slate-100">{activeTab}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
