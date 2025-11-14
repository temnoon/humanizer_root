import { useState } from 'react';
import { keyManager } from '../../../lib/encryption';

interface EncryptionPasswordModalProps {
  salt: string;
  onUnlock: () => void;
  onCancel?: () => void;
}

/**
 * EncryptionPasswordModal - First-time encryption password setup
 *
 * Critical security warnings:
 * - Password is ONLY way to decrypt files
 * - Management has NO access to password or decrypted content
 * - Lost password = lost data (unrecoverable)
 */
export function EncryptionPasswordModal({
  salt,
  onUnlock,
  onCancel
}: EncryptionPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setIsInitializing(true);

      // Initialize encryption key in browser memory
      await keyManager.initialize(password, salt);

      // Success - key is now in memory
      onUnlock();
    } catch (err: any) {
      console.error('Failed to initialize encryption:', err);
      setError('Failed to unlock archive. Check your password and try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="modal-overlay absolute inset-0 flex items-start justify-center overflow-y-auto p-4">
      <div className="modal max-w-2xl w-full p-6 shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">🔒</span>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Unlock Secure Archive
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Enter your archive password to access encrypted files
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="card rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>🔐 Zero-Knowledge Encryption</h3>
          <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li>• Encryption happens in your browser (client-side)</li>
            <li>• Your password never leaves your device</li>
            <li>• We cannot decrypt your files or recover lost passwords</li>
            <li>• Use your password manager to store this password</li>
          </ul>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          {/* Hidden username field to trigger password manager save/autofill */}
          <input
            type="text"
            name="username"
            value="humanizer-archive"
            autoComplete="username"
            readOnly
            tabIndex={-1}
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
            aria-hidden="true"
          />

          <div>
            <label htmlFor="archive-password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Archive Password <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <input
              type="password"
              id="archive-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your archive password"
              autoComplete="current-password"
              className="input w-full px-3 py-2 rounded-md"
              minLength={8}
              required
              disabled={isInitializing}
              autoFocus
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Use the same password to access your previous files
            </p>
          </div>

          {error && (
            <div
              className="rounded-md p-3 text-sm"
              style={{
                background: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isInitializing || password.length < 8}
              className="btn-primary flex-1 px-4 py-2.5 font-medium rounded-md"
            >
              {isInitializing ? 'Unlocking...' : 'Unlock Archive'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isInitializing}
                className="btn-secondary px-4 py-2.5 rounded-md"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
