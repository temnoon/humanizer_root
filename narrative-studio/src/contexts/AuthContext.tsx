import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../utils/api';

export interface User {
  id: string;
  email: string;
  role: 'free' | 'member' | 'pro' | 'premium' | 'admin';
  created_at: number;
  last_login?: number;
  monthly_transformations: number;
  monthly_tokens_used: number;
  last_reset_date?: number;
}

// Quota limits per tier
export const TIER_QUOTAS = {
  free: { transformations: 10, tokens: 5000 },
  member: { transformations: 50, tokens: 100000 },
  pro: { transformations: 200, tokens: 1600000 },
  premium: { transformations: Infinity, tokens: Infinity },
  admin: { transformations: Infinity, tokens: Infinity },
} as const;

// Features available per tier
export const TIER_FEATURES = {
  free: { gptzero: false, personalizer: false, modelTier: '8B' },
  member: { gptzero: false, personalizer: false, modelTier: '8B' },
  pro: { gptzero: true, personalizer: true, modelTier: '70B' },
  premium: { gptzero: true, personalizer: true, modelTier: '70B' },
  admin: { gptzero: true, personalizer: true, modelTier: '70B' },
} as const;

interface QuotaInfo {
  transformationsUsed: number;
  transformationsLimit: number;
  transformationsRemaining: number;
  tokensUsed: number;
  tokensLimit: number;
  isUnlimited: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  // Tier helpers
  getQuota: () => QuotaInfo | null;
  canUseFeature: (feature: 'gptzero' | 'personalizer') => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      if (api.isAuthenticated()) {
        const userData = await api.me();
        setUser(userData);
      }
    } catch (err) {
      // Token might be expired or invalid
      await api.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      await api.login(email, password);
      const userData = await api.me();
      setUser(userData);
    } catch (err: any) {
      const errorMessage = err.details?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await api.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Get quota info for current user
  const getQuota = (): QuotaInfo | null => {
    if (!user) return null;
    const quota = TIER_QUOTAS[user.role] || TIER_QUOTAS.free;
    const isUnlimited = quota.transformations === Infinity;
    return {
      transformationsUsed: user.monthly_transformations,
      transformationsLimit: quota.transformations,
      transformationsRemaining: isUnlimited ? Infinity : Math.max(0, quota.transformations - user.monthly_transformations),
      tokensUsed: user.monthly_tokens_used,
      tokensLimit: quota.tokens,
      isUnlimited,
    };
  };

  // Check if user can use a specific feature
  const canUseFeature = (feature: 'gptzero' | 'personalizer'): boolean => {
    if (!user) return false;
    const features = TIER_FEATURES[user.role] || TIER_FEATURES.free;
    return features[feature];
  };

  // Refresh user data (e.g., after transformation to update quota)
  const refreshUser = async () => {
    if (api.isAuthenticated()) {
      try {
        const userData = await api.me();
        setUser(userData);
      } catch (err) {
        console.error('Failed to refresh user:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        error,
        clearError,
        getQuota,
        canUseFeature,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
