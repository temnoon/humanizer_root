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
          {/* Title and metadata panel */}
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <h1 className="heading-xl mb-2" style={{ color: 'var(--text-primary)' }}>
              {narrative.title}
            </h1>
            <div className="flex items-center gap-4 text-small" style={{ color: 'var(--text-tertiary)' }}>
              {narrative.metadata.createdAt && typeof narrative.metadata.createdAt === 'string' ? (
                <span>
                  {new Date(narrative.metadata.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              ) : null}
              {narrative.metadata.wordCount ? (
                <span>{narrative.metadata.wordCount.toLocaleString()} words</span>
              ) : null}
              {narrative.metadata.source && (
                <span>Source: {narrative.metadata.source}</span>
              )}
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center justify-end mb-8">
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
                  backgroundImage: originalViewMode === 'markdown' ? 'var(--accent-primary-gradient)' : 'none',
                  backgroundColor: originalViewMode === 'markdown' ? 'transparent' : 'var(--bg-secondary)',
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
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Title and metadata panel - spans full width */}
      <div
        className="mx-6 mt-6 mb-4 p-4 rounded-lg border"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <h1 className="heading-lg mb-2" style={{ color: 'var(--text-primary)' }}>
          {narrative.title}
        </h1>
        <div className="flex items-center gap-4 text-small" style={{ color: 'var(--text-tertiary)' }}>
          {narrative.metadata.createdAt && typeof narrative.metadata.createdAt === 'string' ? (
            <span>
              {new Date(narrative.metadata.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          ) : null}
          {narrative.metadata.wordCount ? (
            <span>{narrative.metadata.wordCount.toLocaleString()} words</span>
          ) : null}
          {narrative.metadata.source && (
            <span>Source: {narrative.metadata.source}</span>
          )}
        </div>
      </div>

      {/* Split panes container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
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
        <div style={{ padding: 'var(--space-xl)', paddingBottom: '120px' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
              {transformResult.metadata?.aiDetection ? 'AI Detection Analysis' : 'Transformed'}
            </h2>
            {!transformResult.metadata?.aiDetection && (
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
            )}
          </div>

          {/* AI Detection Results - MOVED TO TOP */}
          {transformResult.metadata?.aiDetection && (
            <div className="mb-8 space-y-6">
              {/* Verdict Badge */}
              <div className="text-center">
                <div
                  className="inline-block px-8 py-4 rounded-lg"
                  style={{
                    backgroundColor:
                      transformResult.metadata.aiDetection.verdict === 'ai'
                        ? 'var(--accent-red)'
                        : transformResult.metadata.aiDetection.verdict === 'human'
                        ? 'var(--accent-green)'
                        : 'var(--accent-yellow)',
                    color: 'white',
                  }}
                >
                  <div className="text-small mb-1" style={{ opacity: 0.9 }}>
                    Verdict
                  </div>
                  <div className="heading-lg font-bold uppercase">
                    {transformResult.metadata.aiDetection.verdict === 'ai'
                      ? '🤖 AI Generated'
                      : transformResult.metadata.aiDetection.verdict === 'human'
                      ? '✍️ Human Written'
                      : '🔀 Mixed/Uncertain'}
                  </div>
                </div>
              </div>

              {/* Confidence Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-small font-medium" style={{ color: 'var(--text-secondary)' }}>
                    AI Confidence
                  </span>
                  <span className="heading-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {(transformResult.metadata.aiDetection.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-4 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${transformResult.metadata.aiDetection.confidence * 100}%`,
                      backgroundColor:
                        transformResult.metadata.aiDetection.confidence > 0.7
                          ? 'var(--accent-red)'
                          : transformResult.metadata.aiDetection.confidence < 0.2
                          ? 'var(--accent-green)'
                          : 'var(--accent-yellow)',
                    }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
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
                    {transformResult.metadata.aiDetection.burstiness}/100
                  </div>
                  <div className="text-small mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {transformResult.metadata.aiDetection.burstiness > 60
                      ? 'Human-like variation'
                      : 'AI-like uniformity'}
                  </div>
                </div>

                <div
                  className="rounded-md"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="text-small mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Perplexity
                  </div>
                  <div className="heading-md" style={{ color: 'var(--text-primary)' }}>
                    {transformResult.metadata.aiDetection.perplexity}/100
                  </div>
                  <div className="text-small mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {transformResult.metadata.aiDetection.perplexity > 60
                      ? 'Varied vocabulary'
                      : 'Predictable patterns'}
                  </div>
                </div>
              </div>

              {/* Tell Words */}
              {transformResult.metadata.aiDetection.tellWords &&
                transformResult.metadata.aiDetection.tellWords.length > 0 && (
                  <div>
                    <div className="text-small font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                      AI Tell-Words Found ({transformResult.metadata.aiDetection.tellWords.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {transformResult.metadata.aiDetection.tellWords.map((word, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-full text-small"
                          style={{
                            backgroundColor: 'var(--accent-red)20',
                            color: 'var(--accent-red)',
                            border: '1px solid',
                            borderColor: 'var(--accent-red)40',
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Reasoning */}
              {transformResult.metadata.aiDetection.reasoning && (
                <div
                  className="rounded-md"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderLeft: '4px solid var(--accent-primary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="text-small font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Analysis
                  </div>
                  <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                    {transformResult.metadata.aiDetection.reasoning}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* User Guidance */}
          {transformResult.metadata?.userGuidance && transformResult.metadata.userGuidance.length > 0 && (
            <div className="mb-6 space-y-3">
              {transformResult.metadata.userGuidance.map((guidance, idx) => {
                const bgColor =
                  guidance.type === 'success' ? 'var(--success)' :
                  guidance.type === 'good' ? 'var(--accent-green)' :
                  guidance.type === 'warning' ? 'var(--accent-yellow)' :
                  'var(--accent-primary)';
                const borderColor =
                  guidance.type === 'success' ? 'var(--success)' :
                  guidance.type === 'good' ? 'var(--accent-green)' :
                  guidance.type === 'warning' ? 'var(--accent-yellow)' :
                  'var(--accent-secondary)';

                return (
                  <div
                    key={idx}
                    className="rounded-md"
                    style={{
                      backgroundColor: `${bgColor}20`,
                      borderLeft: `4px solid ${borderColor}`,
                      padding: 'var(--space-md)',
                    }}
                  >
                    <p className="text-body" style={{ color: 'var(--text-primary)' }}>
                      {guidance.message}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Content */}
          <div className="max-w-3xl">
            {transformedViewMode === 'rendered' ? (
              transformResult.metadata?.manualReviewSuggestions && transformResult.metadata.manualReviewSuggestions.length > 0 ? (
                <div className="prose" style={{ color: 'var(--text-primary)' }}>
                  {(() => {
                    // Highlight suspicious phrases in the transformed text
                    let highlightedText = transformResult.transformed;
                    const phrases = transformResult.metadata.manualReviewSuggestions;

                    // Sort phrases by length (longest first) to avoid partial replacements
                    const sortedPhrases = [...phrases].sort((a, b) => b.phrase.length - a.phrase.length);

                    // Replace each phrase with highlighted version
                    sortedPhrases.forEach((suggestion) => {
                      const phrase = suggestion.phrase;
                      const color = suggestion.severity === 'high' ? 'var(--accent-red)' :
                                   suggestion.severity === 'medium' ? 'var(--accent-yellow)' :
                                   'var(--accent-cyan)';

                      // Case-insensitive replacement with highlight
                      const regex = new RegExp(`\\b(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                      highlightedText = highlightedText.replace(
                        regex,
                        `<mark style="background-color: ${color}40; padding: 2px 4px; border-radius: 3px; border-bottom: 2px solid ${color};">$1</mark>`
                      );
                    });

                    return <div dangerouslySetInnerHTML={{ __html: highlightedText }} />;
                  })()}
                </div>
              ) : (
                <MarkdownRenderer content={transformResult.transformed} />
              )
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


          {/* Computer Humanizer Metrics */}
          {transformResult.metadata && !transformResult.metadata.aiDetection && (
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

          {/* Manual Review Suggestions */}
          {transformResult.metadata?.manualReviewSuggestions && transformResult.metadata.manualReviewSuggestions.length > 0 && (
            <div className="mt-8">
              <h3 className="heading-md mb-4" style={{ color: 'var(--text-primary)' }}>
                Manual Review Suggestions
              </h3>
              <div className="space-y-3">
                {transformResult.metadata.manualReviewSuggestions.map((suggestion, idx) => {
                  const severityColor =
                    suggestion.severity === 'high' ? 'var(--accent-red)' :
                    suggestion.severity === 'medium' ? 'var(--accent-yellow)' :
                    'var(--accent-cyan)';
                  const severityLabel =
                    suggestion.severity === 'high' ? 'High Priority' :
                    suggestion.severity === 'medium' ? 'Medium' :
                    'Low';

                  return (
                    <div
                      key={idx}
                      className="rounded-md"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        borderLeft: `4px solid ${severityColor}`,
                        padding: 'var(--space-md)',
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-mono text-body" style={{ color: 'var(--accent-primary)' }}>
                          "{suggestion.phrase}"
                        </div>
                        <span
                          className="text-small px-2 py-1 rounded"
                          style={{
                            backgroundColor: `${severityColor}20`,
                            color: severityColor,
                            fontSize: '0.75rem',
                          }}
                        >
                          {severityLabel}
                        </span>
                      </div>
                      <p className="text-small mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {suggestion.reason}
                      </p>
                      <p className="text-small" style={{ color: 'var(--text-tertiary)' }}>
                        💡 {suggestion.suggestion}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
