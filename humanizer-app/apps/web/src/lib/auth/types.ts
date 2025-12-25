/**
 * Auth Types
 *
 * User roles, tiers, quotas, and authentication types
 */

// ═══════════════════════════════════════════════════════════════════
// USER ROLES & TIERS
// ═══════════════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'premium' | 'pro' | 'member' | 'free';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: number;
  last_login?: number;
  monthly_transformations: number;
  monthly_tokens_used: number;
  last_reset_date?: number;
  auth_method?: 'password' | 'oauth' | 'mixed';
}

// ═══════════════════════════════════════════════════════════════════
// TIER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export const TIER_QUOTAS: Record<UserRole, { transformations: number; tokens: number }> = {
  free: { transformations: 10, tokens: 5000 },
  member: { transformations: 50, tokens: 100000 },
  pro: { transformations: 200, tokens: 1600000 },
  premium: { transformations: Infinity, tokens: Infinity },
  admin: { transformations: Infinity, tokens: Infinity },
};

export const TIER_FEATURES: Record<UserRole, {
  gptzero: boolean;
  personalizer: boolean;
  modelTier: '8B' | '70B';
  quantumAnalysis: boolean;
  sicAnalysis: boolean;
}> = {
  free: { gptzero: false, personalizer: false, modelTier: '8B', quantumAnalysis: false, sicAnalysis: false },
  member: { gptzero: false, personalizer: false, modelTier: '8B', quantumAnalysis: true, sicAnalysis: false },
  pro: { gptzero: true, personalizer: true, modelTier: '70B', quantumAnalysis: true, sicAnalysis: true },
  premium: { gptzero: true, personalizer: true, modelTier: '70B', quantumAnalysis: true, sicAnalysis: true },
  admin: { gptzero: true, personalizer: true, modelTier: '70B', quantumAnalysis: true, sicAnalysis: true },
};

export const TIER_LABELS: Record<UserRole, string> = {
  free: 'Free',
  member: 'Member',
  pro: 'Pro',
  premium: 'Premium',
  admin: 'Admin',
};

export const TIER_PRICES: Record<Exclude<UserRole, 'free' | 'admin'>, { monthly: number; yearly: number }> = {
  member: { monthly: 9, yearly: 90 },
  pro: { monthly: 29, yearly: 290 },
  premium: { monthly: 99, yearly: 990 },
};

// ═══════════════════════════════════════════════════════════════════
// AUTH REQUESTS & RESPONSES
// ═══════════════════════════════════════════════════════════════════

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthError {
  error: string;
  code?: string;
}

// ═══════════════════════════════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════════════════════════════

export type OAuthProvider = 'google' | 'github' | 'discord';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getUserTier(role?: UserRole): UserRole {
  return role || 'free';
}

export function canUseFeature(role: UserRole, feature: keyof typeof TIER_FEATURES.free): boolean {
  return TIER_FEATURES[role][feature] as boolean;
}

export function getRemainingQuota(user: User): { transformations: number; tokens: number } {
  const quota = TIER_QUOTAS[user.role];
  return {
    transformations: Math.max(0, quota.transformations - user.monthly_transformations),
    tokens: Math.max(0, quota.tokens - user.monthly_tokens_used),
  };
}

export function isOverQuota(user: User): boolean {
  const remaining = getRemainingQuota(user);
  return remaining.transformations <= 0 || remaining.tokens <= 0;
}
