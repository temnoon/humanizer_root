/**
 * Main App Component with Router
 *
 * STUDIO-FIRST ARCHITECTURE
 *
 * After login, users land directly in the StudioShell.
 * All navigation happens within the Studio's 3-panel layout.
 *
 * PUBLIC ROUTES: Unauthenticated users can browse nodes/narratives
 * STUDIO ROUTES: Authenticated users get the full 3-panel experience
 */

import { Component, onMount } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { themeStore } from '@/stores/theme';
import { ToastContainer } from '@/components/ui/Toast';
import { ConfirmDialogContainer } from '@/components/ui/ConfirmDialog';
import { LoginPage } from '@/pages/LoginPage';
import { CallbackPage } from '@/pages/CallbackPage';
import { StudioShell } from '@/pages/StudioShell';

// Public Pages (no auth required)
import { NodeBrowserPage } from '@/pages/NodeBrowserPage';
import { NodeDetailPage } from '@/pages/NodeDetailPage';
import { NarrativePage } from '@/pages/NarrativePage';
import { VersionComparePage } from '@/pages/VersionComparePage';
import { PricingPage } from '@/pages/PricingPage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';
import { TermsPage } from '@/pages/TermsPage';
import { TransparencyPage } from '@/pages/TransparencyPage';

// Admin Pages (requires admin role)
import { SiteAdminPage } from '@/pages/SiteAdminPage';

// Bookmaking Tool
import { BookEditorPage } from '@/pages/BookEditorPage';

// Legacy pages
import { DashboardPage } from '@/pages/DashboardPage';
import { PostDetailPage } from '@/pages/PostDetailPage';
import { SearchPage } from '@/pages/SearchPage';
import { FeedPage } from '@/pages/FeedPage';

const App: Component = () => {
  // Initialize theme on mount
  onMount(() => {
    themeStore.init();
  });

  return (
    <>
    <ToastContainer />
    <ConfirmDialogContainer />
    <Router>
      {/* Auth */}
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/callback" component={CallbackPage} />
      
      {/* PUBLIC: Browse without login */}
      <Route path="/nodes" component={NodeBrowserPage} />
      <Route path="/node/:slug" component={NodeDetailPage} />
      <Route path="/node/:nodeSlug/:narrativeSlug" component={NarrativePage} />
      <Route path="/node/:nodeSlug/:narrativeSlug/compare" component={VersionComparePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/upgrade" component={PricingPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/transparency" component={TransparencyPage} />
      
      {/* STUDIO: Full 3-panel experience (requires login) */}
      <Route path="/app" component={StudioShell} />
      <Route path="/app/*" component={StudioShell} />
      <Route path="/studio" component={StudioShell} />
      <Route path="/studio/*" component={StudioShell} />
      <Route path="/notes" component={StudioShell} />
      
      {/* Admin (requires admin role) */}
      <Route path="/admin" component={SiteAdminPage} />

      {/* Bookmaking Tool */}
      <Route path="/books" component={BookEditorPage} />
      <Route path="/books/:bookId" component={BookEditorPage} />

      {/* Legacy Post System */}
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/post/:id" component={PostDetailPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/feed" component={FeedPage} />
    </Router>
    </>
  );
};

export default App;
