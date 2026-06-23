import express, { Request, Response } from 'express';
import { db } from '../db';
import { scans, findings, resources } from '../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Run analysis (mock mode)
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Load mock scan result
      const mockDataPath = path.join(__dirname, '../../data/mock/scan-result.json');
      const mockData = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
      res.json(mockData);
    } else {
      // TODO: Implement real analysis service
      res.status(501).json({ error: 'Real analysis not yet implemented' });
    }
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    res.status(500).json({ error: 'Failed to run analysis' });
  }
});

// Get findings for a scan
router.get('/findings', async (req: Request, res: Response) => {
  try {
    const { scanId } = req.query;
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Load mock findings
      const mockDataPath = path.join(__dirname, '../../data/mock/findings.json');
      const mockData = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
      res.json(mockData);
    } else {
      if (!scanId) {
        return res.status(400).json({ error: 'scanId is required' });
      }
      
      const scanFindings = await db
        .select()
        .from(findings)
        .where(eq(findings.scanId, scanId as string));
      
      res.json(scanFindings);
    }
  } catch (error) {
    console.error('Error in findings endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

// Get resources for a scan
router.get('/resources', async (req: Request, res: Response) => {
  try {
    const { scanId } = req.query;
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Return mock resources
      res.json({
        intentResources: [],
        terraformResources: [],
        awsResources: []
      });
    } else {
      if (!scanId) {
        return res.status(400).json({ error: 'scanId is required' });
      }
      
      const scanResources = await db
        .select()
        .from(resources)
        .where(eq(resources.scanId, scanId as string));
      
      // Group by source
      const grouped = {
        intentResources: scanResources.filter(r => r.source === 'intent'),
        terraformResources: scanResources.filter(r => r.source === 'terraform'),
        awsResources: scanResources.filter(r => r.source === 'aws')
      };
      
      res.json(grouped);
    }
  } catch (error) {
    console.error('Error in resources endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get list of scans
router.get('/scans', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Return mock scan list
      res.json([
        {
          id: 'mock-scan-1',
          projectId: 'demo-project',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 5000,
          complianceScore: 68,
          status: 'completed'
        }
      ]);
    } else {
      const allScans = await db.select().from(scans);
      res.json(allScans);
    }
  } catch (error) {
    console.error('Error in scans endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// Get graph data
router.get('/graph', async (req: Request, res: Response) => {
  try {
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      // Return mock graph data
      const mockGraph = {
        planned: {
          nodes: [
            { id: 'vpc-1', label: 'VPC', type: 'AWS::EC2::VPC', status: 'planned' },
            { id: 'subnet-1', label: 'Public Subnet', type: 'AWS::EC2::Subnet', status: 'planned' },
            { id: 'subnet-2', label: 'Private Subnet', type: 'AWS::EC2::Subnet', status: 'planned' },
            { id: 'igw-1', label: 'Internet Gateway', type: 'AWS::EC2::InternetGateway', status: 'planned' },
            { id: 'ec2-1', label: 'Web Server', type: 'AWS::EC2::Instance', status: 'planned' },
            { id: 'rds-1', label: 'Database', type: 'AWS::RDS::DBInstance', status: 'planned' },
          ],
          edges: [
            { id: 'e1', source: 'vpc-1', target: 'subnet-1', label: 'contains' },
            { id: 'e2', source: 'vpc-1', target: 'subnet-2', label: 'contains' },
            { id: 'e3', source: 'vpc-1', target: 'igw-1', label: 'attached' },
            { id: 'e4', source: 'subnet-1', target: 'ec2-1', label: 'hosts' },
            { id: 'e5', source: 'subnet-2', target: 'rds-1', label: 'hosts' },
          ]
        },
        terraform: {
          nodes: [
            { id: 'vpc-1', label: 'VPC', type: 'aws_vpc', status: 'managed' },
            { id: 'subnet-1', label: 'Public Subnet', type: 'aws_subnet', status: 'managed' },
            { id: 'subnet-2', label: 'Private Subnet', type: 'aws_subnet', status: 'managed' },
            { id: 'igw-1', label: 'Internet Gateway', type: 'aws_internet_gateway', status: 'managed' },
            { id: 'ec2-1', label: 'Web Server', type: 'aws_instance', status: 'managed' },
          ],
          edges: [
            { id: 'e1', source: 'vpc-1', target: 'subnet-1', label: 'contains' },
            { id: 'e2', source: 'vpc-1', target: 'subnet-2', label: 'contains' },
            { id: 'e3', source: 'vpc-1', target: 'igw-1', label: 'attached' },
            { id: 'e4', source: 'subnet-1', target: 'ec2-1', label: 'hosts' },
          ]
        },
        deployed: {
          nodes: [
            { id: 'vpc-1', label: 'VPC', type: 'AWS::EC2::VPC', status: 'deployed' },
            { id: 'subnet-1', label: 'Public Subnet', type: 'AWS::EC2::Subnet', status: 'deployed' },
            { id: 'subnet-2', label: 'Private Subnet', type: 'AWS::EC2::Subnet', status: 'deployed' },
            { id: 'igw-1', label: 'Internet Gateway', type: 'AWS::EC2::InternetGateway', status: 'deployed' },
            { id: 'ec2-1', label: 'Web Server', type: 'AWS::EC2::Instance', status: 'deployed' },
            { id: 'sg-1', label: 'Security Group', type: 'AWS::EC2::SecurityGroup', status: 'unmanaged' },
          ],
          edges: [
            { id: 'e1', source: 'vpc-1', target: 'subnet-1', label: 'contains' },
            { id: 'e2', source: 'vpc-1', target: 'subnet-2', label: 'contains' },
            { id: 'e3', source: 'vpc-1', target: 'igw-1', label: 'attached' },
            { id: 'e4', source: 'subnet-1', target: 'ec2-1', label: 'hosts' },
            { id: 'e5', source: 'ec2-1', target: 'sg-1', label: 'uses' },
          ]
        }
      };
      
      res.json(mockGraph);
    } else {
      res.status(501).json({ error: 'Graph generation not yet implemented' });
    }
  } catch (error) {
    console.error('Error in graph endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
});

// Generate report
router.get('/report', async (req: Request, res: Response) => {
  try {
    const { scanId, format = 'json' } = req.query;
    const demoMode = process.env.DEMO_MODE === 'true';
    
    if (demoMode) {
      const mockDataPath = path.join(__dirname, '../../data/mock/scan-result.json');
      const mockData = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
      
      if (format === 'html') {
        // Generate simple HTML report
        const html = generateHTMLReport(mockData);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } else {
        res.json(mockData);
      }
    } else {
      res.status(501).json({ error: 'Report generation not yet implemented' });
    }
  } catch (error) {
    console.error('Error in report endpoint:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

function generateHTMLReport(data: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architecture Drift Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .score { font-size: 48px; font-weight: bold; color: #4CAF50; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9f9f9; padding: 20px; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #333; }
    .stat-label { color: #666; margin-top: 5px; }
    .finding { background: #fff; border-left: 4px solid #ff9800; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .finding.critical { border-left-color: #f44336; }
    .finding.high { border-left-color: #ff9800; }
    .finding.medium { border-left-color: #ffc107; }
    .finding.low { border-left-color: #4caf50; }
    .severity { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .severity.critical { background: #f44336; color: white; }
    .severity.high { background: #ff9800; color: white; }
    .severity.medium { background: #ffc107; color: black; }
    .severity.low { background: #4caf50; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Architecture Drift Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Executive Summary</h2>
    <div class="score">Compliance Score: ${data.complianceScore || 0}/100</div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.totalFindings || 0}</div>
        <div class="stat-label">Total Findings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.critical || 0}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.high || 0}</div>
        <div class="stat-label">High</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.statistics?.medium || 0}</div>
        <div class="stat-label">Medium</div>
      </div>
    </div>
    
    <h2>Findings</h2>
    ${(data.findings || []).map((f: any) => `
      <div class="finding ${f.severity}">
        <div>
          <span class="severity ${f.severity}">${f.severity}</span>
          <strong>${f.driftType}</strong> - ${f.resourceType} (${f.logicalName})
        </div>
        <p>${f.diffSummary}</p>
        ${f.reasoning ? `
          <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <strong>Analysis:</strong> ${f.reasoning.summary}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
}

export default router;
