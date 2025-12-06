/**
 * Authentication Store
 */

import { createSignal } from 'solid-js';
import { STORAGE_KEYS, AUTH_API_URL } from '@/config/constants';
import type { User } from '@/types/api';

const [user, setUser] = createSignal<User | null>(null);
const [token, setToken] = createSignal<string | null>(null);
const [isLoading, setIsLoading] = createSignal(false);

// Initialize from localStorage
const storedToken = localStorage.getItem(STORAGE_KEYS.token);
const storedUser = localStorage.getItem(STORAGE_KEYS.user);

if (storedToken && storedUser) {
  setToken(storedToken);
  setUser(JSON.parse(storedUser));
}

export const authStore = {
  // Getters
  user,
  token,
  isLoading,
  isAuthenticated: () => !!token(),

  // Login
  async login(email: string, password: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`${AUTH_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      setToken(data.token);
      setUser(data.user);
      
      localStorage.setItem(STORAGE_KEYS.token, data.token);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  },

  // Logout
  logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  },

  // GitHub OAuth
  getGitHubLoginUrl() {
    const callbackUrl = `${window.location.origin}/callback`;
    return `${AUTH_API_URL}/auth/oauth/github/login?redirect=${encodeURIComponent(callbackUrl)}`;
  },

  // Google OAuth
  getGoogleLoginUrl() {
    const callbackUrl = `${window.location.origin}/callback`;
    return `${AUTH_API_URL}/auth/oauth/google/login?redirect=${encodeURIComponent(callbackUrl)}`;
  },

  // Discord OAuth
  getDiscordLoginUrl() {
    const callbackUrl = `${window.location.origin}/callback`;
    return `${AUTH_API_URL}/auth/oauth/discord/login?redirect=${encodeURIComponent(callbackUrl)}`;
  },

  // Handle OAuth callback
  handleCallback(token: string, isNewUser: string) {
    setToken(token);
    
    // Decode JWT to get user info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData: User = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        created_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
      };
      setUser(userData);
      localStorage.setItem(STORAGE_KEYS.token, token);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
    } catch (e) {
      console.error('Failed to decode token:', e);
    }
  },
};
