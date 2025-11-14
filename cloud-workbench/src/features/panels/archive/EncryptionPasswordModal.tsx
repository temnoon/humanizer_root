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
    <div className="absolute inset-0 bg-slate-950 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-slate-900 rounded-lg max-w-2xl w-full p-6 border border-slate-700 shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">🔒</span>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Unlock Secure Archive
            </h2>
            <p className="text-sm text-slate-400">
              Enter your archive password to access encrypted files
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
          <h3 className="text-slate-300 font-semibold mb-2">🔐 Zero-Knowledge Encryption</h3>
          <ul className="space-y-1.5 text-sm text-slate-400">
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
            <label htmlFor="archive-password" className="block text-sm font-medium text-slate-300 mb-1">
              Archive Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              id="archive-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your archive password"
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              minLength={8}
              required
              disabled={isInitializing}
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">
              Use the same password to access your previous files
            </p>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-md p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isInitializing || password.length < 8}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
            >
              {isInitializing ? 'Unlocking...' : 'Unlock Archive'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isInitializing}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-300 rounded-md transition-colors"
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
