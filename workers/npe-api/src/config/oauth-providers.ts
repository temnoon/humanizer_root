// OAuth Provider Configurations
// Each provider has specific endpoints and scopes

export type OAuthProvider = 'google' | 'github' | 'discord' | 'facebook' | 'apple';

export interface OAuthProviderConfig {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  // How to extract user info from provider response
  extractUserInfo: (data: any) => {
    id: string;
    email: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
}

export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    name: 'Google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    extractUserInfo: (data) => ({
      id: data.id,
      email: data.email || null,
      username: data.name || null,
      avatarUrl: data.picture || null,
    }),
  },

  github: {
    name: 'GitHub',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'read:user'],
    extractUserInfo: (data) => ({
      id: String(data.id),
      email: data.email || null,
      username: data.login || null,
      avatarUrl: data.avatar_url || null,
    }),
  },

  discord: {
    name: 'Discord',
    authorizationUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
    extractUserInfo: (data) => ({
      id: data.id,
      email: data.email || null,
      username: data.username || null,
      avatarUrl: data.avatar 
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : null,
    }),
  },

  facebook: {
    name: 'Facebook',
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    scopes: ['email', 'public_profile'],
    extractUserInfo: (data) => ({
      id: data.id,
      email: data.email || null,
      username: data.name || null,
      avatarUrl: data.picture?.data?.url || null,
    }),
  },

  apple: {
    name: 'Apple',
    authorizationUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: '', // Apple returns user info in the ID token
    scopes: ['name', 'email'],
    extractUserInfo: (data) => ({
      // Apple user info comes from ID token, handled specially
      id: data.sub,
      email: data.email || null,
      username: data.name ? `${data.name.firstName} ${data.name.lastName}`.trim() : null,
      avatarUrl: null, // Apple doesn't provide avatar
    }),
  },
};

/**
 * Build OAuth authorization URL
 */
export function buildAuthorizationUrl(
  provider: OAuthProvider,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const config = OAUTH_PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
    scope: config.scopes.join(' '),
  });

  // Provider-specific parameters
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  
  if (provider === 'discord') {
    params.set('prompt', 'consent');
  }

  if (provider === 'apple') {
    params.set('response_mode', 'form_post');
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}> {
  const config = OAUTH_PROVIDERS[provider];
  
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // GitHub requires Accept header for JSON response
  if (provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Fetch user info from provider
 */
export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<{
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
}> {
  const config = OAUTH_PROVIDERS[provider];

  // Apple doesn't have a userinfo endpoint - info comes from ID token
  if (provider === 'apple') {
    throw new Error('Apple user info must be extracted from ID token');
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'User-Agent': 'Humanizer-OAuth/1.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch user info: ${error}`);
  }

  const data = await response.json();
  
  // GitHub may not include email in main response - need separate call
  if (provider === 'github' && !data.email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Humanizer-OAuth/1.0',
      },
    });
    
    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      const primaryEmail = emails.find((e: any) => e.primary)?.email;
      data.email = primaryEmail || emails[0]?.email || null;
    }
  }

  return config.extractUserInfo(data);
}

/**
 * Decode Apple ID token to extract user info
 */
export function decodeAppleIdToken(idToken: string): {
  id: string;
  email: string | null;
} {
  // Apple ID token is a JWT - decode the payload (we verify signature separately)
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid ID token format');
  }

  const payload = JSON.parse(atob(parts[1]));
  
  return {
    id: payload.sub,
    email: payload.email || null,
  };
}
