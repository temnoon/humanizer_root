import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ApiConfig } from '../adapters/api';

/**
 * AuthContext - Authentication state management
 *
 * Purpose: Conditional authentication (required for remote, optional for local)
 *
 * Features:
 * - Token persistence (localStorage)
 * - User profile management
 * - Login/logout flows
 * - Automatic token injection for remote API
 */

export interface User {
  id: string;
  email: string;
  role: 'FREE' | 'MEMBER' | 'PRO' | 'PREMIUM' | 'ADMIN';
  tier: 'FREE' | 'MEMBER' | 'PRO' | 'PREMIUM' | 'ADMIN';
}

interface AuthContextType {
  // State
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;

  // Helpers
  requiresAuth: () => boolean; // True if remote backend is selected
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      setIsLoading(true);
      // Fetch user profile if we have a token
      fetchUserProfile(savedToken);
    }
  }, []);

  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await fetch(`${ApiConfig.baseUrlRemote}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      // Invalid token, clear it
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${ApiConfig.baseUrlRemote}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();

      // Save token and user
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.token);

      console.log('Login successful:', data.user.email);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem('auth_token');
    console.log('Logged out');
  };

  const clearError = () => {
    setError(null);
  };

  const requiresAuth = (): boolean => {
    return ApiConfig.processingTarget === 'remote';
  };

  const value: AuthContextType = {
    isAuthenticated: !!token && !!user,
    token,
    user,
    isLoading,
    error,
    login,
    logout,
    clearError,
    requiresAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access Auth context
 * @throws {Error} if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
