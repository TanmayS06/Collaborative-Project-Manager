import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import workspaceRoutes from './routes/workspaceRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { isRedisReady } from './config/redis';
import { initSocket } from './socket';
import { initReminderWorker } from './jobs/reminderWorker';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
initSocket(httpServer);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Redis-backed Rate Limiting
app.use('/api/auth', rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication requests. Please try again in 15 minutes.',
}));

app.use('/api', rateLimiter({
  windowMs: 60 * 1000,
  max: 150,
  message: 'API rate limit exceeded. Please slow down.',
}));

// Health check with Redis and Socket.IO status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SyncSphere API',
    realtime: 'Socket.IO ready',
    cache: isRedisReady() ? 'Redis connected' : 'in-memory fallback mode',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`🚀 [SyncSphere Server] running smoothly with Socket.IO on http://localhost:${PORT}`);
    // Boot BullMQ background workers
    initReminderWorker();
  });
}

export default app;

