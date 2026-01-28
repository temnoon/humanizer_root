/**
 * Login Modal Component
 *
 * Modal dialog for user authentication with email/password and OAuth.
 * Supports both login and registration modes.
 */

import { useState, useCallback, useEffect, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LoginModalProps {
  onClose?: () => void;
}

type AuthMode = 'login' | 'register';

// OAuth provider display info
const OAUTH_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔵',
    color: '#4285F4',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '⚫',
    color: '#333',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '💜',
    color: '#5865F2',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function LoginModal({ onClose }: LoginModalProps) {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Toggle between login and register modes
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setLocalError(null);
    clearError();
    setConfirmPassword('');
  }, [clearError]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLocalError(null);

      // Validation
      if (!email || !password) {
        setLocalError('Email and password are required');
        return;
      }

      if (mode === 'register') {
        if (password.length < 8) {
          setLocalError('Password must be at least 8 characters');
          return;
        }
        if (password !== confirmPassword) {
          setLocalError('Passwords do not match');
          return;
        }
      }

      // Submit
      const success =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password });

      if (success && onClose) {
        onClose();
      }
    },
    [email, password, confirmPassword, mode, login, register, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  const displayError = localError || error;

  return (
    <div className="auth-modal__overlay" onClick={handleBackdropClick}>
      <div className="auth-modal" role="dialog" aria-labelledby="auth-modal-title">
        <div className="auth-modal__header">
          <div className="auth-modal__logo">humanizer</div>
          <div className="auth-modal__title" id="auth-modal-title">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {displayError && (
            <div className="auth-form__error" role="alert">
              {displayError}
            </div>
          )}

          <div className="auth-form__group">
            <label htmlFor="auth-email" className="auth-form__label">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              className={`auth-form__input ${displayError ? 'auth-form__input--error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="auth-form__group">
            <label htmlFor="auth-password" className="auth-form__label">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className={`auth-form__input ${displayError ? 'auth-form__input--error' : ''}`}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-form__group">
              <label htmlFor="auth-confirm-password" className="auth-form__label">
                Confirm Password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                className={`auth-form__input ${displayError ? 'auth-form__input--error' : ''}`}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <div className="auth-form__actions">
            <button
              type="submit"
              className="btn btn--primary auth-form__submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="auth-loading">
                  <span className="auth-loading__spinner" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </div>
        </form>

        {/* OAuth Divider */}
        <div className="auth-divider">
          <span className="auth-divider__line" />
          <span className="auth-divider__text">or continue with</span>
          <span className="auth-divider__line" />
        </div>

        {/* OAuth Buttons */}
        <div className="auth-oauth">
          {OAUTH_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className="btn auth-oauth__btn"
              onClick={() => {
                const authApiUrl = import.meta.env.VITE_AUTH_API_URL ?? 'https://auth-api.tem-527.workers.dev';
                const tenantId = import.meta.env.VITE_TENANT_ID ?? 'humanizer';
                const redirectUrl = encodeURIComponent(window.location.origin);
                window.location.href = `${authApiUrl}/auth/oauth/${provider.id}/login?tenant=${tenantId}&redirect=${redirectUrl}`;
              }}
              disabled={isLoading}
            >
              <span className="auth-oauth__icon">{provider.icon}</span>
              <span className="auth-oauth__name">{provider.name}</span>
            </button>
          ))}
        </div>

        <div className="auth-modal__toggle">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button type="button" className="auth-modal__toggle-btn" onClick={toggleMode}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="auth-modal__toggle-btn" onClick={toggleMode}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
