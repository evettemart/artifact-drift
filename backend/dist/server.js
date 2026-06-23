"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = require("fs");
const path_1 = require("path");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("./db");
const seed_1 = require("./db/seed");
const schema_1 = require("./db/schema");
const analysis_1 = require("./services/analysis");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const DEMO_MODE = process.env.DEMO_MODE === 'true';
(0, db_1.initializeDatabase)();
if (DEMO_MODE) {
    (0, seed_1.seedMockData)();
}
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logging middleware
app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});
function loadMockData(filename) {
    const filePath = (0, path_1.join)(process.cwd(), 'data', 'mock', filename);
    const data = (0, fs_1.readFileSync)(filePath, 'utf-8');
    return JSON.parse(data);
}
function getStoredScanResult(scanId) {
    const row = scanId
        ? db_1.db.select().from(schema_1.scans).where((0, drizzle_orm_1.eq)(schema_1.scans.scanId, scanId)).get()
        : db_1.db.select().from(schema_1.scans).orderBy(schema_1.scans.id).get();
    if (!row) {
        return loadMockData('scan-result.json');
    }
    return {
        scanId: row.scanId,
        projectId: row.projectId,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        durationMs: row.durationMs,
        complianceScore: row.complianceScore,
        statistics: JSON.parse(row.statisticsJson),
        sources: JSON.parse(row.sourcesJson),
        config: JSON.parse(row.configJson),
        status: row.status ?? 'completed',
    };
}
function getStoredFindings(scanId) {
    const query = db_1.db.select().from(schema_1.findings);
    const rows = scanId
        ? query.where((0, drizzle_orm_1.eq)(schema_1.findings.scanId, scanId)).all()
        : query.all();
    if (rows.length === 0) {
        return loadMockData('findings.json').findings;
    }
    return rows.map((row) => ({
        driftId: row.driftId,
        scanId: row.scanId,
        driftType: row.driftType,
        severity: row.severity,
        status: row.status,
        resourceType: row.resourceType,
        provider: row.provider,
        region: row.region,
        logicalName: row.logicalName,
        diffSummary: row.diffSummary,
        expected: row.expectedJson ? JSON.parse(row.expectedJson) : null,
        observed: row.observedJson ? JSON.parse(row.observedJson) : null,
        attributeDiffs: row.attributeDiffsJson ? JSON.parse(row.attributeDiffsJson) : [],
        detectedAt: row.detectedAt,
        reasoning: row.reasoningJson ? JSON.parse(row.reasoningJson) : undefined,
    }));
}
function getAnalysisArtifacts() {
    return (0, analysis_1.runFullAnalysis)();
}
function getAnalysisScanResult() {
    return DEMO_MODE ? getAnalysisArtifacts().scan : getStoredScanResult();
}
function getAnalysisFindings() {
    return DEMO_MODE ? getAnalysisArtifacts().findings : getStoredFindings();
}
function getAnalysisResources(source) {
    const artifacts = getAnalysisArtifacts();
    const allResources = [
        ...artifacts.intentResources,
        ...artifacts.terraformResources,
        ...artifacts.awsResources,
    ];
    if (!source || source === 'all') {
        return allResources;
    }
    return allResources.filter((resource) => resource.source === source);
}
function getGraphPayload() {
    const resources = getAnalysisResources();
    const nodes = resources.map((resource) => ({
        id: resource.id,
        label: resource.logicalName,
        type: resource.type,
        source: resource.source,
        region: resource.region,
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = resources.flatMap((resource) => resource.relationships.map((relationship, index) => {
        const target = resources.find((candidate) => candidate.logicalName === relationship.targetLogicalName ||
            candidate.id === relationship.targetLogicalName);
        if (!target || !nodeIds.has(target.id)) {
            return [];
        }
        return [
            {
                id: `${resource.id}-${relationship.type}-${index}`,
                source: resource.id,
                target: target.id,
                relationshipType: relationship.type,
            },
        ];
    }));
    return {
        nodes,
        edges,
        totalNodes: nodes.length,
        totalEdges: edges.length,
    };
}
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        mode: DEMO_MODE ? 'demo' : 'production',
        databasePath: db_1.databasePath
    });
});
// Run analysis endpoint
app.post('/api/analyze', (_req, res) => {
    try {
        console.log('Running analysis...');
        if (DEMO_MODE) {
            // Return mock scan result
            const scanResult = getAnalysisScanResult();
            // Simulate processing time
            setTimeout(() => {
                res.json({
                    scanId: scanResult.scanId,
                    status: scanResult.status,
                    complianceScore: scanResult.complianceScore,
                    findingsCount: scanResult.statistics.totalFindings,
                    durationMs: scanResult.durationMs,
                    startedAt: scanResult.startedAt,
                    completedAt: scanResult.completedAt
                });
            }, 500);
        }
        else {
            // TODO: Implement real analysis
            res.status(501).json({
                error: 'Real analysis not yet implemented',
                message: 'Set DEMO_MODE=true to use mock data'
            });
        }
    }
    catch (error) {
        console.error('Error running analysis:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get findings endpoint
app.get('/api/findings', (req, res) => {
    try {
        const { scanId, severity, type, status } = req.query;
        if (DEMO_MODE) {
            let findings = getAnalysisFindings();
            // Apply filters
            if (severity) {
                findings = findings.filter((f) => f.severity === severity);
            }
            if (type) {
                findings = findings.filter((f) => f.driftType === type);
            }
            if (status) {
                findings = findings.filter((f) => f.status === status);
            }
            res.json({
                scanId: scanId || getAnalysisScanResult().scanId,
                findings,
                total: findings.length
            });
        }
        else {
            res.status(501).json({
                error: 'Real findings not yet implemented',
                message: 'Set DEMO_MODE=true to use mock data'
            });
        }
    }
    catch (error) {
        console.error('Error getting findings:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get resources endpoint
app.get('/api/resources', (req, res) => {
    try {
        const { scanId, source } = req.query;
        if (DEMO_MODE) {
            const resources = getAnalysisResources(source);
            res.json({
                scanId: scanId || getAnalysisScanResult().scanId,
                source: source || 'all',
                resources,
                total: resources.length
            });
        }
        else {
            res.status(501).json({
                error: 'Real resources not yet implemented',
                message: 'Set DEMO_MODE=true to use mock data'
            });
        }
    }
    catch (error) {
        console.error('Error getting resources:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get scans endpoint
app.get('/api/scans', (req, res) => {
    try {
        const { limit = '10' } = req.query;
        if (DEMO_MODE) {
            const scanResult = getAnalysisScanResult();
            res.json({
                scans: [scanResult],
                total: 1,
                limit: parseInt(limit)
            });
        }
        else {
            res.status(501).json({
                error: 'Real scans not yet implemented',
                message: 'Set DEMO_MODE=true to use mock data'
            });
        }
    }
    catch (error) {
        console.error('Error getting scans:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get report endpoint
app.get('/api/report', (req, res) => {
    try {
        const { format = 'json' } = req.query;
        if (DEMO_MODE) {
            const scanResult = getAnalysisScanResult();
            const findingsData = getAnalysisFindings();
            if (format === 'json') {
                res.json({
                    scan: scanResult,
                    findings: findingsData,
                    generatedAt: new Date().toISOString()
                });
            }
            else if (format === 'html') {
                // Generate simple HTML report
                const html = generateHTMLReport(scanResult, findingsData);
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
            }
            else {
                res.status(400).json({
                    error: 'Invalid format',
                    message: 'Supported formats: json, html'
                });
            }
        }
        else {
            res.status(501).json({
                error: 'Real reports not yet implemented',
                message: 'Set DEMO_MODE=true to use mock data'
            });
        }
    }
    catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/graph', (_req, res) => {
    try {
        if (DEMO_MODE) {
            res.json(getGraphPayload());
        }
        else {
            res.status(501).json({
                error: 'Real graph not yet implemented',
                message: 'Set DEMO_MODE=true to use integrated demo analysis'
            });
        }
    }
    catch (error) {
        console.error('Error getting graph:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Helper function to generate HTML report
function generateHTMLReport(scan, findings) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architecture Drift Report - ${scan.scanId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { margin: 0 0 10px 0; color: #333; }
    .score {
      font-size: 48px;
      font-weight: bold;
      color: ${scan.complianceScore >= 80 ? '#10b981' : scan.complianceScore >= 60 ? '#f59e0b' : '#ef4444'};
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-label { color: #666; font-size: 14px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .findings {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .finding {
      border-left: 4px solid #ddd;
      padding: 15px;
      margin: 15px 0;
      background: #f9f9f9;
    }
    .finding.high { border-left-color: #ef4444; }
    .finding.medium { border-left-color: #f59e0b; }
    .finding.low { border-left-color: #3b82f6; }
    .finding.info { border-left-color: #6b7280; }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .finding-title { font-weight: bold; color: #333; }
    .severity-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .severity-high { background: #fee2e2; color: #991b1b; }
    .severity-medium { background: #fef3c7; color: #92400e; }
    .severity-low { background: #dbeafe; color: #1e40af; }
    .severity-info { background: #f3f4f6; color: #374151; }
    .remediation {
      background: #1f2937;
      color: #f9fafb;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      margin-top: 10px;
    }
    pre { margin: 0; }
    code { font-family: 'Courier New', monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Architecture Drift Report</h1>
    <p>Scan ID: ${scan.scanId}</p>
    <p>Generated: ${new Date().toISOString()}</p>
    <div class="score">Compliance Score: ${scan.complianceScore}/100</div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Total Findings</div>
      <div class="stat-value">${scan.statistics.totalFindings}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">High Severity</div>
      <div class="stat-value" style="color: #ef4444;">${scan.statistics.bySeverity.high}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Medium Severity</div>
      <div class="stat-value" style="color: #f59e0b;">${scan.statistics.bySeverity.medium}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Duration</div>
      <div class="stat-value">${(scan.durationMs / 1000).toFixed(2)}s</div>
    </div>
  </div>

  <div class="findings">
    <h2>Findings</h2>
    ${findings.map(f => `
      <div class="finding ${f.severity}">
        <div class="finding-header">
          <div class="finding-title">${f.logicalName}</div>
          <span class="severity-badge severity-${f.severity}">${f.severity}</span>
        </div>
        <p><strong>Type:</strong> ${f.driftType.replace(/_/g, ' ')}</p>
        <p><strong>Summary:</strong> ${f.diffSummary}</p>
        <p><strong>Impact:</strong> ${f.reasoning.impact}</p>
        <details>
          <summary><strong>Remediation</strong></summary>
          <div class="remediation">
            <pre><code>${f.reasoning.terraformRemediation}</code></pre>
          </div>
        </details>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
}
// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Architecture Drift Copilot - Backend API                  ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                   ║
║  Mode: ${DEMO_MODE ? 'DEMO (using mock data)' : 'PRODUCTION'}                        ║
║  Health check: http://localhost:${PORT}/api/health            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
exports.default = app;
// Made with Bob
//# sourceMappingURL=server.js.map