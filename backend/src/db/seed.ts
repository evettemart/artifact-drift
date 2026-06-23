import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './index';
import { findings, scans } from './schema';
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

  db.delete(findings).run();
  db.delete(scans).run();

  db.insert(scans)
    .values({
      scanId: scanResult.scanId,
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