/**
 * Humanizer API Server
 *
 * HTTP server wrapping UnifiedAuiService using Hono.
 * Uses model registry for proper embedding model configuration.
 *
 * @module @humanizer/api
 */

// Load environment variables from .env file
import 'dotenv/config';

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
  initFeatureFlagService,
  initAuditService,
  initPreferencesService,
  initUserService,
  InMemoryConfigManager,
  ALL_PROMPTS,
  type PromptDefinition,
  type ApiKeyScope,
  // Configuration keys and defaults
  EMBEDDING_CONFIG_KEYS,
  EMBEDDING_DEFAULTS,
  STORAGE_CONFIG_KEYS,
  STORAGE_STATIC_DEFAULTS,
  SERVICE_CONFIG_KEYS,
  SERVICE_DEFAULTS,
  // Model registry services
  initProviderConfigService,
  initOllamaDiscovery,
  initProviderHealthService,
  initDatabaseModelRegistry,
  setModelRegistry,
} from '@humanizer/core';
import { OllamaAdapter } from '@humanizer/npe';

import { setUsageService } from './middleware/quota-check.js';
import { setApiKeyService } from './middleware/auth.js';

import { auiMiddleware, setAuiService, type AuiContextVariables } from './middleware/aui-context.js';
import { devAuth } from './middleware/auth.js';
import { usageContextMiddleware } from './middleware/usage-context.js';
import { wrapEmbedFnWithUsageRecording, wrapLlmAdapterWithUsageRecording } from './middleware/usage-recording.js';
import { sessionsRouter } from './routes/sessions.js';
import { buffersRouter } from './routes/buffers.js';
import { searchRouter } from './routes/search.js';
import { clustersRouter } from './routes/clusters.js';
import { booksRouter } from './routes/books.js';
import { adminRouter } from './routes/admin.js';
import { settingsRouter } from './routes/settings.js';
import { authRouter } from './routes/auth.js';
import { archiveRouter } from './routes/archive.js';

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
  /** Encryption key for provider API keys (32 bytes / 64 hex chars) */
  providerKeyEncryptionKey?: string;
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
    corsOrigins: process.env.CORS_ORIGINS?.split(',') ??
      (SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.CORS_DEV_ORIGINS] as string[]),
    providerKeyEncryptionKey: process.env.PROVIDER_KEY_ENCRYPTION_KEY,
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

  // Apply auth, usage context, and AUI middleware to all API routes
  // devAuth() allows anonymous access in development, requires auth in production
  // usageContextMiddleware() propagates user info for usage tracking
  app.use('/sessions/*', devAuth(), usageContextMiddleware(), auiMiddleware);
  app.use('/search/*', devAuth(), usageContextMiddleware(), auiMiddleware);
  app.use('/clusters/*', devAuth(), usageContextMiddleware(), auiMiddleware);
  app.use('/books/*', devAuth(), usageContextMiddleware(), auiMiddleware);
  app.use('/admin/*', devAuth(), usageContextMiddleware(), auiMiddleware);
  app.use('/settings/*', devAuth(), usageContextMiddleware(), auiMiddleware);

  // Mount routers
  app.route('/auth', authRouter); // Auth routes handle their own authentication
  app.route('/sessions', sessionsRouter);
  app.route('/sessions', buffersRouter); // Buffer routes are under /sessions/:id/buffers
  app.route('/search', searchRouter);
  app.route('/archive', archiveRouter); // UCG archive browse/query
  app.route('/clusters', clustersRouter);
  app.route('/books', booksRouter);
  app.route('/admin', adminRouter);
  app.route('/settings', settingsRouter);

  // 404 handler
  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  // Error handler - sanitize error messages in production
  app.onError((err, c) => {
    const isDev = process.env.NODE_ENV === 'development';

    // Always log full error server-side
    console.error('Server error:', err);

    // In development, return full error details
    if (isDev) {
      return c.json(
        {
          error: err.message ?? 'Internal server error',
          stack: err.stack,
        },
        500
      );
    }

    // In production, return sanitized error messages
    // Map specific error types to safe messages
    const errMsg = err.message?.toLowerCase() ?? '';

    if (errMsg.includes('not found')) {
      return c.json({ error: 'Resource not found' }, 404);
    }
    if (errMsg.includes('unauthorized')) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    if (errMsg.includes('forbidden')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    if (errMsg.includes('validation') || errMsg.includes('invalid')) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    // All other errors return generic 500
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG MANAGER HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract variable names from a template string.
 * Variables are in {{variableName}} format.
 */
function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const vars: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    const varName = match[1].trim();
    if (!vars.includes(varName)) {
      vars.push(varName);
    }
  }
  return vars;
}

/**
 * Convert PromptDefinition to the format expected by InMemoryConfigManager.
 */
function convertPromptDefinitionToTemplate(def: PromptDefinition) {
  return {
    id: def.id,
    name: def.name,
    template: def.template,
    description: def.description,
    requiredVariables: extractTemplateVariables(def.template),
    usedBy: def.usedBy,
    tags: def.deprecated ? ['deprecated'] : undefined,
  };
}

/**
 * Create a ConfigManager seeded with all prompts from the prompt registry.
 */
async function createSeededConfigManager(): Promise<InMemoryConfigManager> {
  const configManager = new InMemoryConfigManager({
    userId: 'system',
    seedPrompts: ALL_PROMPTS.map(convertPromptDefinitionToTemplate),
  });
  await configManager.initialize();
  return configManager;
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
    const embedModelId = process.env.EMBEDDING_MODEL ??
      (EMBEDDING_DEFAULTS[EMBEDDING_CONFIG_KEYS.DEFAULT_MODEL] as string);
    const embedModel = await registry.get(embedModelId);

    if (!embedModel) {
      throw new Error(`Embedding model ${embedModelId} not found in registry`);
    }

    const embeddingDimension = embedModel.dimensions ??
      (EMBEDDING_DEFAULTS[EMBEDDING_CONFIG_KEYS.DIMENSIONS] as number);
    console.log(`Using embedding model: ${embedModel.id} (${embeddingDimension} dimensions, ${embedModel.provider})`);

    // Create Ollama adapter with registry-derived model
    const ollamaUrl = process.env.OLLAMA_URL ??
      (EMBEDDING_DEFAULTS[EMBEDDING_CONFIG_KEYS.OLLAMA_URL] as string);
    const ollamaAdapter = new OllamaAdapter({
      baseUrl: ollamaUrl,
      embedModel: embedModel.id,
    });

    // Verify Ollama is available
    const ollamaAvailable = await ollamaAdapter.isAvailable();
    if (!ollamaAvailable) {
      console.warn(`Warning: Ollama not available at ${ollamaUrl}. Search will not work.`);
    }

    // Create embedding function that uses the adapter, wrapped with usage recording
    // The wrapper gets UsageService lazily, so it's safe to create before UsageService init
    const rawEmbedFn = async (text: string): Promise<number[]> => {
      const result = await ollamaAdapter.embed(text);
      return result.embedding;
    };

    const embedFn = wrapEmbedFnWithUsageRecording(rawEmbedFn, {
      embedModelId: embedModel.id,
      provider: 'ollama',
    });

    console.log('Embedding function wrapped with usage recording');

    // Create config manager seeded with all prompts
    console.log('Initializing ConfigManager with prompt registry...');
    const configManager = await createSeededConfigManager();
    console.log(`ConfigManager initialized with ${ALL_PROMPTS.length} prompts`);

    // Initialize the AUI service with PostgreSQL storage and embedding function
    const auiService = await initUnifiedAuiWithStorage({
      embedFn: ollamaAvailable ? embedFn : undefined,
      configManager,
      storageConfig: {
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        maxConnections: STORAGE_STATIC_DEFAULTS[STORAGE_CONFIG_KEYS.MAX_CONNECTIONS] as number,
        idleTimeoutMs: STORAGE_STATIC_DEFAULTS[STORAGE_CONFIG_KEYS.IDLE_TIMEOUT_MS] as number,
        connectionTimeoutMs: STORAGE_STATIC_DEFAULTS[STORAGE_CONFIG_KEYS.CONNECTION_TIMEOUT_MS] as number,
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
        defaultTenantId: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.DEFAULT_TENANT_ID] as string,
        defaultUserTier: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.DEFAULT_USER_TIER] as string,
        cacheTtlMs: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.USAGE_CACHE_TTL_MS] as number,
      });
      setUsageService(usageService);
      console.log('UsageService initialized');

      // Initialize ApiKeyService for API key authentication
      const apiKeyService = initApiKeyService(pool, {
        defaultTenantId: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.DEFAULT_TENANT_ID] as string,
        defaultScopes: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.API_KEY_DEFAULT_SCOPES] as ApiKeyScope[],
        defaultRateLimitRpm: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.API_KEY_DEFAULT_RATE_LIMIT_RPM] as number,
        keyPrefix: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.API_KEY_PREFIX] as string,
      });
      setApiKeyService(apiKeyService);
      console.log('ApiKeyService initialized');

      // Initialize FeatureFlagService for feature toggles
      initFeatureFlagService(pool, 'humanizer');
      console.log('FeatureFlagService initialized');

      // Initialize AuditService for audit logging
      initAuditService(pool, 'humanizer');
      console.log('AuditService initialized');

      // Initialize PreferencesService for user settings
      initPreferencesService(pool, 'humanizer');
      console.log('PreferencesService initialized');

      // Initialize UserService for user management
      initUserService(pool, {
        defaultTenantId: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.DEFAULT_TENANT_ID] as string,
        passwordMinLength: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.PASSWORD_MIN_LENGTH] as number,
        tokenExpiryHours: SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.TOKEN_EXPIRY_HOURS] as number,
      });
      console.log('UserService initialized');

      // ═══════════════════════════════════════════════════════════════════════
      // MODEL REGISTRY SERVICES
      // ═══════════════════════════════════════════════════════════════════════

      const defaultTenantId = SERVICE_DEFAULTS[SERVICE_CONFIG_KEYS.DEFAULT_TENANT_ID] as string;

      // Initialize DatabaseModelRegistry (wraps default registry with database-backed config)
      // This creates its own ModelConfigService internally
      const dbRegistry = await initDatabaseModelRegistry(pool, {
        defaultTenantId,
      });

      // Replace the default model registry with the database-backed one
      setModelRegistry(dbRegistry);
      console.log('DatabaseModelRegistry initialized and set as default');

      // Get the model config service from the registry for other services to use
      const modelConfigService = dbRegistry.getConfigService();

      // Initialize ProviderConfigService for BYOK API key management
      if (config.providerKeyEncryptionKey) {
        const providerConfigService = initProviderConfigService(pool, {
          encryptionKey: config.providerKeyEncryptionKey,
          defaultTenantId,
        });
        console.log('ProviderConfigService initialized');

        // Initialize OllamaDiscoveryService for local model discovery
        const ollamaDiscovery = initOllamaDiscovery({
          baseUrl: ollamaUrl,
          defaultTenantId,
        });
        ollamaDiscovery.setModelConfigService(modelConfigService);
        ollamaDiscovery.setProviderConfigService(providerConfigService);
        console.log('OllamaDiscoveryService initialized');

        // Initialize ProviderHealthService for health monitoring
        const providerHealthService = initProviderHealthService({
          defaultTenantId,
        });
        providerHealthService.setProviderConfigService(providerConfigService);
        providerHealthService.setOllamaDiscoveryService(ollamaDiscovery);
        console.log('ProviderHealthService initialized');

        // Run initial Ollama discovery in the background
        ollamaDiscovery.discover().then(result => {
          if (result.success) {
            console.log(`Ollama discovery: found ${result.modelsFound} models, registered ${result.modelsRegistered}`);
          } else {
            console.warn(`Ollama discovery failed: ${result.error}`);
          }
        }).catch(err => {
          console.warn('Ollama discovery error:', err);
        });
      } else {
        console.warn('PROVIDER_KEY_ENCRYPTION_KEY not set - ProviderConfigService and related services not initialized');
        console.warn('To enable BYOK (Bring Your Own Key) functionality, set PROVIDER_KEY_ENCRYPTION_KEY environment variable');
      }
    } else {
      console.warn('Archive store not available - services not initialized');
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
