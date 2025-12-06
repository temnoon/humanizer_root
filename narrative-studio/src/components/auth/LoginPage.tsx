import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

export function LoginPage() {
  const { login, error, clearError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemoHint, setShowDemoHint] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Handle OAuth callback - check URL for token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // Store the token in both keys for cross-app compatibility
      localStorage.setItem('narrative-studio-auth-token', token);
      localStorage.setItem('post-social:token', token);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload to trigger auth check
      window.location.reload();
    }
  }, []);

  const handleGitHubLogin = () => {
    setOauthLoading(true);
    // Redirect to OAuth with callback to current URL
    const currentUrl = window.location.origin + window.location.pathname;
    window.location.href = `${API_BASE_URL}/auth/oauth/github/login?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const handleGoogleLogin = () => {
    setOauthLoading(true);
    const currentUrl = window.location.origin + window.location.pathname;
    window.location.href = `${API_BASE_URL}/auth/oauth/google/login?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const handleDiscordLogin = () => {
    setOauthLoading(true);
    const currentUrl = window.location.origin + window.location.pathname;
    window.location.href = `${API_BASE_URL}/auth/oauth/discord/login?redirect=${encodeURIComponent(currentUrl)}`;
  };

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
    setEmail('test-pro@humanizer.com');
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
            disabled={isLoading || oauthLoading}
            className="ui-text w-full py-3 px-4 rounded-md font-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundImage: 'var(--accent-primary-gradient)',
              backgroundColor: 'transparent',
              color: 'var(--text-inverse)',
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* OAuth Divider */}
        <div className="mt-6 flex items-center">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          <span
            className="ui-text px-4 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            or
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading || oauthLoading}
          className="ui-text w-full mt-4 py-3 px-4 rounded-md font-medium transition-smooth flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !oauthLoading) {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {oauthLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        {/* GitHub OAuth Button */}
        <button
          type="button"
          onClick={handleGitHubLogin}
          disabled={isLoading || oauthLoading}
          className="ui-text w-full mt-2 py-3 px-4 rounded-md font-medium transition-smooth flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !oauthLoading) {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          {oauthLoading ? 'Redirecting...' : 'Continue with GitHub'}
        </button>

        {/* Discord OAuth Button */}
        <button
          type="button"
          onClick={handleDiscordLogin}
          disabled={isLoading || oauthLoading}
          className="ui-text w-full mt-2 py-3 px-4 rounded-md font-medium transition-smooth flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !oauthLoading) {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#5865F2">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          {oauthLoading ? 'Redirecting...' : 'Continue with Discord'}
        </button>

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
            test-pro@humanizer.com • PRO tier access
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
