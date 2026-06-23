import type { Integration } from './types';

/**
 * Seed integrations for the demo. There is no integrations backend yet, so the
 * Integrations page manages these client-side (consistent with the demo's other
 * local-only interactions). Adding a source or running a test mutates this in
 * page state only.
 */
export const SEED_INTEGRATIONS: Integration[] = [
  {
    id: 'int-aws-prod',
    kind: 'aws',
    name: 'AWS — Production',
    layer: 'runtime',
    status: 'connected',
    config: {
      account_id: '1234-5678-9012',
      region: 'us-east-1',
      credential_source: 'Assume role (STS)',
    },
    lastSync: '2026-06-22T10:00:00Z',
  },
  {
    id: 'int-tfc-infra',
    kind: 'terraform',
    name: 'Terraform Cloud — infra',
    layer: 'terraform',
    status: 'connected',
    config: {
      organization: 'acme',
      workspace: 'prod-network',
      token: 'tfc-xxxxxxxxxxxx',
    },
    lastSync: '2026-06-22T09:55:00Z',
  },
  {
    id: 'int-confluence-arch',
    kind: 'confluence',
    name: 'Confluence — Architecture Space',
    layer: 'intent',
    status: 'error',
    config: {
      base_url: 'https://acme.atlassian.net/wiki',
      space: 'ARCH',
      email: 'bot@acme.com',
      api_token: 'cfl-xxxxxxxxxxxx',
    },
    lastSync: '2026-06-21T20:00:00Z',
  },
  {
    id: 'int-drawio-diagrams',
    kind: 'drawio',
    name: 'Draw.io — diagrams',
    layer: 'intent',
    status: 'unconfigured',
    config: {},
  },
];
