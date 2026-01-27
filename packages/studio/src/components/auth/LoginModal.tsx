/**
 * Login Modal Component
 *
 * Modal dialog for user authentication with email/password.
 * Supports both login and registration modes.
 */

import { useState, useCallback, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LoginModalProps {
  onClose?: () => void;
}

type AuthMode = 'login' | 'register';

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
