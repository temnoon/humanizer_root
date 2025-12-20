/**
 * RouteHandler - Handles route-based rendering
 *
 * This component checks the current route and renders:
 * - Main workspace for "/"
 * - ToolPage for "/tool/:toolId"
 * - ArchiveRoute for "/archive/:viewId"
 *
 * It's designed to work within the existing App structure,
 * wrapping the children (main workspace) and showing tool pages when needed.
 */

import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

// Lazy load tool page for code splitting
const ToolPage = lazy(() => import('../pages/ToolPage'));
const ArchiveRoute = lazy(() => import('../pages/ArchiveRoute'));

interface RouteHandlerProps {
  children: ReactNode; // The main workspace UI
}

function RouteLoading() {
  return (
    <div className="route-loading">
      <div className="route-loading__content">
        <div className="route-loading__spinner" />
        <span className="route-loading__text">Loading...</span>
      </div>
    </div>
  );
}

export function RouteHandler({ children }: RouteHandlerProps) {
  return (
    <Routes>
      {/* Main workspace route - renders children */}
      <Route path="/" element={<>{children}</>} />

      {/* Tool page route - full page tool view */}
      <Route
        path="/tool/:toolId"
        element={
          <Suspense fallback={<RouteLoading />}>
            <ToolPage />
          </Suspense>
        }
      />

      {/* Archive route - full page archive view */}
      <Route
        path="/archive/:viewId"
        element={
          <Suspense fallback={<RouteLoading />}>
            <ArchiveRoute />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default RouteHandler;
