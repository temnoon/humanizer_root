/**
 * Settings Profile Page
 *
 * User profile management including email, password change.
 *
 * @module @humanizer/studio/components/settings/SettingsProfile
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsProfile() {
  const { user } = useAuth();
  const api = useApi();

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await api.settings.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">Profile</h2>
        <p className="settings-section__description">
          Manage your account information
        </p>
      </div>

      <div className="settings-section__content">
        {/* Profile Info Card */}
        <div className="settings-card">
          <h3 className="settings-card__title">Account Information</h3>
          <div className="settings-card__content">
            <div className="settings-field">
              <label className="settings-field__label">Email</label>
              <div className="settings-field__value">{user?.email ?? 'N/A'}</div>
            </div>
            <div className="settings-field">
              <label className="settings-field__label">User ID</label>
              <div className="settings-field__value settings-field__value--mono">
                {user?.id ?? 'N/A'}
              </div>
            </div>
            <div className="settings-field">
              <label className="settings-field__label">Current Tier</label>
              <div className="settings-field__value">
                <span className={`settings-badge settings-badge--${user?.role ?? 'free'}`}>
                  {user?.role ?? 'free'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Password Change Card */}
        <div className="settings-card">
          <h3 className="settings-card__title">Password</h3>
          <div className="settings-card__content">
            {!showPasswordForm ? (
              <button
                className="btn btn--secondary"
                onClick={() => setShowPasswordForm(true)}
              >
                Change Password
              </button>
            ) : (
              <form onSubmit={handlePasswordChange} className="settings-form">
                {passwordError && (
                  <div className="settings-alert settings-alert--error">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="settings-alert settings-alert--success">
                    Password changed successfully
                  </div>
                )}
                <div className="settings-form__field">
                  <label htmlFor="currentPassword">Current Password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="settings-form__field">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="settings-form__field">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="settings-form__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={savingPassword}
                  >
                    {savingPassword ? 'Saving...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Subscription Card */}
        <div className="settings-card">
          <h3 className="settings-card__title">Subscription</h3>
          <div className="settings-card__content">
            <div className="settings-field">
              <label className="settings-field__label">Current Plan</label>
              <div className="settings-field__value">
                <span className={`settings-badge settings-badge--${user?.role ?? 'free'}`}>
                  {user?.role === 'free' ? 'Free Plan' : `${user?.role} Plan`}
                </span>
              </div>
            </div>
            {user?.role === 'free' && (
              <div className="settings-upgrade">
                <p className="settings-upgrade__text">
                  Upgrade to unlock more features and higher limits
                </p>
                <button className="btn btn--primary">
                  View Plans
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-card settings-card--danger">
          <h3 className="settings-card__title">Danger Zone</h3>
          <div className="settings-card__content">
            <div className="settings-danger-item">
              <div className="settings-danger-item__info">
                <strong>Export Data</strong>
                <p>Download all your data as a ZIP file</p>
              </div>
              <button className="btn btn--secondary btn--sm">
                Export
              </button>
            </div>
            <div className="settings-danger-item">
              <div className="settings-danger-item__info">
                <strong>Delete Account</strong>
                <p>Permanently delete your account and all data</p>
              </div>
              <button className="btn btn--danger btn--sm">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
