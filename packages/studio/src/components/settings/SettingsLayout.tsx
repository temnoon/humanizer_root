/**
 * Settings Layout
 *
 * Main layout wrapper for the user settings interface.
 * Provides 2-panel layout with sidebar navigation.
 *
 * @module @humanizer/studio/components/settings/SettingsLayout
 */

import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SettingsNav } from './SettingsNav';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toggle sidebar on mobile
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Close sidebar (for overlay click)
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────────────────

  // Show loading state
  if (isLoading) {
    return (
      <div className="settings">
        <div className="settings-loading">
          <span className="settings-loading__spinner" />
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="settings">
        <div className="settings__main">
          <div className="settings__content">
            <div className="settings-empty">
              <span className="settings-empty__icon">🔒</span>
              <h2 className="settings-empty__title">Sign In Required</h2>
              <p className="settings-empty__description">
                Please sign in to access your settings.
              </p>
              <button
                className="btn btn--primary"
                onClick={() => navigate('/')}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="settings">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="settings__overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`settings__sidebar ${sidebarOpen ? 'settings__sidebar--open' : ''}`}>
        <SettingsNav />
      </aside>

      {/* Main content */}
      <div className="settings__main">
        {/* Top bar */}
        <header className="settings__topbar">
          <div className="settings__topbar-left">
            {/* Mobile menu button */}
            <button
              className="settings__menu-btn"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              <span className="settings__menu-icon">☰</span>
            </button>
            <h1 className="settings__topbar-title">Settings</h1>
          </div>

          <div className="settings__topbar-right">
            {/* Theme toggle */}
            <div className="theme-toggle" role="radiogroup" aria-label="Theme">
              <button
                className={`theme-toggle__btn ${theme === 'light' ? 'theme-toggle__btn--active' : ''}`}
                onClick={() => setTheme('light')}
                title="Light"
                aria-label="Light theme"
              >
                ☀
              </button>
              <button
                className={`theme-toggle__btn ${theme === 'sepia' ? 'theme-toggle__btn--active' : ''}`}
                onClick={() => setTheme('sepia')}
                title="Sepia"
                aria-label="Sepia theme"
              >
                ☼
              </button>
              <button
                className={`theme-toggle__btn ${theme === 'dark' ? 'theme-toggle__btn--active' : ''}`}
                onClick={() => setTheme('dark')}
                title="Dark"
                aria-label="Dark theme"
              >
                ☾
              </button>
            </div>

            {/* Back to studio */}
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate('/')}
            >
              Back to Studio
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="settings__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
