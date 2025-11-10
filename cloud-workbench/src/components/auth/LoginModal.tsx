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
      <div className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-100">Login Required</h2>
          {canDismiss && (
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Info */}
        <p className="mb-6 text-sm text-slate-300">
          Remote API access requires authentication. Enter your credentials to continue.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full rounded bg-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded bg-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded bg-red-900/30 border border-red-700 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            {canDismiss && (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Demo Credentials (for testing) */}
        <div className="mt-6 rounded bg-slate-700/50 p-3 text-xs text-slate-400">
          <p className="font-medium mb-1">Demo Account:</p>
          <p>Email: demo@humanizer.com</p>
          <p>Password: testpass123</p>
        </div>
      </div>
    </div>
  );
}
