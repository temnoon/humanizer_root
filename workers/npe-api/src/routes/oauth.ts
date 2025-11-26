// OAuth Routes for social login
import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { requireAuth, getAuthContext } from '../middleware/auth';
import { 
  OAuthProvider, 
  OAUTH_PROVIDERS, 
  buildAuthorizationUrl 
} from '../config/oauth-providers';
import {
  generateOAuthState,
  storeOAuthState,
  verifyAndConsumeState,
  cleanupExpiredStates,
  completeOAuthFlow,
  linkOAuthAccount,
  getUserOAuthAccounts,
  unlinkOAuthAccount,
  getProviderCredentials,
  findOAuthAccount,
} from '../services/oauth';
import { exchangeCodeForTokens, fetchUserInfo, decodeAppleIdToken } from '../config/oauth-providers';
import { generateToken } from '../middleware/auth';

const oauthRoutes = new Hono<{ Bindings: Env }>();

// Valid providers
const VALID_PROVIDERS: OAuthProvider[] = ['google', 'github', 'discord', 'facebook', 'apple'];

/**
 * Validate provider parameter
 */
function validateProvider(provider: string): provider is OAuthProvider {
  return VALID_PROVIDERS.includes(provider as OAuthProvider);
}

/**
 * Get OAuth redirect URI
 */
function getRedirectUri(env: Env, provider: OAuthProvider): string {
  // TODO: Change to npe-api.humanizer.com once subdomain is configured
  const baseUrl = env.ENVIRONMENT === 'production' 
    ? 'https://npe-api.tem-527.workers.dev'
    : 'http://localhost:8787';
  return `${baseUrl}/auth/oauth/${provider}/callback`;
}

/**
 * GET /auth/oauth/providers - List available OAuth providers
 */
oauthRoutes.get('/providers', async (c) => {
  const providers = VALID_PROVIDERS.map(provider => {
    // Check if provider is configured
    try {
      getProviderCredentials(c.env, provider);
      return { provider, name: OAUTH_PROVIDERS[provider].name, available: true };
    } catch {
      return { provider, name: OAUTH_PROVIDERS[provider].name, available: false };
    }
  });

  return c.json({ providers });
});

/**
 * GET /auth/oauth/:provider/login - Initiate OAuth flow
 * Redirects user to provider's authorization page
 */
oauthRoutes.get('/:provider/login', async (c) => {
  const provider = c.req.param('provider');
  
  if (!validateProvider(provider)) {
    return c.json({ error: `Invalid OAuth provider: ${provider}` }, 400);
  }

  // Check if provider is configured
  try {
    const { clientId } = getProviderCredentials(c.env, provider);
    const redirectUri = getRedirectUri(c.env, provider);
    
    // Generate and store state for CSRF protection
    const state = generateOAuthState();
    
    // Get optional redirect URI for after OAuth completes
    const finalRedirect = c.req.query('redirect') || null;
    await storeOAuthState(c.env.DB, state, provider, finalRedirect);

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(provider, clientId, redirectUri, state);

    // Redirect to provider
    return c.redirect(authUrl);
  } catch (error) {
    console.error(`[OAuth] ${provider} login error:`, error);
    return c.json({ 
      error: `OAuth provider ${provider} is not configured`,
      hint: `Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET`
    }, 503);
  }
});

/**
 * GET /auth/oauth/:provider/callback - OAuth callback handler
 * Handles the redirect from OAuth provider
 */
oauthRoutes.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Handle OAuth errors
  if (error) {
    console.error(`[OAuth] ${provider} error:`, error, errorDescription);
    return c.json({ 
      error: 'OAuth authorization failed',
      provider_error: error,
      description: errorDescription
    }, 400);
  }

  if (!validateProvider(provider)) {
    return c.json({ error: `Invalid OAuth provider: ${provider}` }, 400);
  }

  if (!code || !state) {
    return c.json({ error: 'Missing code or state parameter' }, 400);
  }

  // Verify state (CSRF protection)
  const stateData = await verifyAndConsumeState(c.env.DB, state);
  if (!stateData) {
    return c.json({ error: 'Invalid or expired state' }, 400);
  }

  if (stateData.provider !== provider) {
    return c.json({ error: 'Provider mismatch' }, 400);
  }

  try {
    const redirectUri = getRedirectUri(c.env, provider);
    
    // Complete OAuth flow
    const result = await completeOAuthFlow(c.env, provider, code, redirectUri);

    // Clean up expired states periodically
    await cleanupExpiredStates(c.env.DB);

    // If there's a final redirect, redirect with token
    if (stateData.redirectUri) {
      const separator = stateData.redirectUri.includes('?') ? '&' : '?';
      const redirectUrl = `${stateData.redirectUri}${separator}token=${result.token}&isNewUser=${result.isNewUser}`;
      return c.redirect(redirectUrl);
    }

    // Otherwise return JSON response
    return c.json({
      success: true,
      token: result.token,
      user: result.user,
      isNewUser: result.isNewUser,
      message: result.isNewUser 
        ? `Account created via ${OAUTH_PROVIDERS[provider].name}`
        : `Logged in via ${OAUTH_PROVIDERS[provider].name}`
    });
  } catch (error) {
    console.error(`[OAuth] ${provider} callback error:`, error);
    return c.json({ 
      error: 'OAuth authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/oauth/:provider/callback - OAuth callback (for Apple's form_post)
 * Apple uses POST for the callback
 */
oauthRoutes.post('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  
  if (!validateProvider(provider)) {
    return c.json({ error: `Invalid OAuth provider: ${provider}` }, 400);
  }

  // Parse form data (Apple sends as form)
  const formData = await c.req.parseBody();
  const code = formData['code'] as string;
  const state = formData['state'] as string;
  const idToken = formData['id_token'] as string;
  const error = formData['error'] as string;

  if (error) {
    console.error(`[OAuth] ${provider} error:`, error);
    return c.json({ error: 'OAuth authorization failed', provider_error: error }, 400);
  }

  if (!code || !state) {
    return c.json({ error: 'Missing code or state parameter' }, 400);
  }

  // Verify state
  const stateData = await verifyAndConsumeState(c.env.DB, state);
  if (!stateData || stateData.provider !== provider) {
    return c.json({ error: 'Invalid or expired state' }, 400);
  }

  try {
    const redirectUri = getRedirectUri(c.env, provider);
    const result = await completeOAuthFlow(c.env, provider, code, redirectUri);

    if (stateData.redirectUri) {
      const separator = stateData.redirectUri.includes('?') ? '&' : '?';
      const redirectUrl = `${stateData.redirectUri}${separator}token=${result.token}&isNewUser=${result.isNewUser}`;
      return c.redirect(redirectUrl);
    }

    return c.json({
      success: true,
      token: result.token,
      user: result.user,
      isNewUser: result.isNewUser,
    });
  } catch (error) {
    console.error(`[OAuth] ${provider} POST callback error:`, error);
    return c.json({ 
      error: 'OAuth authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/oauth/:provider/link - Link OAuth account to existing user
 * Requires authentication
 */
oauthRoutes.post('/:provider/link', requireAuth(), async (c) => {
  const provider = c.req.param('provider');
  const auth = getAuthContext(c);

  if (!validateProvider(provider)) {
    return c.json({ error: `Invalid OAuth provider: ${provider}` }, 400);
  }

  try {
    const { clientId } = getProviderCredentials(c.env, provider);
    const redirectUri = getRedirectUri(c.env, provider);
    
    // Generate state with special linking flag
    const state = generateOAuthState();
    
    // Store state with user ID for linking
    await c.env.DB.prepare(
      `INSERT INTO oauth_states (state, provider, redirect_uri, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(state, provider, `LINK:${auth.userId}`, Date.now(), Date.now() + 600000).run();

    const authUrl = buildAuthorizationUrl(provider, clientId, redirectUri, state);

    return c.json({ authUrl });
  } catch (error) {
    console.error(`[OAuth] ${provider} link error:`, error);
    return c.json({ 
      error: `OAuth provider ${provider} is not configured` 
    }, 503);
  }
});

/**
 * GET /auth/oauth/accounts - Get user's linked OAuth accounts
 * Requires authentication
 */
oauthRoutes.get('/accounts', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  try {
    const accounts = await getUserOAuthAccounts(c.env.DB, auth.userId);
    return c.json({ accounts });
  } catch (error) {
    console.error('[OAuth] Get accounts error:', error);
    return c.json({ error: 'Failed to fetch OAuth accounts' }, 500);
  }
});

/**
 * DELETE /auth/oauth/:provider/unlink - Unlink OAuth account
 * Requires authentication
 */
oauthRoutes.delete('/:provider/unlink', requireAuth(), async (c) => {
  const provider = c.req.param('provider');
  const auth = getAuthContext(c);

  if (!validateProvider(provider)) {
    return c.json({ error: `Invalid OAuth provider: ${provider}` }, 400);
  }

  try {
    const success = await unlinkOAuthAccount(c.env.DB, auth.userId, provider);
    
    if (!success) {
      return c.json({ error: `No ${provider} account linked` }, 404);
    }

    return c.json({ 
      success: true, 
      message: `${OAUTH_PROVIDERS[provider].name} account unlinked` 
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('only authentication method')) {
      return c.json({ 
        error: 'Cannot unlink the only authentication method',
        hint: 'Add a password or link another OAuth provider first'
      }, 400);
    }
    
    console.error(`[OAuth] ${provider} unlink error:`, error);
    return c.json({ error: 'Failed to unlink account' }, 500);
  }
});

export default oauthRoutes;
