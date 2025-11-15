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
        className="flex-1 flex items-center justify-center p-8"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <p className="ui-text text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            No narrative selected
          </p>
          <p className="ui-text text-sm" style={{ color: 'var(--text-tertiary)' }}>
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
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          {/* View mode toggle */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {narrative.title}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (originalViewMode === 'markdown') {
                    handleCancelEdit();
                  } else {
                    setEditedContent(narrative.content);
                    setOriginalViewMode('markdown');
                  }
                }}
                className="ui-text px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-smooth"
                style={{
                  backgroundColor: originalViewMode === 'markdown' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: originalViewMode === 'markdown' ? 'var(--text-inverse)' : 'var(--text-primary)',
                }}
              >
                {originalViewMode === 'markdown' ? <Icons.Eye /> : <Icons.Edit />}
                {originalViewMode === 'markdown' ? 'Preview' : 'Edit'}
              </button>
              {originalViewMode === 'markdown' && (
                <button
                  onClick={handleSaveEdit}
                  className="ui-text px-3 py-1.5 rounded-md text-sm font-medium transition-smooth"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'white',
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
      <div className="flex-1 overflow-y-auto border-b md:border-b-0 md:border-r" style={{ borderColor: 'var(--border-color)' }}>
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="ui-text font-semibold text-lg" style={{ color: 'var(--text-secondary)' }}>
              Original
            </h2>
            <button
              onClick={() =>
                setOriginalViewMode((m) => (m === 'rendered' ? 'markdown' : 'rendered'))
              }
              className="ui-text px-3 py-1.5 rounded-md text-sm flex items-center gap-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
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
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="ui-text font-semibold text-lg" style={{ color: 'var(--text-secondary)' }}>
              Transformed
            </h2>
            <button
              onClick={() =>
                setTransformedViewMode((m) => (m === 'rendered' ? 'markdown' : 'rendered'))
              }
              className="ui-text px-3 py-1.5 rounded-md text-sm flex items-center gap-2"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
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
              className="mt-8 p-4 rounded-md"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderLeft: '4px solid var(--accent-secondary)',
              }}
            >
              <h3 className="ui-text font-semibold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
                Reflection
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {transformResult.reflection}
              </p>
            </div>
          )}

          {/* Metrics */}
          {transformResult.metadata && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {transformResult.metadata.aiConfidenceBefore !== undefined && (
                <div
                  className="p-3 rounded-md"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="ui-text text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    AI Confidence
                  </div>
                  <div className="ui-text text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {transformResult.metadata.aiConfidenceBefore}% → {transformResult.metadata.aiConfidenceAfter}%
                  </div>
                </div>
              )}
              {transformResult.metadata.burstinessBefore !== undefined && (
                <div
                  className="p-3 rounded-md"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="ui-text text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    Burstiness
                  </div>
                  <div className="ui-text text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
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
