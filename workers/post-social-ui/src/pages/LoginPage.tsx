/**
 * Login Page
 */

import { Component, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { Button } from '@/components/ui/Button';

export const LoginPage: Component = () => {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setError('');

    try {
      await authStore.login(email(), password());
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleGitHub = () => {
    window.location.href = authStore.getGitHubLoginUrl();
  };

  return (
    <div class="container" style={{ 'max-width': '500px', 'padding-top': '4rem' }}>
      <div style={{ 'text-align': 'center', 'margin-bottom': '2rem' }}>
        <h1 style={{ 'margin-bottom': 'var(--space-sm)' }}>
          post<span style={{ color: 'var(--color-primary)' }}>-social</span>
        </h1>
        <p class="text-secondary">Sign in to continue</p>
      </div>

      <div class="card">
        <button
          onClick={handleGitHub}
          class="btn btn-secondary"
          style={{ width: '100%', 'margin-bottom': 'var(--space-lg)' }}
        >
          Continue with GitHub
        </button>

        <div style={{
          display: 'flex',
          'align-items': 'center',
          'margin': 'var(--space-lg) 0',
          color: 'var(--color-text-secondary)',
          'font-size': 'var(--text-sm)',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          <span style={{ padding: '0 var(--space-md)' }}>or sign in with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
        </div>

        <form onSubmit={handleLogin}>
          {error() && (
            <div style={{
              color: 'var(--color-error)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-error)',
              padding: 'var(--space-md)',
              'border-radius': 'var(--radius-md)',
              'margin-bottom': 'var(--space-md)',
              'font-size': 'var(--text-sm)',
            }}>
              {error()}
            </div>
          )}

          <div style={{ 'margin-bottom': 'var(--space-md)' }}>
            <label style={{ display: 'block', 'margin-bottom': 'var(--space-sm)', 'font-size': 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              class="input"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div style={{ 'margin-bottom': 'var(--space-lg)' }}>
            <label style={{ display: 'block', 'margin-bottom': 'var(--space-sm)', 'font-size': 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              class="input"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              placeholder="Your password"
            />
          </div>

          <Button type="submit" variant="primary" style={{ width: '100%' }} loading={authStore.isLoading()}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};
