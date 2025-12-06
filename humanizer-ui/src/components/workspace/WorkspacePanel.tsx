/**
 * Workspace Panel - Center
 * Unified content viewer/editor with buffer system
 * Supports viewing and editing all content types
 */

import React, { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { MarkdownRenderer } from '../MarkdownRenderer';
import './WorkspacePanel.css';

type ViewMode = 'viewer' | 'editor';

export function WorkspacePanel() {
  const {
    currentBuffer,
    buffers,
    updateBuffer,
    closeBuffer,
    switchBuffer,
    viewMode: layoutViewMode,
    comparisonBufferId,
    setViewMode: setLayoutViewMode,
  } = useWorkspace();
  const [editMode, setEditMode] = useState<ViewMode>('viewer');

  // If no buffer, show welcome screen
  if (!currentBuffer) {
    return <WelcomeView />;
  }

  const comparisonBuffer = buffers.find(b => b.id === comparisonBufferId) || null;

  return (
    <div className="workspace-panel">
      {/* Buffer Tabs */}
      {buffers.length > 0 && (
        <div className="workspace-tabs">
          {buffers.map((buffer) => (
            <div
              key={buffer.id}
              className={`workspace-tab ${buffer.id === currentBuffer.id ? 'active' : ''}`}
              onClick={() => switchBuffer(buffer.id)}
            >
              <span className="tab-title">{buffer.title}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeBuffer(buffer.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button
          className={`view-mode-btn ${layoutViewMode === 'single' ? 'active' : ''}`}
          onClick={() => setLayoutViewMode('single')}
        >
          Single
        </button>
        <button
          className={`view-mode-btn ${layoutViewMode === 'side-by-side' ? 'active' : ''}`}
          onClick={() => setLayoutViewMode('side-by-side')}
          disabled={!comparisonBuffer}
          title={!comparisonBuffer ? 'No comparison buffer available' : 'Side-by-side view'}
        >
          Side-by-Side
        </button>
      </div>

      {/* Content Area */}
      {layoutViewMode === 'single' ? (
        <div className="workspace-single">
          {editMode === 'viewer' ? (
            <ViewerView
              buffer={currentBuffer}
              onEdit={() => setEditMode('editor')}
            />
          ) : (
            <EditorView
              buffer={currentBuffer}
              onSave={(content) => {
                updateBuffer(currentBuffer.id, content);
                setEditMode('viewer');
              }}
              onCancel={() => setEditMode('viewer')}
            />
          )}
        </div>
      ) : (
        <div className="workspace-side-by-side">
          {/* Left Pane: Comparison Buffer */}
          <div className="side-by-side-pane">
            <div className="pane-label">
              {comparisonBuffer?.isVariation ? 'Original' : 'Comparison'}
            </div>
            {comparisonBuffer && <ViewerView buffer={comparisonBuffer} onEdit={() => {}} />}
          </div>

          {/* Right Pane: Current Buffer */}
          <div className="side-by-side-pane">
            <div className="pane-label">
              {currentBuffer.source.type === 'transformation' ? 'Transformed' : 'Current'}
            </div>
            {editMode === 'viewer' ? (
              <ViewerView
                buffer={currentBuffer}
                onEdit={() => setEditMode('editor')}
              />
            ) : (
              <EditorView
                buffer={currentBuffer}
                onSave={(content) => {
                  updateBuffer(currentBuffer.id, content);
                  setEditMode('viewer');
                }}
                onCancel={() => setEditMode('viewer')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeView() {
  return (
    <div className="workspace-welcome">
      <div className="welcome-content">
        <div className="welcome-logo">
          <span className="logo-main">humanizer</span>
          <span className="logo-dot">.com</span>
        </div>
        <h1>Welcome to Humanizer</h1>
        <p className="welcome-subtitle">
          Transform AI-generated text, explore archives, and build better content
        </p>

        <div className="welcome-actions">
          <div className="welcome-section">
            <h3>📥 Get Started</h3>
            <ul>
              <li>Import content from archives or paste text</li>
              <li>Browse Project Gutenberg for public domain books</li>
              <li>Connect to the post-social node network</li>
            </ul>
          </div>

          <div className="welcome-section">
            <h3>🛠️ Tools Available</h3>
            <ul>
              <li>AI Detection & Humanization</li>
              <li>Persona & Style Transformations</li>
              <li>Semantic Search & Analysis</li>
              <li>Book Builder (WIP)</li>
            </ul>
          </div>

          <div className="welcome-section">
            <h3>🔒 Privacy First</h3>
            <ul>
              <li>Local mode: Everything stays on your device</li>
              <li>Cloud mode: Advanced AI with usage warnings</li>
              <li>Zero-trust archives: Client-side encryption</li>
            </ul>
          </div>
        </div>

        <div className="welcome-footer">
          <p>Select a source from the left panel to begin</p>
        </div>
      </div>
    </div>
  );
}

function ViewerView({ buffer, onEdit }: { buffer: any; onEdit: () => void }) {
  const wordCount = buffer.content.split(/\s+/).filter((w: string) => w).length;
  const charCount = buffer.content.length;
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buffer.content);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus('Failed');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(buffer.content);
      setCopyStatus('Copied as Markdown!');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      console.error('Failed to copy markdown:', error);
      setCopyStatus('Failed');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  return (
    <div className="workspace-viewer">
      <div className="viewer-toolbar">
        <div className="viewer-title">
          <h2>{buffer.title}</h2>
          <div className="viewer-meta">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} chars</span>
            <span>•</span>
            <span>{buffer.source.type}</span>
          </div>
        </div>
        <div className="viewer-actions">
          <button className="btn btn-ghost" onClick={handleCopy} title="Copy content">
            {copyStatus === 'Copied!' ? '✅' : '📋'} Copy
          </button>
          <button className="btn btn-ghost" onClick={handleCopyMarkdown} title="Copy as Markdown">
            {copyStatus === 'Copied as Markdown!' ? '✅' : '📝'} Markdown
          </button>
          <button className="btn btn-ghost" onClick={onEdit}>
            ✏️ Edit
          </button>
        </div>
      </div>
      <div className="viewer-content">
        <div className="content-prose">
          <MarkdownRenderer content={buffer.content} />
        </div>
      </div>
    </div>
  );
}

function EditorView({
  buffer,
  onSave,
  onCancel,
}: {
  buffer: any;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(buffer.content);
  const wordCount = content.split(/\s+/).filter((w: string) => w).length;
  const charCount = content.length;

  return (
    <div className="workspace-editor">
      <div className="editor-toolbar">
        <div className="editor-title">
          <h2>Editing: {buffer.title}</h2>
          <div className="editor-meta">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} chars</span>
          </div>
        </div>
        <div className="editor-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onSave(content)}>
            💾 Save
          </button>
        </div>
      </div>
      <div className="editor-content">
        <textarea
          className="editor-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing..."
        />
      </div>
    </div>
  );
}
