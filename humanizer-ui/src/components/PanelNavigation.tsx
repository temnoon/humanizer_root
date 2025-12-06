/**
 * Panel Navigation - Back/Forward buttons for side panels
 * Always in the same place, always doing the same thing
 * The cognitive anchor for panel history
 */

import React from 'react';
import './PanelNavigation.css';

interface PanelNavigationProps {
  position: 'left' | 'right';
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  title?: string;
}

export function PanelNavigation({
  position,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  title,
}: PanelNavigationProps) {
  return (
    <div className={`panel-navigation panel-navigation-${position}`}>
      {/* Back/Forward Buttons */}
      <div className="nav-buttons">
        <button
          className="nav-button nav-back"
          onClick={onBack}
          disabled={!canGoBack}
          title="Go back"
        >
          ‹
        </button>
        <button
          className="nav-button nav-forward"
          onClick={onForward}
          disabled={!canGoForward}
          title="Go forward"
        >
          ›
        </button>
      </div>

      {/* Optional Title */}
      {title && (
        <div className="nav-title">
          {title}
        </div>
      )}
    </div>
  );
}
