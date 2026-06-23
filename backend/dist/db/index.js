"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databasePath = exports.schema = exports.db = void 0;
exports.initializeDatabase = initializeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const fs_1 = require("fs");
const path_1 = require("path");
const schema = __importStar(require("./schema"));
exports.schema = schema;
const DEFAULT_DB_PATH = (0, path_1.join)(process.cwd(), 'data', 'artifact-drift.db');
const databasePath = process.env.DATABASE_URL || DEFAULT_DB_PATH;
exports.databasePath = databasePath;
(0, fs_1.mkdirSync)((0, path_1.dirname)(databasePath), { recursive: true });
const sqlite = new better_sqlite3_1.default(databasePath);
sqlite.pragma('journal_mode = WAL');
exports.db = (0, better_sqlite3_2.drizzle)(sqlite, { schema });
function initializeDatabase() {
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
//# sourceMappingURL=index.js.map