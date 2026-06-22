import type { Integration } from "@/api/types";

export const integrations: Integration[] = [
  {
    id: "int_aws",
    kind: "aws",
    name: "AWS — Production",
    layer: "runtime",
    status: "connected",
    config: { account_id: "1234-5678-9012", region: "us-east-1", role: "arn:aws:iam::role/drift-readonly" },
    lastSync: "2026-06-22T08:00:00Z",
  },
  {
    id: "int_tf",
    kind: "terraform",
    name: "Terraform Cloud — infra",
    layer: "terraform",
    status: "connected",
    config: { organization: "acme", workspace: "prod-network" },
    lastSync: "2026-06-22T07:55:00Z",
  },
  {
    id: "int_confluence",
    kind: "confluence",
    name: "Confluence — Architecture Space",
    layer: "intent",
    status: "error",
    config: { base_url: "https://acme.atlassian.net/wiki", space: "ARCH" },
    lastSync: "2026-06-21T18:00:00Z",
  },
  {
    id: "int_drawio",
    kind: "drawio",
    name: "Draw.io — diagrams",
    layer: "intent",
    status: "unconfigured",
    config: {},
  },
];
