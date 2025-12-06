/**
 * Studio Tools Panel - Wrapper for @humanizer/studio-tools
 *
 * Integrates the shared ToolPalette with narrative-studio's
 * auth system and content flow.
 */

import { useEffect, useState } from 'react';
import {
  ToolPalette,
  initializeTools,
  setAuthToken,
  configureApiClient,
} from '../../../../workers/shared/studio-tools/src/components/react';
import type { ToolResult, UserTier } from '../../../../workers/shared/studio-tools/src/types';
import { useAuth } from '../../contexts/AuthContext';
import { AddToBookSection } from './AddToBookSection';
import { STORAGE_PATHS } from '../../config/storage-paths';

// Import styles
import '../../../../workers/shared/studio-tools/src/components/solid/studio-tools.css';

interface StudioToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApplyTransform?: (transformedText: string) => void;
}

// Map narrative-studio user roles to tool tiers
function mapRoleToTier(role?: string): UserTier {
  switch (role) {
    case 'admin':
      return 'admin';
    case 'pro':
      return 'pro';
    case 'member':
      return 'free';
    default:
      return 'free';
  }
}

// Determine API URL based on environment
function getApiUrl(): string {
  // Use the same logic as narrative-studio's api.ts
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  // Use centralized config
  return STORAGE_PATHS.npeApiUrl;
}

export function StudioToolsPanel({
  isOpen,
  onClose,
  content,
  onApplyTransform,
}: StudioToolsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [initialized, setInitialized] = useState(false);

  // Initialize tools and configure API on mount
  useEffect(() => {
    initializeTools();
    configureApiClient({
      baseUrl: getApiUrl(),
    });
    setInitialized(true);
  }, []);

  // Update auth token when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      // Get token from localStorage (same keys as narrative-studio api.ts)
      const token = localStorage.getItem('narrative-studio-auth-token')
        || localStorage.getItem('post-social:token');
      if (token) {
        setAuthToken(token);
      }
    }
  }, [isAuthenticated]);

  // Get user tier from auth context
  const userTier = mapRoleToTier(user?.role);

  // Handle tool result application
  const handleApplyResult = (result: ToolResult) => {
    if (result.transformedText && onApplyTransform) {
      onApplyTransform(result.transformedText);
    } else if (result.generatedContent && onApplyTransform) {
      onApplyTransform(result.generatedContent);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed top-16 right-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderLeft: '1px solid var(--border-color)',
          borderRadius: 0,
        }}
      >
        {/* Header */}
        <div
          className="panel-header"
          style={{
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="heading-md" style={{ color: 'var(--text-primary)' }}>
              Tools
            </h2>
            <button
              onClick={onClose}
              title="Collapse Tools Panel"
              className="p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '16px',
              }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Main content area - flexbox column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100% - 80px)',
            overflow: 'hidden',
          }}
        >
          {/* Tool Palette */}
          <div
            className="studio-tools-wrapper"
            style={{
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {initialized && (
              <ToolPalette
                content={content}
                interfaceId="narrative-studio"
                userTier={userTier}
                onApplyResult={handleApplyResult}
              />
            )}
          </div>

          {/* Add to Book Section */}
          <AddToBookSection
            content={content}
            sourceType="archive"
          />
        </div>
      </aside>
    </>
  );
}
