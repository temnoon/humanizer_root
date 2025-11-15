import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const { login, error, clearError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemoHint, setShowDemoHint] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(email, password);
    } catch (err) {
      // Error is already set in context
      console.error('Login failed:', err);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo@humanizer.com');
    setPassword('testpass123');
    setShowDemoHint(true);
    setTimeout(() => setShowDemoHint(false), 3000);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md p-8 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--text-primary)',
            }}
          >
            Narrative Studio
          </h1>
          <p
            className="ui-text text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            A thoughtful workspace for transforming narratives
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mb-6 p-4 rounded-md"
            style={{
              backgroundColor: 'var(--error)',
              color: 'white',
            }}
          >
            <p className="ui-text text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Demo Hint */}
        {showDemoHint && (
          <div
            className="mb-6 p-4 rounded-md"
            style={{
              backgroundColor: 'var(--accent-secondary)',
              color: 'white',
            }}
          >
            <p className="ui-text text-sm font-medium">
              Demo credentials filled! Click "Sign In" to continue.
            </p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="ui-text block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="ui-text w-full px-4 py-3 rounded-md transition-smooth focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
              }}
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="ui-text block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="ui-text w-full px-4 py-3 rounded-md transition-smooth focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="ui-text w-full py-3 px-4 rounded-md font-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Account Button */}
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={fillDemoCredentials}
            disabled={isLoading}
            className="ui-text w-full py-2 px-4 rounded-md text-sm transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            Use Demo Account
          </button>
          <p
            className="ui-text text-xs text-center mt-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            demo@humanizer.com • PRO tier access
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p
            className="ui-text text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Powered by Humanizer API
          </p>
        </div>
      </div>
    </div>
  );
}
