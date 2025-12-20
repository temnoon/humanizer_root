/**
 * ArchiveRoute - Placeholder for full-page archive views
 *
 * Future: Will provide full-page archive browsing on mobile.
 */

import { useParams, Link } from 'react-router-dom';

export function ArchiveRoute() {
  const { viewId } = useParams<{ viewId: string }>();

  return (
    <div className="archive-route">
      <header className="archive-route__header">
        <Link to="/" className="archive-route__back">
          ← Back to Workspace
        </Link>
        <h1>Archive: {viewId}</h1>
      </header>
      <main className="archive-route__content">
        <p>Archive view "{viewId}" - Coming soon</p>
        <Link to="/">Return to Workspace</Link>
      </main>
    </div>
  );
}

export default ArchiveRoute;
