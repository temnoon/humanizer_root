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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
      setError('Failed to initialize encryption. Please try again.');
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
              Secure Archive Encryption
            </h2>
            <p className="text-sm text-slate-400">
              Set up client-side encryption for your files
            </p>
          </div>
        </div>

        {/* Critical Warnings */}
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6">
          <h3 className="text-red-400 font-bold text-lg mb-3 flex items-center gap-2">
            ⚠️ CRITICAL: Read Before Continuing
          </h3>
          <ul className="space-y-2 text-red-200 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>
                <strong>This password is the ONLY way to decrypt your files.</strong>
                {' '}If you forget it, your data is permanently lost.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>
                <strong>Management has NO access to your password or decrypted files.</strong>
                {' '}We store only encrypted data—we cannot help you recover lost passwords.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>
                <strong>Use a password manager!</strong> Store this password securely in 1Password, Bitwarden, or similar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>
                <strong>This is separate from your login password.</strong> Use a unique, strong password (12+ characters).
              </span>
            </li>
          </ul>
        </div>

        {/* How It Works */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
          <h3 className="text-slate-300 font-semibold mb-2">🔐 How Zero-Knowledge Encryption Works</h3>
          <ol className="space-y-1.5 text-sm text-slate-400 list-decimal list-inside">
            <li>All encryption/decryption happens <strong className="text-slate-300">in your browser</strong></li>
            <li>Your password <strong className="text-slate-300">never leaves your device</strong></li>
            <li>We store only <strong className="text-slate-300">encrypted data</strong> (ciphertext)</li>
            <li>Our servers <strong className="text-slate-300">cannot decrypt your files</strong></li>
            <li>You have complete privacy—we cannot see your content</li>
          </ol>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Encryption Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter at least 12 characters"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              minLength={12}
              required
              disabled={isInitializing}
            />
            <p className="text-xs text-slate-500 mt-1">
              Minimum 12 characters. Recommend using a password manager to generate and store.
            </p>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-300 mb-1">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              id="confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              minLength={12}
              required
              disabled={isInitializing}
            />
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
              disabled={isInitializing || password.length < 12}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
            >
              {isInitializing ? 'Setting up encryption...' : 'Enable Secure Archive'}
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

          {/* Acknowledgment */}
          <p className="text-xs text-slate-500 text-center pt-2">
            By clicking "Enable Secure Archive", you acknowledge that you understand
            the consequences of losing your encryption password.
          </p>
        </form>
      </div>
    </div>
  );
}
