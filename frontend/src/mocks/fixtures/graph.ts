import type { CanonicalEdge, CanonicalNode, GraphSnapshot, Layer } from "@/api/types";

// A single realistic AWS topology. The `runtime` snapshot carries drift markers
// that key to the seeded drift records (see driftRecords.ts).

const nodes: CanonicalNode[] = [
  {
    uid: "n_vpc_main",
    kind: "aws_vpc",
    name: "vpc-main",
    layer: "runtime",
    attributes: { cidr_block: "10.0.0.0/16", region: "us-east-1" },
    provenance: { source: "aws:ec2", ref: "vpc-0a1b2c3d4e5f" },
  },
  {
    uid: "n_subnet_public",
    kind: "aws_subnet",
    name: "subnet-public-a",
    layer: "runtime",
    attributes: { cidr_block: "10.0.1.0/24", public: true, az: "us-east-1a" },
    provenance: { source: "aws:ec2", ref: "subnet-public-a" },
  },
  {
    uid: "n_subnet_private",
    kind: "aws_subnet",
    name: "subnet-private-a",
    layer: "runtime",
    attributes: { cidr_block: "10.0.2.0/24", public: false, az: "us-east-1a" },
    provenance: { source: "aws:ec2", ref: "subnet-private-a" },
  },
  {
    uid: "n_igw_main",
    kind: "aws_internet_gateway",
    name: "igw-main",
    layer: "runtime",
    attributes: { attached: true },
    provenance: { source: "aws:ec2", ref: "igw-0099aabb" },
  },
  {
    uid: "n_sg_web",
    kind: "aws_security_group",
    name: "sg-web",
    layer: "runtime",
    attributes: {
      ingress: ["0.0.0.0/0:443", "0.0.0.0/0:22"], // :22 is the drift
      egress: ["0.0.0.0/0:all"],
    },
    provenance: { source: "aws:ec2", ref: "sg-web-001" },
    drifted: true,
    driftSeverity: "critical",
  },
  {
    uid: "n_sg_db",
    kind: "aws_security_group",
    name: "sg-db",
    layer: "runtime",
    attributes: { ingress: ["10.0.1.0/24:5432"], egress: [] },
    provenance: { source: "aws:ec2", ref: "sg-db-001" },
  },
  {
    uid: "n_ec2_web",
    kind: "aws_instance",
    name: "ec2-web-1",
    layer: "runtime",
    attributes: { instance_type: "t3.large", ami: "ami-0abc123" }, // type drift
    provenance: { source: "aws:ec2", ref: "i-0web123456" },
    drifted: true,
    driftSeverity: "medium",
  },
  {
    uid: "n_rds_main",
    kind: "aws_db_instance",
    name: "rds-main",
    layer: "runtime",
    attributes: { engine: "postgres", encrypted: true, multi_az: false },
    provenance: { source: "aws:rds", ref: "rds-main" },
  },
  {
    uid: "n_s3_assets",
    kind: "aws_s3_bucket",
    name: "s3-assets",
    layer: "runtime",
    attributes: { encrypted: false, versioning: true, public: false }, // encryption drift
    provenance: { source: "aws:s3", ref: "acme-assets" },
    drifted: true,
    driftSeverity: "critical",
  },
  {
    uid: "n_iam_role_app",
    kind: "aws_iam_role",
    name: "app-role",
    layer: "runtime",
    attributes: { managed_policies: ["AmazonS3ReadOnlyAccess"] },
    provenance: { source: "aws:iam", ref: "arn:aws:iam::role/app-role" },
  },
];

const edges: CanonicalEdge[] = [
  edge("e_vpc_subpub", "contains", "n_vpc_main", "n_subnet_public"),
  edge("e_vpc_subpriv", "contains", "n_vpc_main", "n_subnet_private"),
  edge("e_vpc_igw", "contains", "n_vpc_main", "n_igw_main"),
  edge("e_subpub_igw", "routes_to", "n_subnet_public", "n_igw_main"),
  edge("e_sgweb_ec2", "allows_ingress", "n_sg_web", "n_ec2_web", {
    drifted: true,
    driftSeverity: "critical",
    attributes: { rule: "0.0.0.0/0:22" },
  }),
  edge("e_ec2_sgweb", "depends_on", "n_ec2_web", "n_sg_web"),
  edge("e_ec2_rds", "routes_to", "n_ec2_web", "n_rds_main"),
  edge("e_sgdb_rds", "depends_on", "n_rds_main", "n_sg_db"),
  edge("e_ec2_iam", "depends_on", "n_ec2_web", "n_iam_role_app"),
  edge("e_ec2_s3", "routes_to", "n_ec2_web", "n_s3_assets"),
];

function edge(
  uid: string,
  kind: string,
  src: string,
  dst: string,
  opts: {
    attributes?: Record<string, unknown>;
    drifted?: boolean;
    driftSeverity?: CanonicalEdge["driftSeverity"];
  } = {},
): CanonicalEdge {
  return {
    uid,
    kind,
    src,
    dst,
    layer: "runtime",
    attributes: opts.attributes ?? {},
    drifted: opts.drifted,
    driftSeverity: opts.driftSeverity,
  };
}

function snapshot(layer: Layer, withDrift: boolean): GraphSnapshot {
  const layerNodes = nodes.map((n) => ({
    ...n,
    layer,
    drifted: withDrift ? n.drifted : undefined,
    driftSeverity: withDrift ? n.driftSeverity : undefined,
  }));
  const layerEdges = edges.map((e) => ({
    ...e,
    layer,
    drifted: withDrift ? e.drifted : undefined,
    driftSeverity: withDrift ? e.driftSeverity : undefined,
  }));
  return {
    id: `snap_${layer}`,
    layer,
    nodeCount: layerNodes.length,
    edgeCount: layerEdges.length,
    createdAt: "2026-06-22T08:00:00Z",
    nodes: layerNodes,
    edges: layerEdges,
  };
}

export const graphSnapshots: Record<Layer, GraphSnapshot> = {
  intent: snapshot("intent", false),
  terraform: snapshot("terraform", false),
  runtime: snapshot("runtime", true),
};
