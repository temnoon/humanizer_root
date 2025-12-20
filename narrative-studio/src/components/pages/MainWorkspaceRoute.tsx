/**
 * MainWorkspaceRoute - Route wrapper for the main workspace
 *
 * This component serves as the entry point for the "/" route.
 * It renders the existing App content (editor + panels) and
 * handles routing to tools when in split-view mode.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import App from '../../App';
import { useLayoutPreference } from '../../hooks/useLayoutPreference';

export function MainWorkspaceRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, preferSplitView } = useLayoutPreference();

  // Check if we should redirect to a tool page (mobile + tool requested)
  useEffect(() => {
    const toolParam = searchParams.get('tool');
    const storedTool = localStorage.getItem('narrative-studio-active-tool');

    // On mobile, if a tool is requested, navigate to tool page
    if (isMobile && (toolParam || storedTool)) {
      const toolId = toolParam || storedTool;
      if (toolId) {
        localStorage.removeItem('narrative-studio-active-tool');
        navigate(`/tool/${toolId}`, { replace: true });
      }
    }
  }, [isMobile, searchParams, navigate]);

  // Render the main App content
  // The App component handles its own panel state
  return <App />;
}

export default MainWorkspaceRoute;
