import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { parseDesignIntentFromFileSync } from './designIntent';
import { ResourceSource, ResourceType } from '../../types/shared';

describe('DesignIntentAgent', () => {
  it('parses examples/architecture.yaml into normalized resources', () => {
    const filePath = join(process.cwd(), '..', 'examples', 'architecture.yaml');
    const resources = parseDesignIntentFromFileSync(filePath, true);

    expect(resources.length).toBeGreaterThan(0);
    expect(resources.some((resource) => resource.type === ResourceType.VPC)).toBe(true);
    expect(resources.some((resource) => resource.type === ResourceType.EC2_INSTANCE)).toBe(true);

    for (const resource of resources) {
      expect(resource.source).toBe(ResourceSource.INTENT);
      expect(resource.metadata.sourceChecksum).toBeTruthy();
      expect(resource.metadata.sourceLocation).toBe(filePath);
    }
  });

  it('maps legacy YAML schema to normalized resources', () => {
    const legacyYaml = `
version: "1.0"
metadata:
  name: "legacy"
  owner: "platform"
provider:
  region: "us-east-1"
resources:
  - type: vpc
    name: legacy-vpc
    attributes:
      cidr_block: "10.0.0.0/16"
      enable_dns_hostnames: true
      enable_dns_support: true
    tags:
      Name: "legacy-vpc"
  - type: subnet
    name: legacy-subnet
    attributes:
      vpc: legacy-vpc
      cidr_block: "10.0.1.0/24"
      availability_zone: "us-east-1a"
      map_public_ip_on_launch: true
    relationships:
      - type: contains
        target: legacy-vpc
    tags:
      Name: "legacy-subnet"
`;

    const filePath = join(process.cwd(), 'tmp-legacy-architecture.yaml');
    require('fs').writeFileSync(filePath, legacyYaml, 'utf-8');

    const resources = parseDesignIntentFromFileSync(filePath, true);
    const subnet = resources.find((resource) => resource.logicalName === 'legacy-subnet');

    expect(resources.some((resource) => resource.logicalName === 'legacy-vpc')).toBe(true);
    expect(subnet).toBeTruthy();
    expect(subnet?.type).toBe(ResourceType.SUBNET);
    expect(subnet?.relationships.length).toBeGreaterThan(0);

    require('fs').unlinkSync(filePath);
  });
});
