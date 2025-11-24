// Main entry point for NPE Workers API
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes from './routes/auth';
import transformationRoutes from './routes/transformations';
import configRoutes from './routes/config';
import mailingListRoutes from './routes/mailing-list';
import webauthnRoutes from './routes/webauthn';
import userSettingsRoutes from './routes/user-settings';
import { quantumAnalysisRoutes } from './routes/quantum-analysis';
import writingSamplesRoutes from './routes/writing-samples';
import personalPersonasRoutes from './routes/personal-personas';
import personalStylesRoutes from './routes/personal-styles';
import aiDetectionRoutes from './routes/ai-detection';
import transformationHistoryRoutes from './routes/transformation-history';
import { analysisRoutes } from './routes/analysis';
import { narrativesRoutes } from './routes/v2/narratives';
import { rhoRoutes } from './routes/v2/rho';
import { adminRoutes } from './routes/admin';
import { secureArchive } from './routes/secure-archive';
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
        origin === 'https://workbench.humanizer.com' ||
        origin === 'https://studio.humanizer.com' ||
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
app.route('/webauthn', webauthnRoutes);
app.route('/user', userSettingsRoutes);
app.route('/quantum-analysis', quantumAnalysisRoutes);

// Personalizer routes
app.route('/personal/samples', writingSamplesRoutes);
app.route('/personal/personas', personalPersonasRoutes);
app.route('/personal/styles', personalStylesRoutes);

// AI Detection routes
app.route('/ai-detection', aiDetectionRoutes);

// Transformation History routes
app.route('/transformation-history', transformationHistoryRoutes);

// Analysis routes (POVM, Rho)
app.route('/eval', analysisRoutes);

// V2 Routes - ρ-Centric Architecture
app.route('/v2/narratives', narrativesRoutes);
app.route('/v2/rho', rhoRoutes);

// V2 Attribute Builder Routes
import attributesRoutes from './routes/v2/attributes';
import workspaceRoutes from './routes/v2/workspace';
app.route('/v2/attributes', attributesRoutes);
app.route('/v2/workspace', workspaceRoutes);

// Admin routes (metrics, user management, system health)
app.route('/admin', adminRoutes);

// Secure Archive routes (encrypted file storage)
app.route('/secure-archive', secureArchive);

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
