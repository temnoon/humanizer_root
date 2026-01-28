/**
 * MainWorkspace - Primary content display area
 *
 * Displays content from AUI buffers with beautiful markdown rendering.
 * Features:
 * - GitHub Flavored Markdown (tables, task lists, etc.)
 * - KaTeX math rendering (lazy loaded)
 * - Reddit-style extensions (spoilers, superscript)
 * - Syntax highlighted code blocks
 *
 * Shows WelcomeScreen when no content is active.
 */

import { useState, useCallback, useEffect } from 'react';
import { MathMarkdown } from '../markdown';
import { WelcomeScreen } from './WelcomeScreen';
import { useBufferSync } from '../../contexts/BufferSyncContext';

export interface WorkspaceContent {
  id: string;
  title: string;
  text: string;
  source?: {
    type: string;
    path?: string[];
  };
  metadata?: {
    wordCount?: number;
    authorRole?: string;
  };
}

export interface MainWorkspaceProps {
  content?: WorkspaceContent | null;
  onFindSimilar?: (text: string) => void;
}

export type ViewMode = 'read' | 'edit';

export function MainWorkspace({ content, onFindSimilar }: MainWorkspaceProps) {
  const { setContent, commit, isDirty, undo, redo, canUndo, canRedo } = useBufferSync();

  const [viewMode, setViewMode] = useState<ViewMode>('read');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync edit content when content changes
  useEffect(() => {
    if (content && viewMode === 'edit') {
      setEditContent(content.text);
    }
  }, [content?.id]);

  const handleEnterEdit = useCallback(() => {
    if (content) {
      setEditContent(content.text);
    }
    setViewMode('edit');
  }, [content]);

  // Apply edits by updating buffer content
  const handleApplyChanges = useCallback(async () => {
    if (!content) return;

    setIsSaving(true);
    try {
      // Update the buffer with edited content
      await setContent([{
        id: content.id,
        type: 'text',
        text: editContent,
        metadata: {
          wordCount: editContent.split(/\s+/).filter(Boolean).length,
          authorRole: (content.metadata?.authorRole as 'user' | 'assistant' | 'system' | undefined),
        },
      }]);

      // Commit the changes
      await commit('Edit in workspace');
      setViewMode('read');
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [content, editContent, setContent, commit]);

  const handleCancelEdit = useCallback(() => {
    setViewMode('read');
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (canRedo) redo();
        } else {
          e.preventDefault();
          if (canUndo) undo();
        }
      }
      // Cmd+E to toggle edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (viewMode === 'edit') {
          handleCancelEdit();
        } else if (content) {
          handleEnterEdit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, viewMode, content, handleCancelEdit, handleEnterEdit]);

  // Handle text selection for "Find Similar"
  const handleSelection = useCallback(() => {
    if (!onFindSimilar) return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      // Could show a floating toolbar here
    }
  }, [onFindSimilar]);

  // No content - show welcome screen
  if (!content) {
    return <WelcomeScreen />;
  }

  return (
    <div className="workspace" onMouseUp={handleSelection}>
      {/* Breadcrumb / Path */}
      {content.source?.path && (
        <nav className="workspace__breadcrumb">
          {content.source.path.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="workspace__breadcrumb-sep">&rsaquo;</span>}
              {p}
            </span>
          ))}
        </nav>
      )}

      {/* Workspace Header */}
      <div className="workspace__header">
        <div className="workspace__view-toggle" role="group" aria-label="View mode">
          <button
            className={`workspace__view-btn ${viewMode === 'read' ? 'workspace__view-btn--active' : ''}`}
            onClick={() => setViewMode('read')}
            aria-pressed={viewMode === 'read'}
          >
            Read
          </button>
          <button
            className={`workspace__view-btn ${viewMode === 'edit' ? 'workspace__view-btn--active' : ''}`}
            onClick={handleEnterEdit}
            aria-pressed={viewMode === 'edit'}
          >
            Edit
          </button>
          <span className="workspace__view-hint" aria-hidden="true">
            Cmd+E
          </span>
          {isDirty && (
            <span className="workspace__dirty-indicator" title="Unsaved changes">
              •
            </span>
          )}
        </div>

        <div className="workspace__actions">
          <button
            className="workspace__action-btn"
            onClick={async () => {
              await navigator.clipboard.writeText(content.text);
            }}
            title="Copy as plain text"
          >
            Copy
          </button>
          <button
            className="workspace__action-btn"
            onClick={() => {
              const blob = new Blob([content.text], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${content.title || 'content'}.md`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            title="Download as markdown"
          >
            Download
          </button>
          {onFindSimilar && (
            <button
              className="workspace__action-btn workspace__action-btn--primary"
              onClick={() => onFindSimilar(content.text)}
              title="Find similar content in archive"
            >
              Find Similar
            </button>
          )}
        </div>
      </div>

      {/* Content - Read or Edit Mode */}
      {viewMode === 'read' ? (
        <article className="workspace__article">
          <MathMarkdown>{content.text}</MathMarkdown>
          {content.metadata?.wordCount && (
            <div className="workspace__stats">
              <span className="workspace__stat">
                {content.metadata.wordCount.toLocaleString()} words
              </span>
              {content.metadata.authorRole && (
                <span className="workspace__stat">{content.metadata.authorRole}</span>
              )}
            </div>
          )}
        </article>
      ) : (
        <div className="workspace__editor-pane">
          <textarea
            className="workspace__editor"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Edit markdown content..."
          />
          <div className="workspace__editor-actions">
            <button
              className="workspace__editor-btn workspace__editor-btn--primary"
              onClick={handleApplyChanges}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Apply Changes'}
            </button>
            <button
              className="workspace__editor-btn workspace__editor-btn--secondary"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              Cancel
            </button>
            {canUndo && (
              <button
                className="workspace__editor-btn"
                onClick={undo}
                disabled={isSaving}
                title="Undo (Cmd+Z)"
              >
                Undo
              </button>
            )}
            {canRedo && (
              <button
                className="workspace__editor-btn"
                onClick={redo}
                disabled={isSaving}
                title="Redo (Cmd+Shift+Z)"
              >
                Redo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
