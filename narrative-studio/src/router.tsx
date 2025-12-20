/**
 * Router Configuration - Mobile-first tool navigation
 *
 * Routes:
 * - / : Main workspace (editor + panels on desktop)
 * - /tool/:toolId : Full-page tool view (primary on mobile)
 * - /archive/:viewId : Archive view (future)
 *
 * Desktop users can toggle between split-view and full-page modes.
 * Mobile users always get full-page tool views.
 */

import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Lazy load tool pages for code splitting
const ToolPage = lazy(() => import('./components/pages/ToolPage'));

// Loading fallback for lazy-loaded routes
function RouteLoadingFallback() {
  return (
    <div className="route-loading">
      <div className="route-loading__spinner" />
      <span className="route-loading__text">Loading...</span>
    </div>
  );
}

// Root layout that provides context to all routes
function RootLayout() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Outlet />
    </Suspense>
  );
}

// Create the router configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        // Main workspace - lazy loaded from App
        lazy: async () => {
          const { MainWorkspaceRoute } = await import('./components/pages/MainWorkspaceRoute');
          return { Component: MainWorkspaceRoute };
        },
      },
      {
        path: 'tool/:toolId',
        element: (
          <Suspense fallback={<RouteLoadingFallback />}>
            <ToolPage />
          </Suspense>
        ),
      },
      {
        path: 'archive/:viewId',
        lazy: async () => {
          const { ArchiveRoute } = await import('./components/pages/ArchiveRoute');
          return { Component: ArchiveRoute };
        },
      },
    ],
  },
]);

// Router provider component to wrap the app
export function AppRouter() {
  return <RouterProvider router={router} />;
}
