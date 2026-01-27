/**
 * Humanizer Studio - Main Application
 *
 * Distraction-free workspace with:
 * - 3-mode theme system (light, sepia, dark) at the foundation
 * - Auto-hiding topbar (hides after 3s of no mouse movement)
 * - Floating corner assistant for AUI access
 * - Admin interface for system management
 */

import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ApiProvider, useApi } from './contexts/ApiContext';
import { AuthProvider, useAuth, useIsAdmin } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { MainWorkspace, type WorkspaceContent } from './components/workspace';
import { CornerAssistant } from './components/CornerAssistant';
import { LoginModal, UserMenu } from './components/auth';
import { AdminLayout, AdminDashboard, AdminUsers, AdminPrompts, AdminModels, AdminTiers, AdminProviders, AdminFeatures, AdminApiKeys, AdminUsage, AdminCosts, AdminSubscriptions, AdminAudit } from './components/admin';
import { SettingsLayout, SettingsProfile, SettingsApiKeys, SettingsUsage, SettingsPreferences, SettingsPrompts } from './components/settings';
import type { SearchResult } from './contexts/ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO CONTENT - Main application layout
// ═══════════════════════════════════════════════════════════════════════════

function StudioContent() {
  const api = useApi();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [content, setContent] = useState<WorkspaceContent | null>(null);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Create session on mount
  useEffect(() => {
    api.createSession({ name: 'Studio Session' })
      .then((session) => setSessionId(session.id))
      .catch(console.error);
  }, [api]);

  // Auto-hide topbar after 3 seconds of no mouse movement
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = () => {
      setTopbarVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setTopbarVisible(false), 3000);
    };
    window.addEventListener('mousemove', handleMove);
    handleMove();
    return () => {
      window.removeEventListener('mousemove', handleMove);
      clearTimeout(timeout);
    };
  }, []);

  // Handle result selection from CornerAssistant
  const handleSelectResult = useCallback((result: SearchResult) => {
    const sourceType = result.provenance?.sourceType || result.source;
    const threadTitle = result.provenance?.threadTitle;
    const authorRole = result.provenance?.authorRole;

    setContent({
      id: result.id,
      title: threadTitle || sourceType,
      text: result.text,
      source: {
        type: result.source,
        path: [sourceType, threadTitle || 'Content'],
      },
      metadata: {
        wordCount: result.wordCount,
        authorRole,
      },
    });
  }, []);

  // Handle "Find Similar" from workspace
  const handleFindSimilar = useCallback(async (text: string) => {
    // This will be implemented when we add the find similar panel
    console.log('Find similar:', text.slice(0, 50));
  }, []);

  return (
    <div className="studio">
      {/* Auto-hiding topbar */}
      <header className={`studio-topbar ${topbarVisible ? '' : 'studio-topbar--hidden'}`}>
        <div className="studio-topbar__left">
          <span className="studio-topbar__logo">humanizer</span>
        </div>

        <div className="studio-topbar__center">
          <span className="studio-topbar__title">Studio</span>
        </div>

        <div className="studio-topbar__right">
          {/* Settings link for authenticated users */}
          {isAuthenticated && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate('/settings')}
            >
              Settings
            </button>
          )}

          {/* Admin link for admin users */}
          {isAdmin && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate('/admin')}
            >
              Admin
            </button>
          )}

          {/* Theme toggle */}
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

          {/* Auth: User menu or login button */}
          {authLoading ? (
            <span className="auth-loading">
              <span className="auth-loading__spinner" />
            </span>
          ) : isAuthenticated && user ? (
            <UserMenu user={user} />
          ) : (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setShowLoginModal(true)}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main workspace */}
      <main className="studio__main">
        <MainWorkspace
          content={content}
          onFindSimilar={handleFindSimilar}
        />
      </main>

      {/* Floating corner assistant for AUI */}
      <CornerAssistant
        onSelectResult={handleSelectResult}
        sessionId={sessionId ?? undefined}
      />

      {/* Login modal */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PLACEHOLDER PAGES
// These will be expanded into full components
// ═══════════════════════════════════════════════════════════════════════════

function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2 className="admin-section__title">{title}</h2>
      </div>
      <div className="admin-section__content">
        <div className="admin-empty">
          <span className="admin-empty__icon">🚧</span>
          <h3 className="admin-empty__title">Coming Soon</h3>
          <p className="admin-empty__description">
            This section is under development.
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminStatus() {
  const api = useApi();
  const [status, setStatus] = useState<{ status: string; message?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getStatus()
      .then(setStatus)
      .catch(() => setStatus({ status: 'error', message: 'Failed to fetch status' }))
      .finally(() => setLoading(false));
  }, [api.admin]);

  if (loading) {
    return (
      <div className="admin-loading">
        <span className="admin-loading__spinner" />
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2 className="admin-section__title">System Status</h2>
      </div>
      <div className="admin-section__content">
        <div className="admin-alert admin-alert--info">
          <span className="admin-alert__icon">ℹ️</span>
          <div className="admin-alert__content">
            <h4 className="admin-alert__title">API Status: {status?.status}</h4>
            <p className="admin-alert__message">{status?.message ?? 'System is operational'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// AdminUsers is now imported from ./components/admin

// AdminApiKeys is now imported from ./components/admin

// AdminTiers is now imported from ./components/admin

// AdminModels is now imported from ./components/admin

// AdminPrompts is now imported from ./components/admin

// AdminProviders is now imported from ./components/admin

// AdminFeatures is now imported from ./components/admin

// AdminSubscriptions is now imported from ./components/admin

// AdminCosts is now imported from ./components/admin

// AdminUsage is now imported from ./components/admin

// AdminAudit is now imported from ./components/admin

// ═══════════════════════════════════════════════════════════════════════════
// APP ROUTES - Router configuration
// ═══════════════════════════════════════════════════════════════════════════

function AppRoutes() {
  return (
    <Routes>
      {/* Main Studio */}
      <Route path="/" element={<StudioContent />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="status" element={<AdminStatus />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="api-keys" element={<AdminApiKeys />} />
        <Route path="tiers" element={<AdminTiers />} />
        <Route path="models" element={<AdminModels />} />
        <Route path="prompts" element={<AdminPrompts />} />
        <Route path="providers" element={<AdminProviders />} />
        <Route path="features" element={<AdminFeatures />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="costs" element={<AdminCosts />} />
        <Route path="analytics/usage" element={<AdminUsage />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>

      {/* Settings Routes */}
      <Route path="/settings" element={<SettingsLayout />}>
        <Route index element={<SettingsProfile />} />
        <Route path="api-keys" element={<SettingsApiKeys />} />
        <Route path="usage" element={<SettingsUsage />} />
        <Route path="preferences" element={<SettingsPreferences />} />
        <Route path="prompts" element={<SettingsPrompts />} />
      </Route>
    </Routes>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP - Provider wrapper
// ═══════════════════════════════════════════════════════════════════════════

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ApiProvider>
            <AppRoutes />
          </ApiProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
