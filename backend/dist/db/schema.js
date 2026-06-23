"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resources = exports.findings = exports.scans = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.scans = (0, sqlite_core_1.sqliteTable)('scans', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    scanId: (0, sqlite_core_1.text)('scan_id').notNull().unique(),
    projectId: (0, sqlite_core_1.text)('project_id').notNull(),
    status: (0, sqlite_core_1.text)('status'),
    startedAt: (0, sqlite_core_1.text)('started_at').notNull(),
    completedAt: (0, sqlite_core_1.text)('completed_at').notNull(),
    durationMs: (0, sqlite_core_1.integer)('duration_ms').notNull(),
    complianceScore: (0, sqlite_core_1.integer)('compliance_score').notNull(),
    statisticsJson: (0, sqlite_core_1.text)('statistics_json').notNull(),
    sourcesJson: (0, sqlite_core_1.text)('sources_json').notNull(),
    configJson: (0, sqlite_core_1.text)('config_json').notNull(),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
});
exports.findings = (0, sqlite_core_1.sqliteTable)('findings', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    driftId: (0, sqlite_core_1.text)('drift_id').notNull().unique(),
    scanId: (0, sqlite_core_1.text)('scan_id').notNull(),
    driftType: (0, sqlite_core_1.text)('drift_type').notNull(),
    severity: (0, sqlite_core_1.text)('severity').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    resourceType: (0, sqlite_core_1.text)('resource_type').notNull(),
    provider: (0, sqlite_core_1.text)('provider').notNull(),
    region: (0, sqlite_core_1.text)('region').notNull(),
    logicalName: (0, sqlite_core_1.text)('logical_name').notNull(),
    diffSummary: (0, sqlite_core_1.text)('diff_summary').notNull(),
    expectedJson: (0, sqlite_core_1.text)('expected_json'),
    observedJson: (0, sqlite_core_1.text)('observed_json'),
    attributeDiffsJson: (0, sqlite_core_1.text)('attribute_diffs_json'),
    reasoningJson: (0, sqlite_core_1.text)('reasoning_json'),
    detectedAt: (0, sqlite_core_1.text)('detected_at').notNull(),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
});
exports.resources = (0, sqlite_core_1.sqliteTable)('resources', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    resourceId: (0, sqlite_core_1.text)('resource_id').notNull().unique(),
    scanId: (0, sqlite_core_1.text)('scan_id'),
    logicalName: (0, sqlite_core_1.text)('logical_name').notNull(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    provider: (0, sqlite_core_1.text)('provider').notNull(),
    region: (0, sqlite_core_1.text)('region').notNull(),
    source: (0, sqlite_core_1.text)('source').notNull(),
    attributesJson: (0, sqlite_core_1.text)('attributes_json').notNull(),
    tagsJson: (0, sqlite_core_1.text)('tags_json').notNull(),
    relationshipsJson: (0, sqlite_core_1.text)('relationships_json').notNull(),
    sensitiveRedacted: (0, sqlite_core_1.integer)('sensitive_redacted', { mode: 'boolean' }).notNull(),
    metadataJson: (0, sqlite_core_1.text)('metadata_json').notNull(),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
});
// Made with Bob
//# sourceMappingURL=schema.js.map