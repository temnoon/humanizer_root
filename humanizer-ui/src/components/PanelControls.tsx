/**
 * Panel Controls
 * Collapse/expand buttons for panels
 */

import React from 'react';
import './PanelControls.css';

interface PanelControlsProps {
  position: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
  title: string;
}

export function PanelControls({ position, collapsed, onToggle, title }: PanelControlsProps) {
  const Icon = collapsed
    ? (position === 'left' ? ChevronRightIcon : ChevronLeftIcon)
    : (position === 'left' ? ChevronLeftIcon : ChevronRightIcon);

  const shortcut = position === 'left' ? '⌘B' : '⌘\\';

  return (
    <button
      className={`panel-control ${position} ${collapsed ? 'collapsed' : ''}`}
      onClick={onToggle}
      title={`${collapsed ? 'Expand' : 'Collapse'} ${title} (${shortcut})`}
    >
      <Icon />
    </button>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10 12L6 8L10 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 12L10 8L6 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
