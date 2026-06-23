"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedMockData = seedMockData;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("./index");
const schema_1 = require("./schema");
function readJsonFile(relativePath) {
    const filePath = (0, path_1.join)(process.cwd(), relativePath);
    return JSON.parse((0, fs_1.readFileSync)(filePath, 'utf-8'));
}
function seedMockData() {
    const now = new Date().toISOString();
    const scanResult = readJsonFile('data/mock/scan-result.json');
    const findingsPayload = readJsonFile('data/mock/findings.json');
    index_1.db.delete(schema_1.findings).run();
    index_1.db.delete(schema_1.scans).run();
    index_1.db.insert(schema_1.scans)
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
        index_1.db.insert(schema_1.findings)
            .values(findingsPayload.findings.map((finding) => ({
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
        })))
            .run();
    }
}
// Made with Bob
//# sourceMappingURL=seed.js.map