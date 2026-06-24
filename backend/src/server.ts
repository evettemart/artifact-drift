import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { initializeDatabase } from './db';
import { seedMockData } from './db/seed';
import apiRouter from './api';

const app = express();
const PORT = config.port;
const DEMO_MODE = config.demoMode;

// Initialize database
initializeDatabase();

// Seed mock data in demo mode
if (DEMO_MODE) {
  console.log('Demo mode enabled - seeding mock data...');
  seedMockData();
}

// Middleware
app.use(cors());
// Larger limit accommodates base64-encoded integration file uploads.
app.use(express.json({ limit: '20mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', apiRouter);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  const reasoning = config.llm.enabled
    ? `${config.llm.provider} (${config.llm.model})`
    : 'deterministic (no LLM key)';
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Drifters - Backend API                                    ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                   ║
║  Mode: ${DEMO_MODE ? 'DEMO (using mock data)' : 'LIVE'}                        ║
║  Reasoning: ${reasoning}
║  AWS region: ${config.aws.region}
║  Health check: http://localhost:${PORT}/api/health            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;