/**
 * Admin Layout
 *
 * Main layout wrapper for the admin interface.
 * Provides 2-panel layout with sidebar navigation.
 *
 * @module @humanizer/studio/components/admin/AdminLayout
 */

import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useIsAdmin } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AdminNav } from './AdminNav';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = useIsAdmin();
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
      <div className="admin">
        <div className="admin-loading">
          <span className="admin-loading__spinner" />
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="admin">
        <div className="admin__main">
          <div className="admin__content">
            <div className="admin-empty">
              <span className="admin-empty__icon">🔒</span>
              <h2 className="admin-empty__title">Authentication Required</h2>
              <p className="admin-empty__description">
                Please sign in to access the admin panel.
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

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="admin">
        <div className="admin__main">
          <div className="admin__content">
            <div className="admin-empty">
              <span className="admin-empty__icon">⛔</span>
              <h2 className="admin-empty__title">Access Denied</h2>
              <p className="admin-empty__description">
                You do not have permission to access the admin panel.
                Your current role is: {user?.role}
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
    <div className="admin">
      {/* Mobile Overlay */}
      <div
        className={`admin__overlay ${sidebarOpen ? 'admin__overlay--visible' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`admin__sidebar ${sidebarOpen ? 'admin__sidebar--open' : ''}`}>
        <AdminNav />
      </aside>

      {/* Main Content */}
      <div className="admin__main">
        {/* Header */}
        <header className="admin__header">
          <div className="admin__header-left">
            {/* Mobile menu button */}
            <button
              className="btn btn--ghost btn--icon btn--sm admin__menu-btn"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>

          <div className="admin__header-actions">
            {/* Theme Toggle */}
            <div className="theme-toggle" role="radiogroup" aria-label="Theme">
              <button
                className={`theme-toggle__btn ${theme === 'light' ? 'theme-toggle__btn--active' : ''}`}
                onClick={() => setTheme('light')}
                title="Light"
                aria-label="Light theme"
              >
                &#9728;
              </button>
              <button
                className={`theme-toggle__btn ${theme === 'sepia' ? 'theme-toggle__btn--active' : ''}`}
                onClick={() => setTheme('sepia')}
                title="Sepia"
                aria-label="Sepia theme"
              >
                &#9788;
              </button>
              <button
                className={`theme-toggle__btn ${theme === 'dark' ? 'theme-toggle__btn--active' : ''}`}
                onClick={() => setTheme('dark')}
                title="Dark"
                aria-label="Dark theme"
              >
                &#9790;
              </button>
            </div>

            {/* Back to Studio */}
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => navigate('/')}
            >
              Exit Admin
            </button>
          </div>
        </header>

        {/* Content - Renders child routes */}
        <main className="admin__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
