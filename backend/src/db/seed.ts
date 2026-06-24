import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './index';
import { findings, scans, projects, integrations, workspaces } from './schema';
import type { DriftFinding, ScanResult } from '../types/shared';

interface FindingsPayload {
  scanId: string;
  findings: DriftFinding[];
}

function readJsonFile<T>(relativePath: string): T {
  const filePath = join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

export function seedMockData(): void {
  const now = new Date().toISOString();

  const scanResult = readJsonFile<ScanResult>('data/mock/scan-result.json');
  const findingsPayload = readJsonFile<FindingsPayload>('data/mock/findings.json');

  // Clear existing data
  db.delete(findings).run();
  db.delete(scans).run();
  db.delete(integrations).run();
  db.delete(workspaces).run();
  db.delete(projects).run();

  // Seed project
  db.insert(projects)
    .values({
      projectId: 'demo-project',
      name: 'Demo Infrastructure Project',
      description: 'Sample project demonstrating architecture drift detection',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Seed integrations
  db.insert(integrations)
    .values([
      {
        integrationId: 'int-terraform-1',
        projectId: 'demo-project',
        name: 'Terraform State',
        type: 'terraform',
        status: 'active',
        configJson: JSON.stringify({
          backend: 's3',
          bucket: 'demo-terraform-state',
          region: 'us-east-1',
        }),
        credentialsJson: null,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        integrationId: 'int-aws-1',
        projectId: 'demo-project',
        name: 'AWS Account',
        type: 'aws',
        status: 'active',
        configJson: JSON.stringify({
          region: 'us-east-1',
          accountId: '123456789012',
        }),
        credentialsJson: null,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        integrationId: 'int-arch-1',
        projectId: 'demo-project',
        name: 'Architecture Design',
        type: 'architecture',
        status: 'active',
        configJson: JSON.stringify({
          source: 'yaml',
          path: 'examples/architecture.yaml',
        }),
        credentialsJson: null,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .run();

  // Seed workspace
  db.insert(workspaces)
    .values({
      workspaceId: scanResult.workspaceId,
      projectId: 'demo-project',
      name: 'Demo Workspace',
      description: 'Primary workspace for demo project',
      status: 'active',
      configJson: JSON.stringify({
        selectedIntegrationIds: ['int-terraform-1', 'int-aws-1', 'int-arch-1'],
      }),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(scans)
    .values({
      scanId: scanResult.scanId,
      workspaceId: scanResult.workspaceId,
      projectId: scanResult.projectId,
      status: scanResult.status ?? 'completed',
      startedAt: scanResult.startedAt,
      completedAt: scanResult.completedAt,
      durationMs: scanResult.durationMs,
      complianceScore: scanResult.complianceScore,
      statisticsJson: JSON.stringify(scanResult.statistics),
      sourcesJson: JSON.stringify(scanResult.sources),
      configJson: JSON.stringify(scanResult.config),
      createdAt: now,
    })
    .run();

  if (findingsPayload.findings.length > 0) {
    db.insert(findings)
      .values(
        findingsPayload.findings.map((finding) => ({
          driftId: finding.driftId,
          scanId: findingsPayload.scanId,
          driftType: finding.driftType,
          severity: finding.severity,
          status: finding.status,
          resourceType: finding.resourceType,
          provider: finding.provider,
          region: finding.region,
          logicalName: finding.logicalName,
          diffSummary: finding.diffSummary,
          expectedJson: finding.expected ? JSON.stringify(finding.expected) : null,
          observedJson: finding.observed ? JSON.stringify(finding.observed) : null,
          attributeDiffsJson: finding.attributeDiffs
            ? JSON.stringify(finding.attributeDiffs)
            : null,
          reasoningJson: finding.reasoning ? JSON.stringify(finding.reasoning) : null,
          detectedAt: finding.detectedAt,
          createdAt: now,
        }))
      )
      .run();
  }
}

// Made with Bob