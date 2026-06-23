import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import * as schema from './schema';

const DEFAULT_DB_PATH = join(process.cwd(), 'data', 'artifact-drift.db');
const databasePath = process.env.DATABASE_URL || DEFAULT_DB_PATH;

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export { schema, databasePath };

export function initializeDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      status TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      compliance_score INTEGER NOT NULL,
      statistics_json TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drift_id TEXT NOT NULL UNIQUE,
      scan_id TEXT NOT NULL,
      drift_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      region TEXT NOT NULL,
      logical_name TEXT NOT NULL,
      diff_summary TEXT NOT NULL,
      expected_json TEXT,
      observed_json TEXT,
      attribute_diffs_json TEXT,
      reasoning_json TEXT,
      detected_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id TEXT NOT NULL UNIQUE,
      scan_id TEXT,
      logical_name TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      region TEXT NOT NULL,
      source TEXT NOT NULL,
      attributes_json TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      relationships_json TEXT NOT NULL,
      sensitive_redacted INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

// Made with Bob