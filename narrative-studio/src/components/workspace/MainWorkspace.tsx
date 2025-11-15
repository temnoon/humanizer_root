import { useState } from 'react';
import type { Narrative, TransformResult, ViewMode, WorkspaceMode } from '../../types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import { Icons } from '../layout/Icons';

interface MainWorkspaceProps {
  narrative: Narrative | null;
  transformResult: TransformResult | null;
  mode: WorkspaceMode;
  onUpdateNarrative: (content: string) => void;
}

export function MainWorkspace({
  narrative,
  transformResult,
  mode,
  onUpdateNarrative,
}: MainWorkspaceProps) {
  const [originalViewMode, setOriginalViewMode] = useState<ViewMode>('rendered');
  const [transformedViewMode, setTransformedViewMode] = useState<ViewMode>('rendered');
  const [editedContent, setEditedContent] = useState('');

  if (!narrative) {
    return (
      <main
        className="flex-1 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--bg-primary)',
          padding: 'var(--space-xl)',
        }}
      >
        <div className="text-center">
          <div
            className="mb-6"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <Icons.Eye />
          </div>
          <p className="heading-md mb-3" style={{ color: 'var(--text-secondary)' }}>
            No narrative selected
          </p>
          <p className="text-body" style={{ color: 'var(--text-tertiary)' }}>
            Select a narrative from the Archive to get started
          </p>
        </div>
      </main>
    );
  }

  const handleSaveEdit = () => {
    onUpdateNarrative(editedContent);
    setOriginalViewMode('rendered');
  };

  const handleCancelEdit = () => {
    setEditedContent('');
    setOriginalViewMode('rendered');
  };

  // Single pane mode
  if (mode === 'single' || !transformResult) {
    return (
      <main
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-5xl mx-auto" style={{ padding: 'var(--space-xl)' }}>
          {/* View mode toggle */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="heading-xl" style={{ color: 'var(--text-primary)' }}>
              {narrative.title}
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (originalViewMode === 'markdown') {
                    handleCancelEdit();
                  } else {
                    setEditedContent(narrative.content);
                    setOriginalViewMode('markdown');
                  }
                }}
                className="text-body px-4 rounded-md flex items-center gap-2 transition-smooth"
                style={{
                  backgroundColor: originalViewMode === 'markdown' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: originalViewMode === 'markdown' ? 'var(--text-inverse)' : 'var(--text-primary)',
                  padding: 'var(--space-sm) var(--space-md)',
                }}
              >
                {originalViewMode === 'markdown' ? <Icons.Eye /> : <Icons.Edit />}
                {originalViewMode === 'markdown' ? 'Preview' : 'Edit'}
              </button>
              {originalViewMode === 'markdown' && (
                <button
                  onClick={handleSaveEdit}
                  className="text-body font-medium rounded-md transition-smooth"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'white',
                    padding: 'var(--space-sm) var(--space-md)',
                  }}
                >
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {originalViewMode === 'rendered' ? (
            <MarkdownRenderer content={narrative.content} />
          ) : (
            <MarkdownEditor
              content={editedContent}
              onChange={setEditedContent}
              placeholder="Enter markdown content..."
            />
          )}
        </div>
      </main>
    );
  }

  // Split pane mode
  return (
    <main
      className="flex-1 flex flex-col md:flex-row overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Left pane: Original */}
      <div
        className="flex-1 overflow-y-auto border-b md:border-b-0 md:border-r"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div style={{ padding: 'var(--space-xl)' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
              Original
            </h2>
            <button
              onClick={() =>
                setOriginalViewMode((m) => (m === 'rendered' ? 'markdown' : 'rendered'))
              }
              className="text-body rounded-md flex items-center gap-2 transition-smooth"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                padding: 'var(--space-sm) var(--space-md)',
              }}
            >
              {originalViewMode === 'markdown' ? <Icons.Eye /> : <Icons.Edit />}
              {originalViewMode === 'markdown' ? 'Preview' : 'Edit'}
            </button>
          </div>

          {/* Content */}
          <div className="max-w-3xl">
            {originalViewMode === 'rendered' ? (
              <MarkdownRenderer content={narrative.content} />
            ) : (
              <MarkdownEditor
                content={editedContent || narrative.content}
                onChange={(content) => {
                  setEditedContent(content);
                  onUpdateNarrative(content);
                }}
                placeholder="Original content..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Right pane: Transformed */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ padding: 'var(--space-xl)' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
              Transformed
            </h2>
            <button
              onClick={() =>
                setTransformedViewMode((m) => (m === 'rendered' ? 'markdown' : 'rendered'))
              }
              className="text-body rounded-md flex items-center gap-2 transition-smooth"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                padding: 'var(--space-sm) var(--space-md)',
              }}
            >
              {transformedViewMode === 'markdown' ? <Icons.Eye /> : <Icons.Edit />}
              {transformedViewMode === 'markdown' ? 'Preview' : 'Source'}
            </button>
          </div>

          {/* Content */}
          <div className="max-w-3xl">
            {transformedViewMode === 'rendered' ? (
              <MarkdownRenderer content={transformResult.transformed} />
            ) : (
              <MarkdownEditor
                content={transformResult.transformed}
                onChange={() => {}}
                placeholder="Transformed content..."
              />
            )}
          </div>

          {/* Reflection/Metadata */}
          {transformResult.reflection && (
            <div
              className="mt-8 rounded-md"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderLeft: '4px solid var(--accent-secondary)',
                padding: 'var(--space-md)',
              }}
            >
              <h3 className="text-small font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Reflection
              </h3>
              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                {transformResult.reflection}
              </p>
            </div>
          )}

          {/* Metrics */}
          {transformResult.metadata && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {transformResult.metadata.aiConfidenceBefore !== undefined && (
                <div
                  className="rounded-md"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="text-small mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    AI Confidence
                  </div>
                  <div className="heading-md" style={{ color: 'var(--text-primary)' }}>
                    {transformResult.metadata.aiConfidenceBefore}% → {transformResult.metadata.aiConfidenceAfter}%
                  </div>
                </div>
              )}
              {transformResult.metadata.burstinessBefore !== undefined && (
                <div
                  className="rounded-md"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="text-small mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Burstiness
                  </div>
                  <div className="heading-md" style={{ color: 'var(--text-primary)' }}>
                    {transformResult.metadata.burstinessBefore} → {transformResult.metadata.burstinessAfter}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
