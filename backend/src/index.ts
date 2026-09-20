import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { env } from './config/env';
import { prisma } from './database/prisma';
import { initIO, emitToAll } from './socket';
import { errorHandler } from './middlewares/errorHandler';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import attendantRoutes from './modules/attendants/attendant.routes';
import queueRoutes from './modules/queue/queue.routes';
import chatRoutes from './modules/chats/chat.routes';
import cannedRoutes from './modules/canned/canned.routes';
import aiRoutes from './modules/ai/ai.routes';
import documentsRoutes from './modules/documents/documents.routes';
import tagRoutes from './modules/tags/tag.routes';
import blockedRoutes from './modules/blocked/blocked.routes';
import bhRoutes from './modules/business-hours/bh.routes';
import metricsRoutes from './modules/metrics/metrics.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initIO(server);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static files for media
app.use('/media', express.static('/app/data/media'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendants', attendantRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/canned', cannedRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/blocked', blockedRoutes);
app.use('/api/business-hours', bhRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', error: 'Database connection failed' });
  }
});

// Error handler
app.use(errorHandler);

// Start server
server.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check AI status periodically
  setInterval(async () => {
    const { getAIStatus } = await import('./services/ai.service');
    const online = await getAIStatus();
    emitToAll('ai:status', { online });
    console.log(`🤖 AI Status: ${online ? 'Online' : 'Offline'}`);
  }, 30000);
});

export default app;
