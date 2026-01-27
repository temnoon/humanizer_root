/**
 * Humanizer API Server
 *
 * HTTP server wrapping UnifiedAuiService using Hono.
 * Uses model registry for proper embedding model configuration.
 *
 * @module @humanizer/api
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import {
  initUnifiedAuiWithStorage,
  getModelRegistry,
  initUsageService,
  initApiKeyService,
} from '@humanizer/core';
import { OllamaAdapter } from '@humanizer/npe';

import { setUsageService } from './middleware/quota-check.js';
import { setApiKeyService } from './middleware/auth.js';

import { auiMiddleware, setAuiService, type AuiContextVariables } from './middleware/aui-context.js';
import { devAuth } from './middleware/auth.js';
import { sessionsRouter } from './routes/sessions.js';
import { buffersRouter } from './routes/buffers.js';
import { searchRouter } from './routes/search.js';
import { clustersRouter } from './routes/clusters.js';
import { booksRouter } from './routes/books.js';
import { adminRouter } from './routes/admin.js';
import { settingsRouter } from './routes/settings.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface ServerConfig {
  port: number;
  host: string;
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
  };
  corsOrigins?: string[];
}

function getConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT ?? '3030', 10),
    host: process.env.HOST ?? '0.0.0.0',
    postgres: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      database: process.env.POSTGRES_DB ?? 'humanizer_archive',
      user: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD,
    },
    corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:5179',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// APP CREATION
// ═══════════════════════════════════════════════════════════════════════════

export function createApp(): Hono<{ Variables: AuiContextVariables }> {
  const config = getConfig();

  const app = new Hono<{ Variables: AuiContextVariables }>();

  // Middleware
  app.use('*', logger());
  app.use('*', prettyJSON());
  app.use(
    '*',
    cors({
      origin: config.corsOrigins ?? ['http://localhost:5173'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Health check (no auth required)
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // API version info
  app.get('/', (c) =>
    c.json({
      name: 'Humanizer API',
      version: '0.1.0',
      endpoints: [
        'GET /health',
        'GET /sessions',
        'POST /sessions',
        'GET /sessions/:id',
        'DELETE /sessions/:id',
        'GET /sessions/:sessionId/buffers',
        'POST /sessions/:sessionId/buffers',
        'GET /sessions/:sessionId/buffers/:name',
        'POST /search',
        'POST /search/similar',
        'GET /clusters',
        'POST /clusters/discover',
        'GET /books',
        'POST /books/from-cluster',
        'POST /books/harvest',
      ],
    })
  );

  // Apply auth and AUI middleware to all API routes
  // devAuth() allows anonymous access in development, requires auth in production
  app.use('/sessions/*', devAuth(), auiMiddleware);
  app.use('/search/*', devAuth(), auiMiddleware);
  app.use('/clusters/*', devAuth(), auiMiddleware);
  app.use('/books/*', devAuth(), auiMiddleware);
  app.use('/admin/*', devAuth(), auiMiddleware);
  app.use('/settings/*', devAuth(), auiMiddleware);

  // Mount routers
  app.route('/sessions', sessionsRouter);
  app.route('/sessions', buffersRouter); // Buffer routes are under /sessions/:id/buffers
  app.route('/search', searchRouter);
  app.route('/clusters', clustersRouter);
  app.route('/books', booksRouter);
  app.route('/admin', adminRouter);
  app.route('/settings', settingsRouter);

  // 404 handler
  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  // Error handler
  app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json(
      {
        error: err.message ?? 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
      500
    );
  });

  return app;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const config = getConfig();

  console.log('Initializing AUI service...');

  try {
    // Get embedding model from registry
    // Use nomic-embed-text for local privacy (Ollama) - matches existing 768-dim embeddings
    const registry = getModelRegistry();
    const embedModelId = process.env.EMBEDDING_MODEL ?? 'nomic-embed-text:latest';
    const embedModel = await registry.get(embedModelId);

    if (!embedModel) {
      throw new Error(`Embedding model ${embedModelId} not found in registry`);
    }

    const embeddingDimension = embedModel.dimensions ?? 768;
    console.log(`Using embedding model: ${embedModel.id} (${embeddingDimension} dimensions, ${embedModel.provider})`);

    // Create Ollama adapter with registry-derived model
    const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    const ollamaAdapter = new OllamaAdapter({
      baseUrl: ollamaUrl,
      embedModel: embedModel.id,
    });

    // Verify Ollama is available
    const ollamaAvailable = await ollamaAdapter.isAvailable();
    if (!ollamaAvailable) {
      console.warn(`Warning: Ollama not available at ${ollamaUrl}. Search will not work.`);
    }

    // Create embedding function that uses the adapter
    const embedFn = async (text: string): Promise<number[]> => {
      const result = await ollamaAdapter.embed(text);
      return result.embedding;
    };

    // Initialize the AUI service with PostgreSQL storage and embedding function
    const auiService = await initUnifiedAuiWithStorage({
      embedFn: ollamaAvailable ? embedFn : undefined,
      storageConfig: {
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        maxConnections: 10,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 10000,
        embeddingDimension,
        enableFTS: true,
        enableVec: true,
      },
    });

    // Set the global AUI service for middleware
    setAuiService(auiService);
    console.log('AUI service initialized');

    // Initialize usage and API key services with the database pool
    // Access pool via the archive store that was attached to the AUI service
    const archiveStore = auiService.getArchiveStore();
    if (archiveStore) {
      const pool = archiveStore.getPool();

      // Initialize UsageService for quota tracking
      const usageService = initUsageService(pool, {
        defaultTenantId: 'humanizer',
        defaultUserTier: 'free',
        cacheTtlMs: 60_000,
      });
      setUsageService(usageService);
      console.log('UsageService initialized');

      // Initialize ApiKeyService for API key authentication
      const apiKeyService = initApiKeyService(pool, {
        defaultTenantId: 'humanizer',
        defaultScopes: ['read', 'write'],
        defaultRateLimitRpm: 60,
        keyPrefix: 'hum_',
      });
      setApiKeyService(apiKeyService);
      console.log('ApiKeyService initialized');
    } else {
      console.warn('Archive store not available - UsageService and ApiKeyService not initialized');
    }

    // Create and start the app
    const app = createApp();

    console.log(`Starting server on ${config.host}:${config.port}...`);

    serve(
      {
        fetch: app.fetch,
        port: config.port,
        hostname: config.host,
      },
      (info) => {
        console.log(`Server running at http://${info.address}:${info.port}`);
        console.log(`CORS origins: ${config.corsOrigins?.join(', ')}`);
        console.log(`Agentic search: ${ollamaAvailable ? 'enabled' : 'disabled (Ollama unavailable)'}`);
        console.log(`Auth mode: ${process.env.JWT_SECRET ? 'production (JWT required)' : 'development (mock auth)'}`);
      }
    );
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main().catch(console.error);

// Export for testing
export { setAuiService, getAuiService } from './middleware/aui-context.js';
