/**
 * Studio Layout - 3-Panel Narrative Composer
 * 
 * Inspired by professional writing tools:
 * - Left: Archive browser / content sources
 * - Center: Main editing/viewing pane
 * - Right: AI curator / tools
 * 
 * Panels are resizable and collapsible.
 */

import { Component, createSignal, createEffect, Show, JSX } from 'solid-js';

interface StudioLayoutProps {
  leftPanel?: JSX.Element;
  centerPanel: JSX.Element;
  rightPanel?: JSX.Element;
  leftTitle?: string;
  rightTitle?: string;
  leftWidth?: number;
  rightWidth?: number;
  minPanelWidth?: number;
}

export const StudioLayout: Component<StudioLayoutProps> = (props) => {
  const [leftOpen, setLeftOpen] = createSignal(true);
  const [rightOpen, setRightOpen] = createSignal(true);
  const [leftWidth, setLeftWidth] = createSignal(props.leftWidth || 280);
  const [rightWidth, setRightWidth] = createSignal(props.rightWidth || 320);
  const [isDraggingLeft, setIsDraggingLeft] = createSignal(false);
  const [isDraggingRight, setIsDraggingRight] = createSignal(false);
  
  const minWidth = props.minPanelWidth || 200;
  const maxWidth = 500;
  
  // Handle resize drag
  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingLeft()) {
      const newWidth = Math.min(maxWidth, Math.max(minWidth, e.clientX));
      setLeftWidth(newWidth);
    }
    if (isDraggingRight()) {
      const newWidth = Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX));
      setRightWidth(newWidth);
    }
  };
  
  const handleMouseUp = () => {
    setIsDraggingLeft(false);
    setIsDraggingRight(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  
  createEffect(() => {
    if (isDraggingLeft() || isDraggingRight()) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });
  
  return (
    <div class="studio-layout">
      {/* Left Panel */}
      <Show when={props.leftPanel}>
        <div 
          class={`studio-panel left ${leftOpen() ? 'open' : 'collapsed'}`}
          style={{ width: leftOpen() ? `${leftWidth()}px` : '40px' }}
        >
          <div class="panel-header">
            <Show when={leftOpen()}>
              <span class="panel-title">{props.leftTitle || 'Archive'}</span>
            </Show>
            <button 
              class="panel-toggle"
              onClick={() => setLeftOpen(!leftOpen())}
              title={leftOpen() ? 'Collapse' : 'Expand'}
            >
              {leftOpen() ? '◀' : '▶'}
            </button>
          </div>
          <Show when={leftOpen()}>
            <div class="panel-content">
              {props.leftPanel}
            </div>
          </Show>
        </div>
        
        {/* Left Resize Handle */}
        <Show when={leftOpen()}>
          <div 
            class="resize-handle left"
            onMouseDown={() => setIsDraggingLeft(true)}
          />
        </Show>
      </Show>
      
      {/* Center Panel - Always visible */}
      <div class="studio-panel center">
        <div class="panel-content">
          {props.centerPanel}
        </div>
      </div>
      
      {/* Right Resize Handle */}
      <Show when={props.rightPanel && rightOpen()}>
        <div 
          class="resize-handle right"
          onMouseDown={() => setIsDraggingRight(true)}
        />
      </Show>
      
      {/* Right Panel */}
      <Show when={props.rightPanel}>
        <div 
          class={`studio-panel right ${rightOpen() ? 'open' : 'collapsed'}`}
          style={{ width: rightOpen() ? `${rightWidth()}px` : '40px' }}
        >
          <div class="panel-header">
            <button 
              class="panel-toggle"
              onClick={() => setRightOpen(!rightOpen())}
              title={rightOpen() ? 'Collapse' : 'Expand'}
            >
              {rightOpen() ? '▶' : '◀'}
            </button>
            <Show when={rightOpen()}>
              <span class="panel-title">{props.rightTitle || 'Curator'}</span>
            </Show>
          </div>
          <Show when={rightOpen()}>
            <div class="panel-content">
              {props.rightPanel}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
