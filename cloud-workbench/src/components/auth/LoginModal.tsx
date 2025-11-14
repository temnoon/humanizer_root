import { useState } from 'react';
import { useAuth } from '../../core/context/AuthContext';

/**
 * LoginModal - Authentication modal for remote API access
 *
 * Features:
 * - Email/password login
 * - Error display
 * - Loading states
 * - Can be dismissed (optional auth for local mode)
 */

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  canDismiss?: boolean; // Allow closing without login (for local mode)
}

export function LoginModal({ isOpen, onClose, canDismiss = false }: LoginModalProps) {
  const { login, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(email, password);
      // Success - close modal
      onClose();
      setEmail('');
      setPassword('');
    } catch (err) {
      // Error is handled by AuthContext
      console.error('Login error:', err);
    }
  };

  const handleClose = () => {
    if (canDismiss) {
      clearError();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-full max-w-md rounded-lg p-6 shadow-2xl"
        style={{
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Login Required
          </h2>
          {canDismiss && (
            <button
              onClick={handleClose}
              className="transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Info */}
        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Remote API access requires authentication. Enter your credentials to continue.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full rounded px-3 py-2 focus:outline-none focus:ring-2"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded px-3 py-2 focus:outline-none focus:ring-2"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded px-3 py-2 text-sm" style={{ background: 'rgba(220, 38, 38, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded px-4 py-2 font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: 'var(--accent-purple)' }}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            {canDismiss && (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Demo Credentials (for testing) */}
        <div className="mt-6 rounded p-3 text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
          <p className="font-medium mb-1">Demo Account:</p>
          <p>Email: demo@humanizer.com</p>
          <p>Password: testpass123</p>
        </div>
      </div>
    </div>
  );
}
