// Main entry point for NPE Workers API
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes from './routes/auth';
import transformationRoutes from './routes/transformations';
import configRoutes from './routes/config';
import mailingListRoutes from './routes/mailing-list';
import { requireAuth } from './middleware/auth';
import type { Env } from '../shared/types';

// Export Durable Object for maieutic sessions
export { MaieuticSessionDO } from './services/maieutic';

const app = new Hono<{ Bindings: Env }>();

// Middleware: Logging
app.use('*', logger());

// Middleware: CORS
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    // Allow production domains
    if (origin === 'https://humanizer.com' ||
        origin === 'https://www.humanizer.com' ||
        origin.endsWith('.pages.dev')) {
      return origin;
    }
    // Default deny
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'NPE Workers API',
    version: '1.0.0',
    status: 'online',
    timestamp: Date.now()
  });
});

// Routes
app.route('/auth', authRoutes);
app.route('/transformations', transformationRoutes);
app.route('/config', configRoutes);
app.route('/mailing-list', mailingListRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
