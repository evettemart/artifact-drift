import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const integrations = sqliteTable('integrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  integrationId: text('integration_id').notNull().unique(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'terraform', 'aws', 'architecture'
  status: text('status').notNull().default('active'),
  configJson: text('config_json').notNull(),
  credentialsJson: text('credentials_json'),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const scans = sqliteTable('scans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: text('scan_id').notNull().unique(),
  projectId: text('project_id').notNull(),
  status: text('status'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at').notNull(),
  durationMs: integer('duration_ms').notNull(),
  complianceScore: integer('compliance_score').notNull(),
  statisticsJson: text('statistics_json').notNull(),
  sourcesJson: text('sources_json').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export const findings = sqliteTable('findings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  driftId: text('drift_id').notNull().unique(),
  scanId: text('scan_id').notNull(),
  driftType: text('drift_type').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull(),
  resourceType: text('resource_type').notNull(),
  provider: text('provider').notNull(),
  region: text('region').notNull(),
  logicalName: text('logical_name').notNull(),
  diffSummary: text('diff_summary').notNull(),
  expectedJson: text('expected_json'),
  observedJson: text('observed_json'),
  attributeDiffsJson: text('attribute_diffs_json'),
  reasoningJson: text('reasoning_json'),
  detectedAt: text('detected_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const resources = sqliteTable('resources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().unique(),
  scanId: text('scan_id'),
  logicalName: text('logical_name').notNull(),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  region: text('region').notNull(),
  source: text('source').notNull(),
  attributesJson: text('attributes_json').notNull(),
  tagsJson: text('tags_json').notNull(),
  relationshipsJson: text('relationships_json').notNull(),
  sensitiveRedacted: integer('sensitive_redacted', { mode: 'boolean' }).notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type IntegrationRow = typeof integrations.$inferSelect;
export type NewIntegrationRow = typeof integrations.$inferInsert;
export type ScanRow = typeof scans.$inferSelect;
export type NewScanRow = typeof scans.$inferInsert;
export type FindingRow = typeof findings.$inferSelect;
export type NewFindingRow = typeof findings.$inferInsert;
export type ResourceRow = typeof resources.$inferSelect;
export type NewResourceRow = typeof resources.$inferInsert;

// Made with Bob