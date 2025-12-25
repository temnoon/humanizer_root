/**
 * Auth API Service
 *
 * Handles all authenticated API calls to the NPE backend
 */

import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  OAuthProvider,
} from './types';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || 'https://npe-api.tem-527.workers.dev';
const TOKEN_KEY = 'humanizer-auth-token';
const TOKEN_KEY_COMPAT = 'narrative-studio-auth-token'; // Cross-app compatibility

// ═══════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

export function getStoredToken(): string | null {
  // Check both keys for cross-app compatibility
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY_COMPAT);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY_COMPAT, token); // Keep in sync
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY_COMPAT);
}

// ═══════════════════════════════════════════════════════════════════
// HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  requireAuth?: boolean;
  timeout?: number;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, requireAuth = false, timeout = 30000 } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth header if we have a token
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requireAuth) {
    throw new Error('Authentication required');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.statusText}`);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Register a new user
 */
export async function register(email: string, password: string): Promise<AuthResponse> {
  const request: RegisterRequest = { email, password };
  const response = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: request,
  });

  setStoredToken(response.token);
  return response;
}

/**
 * Login with email/password
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const request: LoginRequest = { email, password };
  const response = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: request,
  });

  setStoredToken(response.token);
  return response;
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/auth/me', { requireAuth: true });
}

/**
 * Logout (client-side only)
 */
export function logout(): void {
  clearStoredToken();
}

// ═══════════════════════════════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════════════════════════════

/**
 * Get OAuth login URL for a provider
 */
export function getOAuthLoginUrl(provider: OAuthProvider): string {
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
  return `${API_BASE}/auth/oauth/${provider}/login?redirect_uri=${redirectUri}`;
}

/**
 * Handle OAuth callback - extract token from URL
 */
export function handleOAuthCallback(): { token: string; isNewUser: boolean } | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const isNewUser = params.get('new_user') === 'true';

  if (token) {
    setStoredToken(token);
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
    return { token, isNewUser };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATED API WRAPPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Make an authenticated API call
 * This is the main function to use for all protected endpoints
 */
export async function authenticatedFetch<T>(
  endpoint: string,
  options: Omit<FetchOptions, 'requireAuth'> = {}
): Promise<T> {
  return apiFetch<T>(endpoint, { ...options, requireAuth: true });
}

/**
 * Make an API call with optional auth (uses token if available)
 */
export async function optionalAuthFetch<T>(
  endpoint: string,
  options: Omit<FetchOptions, 'requireAuth'> = {}
): Promise<T> {
  return apiFetch<T>(endpoint, { ...options, requireAuth: false });
}

// ═══════════════════════════════════════════════════════════════════
// STRIPE BILLING
// ═══════════════════════════════════════════════════════════════════

export interface SubscriptionInfo {
  tier: string;
  status: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(tier: 'member' | 'pro' | 'premium'): Promise<{ url: string }> {
  return authenticatedFetch('/stripe/create-checkout', {
    method: 'POST',
    body: {
      tier,
      successUrl: `${window.location.origin}/settings?success=true`,
      cancelUrl: `${window.location.origin}/settings?canceled=true`,
    },
  });
}

/**
 * Get current subscription status
 */
export async function getSubscription(): Promise<SubscriptionInfo | null> {
  try {
    return await authenticatedFetch('/stripe/subscription');
  } catch {
    return null;
  }
}

/**
 * Create portal session to manage subscription
 */
export async function createPortalSession(): Promise<{ url: string }> {
  return authenticatedFetch('/stripe/portal', {
    method: 'POST',
    body: {
      returnUrl: `${window.location.origin}/settings`,
    },
  });
}

/**
 * Purchase a day pass
 */
export async function purchaseDayPass(): Promise<{ url: string }> {
  return authenticatedFetch('/stripe/day-pass', {
    method: 'POST',
    body: {
      successUrl: `${window.location.origin}/?daypass=true`,
      cancelUrl: `${window.location.origin}/`,
    },
  });
}
