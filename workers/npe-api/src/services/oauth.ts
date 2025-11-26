// OAuth Service - handles OAuth flow logic
import type { Env } from '../../shared/types';
import { 
  OAuthProvider, 
  buildAuthorizationUrl, 
  exchangeCodeForTokens, 
  fetchUserInfo,
  decodeAppleIdToken 
} from '../config/oauth-providers';
import { generateToken } from '../middleware/auth';

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate cryptographically secure state for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store OAuth state in database
 */
export async function storeOAuthState(
  db: D1Database,
  state: string,
  provider: OAuthProvider,
  redirectUri?: string
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + STATE_EXPIRY_MS;

  await db.prepare(
    `INSERT INTO oauth_states (state, provider, redirect_uri, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(state, provider, redirectUri || null, now, expiresAt).run();
}

/**
 * Verify and consume OAuth state (one-time use)
 */
export async function verifyAndConsumeState(
  db: D1Database,
  state: string
): Promise<{ provider: OAuthProvider; redirectUri: string | null } | null> {
  const now = Date.now();

  // Get and delete in one transaction
  const result = await db.prepare(
    `DELETE FROM oauth_states WHERE state = ? AND expires_at > ? RETURNING provider, redirect_uri`
  ).bind(state, now).first<{ provider: OAuthProvider; redirect_uri: string | null }>();

  if (!result) {
    return null;
  }

  return {
    provider: result.provider,
    redirectUri: result.redirect_uri,
  };
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredStates(db: D1Database): Promise<number> {
  const result = await db.prepare(
    `DELETE FROM oauth_states WHERE expires_at < ?`
  ).bind(Date.now()).run();

  return result.meta.changes || 0;
}

/**
 * Find existing OAuth account
 */
export async function findOAuthAccount(
  db: D1Database,
  provider: OAuthProvider,
  providerUserId: string
): Promise<{
  id: string;
  userId: string;
  providerEmail: string | null;
} | null> {
  const result = await db.prepare(
    `SELECT id, user_id, provider_email FROM oauth_accounts 
     WHERE provider = ? AND provider_user_id = ?`
  ).bind(provider, providerUserId).first<{
    id: string;
    user_id: string;
    provider_email: string | null;
  }>();

  if (!result) return null;

  return {
    id: result.id,
    userId: result.user_id,
    providerEmail: result.provider_email,
  };
}

/**
 * Find user by email
 */
export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<{
  id: string;
  email: string;
  role: string;
  authMethod: string;
} | null> {
  const result = await db.prepare(
    `SELECT id, email, role, auth_method FROM users WHERE email = ?`
  ).bind(email).first<{
    id: string;
    email: string;
    role: string;
    auth_method: string;
  }>();

  if (!result) return null;

  return {
    id: result.id,
    email: result.email,
    role: result.role,
    authMethod: result.auth_method,
  };
}

/**
 * Create new user via OAuth
 */
export async function createOAuthUser(
  db: D1Database,
  email: string,
  provider: OAuthProvider,
  providerUserId: string,
  providerUsername: string | null,
  providerAvatarUrl: string | null,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: number | null
): Promise<{ userId: string; oauthAccountId: string }> {
  const userId = crypto.randomUUID();
  const oauthAccountId = crypto.randomUUID();
  const now = Date.now();

  // Create user with OAUTH_ONLY password
  await db.prepare(
    `INSERT INTO users (id, email, password_hash, role, auth_method, created_at, monthly_transformations, monthly_tokens_used, last_reset_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, email, 'OAUTH_ONLY', 'free', 'oauth', now, 0, 0, now).run();

  // Create OAuth account link
  await db.prepare(
    `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, provider_username, provider_avatar_url, access_token, refresh_token, token_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    oauthAccountId, userId, provider, providerUserId, email,
    providerUsername, providerAvatarUrl, accessToken, refreshToken,
    tokenExpiresAt, now, now
  ).run();

  return { userId, oauthAccountId };
}

/**
 * Link OAuth account to existing user
 */
export async function linkOAuthAccount(
  db: D1Database,
  userId: string,
  provider: OAuthProvider,
  providerUserId: string,
  providerEmail: string | null,
  providerUsername: string | null,
  providerAvatarUrl: string | null,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: number | null
): Promise<string> {
  const oauthAccountId = crypto.randomUUID();
  const now = Date.now();

  // Create OAuth account link
  await db.prepare(
    `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, provider_username, provider_avatar_url, access_token, refresh_token, token_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    oauthAccountId, userId, provider, providerUserId, providerEmail,
    providerUsername, providerAvatarUrl, accessToken, refreshToken,
    tokenExpiresAt, now, now
  ).run();

  // Update user auth_method to 'mixed' if they also have a password
  await db.prepare(
    `UPDATE users SET auth_method = 'mixed' 
     WHERE id = ? AND password_hash != 'OAUTH_ONLY' AND auth_method = 'password'`
  ).bind(userId).run();

  return oauthAccountId;
}

/**
 * Update OAuth tokens
 */
export async function updateOAuthTokens(
  db: D1Database,
  oauthAccountId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: number | null
): Promise<void> {
  await db.prepare(
    `UPDATE oauth_accounts 
     SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(accessToken, refreshToken, tokenExpiresAt, Date.now(), oauthAccountId).run();
}

/**
 * Get user's linked OAuth accounts
 */
export async function getUserOAuthAccounts(
  db: D1Database,
  userId: string
): Promise<Array<{
  provider: OAuthProvider;
  providerEmail: string | null;
  providerUsername: string | null;
  linkedAt: number;
}>> {
  const results = await db.prepare(
    `SELECT provider, provider_email, provider_username, created_at 
     FROM oauth_accounts WHERE user_id = ?`
  ).bind(userId).all<{
    provider: OAuthProvider;
    provider_email: string | null;
    provider_username: string | null;
    created_at: number;
  }>();

  return (results.results || []).map(r => ({
    provider: r.provider,
    providerEmail: r.provider_email,
    providerUsername: r.provider_username,
    linkedAt: r.created_at,
  }));
}

/**
 * Unlink OAuth account from user
 */
export async function unlinkOAuthAccount(
  db: D1Database,
  userId: string,
  provider: OAuthProvider
): Promise<boolean> {
  // Check if user has another auth method before unlinking
  const user = await db.prepare(
    `SELECT password_hash, auth_method FROM users WHERE id = ?`
  ).bind(userId).first<{ password_hash: string; auth_method: string }>();

  if (!user) return false;

  // Count remaining OAuth accounts
  const countResult = await db.prepare(
    `SELECT COUNT(*) as count FROM oauth_accounts WHERE user_id = ?`
  ).bind(userId).first<{ count: number }>();

  const oauthCount = countResult?.count || 0;

  // Don't allow unlinking if it's the only auth method
  if (user.password_hash === 'OAUTH_ONLY' && oauthCount <= 1) {
    throw new Error('Cannot unlink the only authentication method');
  }

  // Delete the OAuth account
  const result = await db.prepare(
    `DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?`
  ).bind(userId, provider).run();

  // Update auth_method if no more OAuth accounts
  if (result.meta.changes && oauthCount === 1 && user.password_hash !== 'OAUTH_ONLY') {
    await db.prepare(
      `UPDATE users SET auth_method = 'password' WHERE id = ?`
    ).bind(userId).run();
  }

  return (result.meta.changes || 0) > 0;
}

/**
 * Get provider credentials from environment
 */
export function getProviderCredentials(env: Env, provider: OAuthProvider): {
  clientId: string;
  clientSecret: string;
} {
  const clientIdKey = `${provider.toUpperCase()}_CLIENT_ID` as keyof Env;
  const clientSecretKey = `${provider.toUpperCase()}_CLIENT_SECRET` as keyof Env;

  const clientId = env[clientIdKey] as string | undefined;
  const clientSecret = env[clientSecretKey] as string | undefined;

  if (!clientId || !clientSecret) {
    throw new Error(`OAuth credentials not configured for ${provider}`);
  }

  return { clientId, clientSecret };
}

/**
 * Complete OAuth flow - handles user creation or login
 */
export async function completeOAuthFlow(
  env: Env,
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<{
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
  isNewUser: boolean;
}> {
  const { clientId, clientSecret } = getProviderCredentials(env, provider);

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(
    provider,
    code,
    clientId,
    clientSecret,
    redirectUri
  );

  // Get user info
  let userInfo: { id: string; email: string | null; username: string | null; avatarUrl: string | null };
  
  if (provider === 'apple' && tokens.id_token) {
    const decoded = decodeAppleIdToken(tokens.id_token);
    userInfo = { ...decoded, username: null, avatarUrl: null };
  } else {
    userInfo = await fetchUserInfo(provider, tokens.access_token);
  }

  if (!userInfo.email) {
    throw new Error(`Email not provided by ${provider}. Please ensure email permission is granted.`);
  }

  const tokenExpiresAt = tokens.expires_in 
    ? Date.now() + (tokens.expires_in * 1000) 
    : null;

  // Check for existing OAuth account
  const existingOAuth = await findOAuthAccount(env.DB, provider, userInfo.id);
  
  if (existingOAuth) {
    // Existing OAuth user - update tokens and log in
    await updateOAuthTokens(
      env.DB, 
      existingOAuth.id, 
      tokens.access_token, 
      tokens.refresh_token || null,
      tokenExpiresAt
    );

    // Get user details
    const user = await env.DB.prepare(
      `SELECT id, email, role FROM users WHERE id = ?`
    ).bind(existingOAuth.userId).first<{ id: string; email: string; role: string }>();

    if (!user) {
      throw new Error('User not found');
    }

    const jwtToken = await generateToken(user.id, user.email, user.role, env.JWT_SECRET);

    return {
      token: jwtToken,
      user: { id: user.id, email: user.email, role: user.role },
      isNewUser: false,
    };
  }

  // Check if email is already registered (different auth method)
  const existingUser = await findUserByEmail(env.DB, userInfo.email);

  if (existingUser) {
    // Link OAuth to existing account
    await linkOAuthAccount(
      env.DB,
      existingUser.id,
      provider,
      userInfo.id,
      userInfo.email,
      userInfo.username,
      userInfo.avatarUrl,
      tokens.access_token,
      tokens.refresh_token || null,
      tokenExpiresAt
    );

    const jwtToken = await generateToken(existingUser.id, existingUser.email, existingUser.role, env.JWT_SECRET);

    return {
      token: jwtToken,
      user: { id: existingUser.id, email: existingUser.email, role: existingUser.role },
      isNewUser: false,
    };
  }

  // Create new user
  const { userId } = await createOAuthUser(
    env.DB,
    userInfo.email,
    provider,
    userInfo.id,
    userInfo.username,
    userInfo.avatarUrl,
    tokens.access_token,
    tokens.refresh_token || null,
    tokenExpiresAt
  );

  const jwtToken = await generateToken(userId, userInfo.email, 'free', env.JWT_SECRET);

  return {
    token: jwtToken,
    user: { id: userId, email: userInfo.email, role: 'free' },
    isNewUser: true,
  };
}
