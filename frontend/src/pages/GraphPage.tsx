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
import {
  Box,
  Database,
  Globe,
  Network,
  Route,
  Server,
  Shield,
  type LucideIcon,
} from 'lucide-react';
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
  selectedIntegrations?: string[];
}

interface DriftRunRow {
  id: string;
  label: string;
  scanId?: string;
  createdAt?: string | null;
}

interface IntegrationTab {
  id: string;
  label: string;
  layer: 'planned' | 'terraform' | 'deployed';
}

type GraphLayerPayload = {
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
};

const INTEGRATION_LABEL: Record<string, string> = {
  image: 'Static Diagram',
  drawio: 'Draw.io Diagram',
  confluence: 'Confluence Intent',
  terraform: 'Terraform State',
  aws: 'AWS Runtime',
  vault: 'Vault Runtime',
};

const INTEGRATION_LAYER: Record<string, 'planned' | 'terraform' | 'deployed'> = {
  image: 'planned',
  drawio: 'planned',
  confluence: 'planned',
  terraform: 'terraform',
  aws: 'deployed',
  vault: 'deployed',
};

function integrationTab(kind: string): IntegrationTab {
  return {
    id: kind,
    label: INTEGRATION_LABEL[kind] ?? kind,
    layer: INTEGRATION_LAYER[kind] ?? 'planned',
  };
}

const nodeTypes = {};

const SELECT_CLS =
  'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30';

function formatRunTimestamp(value?: string | null): string {
  if (!value) {
    return 'No date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No date';
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeType(typeValue: string): string {
  const raw = String(typeValue || '').trim();
  if (!raw) return 'unknown';
  if (raw.includes('::')) {
    return raw.split('::').pop()?.toLowerCase() ?? raw.toLowerCase();
  }
  if (raw.startsWith('aws_')) {
    return raw.slice(4).toLowerCase();
  }
  return raw.toLowerCase();
}

function titleForType(typeValue: string): string {
  const normalized = normalizeType(typeValue);
  const titles: Record<string, string> = {
    vpc: 'VPC',
    subnet: 'Subnet',
    ec2_instance: 'EC2 Instance',
    instance: 'EC2 Instance',
    security_group: 'Security Group',
    load_balancer: 'Load Balancer',
    alb: 'Load Balancer',
    route_table: 'Route Table',
    internet_gateway: 'Internet Gateway',
    nat_gateway: 'NAT Gateway',
    s3_bucket: 'S3 Bucket',
    rds_instance: 'RDS Instance',
  };
  return titles[normalized] ?? typeValue;
}

function iconForType(typeValue: string): LucideIcon {
  const normalized = normalizeType(typeValue);
  const icons: Record<string, LucideIcon> = {
    vpc: Network,
    subnet: Route,
    ec2_instance: Server,
    instance: Server,
    security_group: Shield,
    load_balancer: Globe,
    alb: Globe,
    route_table: Route,
    internet_gateway: Globe,
    nat_gateway: Globe,
    s3_bucket: Box,
    rds_instance: Database,
  };
  return icons[normalized] ?? Box;
}

export function GraphPage() {
  const [activeTab, setActiveTab] = useState<string>('planned');
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

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.scanId === workspaceId) ?? null,
    [workspaces, workspaceId]
  );

  const shouldLoadGraph = Boolean(projectId && workspaceId && runId);
  const { data: graphData, isLoading, error } = useQuery({
    queryKey: ['graph', workspaceId, runId],
    queryFn: async () => {
      const response = await apiClient.getGraph({ scanId: workspaceId, runId });
      return response.data;
    },
    enabled: shouldLoadGraph,
  });

  const integrationTabs = useMemo<IntegrationTab[]>(() => {
    const layerHasData = (layer: 'planned' | 'terraform' | 'deployed'): boolean => {
      const payload = (graphData?.[layer] ?? null) as GraphLayerPayload | null;
      if (!payload) {
        return false;
      }
      return (payload.nodes?.length ?? 0) > 0 || (payload.edges?.length ?? 0) > 0;
    };

    const kinds = selectedWorkspace?.selectedIntegrations ?? [];
    const defaultTabs: IntegrationTab[] = [
      { id: 'planned', label: 'Planned (Intent)', layer: 'planned' },
      { id: 'terraform', label: 'Terraform State', layer: 'terraform' },
      { id: 'deployed', label: 'Deployed (AWS)', layer: 'deployed' },
    ];

    const fromWorkspace =
      Array.isArray(kinds) && kinds.length > 0
        ? Array.from(new Set(kinds)).map(integrationTab)
        : defaultTabs;

    const tabs = [...fromWorkspace];
    const layersPresent = new Set(tabs.map((tab) => tab.layer));

    if (layerHasData('planned') && !layersPresent.has('planned')) {
      tabs.unshift({ id: 'planned', label: 'Planned (Intent)', layer: 'planned' });
      layersPresent.add('planned');
    }
    if (layerHasData('terraform') && !layersPresent.has('terraform')) {
      tabs.push({ id: 'terraform', label: 'Terraform State', layer: 'terraform' });
      layersPresent.add('terraform');
    }
    if (layerHasData('deployed') && !layersPresent.has('deployed')) {
      tabs.push({ id: 'deployed', label: 'Deployed (AWS)', layer: 'deployed' });
    }

    return tabs;
  }, [selectedWorkspace, graphData]);

  useEffect(() => {
    if (!integrationTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(integrationTabs[0]?.id ?? 'planned');
    }
  }, [integrationTabs, activeTab]);

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
    const normalized = normalizeType(type);
    const colors: Record<string, string> = {
      vpc: '#dbeafe',
      subnet: '#bfdbfe',
      ec2_instance: '#fef3c7',
      security_group: '#fecaca',
      load_balancer: '#d1fae5',
      instance: '#fef3c7',
      route_table: '#e2e8f0',
      internet_gateway: '#e0f2fe',
      nat_gateway: '#cffafe',
      s3_bucket: '#fde68a',
      rds_instance: '#ddd6fe',
      default: '#f3f4f6',
    };
    return colors[normalized] || colors.default;
  };

  const transformToFlowData = (nodes: any[], edges: any[]) => {
    const flowNodes: Node[] = nodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      data: {
        label: (
          <div className="flex flex-col items-center text-center">
            {(() => {
              const Icon = iconForType(node.type);
              return <Icon className="mb-1 h-4 w-4 text-sky-700" />;
            })()}
            <div className="text-sm font-semibold">{node.label}</div>
            <div className="text-[10px] text-gray-600">{titleForType(node.type)}</div>
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
    const activeLayer = integrationTabs.find((tab) => tab.id === activeTab)?.layer ?? 'planned';
    const viewData = graphData[activeLayer];
    if (!viewData) {
      return { nodes: [], edges: [] };
    }
    return transformToFlowData(viewData.nodes || [], viewData.edges || []);
  }, [graphData, activeTab, integrationTabs]);

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
                    {formatRunTimestamp(run.createdAt)} | {run.label} ({run.scanId ?? 'no-scan-id'})
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
                {integrationTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-sky-500 text-sky-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="h-[600px] bg-slate-900/40">
              {nodes.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  No resources found for {integrationTabs.find((tab) => tab.id === activeTab)?.label ?? activeTab} view
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
