/**
 * Studio Tools Panel - Wrapper for @humanizer/studio-tools
 *
 * Integrates the shared ToolPalette with post-social-ui's
 * auth system and content flow.
 */

import { Component, onMount, createEffect } from 'solid-js';
import {
  ToolPalette,
  initializeTools,
  setAuthToken,
  configureApiClient,
} from '../../../../shared/studio-tools/src/components/solid';
import type { ToolResult, UserTier } from '../../../../shared/studio-tools/src/types';
import { authStore } from '@/stores/auth';

// Import styles
import '../../../../shared/studio-tools/src/components/solid/studio-tools.css';

interface StudioToolsPanelProps {
  content: string;
  onApplyTransform?: (transformedText: string) => void;
  onSubmitAsNarrative?: (transformedText: string, title?: string) => void;
}

// Map post-social user roles to tool tiers
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
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8787';
    }
  }
  return 'https://npe-api.tem-527.workers.dev';
}

export const StudioToolsPanel: Component<StudioToolsPanelProps> = (props) => {
  // Initialize tools and configure API on mount
  onMount(() => {
    initializeTools();
    configureApiClient({
      baseUrl: getApiUrl(),
    });
  });

  // Update auth token when it changes
  createEffect(() => {
    const token = authStore.token();
    if (token) {
      setAuthToken(token);
    }
  });

  // Get user tier from auth store
  const userTier = () => mapRoleToTier(authStore.user()?.role);

  // Handle tool result application
  const handleApplyResult = (result: ToolResult) => {
    if (result.transformedText && props.onApplyTransform) {
      props.onApplyTransform(result.transformedText);
    } else if (result.generatedContent && props.onApplyTransform) {
      props.onApplyTransform(result.generatedContent);
    }
  };

  return (
    <div class="studio-tools-wrapper">
      <ToolPalette
        content={props.content}
        interfaceId="post-social"
        userTier={userTier()}
        onApplyResult={handleApplyResult}
      />
    </div>
  );
};
