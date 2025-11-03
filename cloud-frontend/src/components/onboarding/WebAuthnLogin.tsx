import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

interface WebAuthnLoginProps {
  onSuccess: (token: string, user: any) => void;
}

export default function WebAuthnLogin({ onSuccess }: WebAuthnLoginProps) {
  const [email, setEmail] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWebAuthnLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsAuthenticating(true);

    try {
      // Get authentication options from server
      const optionsResponse = await fetch('https://api.humanizer.com/webauthn/login-challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.error || 'Failed to start authentication');
      }

      const options = await optionsResponse.json();

      // Start WebAuthn authentication (Touch ID prompt appears here)
      const authenticationResponse = await startAuthentication(options);

      // Verify authentication with server
      const verifyResponse = await fetch('https://api.humanizer.com/webauthn/login-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          response: authenticationResponse
        })
      });

      if (!verifyResponse.ok) {
        throw new Error('Authentication failed');
      }

      const result = await verifyResponse.json();

      // Call success callback with token and user
      onSuccess(result.token, result.user);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Authentication cancelled or not allowed');
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: 'var(--spacing-md)' }}>
        Touch ID Login
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
        Sign in securely using Touch ID, Face ID, or a registered security key.
      </p>

      <form onSubmit={handleWebAuthnLogin}>
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-sm)',
            fontWeight: 500
          }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isAuthenticating}
            placeholder="your@email.com"
            style={{
              width: '100%',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {error && (
          <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isAuthenticating}
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: 'var(--spacing-md)',
            opacity: isAuthenticating ? 0.5 : 1,
            cursor: isAuthenticating ? 'not-allowed' : 'pointer'
          }}
        >
          {isAuthenticating ? (
            <>
              <div className="loading"></div>
              <span>Authenticating...</span>
            </>
          ) : (
            <>🔐 Sign in with Touch ID</>
          )}
        </button>
      </form>
    </div>
  );
}
