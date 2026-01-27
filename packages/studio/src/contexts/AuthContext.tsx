/**
 * Authentication Context
 *
 * Manages authentication state for the studio application.
 * Communicates with auth-api for login/register/logout.
 *
 * @module @humanizer/studio/contexts/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type UserRole = 'free' | 'member' | 'pro' | 'premium' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  getToken: () => string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = 'humanizer-auth-token';
const USER_KEY = 'humanizer-auth-user';

// Auth API URL - defaults to auth-api.tem-527.workers.dev
// Can be overridden via environment variable
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL ?? 'https://auth-api.tem-527.workers.dev';

// Tenant ID for this application
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? 'humanizer';

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STORAGE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const saveAuth = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const loadAuth = useCallback((): { token: string | null; user: User | null } => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    const user = userJson ? JSON.parse(userJson) : null;
    return { token, user };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // API CALLS
  // ─────────────────────────────────────────────────────────────────────────

  const callAuthApi = useCallback(async <T extends object>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: T,
    token?: string
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${AUTH_API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATE TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  const validateToken = useCallback(async (token: string): Promise<User | null> => {
    try {
      const response = await callAuthApi('/auth/me', 'GET', undefined, token);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId,
      };
    } catch {
      return null;
    }
  }, [callAuthApi]);

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE ON MOUNT
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { token, user } = loadAuth();

      if (!token) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Validate token is still valid
      const validatedUser = await validateToken(token);

      if (validatedUser) {
        setState({
          user: validatedUser,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        // Update stored user in case it changed
        saveAuth(token, validatedUser);
      } else {
        // Token expired or invalid
        clearAuth();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    }

    init();
  }, [loadAuth, validateToken, saveAuth, clearAuth]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await callAuthApi('/auth/login', 'POST', credentials);

      if (!response.ok) {
        const error = await response.json();
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message ?? error.error ?? 'Login failed',
        }));
        return false;
      }

      const data = await response.json();
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        tenantId: data.user.tenantId,
      };

      saveAuth(data.token, user);
      setState({
        user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Network error',
      }));
      return false;
    }
  }, [callAuthApi, saveAuth]);

  const register = useCallback(async (credentials: RegisterCredentials): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await callAuthApi('/auth/register', 'POST', credentials);

      if (!response.ok) {
        const error = await response.json();
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message ?? error.error ?? 'Registration failed',
        }));
        return false;
      }

      const data = await response.json();
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        tenantId: data.user.tenantId,
      };

      saveAuth(data.token, user);
      setState({
        user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Network error',
      }));
      return false;
    }
  }, [callAuthApi, saveAuth]);

  const logout = useCallback(() => {
    clearAuth();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, [clearAuth]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const getToken = useCallback((): string | null => {
    return state.token;
  }, [state.token]);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    login,
    register,
    logout,
    clearError,
    getToken,
  }), [state, login, register, logout, clearError, getToken]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to check if user has at least the specified tier.
 */
export function useRequiresTier(minTier: UserRole): boolean {
  const { user } = useAuth();

  const tierOrder: Record<UserRole, number> = {
    free: 0,
    member: 1,
    pro: 2,
    premium: 3,
    admin: 4,
  };

  if (!user) return false;
  return tierOrder[user.role] >= tierOrder[minTier];
}

/**
 * Hook to check if user is admin.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'admin';
}
