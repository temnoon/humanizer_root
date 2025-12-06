/**
 * Main 3-Panel Layout
 * Left: Input Sources | Center: Workspace | Right: Tools
 *
 * Features:
 * - Resizable panels (drag dividers)
 * - Collapsible panels (⌘B for left, ⌘\ for right)
 * - Focus mode (⌘⇧F to hide all panels)
 * - Layout persistence (saved to localStorage)
 */

import React, { ReactNode } from 'react';
import { useLayout } from '../contexts/LayoutContext';
import { ResizableDivider } from './ResizableDivider';
import { PanelControls } from './PanelControls';
import './Layout.css';

interface LayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
}

export function Layout({ leftPanel, centerPanel, rightPanel }: LayoutProps) {
  const {
    leftWidth,
    rightWidth,
    leftCollapsed,
    rightCollapsed,
    focusMode,
    setLeftWidth,
    setRightWidth,
    toggleLeftPanel,
    toggleRightPanel,
  } = useLayout();

  const handleLeftResize = (delta: number) => {
    setLeftWidth(leftWidth + delta);
  };

  const handleRightResize = (delta: number) => {
    setRightWidth(rightWidth - delta);
  };

  return (
    <div className={`layout ${focusMode ? 'focus-mode' : ''}`}>
      {/* Left Panel */}
      {!focusMode && (
        <>
          <div
            className={`layout-left ${leftCollapsed ? 'collapsed' : ''}`}
            style={{
              width: leftCollapsed ? '0px' : `${leftWidth}px`,
            }}
          >
            {!leftCollapsed && (
              <>
                {leftPanel}
                <PanelControls
                  position="left"
                  collapsed={leftCollapsed}
                  onToggle={toggleLeftPanel}
                  title="Input Panel"
                />
              </>
            )}
          </div>

          {/* Left Divider */}
          {!leftCollapsed && (
            <ResizableDivider onResize={handleLeftResize} direction="horizontal" />
          )}

          {/* Collapsed Left Panel Button */}
          {leftCollapsed && (
            <div className="collapsed-panel-trigger left">
              <PanelControls
                position="left"
                collapsed={leftCollapsed}
                onToggle={toggleLeftPanel}
                title="Input Panel"
              />
            </div>
          )}
        </>
      )}

      {/* Center Panel */}
      <div className="layout-center">{centerPanel}</div>

      {/* Right Panel */}
      {!focusMode && (
        <>
          {/* Collapsed Right Panel Button */}
          {rightCollapsed && (
            <div className="collapsed-panel-trigger right">
              <PanelControls
                position="right"
                collapsed={rightCollapsed}
                onToggle={toggleRightPanel}
                title="Tools Panel"
              />
            </div>
          )}

          {/* Right Divider */}
          {!rightCollapsed && (
            <ResizableDivider onResize={handleRightResize} direction="horizontal" />
          )}

          <div
            className={`layout-right ${rightCollapsed ? 'collapsed' : ''}`}
            style={{
              width: rightCollapsed ? '0px' : `${rightWidth}px`,
            }}
          >
            {!rightCollapsed && (
              <>
                {rightPanel}
                <PanelControls
                  position="right"
                  collapsed={rightCollapsed}
                  onToggle={toggleRightPanel}
                  title="Tools Panel"
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
