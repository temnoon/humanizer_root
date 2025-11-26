// Post-Social API Worker
// Unified authentication via npe-api JWT tokens
// AI-powered content curation and semantic search
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import postsRoutes from './routes/posts';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
import commentsRoutes from './routes/comments';
import synthesisRoutes from './routes/synthesis';
// Node System routes (Phase 1)
import nodesRoutes from './routes/nodes';
import narrativesRoutes from './routes/narratives';
import subscriptionsRoutes from './routes/subscriptions';
import narrativeCommentsRoutes from './routes/narrative-comments';
import curatorRoutes from './routes/curator';
import curatorAgentRoutes from './routes/curator-agent';
import { validateConfig } from './config/ai-models';

// Environment bindings type
type Bindings = {
  // Database
  DB: D1Database;
  // KV for rate limiting and caching (optional)
  KV?: KVNamespace;
  // Workers AI
  AI: Ai;
  // Vectorize for semantic search (optional until created)
  POST_VECTORS?: VectorizeIndex;
  // Queue for async curation (optional)
  CURATION_QUEUE?: Queue;
  // Secrets
  JWT_SECRET: string;
  // Config
  ENVIRONMENT?: string;
};

// App type with bindings
export type AppType = Hono<{ Bindings: Bindings }>;

const app = new Hono<{ Bindings: Bindings }>();

// CORS configuration with function-based origin check
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin.startsWith('http://localhost:')) {
      return origin;
    }
    
    // Allow humanizer.com domains
    if (origin === 'https://humanizer.com' || 
        origin.endsWith('.humanizer.com')) {
      return origin;
    }
    
    // Allow post-social-ui.pages.dev domains
    if (origin === 'https://post-social-ui.pages.dev' || 
        origin.endsWith('.post-social-ui.pages.dev')) {
      return origin;
    }
    
    // Deny all other origins
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check and service info
app.get('/', (c) => {
  // Validate AI model configuration
  const configValidation = validateConfig();
  
  return c.json({
    service: 'post-social-api',
    status: 'healthy',
    version: '2.2.0',
    features: {
      authentication: 'unified-jwt',
      contentModeration: 'llama-guard',
      aiCuration: true,
      aiCurator: true,
      curatorAgent: true,
      semanticSearch: !!c.env.POST_VECTORS,
      asyncQueue: !!c.env.CURATION_QUEUE,
    },
    config: {
      valid: configValidation.valid,
      errors: configValidation.errors,
    },
    description: 'Post-social networking API with AI curation',
  });
});

// API routes - Legacy posts system
app.route('/api/posts', postsRoutes);
app.route('/api/posts', commentsRoutes);  // Comments nested under posts
app.route('/api/posts', synthesisRoutes);  // Synthesis nested under posts
app.route('/api', commentsRoutes);  // Direct comment operations
app.route('/api/search', searchRoutes);
app.route('/api/admin', adminRoutes);

// API routes - Node System (Phase 1)
app.route('/api/nodes', nodesRoutes);
app.route('/api/nodes', narrativesRoutes);  // Narratives nested under nodes
app.route('/api/narratives', narrativesRoutes);  // Direct narrative access by ID
app.route('/api/narratives', narrativeCommentsRoutes);  // Comments nested under narratives
app.route('/api/narrative-comments', narrativeCommentsRoutes);  // Direct comment operations
app.route('/api/subscriptions', subscriptionsRoutes);

// API routes - AI Curator (Phase 2)
app.route('/api/curator', curatorRoutes);
app.route('/api/curator-agent', curatorAgentRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('[ERROR]', err);
  return c.json({
    error: 'Internal server error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : 'An error occurred',
  }, 500);
});

export default app;
