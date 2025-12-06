/**
 * Status Bar - Bottom of screen
 * Always visible, shows system state, job progress, environment info
 * The cognitive anchor at the bottom edge
 */

import React from 'react';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import './StatusBar.css';

export function StatusBar() {
  const { environment, provider, features } = useEnvironment();
  const { buffers } = useWorkspace();

  return (
    <div className="status-bar">
      {/* Left: Environment & Connection */}
      <div className="status-section status-left">
        <span className="status-item">
          {environment === 'electron' ? '🏠' : '🌐'} {environment}
        </span>
        <span className="status-divider">|</span>
        <span className="status-item">
          {provider === 'local' ? '💻 Local' : '☁️ Cloud'}
        </span>
        {features.nodeNetwork && (
          <>
            <span className="status-divider">|</span>
            <span className="status-item status-connected">
              ● Connected
            </span>
          </>
        )}
      </div>

      {/* Center: Active Jobs / Progress */}
      <div className="status-section status-center">
        {/* TODO: Background jobs will appear here */}
        <span className="status-ready">Ready</span>
      </div>

      {/* Right: Buffer Info */}
      <div className="status-section status-right">
        {buffers.length > 0 && (
          <>
            <span className="status-item">
              {buffers.length} buffer{buffers.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
