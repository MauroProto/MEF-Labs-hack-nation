import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { createServer } from 'http';

// Routes
import agentRoutes from './routes/agentRoutes';
import capabilityRoutes from './routes/capabilityRoutes';

// WebSocket
import { initializeWebSocket, getWebSocketManager } from './lib/websocket';

// Types
import { AgentError } from './types/agent.types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// Initialize WebSocket server
const wsManager = initializeWebSocket(httpServer);

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  const wsStats = wsManager.getStats();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websocket: {
      connected: wsStats.connectedClients,
      byCanvas: wsStats.clientsByCanvas,
    },
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Research Agent Canvas API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      agents: '/api/agents',
      capabilities: '/api/capabilities',
    },
  });
});

// Mount routes
app.use('/api/agents', agentRoutes);
app.use('/api/capabilities', capabilityRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);

  // Handle AgentError specifically
  if (err instanceof AgentError) {
    return res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        data: err.data,
      },
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: (err as any).errors,
    });
  }

  // Generic error handler
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Agents API: http://localhost:${PORT}/api/agents`);
  console.log(`🔌 WebSocket server initialized on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await wsManager.shutdown();
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

export default app;
