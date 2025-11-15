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
    <dialog className="modal" open={isOpen}>
      <div className="modal-box">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-2xl">Login Required</h3>
          {canDismiss && (
            <button
              onClick={handleClose}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          )}
        </div>

        {/* Info */}
        <p className="text-sm opacity-70 mb-6">
          Remote API access requires authentication. Enter your credentials to continue.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="input input-bordered w-full"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="input input-bordered w-full"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="modal-action">
            {canDismiss && (
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>

        {/* Demo Credentials (for testing) */}
        <div className="mt-6 bg-base-200 rounded p-3 text-xs opacity-70">
          <p className="font-medium mb-1">Demo Account:</p>
          <p>Email: demo@humanizer.com</p>
          <p>Password: testpass123</p>
        </div>
      </div>

      {/* Backdrop */}
      {canDismiss && (
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleClose}>close</button>
        </form>
      )}
    </dialog>
  );
}
