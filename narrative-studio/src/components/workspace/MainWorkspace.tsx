import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Narrative, TransformResult, ViewMode, WorkspaceMode } from '../../types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import { Icons } from '../layout/Icons';
import { stripMarkdown } from '../../services/transformationService';
import { useSession } from '../../contexts/SessionContext';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { BufferTabs } from './BufferTabs';
import { BufferSelector } from './BufferSelector';
import { ViewModeToggle } from './ViewModeToggle';
import { BUFFER_IDS } from '../../config/buffer-constants';
import { VIEW_MODES, DEFAULT_VIEW_MODE } from '../../config/view-modes';
import { STORAGE_PATHS } from '../../config/storage-paths';

// New extracted components and hooks
import { useWorkspaceState } from './hooks/useWorkspaceState';
import { WorkspaceCompareView } from './WorkspaceCompareView';
import type { HighlightRange } from './WorkspaceContentPane';

interface MainWorkspaceProps {
  narrative: Narrative | null;
  transformResult: TransformResult | null;
  mode: WorkspaceMode;
  viewPreference: 'split' | 'tabs';
  onUpdateNarrative: (content: string) => void;
  selectedText: { text: string; start: number; end: number } | null;
  onTextSelection: (selection: { text: string; start: number; end: number } | null) => void;
  aiAnalysisHighlights?: HighlightRange[];
}

export function MainWorkspace({
  narrative,
  transformResult,
  mode,
  viewPreference,
  onUpdateNarrative,
  selectedText,
  onTextSelection,
  aiAnalysisHighlights = [],
}: MainWorkspaceProps) {
  // Session context for buffer-based workflow (legacy)
  const {
    buffers,
    activeBufferId,
    setActiveBuffer,
    closeBuffer,
    currentSession,
    updateViewMode,
    hasSession,
    updateBufferText,
    loadSession
  } = useSession();

  // NEW: Use extracted workspace state hook (with debugging enabled)
  const {
    hasWorkspace,
    activeWorkspace,
    workspaceActiveBuffer,
    workspaceCompareBuffer,
    bufferTree,
    workspaceContent,
    workspaceCompareMode,
    handleToggleCompareMode,
    handleWorkspaceBufferSelect,
    workspaceContext,
  } = useWorkspaceState({ debug: true });

  // Unified buffer context for paste-to-workspace functionality
  const { createFromText, setWorkingBuffer } = useUnifiedBuffer();

  // Paste/drop state for empty workspace
  const [isDragging, setIsDragging] = useState(false);

  // Local state (legacy for non-session workflow)
  const [originalViewMode, setOriginalViewMode] = useState<ViewMode>('rendered');
  const [transformedViewMode, setTransformedViewMode] = useState<ViewMode>('rendered');
  const [editedContent, setEditedContent] = useState('');
  const [activeTab, setActiveTab] = useState<'original' | 'transformed'>('original');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs for scrollable containers to reset scroll position
  const singlePaneRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // Reload current session from disk
  const handleReloadSession = async () => {
    if (currentSession) {
      await loadSession(currentSession.sessionId);
      setToastMessage('Session reloaded from disk');
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  // Get active buffer content (session-aware)
  const getActiveBufferContent = () => {
    if (!hasSession || buffers.length === 0) {
      return null;
    }
    const activeBuffer = buffers.find(b => b.bufferId === activeBufferId);
    return activeBuffer || null;
  };

  // Get original buffer (buffer-0)
  const getOriginalBuffer = () => {
    if (!hasSession || buffers.length === 0) {
      return null;
    }
    return buffers.find(b => b.bufferId === BUFFER_IDS.ORIGINAL) || buffers[0];
  };

  // Determine if we should use session-based rendering
  const useSessionRendering = hasSession && buffers.length > 0;

  // Get current view mode (session or legacy)
  const currentViewMode = useSessionRendering && currentSession
    ? currentSession.viewMode
    : DEFAULT_VIEW_MODE; // default for legacy

  // Helper: Get text from buffer (handles both text and resultText properties)
  const getBufferText = (buffer: any): string => {
    if (!buffer) return '';
    // Original buffers use 'text', transformation/analysis buffers use 'resultText'
    // After editing, both types may have 'text' set (overriding resultText)
    return buffer.text || buffer.resultText || '';
  };

  // Get display content based on view mode
  const getDisplayContent = () => {
    if (!useSessionRendering) {
      // Legacy: use narrative and transformResult
      return {
        original: narrative?.content || '',
        transformed: transformResult?.transformed || '',
        hasTransformed: !!transformResult
      };
    }

    // Session-based: use buffers
    const originalBuffer = getOriginalBuffer();
    const activeBuffer = getActiveBufferContent();

    console.log('[MainWorkspace] getDisplayContent:', {
      viewMode: currentViewMode,
      activeBufferId,
      activeBufferName: activeBuffer?.displayName,
      originalBufferName: originalBuffer?.displayName,
      activeBufferText: activeBuffer?.text,
      activeBufferResultText: activeBuffer?.resultText
    });

    if (currentViewMode === VIEW_MODES.SINGLE_ORIGINAL) {
      return {
        original: getBufferText(originalBuffer),
        transformed: '',
        hasTransformed: false
      };
    } else if (currentViewMode === VIEW_MODES.SINGLE_TRANSFORMED) {
      return {
        original: '',
        transformed: getBufferText(activeBuffer),
        hasTransformed: true
      };
    } else {
      // split mode
      return {
        original: getBufferText(originalBuffer),
        transformed: getBufferText(activeBuffer) || getBufferText(originalBuffer),
        hasTransformed: activeBuffer?.bufferId !== BUFFER_IDS.ORIGINAL
      };
    }
  };

  const displayContent = getDisplayContent();

  // workspaceContent and handleWorkspaceBufferSelect are now provided by useWorkspaceState hook

  // Handle text editing with session-aware edit tracking
  const handleContentChange = (newContent: string) => {
    if (useSessionRendering && activeBufferId) {
      // Session mode: Track edits in buffer
      const activeBuffer = buffers.find(b => b.bufferId === activeBufferId);
      const oldContent = activeBuffer?.text || activeBuffer?.resultText || '';

      // Update buffer with edit tracking
      updateBufferText(activeBufferId, newContent, oldContent);

      console.log('[MainWorkspace] Tracked edit in buffer:', activeBufferId);
    } else {
      // Legacy mode: Update narrative directly
      onUpdateNarrative(newContent);
    }
  };

  // Reset scroll position when narrative changes, or scroll to specific image
  useEffect(() => {
    if (narrative) {
      // Check if we should scroll to a specific image
      const scrollToImageUrl = narrative.metadata?.scrollToImageUrl as string | undefined;

      if (scrollToImageUrl) {
        // Wait for images to load, then scroll to the target image
        setTimeout(() => {
          const container = singlePaneRef.current || leftPaneRef.current;
          if (container) {
            // Find all images in the content
            const images = container.querySelectorAll('img');
            const targetImage = Array.from(images).find(img =>
              img.src.includes(encodeURIComponent(scrollToImageUrl))
            );

            if (targetImage) {
              // Scroll the image into view with some offset
              targetImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
              console.log('Scrolled to image:', scrollToImageUrl);
            }
          }
        }, 500); // Give images time to render
      } else {
        // Default: scroll to top
        if (singlePaneRef.current) {
          singlePaneRef.current.scrollTop = 0;
        }
        if (leftPaneRef.current) {
          leftPaneRef.current.scrollTop = 0;
        }
        if (rightPaneRef.current) {
          rightPaneRef.current.scrollTop = 0;
        }
      }
    }
  }, [narrative?.id, narrative?.metadata?.scrollToImageUrl]); // Run when narrative ID or scroll hint changes

  // Handle paste event for empty workspace - allows pasting text directly
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text && text.trim()) {
      e.preventDefault();
      // Determine format based on content
      const hasMarkdown = /^#{1,6}\s|\*\*|__|\[.*\]\(.*\)|```/.test(text);
      const format = hasMarkdown ? 'markdown' : 'plain';

      // Create buffer and set as working
      const buffer = createFromText(text, format);
      setWorkingBuffer(buffer);
      console.log('[MainWorkspace] Pasted content to workspace:', buffer.displayName);
    }
  }, [createFromText, setWorkingBuffer]);

  // Handle file drop for empty workspace
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const textFile = files.find(f =>
      f.name.endsWith('.txt') || f.name.endsWith('.md')
    );

    if (textFile) {
      try {
        const text = await textFile.text();
        const hasMarkdown = /^#{1,6}\s|\*\*|__|\[.*\]\(.*\)|```/.test(text);
        const format = hasMarkdown ? 'markdown' : 'plain';

        const buffer = createFromText(text, format);
        // Use filename (without extension) as display name
        const baseName = textFile.name.replace(/\.[^/.]+$/, '');
        buffer.displayName = baseName;

        setWorkingBuffer(buffer);
        console.log('[MainWorkspace] Dropped file to workspace:', buffer.displayName);
      } catch (err) {
        console.error('Failed to read dropped file:', err);
      }
    } else {
      // Check for plain text in drag data
      const text = e.dataTransfer.getData('text');
      if (text && text.trim()) {
        const hasMarkdown = /^#{1,6}\s|\*\*|__|\[.*\]\(.*\)|```/.test(text);
        const format = hasMarkdown ? 'markdown' : 'plain';

        const buffer = createFromText(text, format);
        setWorkingBuffer(buffer);
        console.log('[MainWorkspace] Dropped text to workspace:', buffer.displayName);
      }
    }
  }, [createFromText, setWorkingBuffer]);

  // Workspace buffer view - show when workspace is active even without a narrative
  if (hasWorkspace && workspaceActiveBuffer && !narrative) {
    return (
      <main
        className="flex-1 flex flex-col"
        style={{
          backgroundColor: 'var(--bg-primary)',
          minHeight: 0,
        }}
      >
        {/* Workspace Buffer Comparison Toolbar */}
        <div className="workspace-buffer-toolbar">
          <div className="workspace-buffer-toolbar__left">
            <BufferSelector
              label="Compare"
              selectedBuffer={workspaceCompareBuffer || null}
              bufferTree={bufferTree || null}
              onSelect={(id) => handleWorkspaceBufferSelect(id, true)}
              excludeId={workspaceActiveBuffer.id}
              allowClear={true}
              placeholder="Select to compare..."
            />
            {workspaceCompareBuffer && (
              <span className="workspace-buffer-toolbar__stats">
                {workspaceContent.leftWordCount.toLocaleString()} words
                {workspaceCompareBuffer.analysis?.aiScore !== undefined && (
                  <span className={`workspace-buffer-toolbar__score ${
                    workspaceCompareBuffer.analysis.aiScore <= 30 ? 'workspace-buffer-toolbar__score--good' :
                    workspaceCompareBuffer.analysis.aiScore <= 60 ? 'workspace-buffer-toolbar__score--warning' :
                    'workspace-buffer-toolbar__score--high'
                  }`}>
                    {Math.round(workspaceCompareBuffer.analysis.aiScore)}% AI
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="workspace-buffer-toolbar__center">
            {workspaceContent.aiScoreDelta !== null && (
              <span className={`workspace-buffer-toolbar__delta ${
                workspaceContent.aiScoreDelta < 0 ? 'workspace-buffer-toolbar__delta--good' :
                workspaceContent.aiScoreDelta > 0 ? 'workspace-buffer-toolbar__delta--bad' : ''
              }`}>
                {workspaceContent.aiScoreDelta > 0 ? '+' : ''}{workspaceContent.aiScoreDelta.toFixed(1)}% AI
              </span>
            )}
            <button
              className={`workspace-buffer-toolbar__toggle ${!workspaceCompareMode ? 'workspace-buffer-toolbar__toggle--active' : ''}`}
              onClick={handleToggleCompareMode}
              title={workspaceCompareMode ? 'Show single pane' : 'Show comparison'}
            >
              {workspaceCompareMode ? '◧' : '▣'}
            </button>
          </div>

          <div className="workspace-buffer-toolbar__right">
            <BufferSelector
              label="Active"
              selectedBuffer={workspaceActiveBuffer}
              bufferTree={bufferTree || null}
              onSelect={(id) => handleWorkspaceBufferSelect(id, false)}
              excludeId={workspaceCompareBuffer?.id}
            />
            <span className="workspace-buffer-toolbar__stats">
              {workspaceContent.rightWordCount.toLocaleString()} words
              {workspaceActiveBuffer.analysis?.aiScore !== undefined && (
                <span className={`workspace-buffer-toolbar__score ${
                  workspaceActiveBuffer.analysis.aiScore <= 30 ? 'workspace-buffer-toolbar__score--good' :
                  workspaceActiveBuffer.analysis.aiScore <= 60 ? 'workspace-buffer-toolbar__score--warning' :
                  'workspace-buffer-toolbar__score--high'
                }`}>
                  {Math.round(workspaceActiveBuffer.analysis.aiScore)}% AI
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Workspace name header */}
        <div className="flex justify-center w-full">
          <div
            className="mx-6 mt-6 mb-4 p-4 rounded-lg w-full max-w-5xl"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h1 className="heading-lg mb-2 u-text-primary">
              {activeWorkspace?.name || 'Workspace'}
            </h1>
            <div className="flex items-center gap-4 text-small u-text-tertiary">
              <span>{Object.keys(activeWorkspace?.buffers || {}).length} versions</span>
              <span>•</span>
              <span>Active: {workspaceActiveBuffer.displayName}</span>
            </div>
          </div>
        </div>

        {/* Workspace Buffer Content */}
        {workspaceCompareMode && workspaceCompareBuffer ? (
          /* Side-by-side workspace comparison */
          <div className="hidden md:flex flex-1 flex-col md:flex-row u-flex-fill">
            {/* Left pane: Compare buffer */}
            <div
              ref={leftPaneRef}
              className="flex-1 md-border-switch flex flex-col"
              style={{
                borderRight: '1px solid var(--border-color)',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-5xl u-content-center">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceCompareBuffer.displayName || 'Compare'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.left || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.left || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer
                      content={workspaceContent.left || ''}
                      highlights={workspaceCompareBuffer?.analysis?.highlights}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right pane: Active buffer */}
            <div
              ref={rightPaneRef}
              className="flex-1 flex flex-col"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-5xl u-content-center">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceActiveBuffer.displayName || 'Active'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    {/* Use MarkdownRenderer with optional highlights prop for proper rendering */}
                    <MarkdownRenderer
                      content={workspaceContent.right || ''}
                      highlights={aiAnalysisHighlights.length > 0
                        ? aiAnalysisHighlights
                        : workspaceActiveBuffer?.analysis?.highlights}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Single pane: Active buffer only */
          <div className="flex-1 flex u-flex-fill">
            <div
              ref={singlePaneRef}
              className="flex-1 flex flex-col"
              style={{
                minHeight: 0,
                overflow: 'hidden',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-5xl u-content-center">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceActiveBuffer.displayName || 'Active Buffer'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    {/* Use MarkdownRenderer with optional highlights prop for proper rendering */}
                    <MarkdownRenderer
                      content={workspaceContent.right || ''}
                      highlights={aiAnalysisHighlights.length > 0
                        ? aiAnalysisHighlights
                        : workspaceActiveBuffer?.analysis?.highlights}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast notification */}
        {toastMessage && (
          <div className="toast">
            <Icons.Check />
            {toastMessage}
          </div>
        )}
      </main>
    );
  }

  // No workspace and no narrative - show empty state with paste/drop zone
  if (!narrative) {
    return (
      <main
        className="workspace__empty u-bg-primary"
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0} // Make focusable to receive paste events
      >
        <div className={`workspace__drop-zone ${isDragging ? 'workspace__drop-zone--active' : ''}`}>
          <div
            className="workspace__drop-icon"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: isDragging ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDragging ? (
              <Icons.Upload />
            ) : (
              <Icons.Eye />
            )}
          </div>
          <p className={`workspace__drop-title ${isDragging ? 'u-text-accent' : ''}`}>
            {isDragging ? 'Drop to import' : 'Start your narrative'}
          </p>
          <p className="workspace__drop-subtitle">
            {isDragging ? 'Drop your text file here' : (
              <>
                <strong className="u-text-secondary">Paste</strong> text (Ctrl+V) or{' '}
                <strong className="u-text-secondary">drop</strong> a .txt/.md file
              </>
            )}
          </p>
          <p className="workspace__drop-hint">
            Or use the 📥 Import tab in the Archive panel
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

  // Copy to clipboard with toast notification
  const copyToClipboard = async (text: string, format: 'plain' | 'markdown') => {
    try {
      const content = format === 'plain' ? stripMarkdown(text) : text;
      await navigator.clipboard.writeText(content);
      setToastMessage(format === 'plain' ? 'Plain text copied!' : 'Markdown copied!');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setToastMessage('Failed to copy');
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  // Handle text selection for scoped transformations
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString();
      const range = selection.getRangeAt(0);
      onTextSelection({
        text,
        start: range.startOffset,
        end: range.endOffset,
      });
    }
  };

  // Media props for MarkdownRenderer - extract from narrative metadata
  const mediaProps = narrative?.metadata ? {
    mediaManifest: narrative.metadata.mediaManifest as import('../../types').MediaManifest | undefined,
    mediaBaseUrl: narrative.metadata.mediaBaseUrl ?
      `${STORAGE_PATHS.archiveServerUrl}${narrative.metadata.mediaBaseUrl}` : undefined,
  } : {};

  // When workspace is active WITH a narrative, use workspace comparison view
  // This takes priority over the legacy single/split mode
  if (hasWorkspace && workspaceActiveBuffer && narrative) {
    return (
      <main
        className="flex-1 flex flex-col"
        style={{
          backgroundColor: 'var(--bg-primary)',
          minHeight: 0,
        }}
      >
        {/* Workspace Buffer Comparison Toolbar */}
        <div className="workspace-buffer-toolbar">
          <div className="workspace-buffer-toolbar__left">
            <BufferSelector
              label="Compare"
              selectedBuffer={workspaceCompareBuffer || null}
              bufferTree={bufferTree || null}
              onSelect={(id) => handleWorkspaceBufferSelect(id, true)}
              excludeId={workspaceActiveBuffer.id}
              allowClear={true}
              placeholder="Select to compare..."
            />
            {workspaceCompareBuffer && (
              <span className="workspace-buffer-toolbar__stats">
                {workspaceContent.leftWordCount.toLocaleString()} words
                {workspaceCompareBuffer.analysis?.aiScore !== undefined && (
                  <span className={`workspace-buffer-toolbar__score ${
                    workspaceCompareBuffer.analysis.aiScore <= 30 ? 'workspace-buffer-toolbar__score--good' :
                    workspaceCompareBuffer.analysis.aiScore <= 60 ? 'workspace-buffer-toolbar__score--warning' :
                    'workspace-buffer-toolbar__score--high'
                  }`}>
                    {Math.round(workspaceCompareBuffer.analysis.aiScore)}% AI
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="workspace-buffer-toolbar__center">
            {workspaceContent.aiScoreDelta !== null && (
              <span className={`workspace-buffer-toolbar__delta ${
                workspaceContent.aiScoreDelta < 0 ? 'workspace-buffer-toolbar__delta--good' :
                workspaceContent.aiScoreDelta > 0 ? 'workspace-buffer-toolbar__delta--bad' : ''
              }`}>
                {workspaceContent.aiScoreDelta > 0 ? '+' : ''}{workspaceContent.aiScoreDelta.toFixed(1)}% AI
              </span>
            )}
            <button
              className={`workspace-buffer-toolbar__toggle ${!workspaceCompareMode ? 'workspace-buffer-toolbar__toggle--active' : ''}`}
              onClick={handleToggleCompareMode}
              title={workspaceCompareMode ? 'Show single pane' : 'Show comparison'}
            >
              {workspaceCompareMode ? '◧' : '▣'}
            </button>
          </div>

          <div className="workspace-buffer-toolbar__right">
            <BufferSelector
              label="Active"
              selectedBuffer={workspaceActiveBuffer}
              bufferTree={bufferTree || null}
              onSelect={(id) => handleWorkspaceBufferSelect(id, false)}
              excludeId={workspaceCompareBuffer?.id}
            />
            <span className="workspace-buffer-toolbar__stats">
              {workspaceContent.rightWordCount.toLocaleString()} words
              {workspaceActiveBuffer.analysis?.aiScore !== undefined && (
                <span className={`workspace-buffer-toolbar__score ${
                  workspaceActiveBuffer.analysis.aiScore <= 30 ? 'workspace-buffer-toolbar__score--good' :
                  workspaceActiveBuffer.analysis.aiScore <= 60 ? 'workspace-buffer-toolbar__score--warning' :
                  'workspace-buffer-toolbar__score--high'
                }`}>
                  {Math.round(workspaceActiveBuffer.analysis.aiScore)}% AI
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Workspace name header */}
        <div className="flex justify-center w-full">
          <div
            className="mx-6 mt-4 mb-2 p-3 rounded-lg w-full max-w-5xl"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h1 className="heading-lg u-text-primary">
              {narrative.title}
            </h1>
            <div className="flex items-center gap-4 text-small mt-1 u-text-tertiary">
              <span>{Object.keys(activeWorkspace?.buffers || {}).length} versions</span>
              <span>•</span>
              <span>{workspaceActiveBuffer.displayName}</span>
            </div>
          </div>
        </div>

        {/* Workspace Buffer Content */}
        {workspaceCompareMode && workspaceCompareBuffer ? (
          /* Side-by-side workspace comparison */
          <div className="flex-1 flex flex-col md:flex-row u-flex-fill">
            {/* Left pane: Compare buffer */}
            <div
              ref={leftPaneRef}
              className="flex-1 md:border-r flex flex-col"
              style={{
                borderColor: 'var(--border-color)',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-4xl u-content-narrow">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceCompareBuffer.displayName || 'Compare'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.left || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.left || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer content={workspaceContent.left || ''} {...mediaProps} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right pane: Active buffer */}
            <div
              ref={rightPaneRef}
              className="flex-1 flex flex-col"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-4xl u-content-narrow">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceActiveBuffer.displayName || 'Active'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer content={workspaceContent.right || ''} {...mediaProps} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Single pane: Active buffer only */
          <div className="flex-1 flex u-flex-fill">
            <div
              ref={singlePaneRef}
              className="flex-1 flex flex-col"
              style={{
                minHeight: 0,
                overflow: 'hidden',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-4xl u-content-narrow">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceActiveBuffer.displayName || 'Active Buffer'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer content={workspaceContent.right || ''} {...mediaProps} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast notification */}
        {toastMessage && (
          <div className="toast">
            <Icons.Check />
            {toastMessage}
          </div>
        )}
      </main>
    );
  }

  // Single pane mode (legacy - no workspace)
  if (mode === 'single' || !transformResult) {
    return (
      <main
        ref={singlePaneRef}
        className="flex-1 overflow-y-auto flex flex-col items-center"
        style={{
          backgroundColor: 'var(--bg-primary)',
          minHeight: 0,
        }}
      >
        <div className="w-full max-w-5xl" style={{ padding: 'var(--space-xl)' }}>
          {/* Title and metadata panel */}
          <div
            className="mb-6 p-4 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <h1 className="heading-xl u-text-primary">
                {narrative.title}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(narrative.content, 'plain')}
                  title="Copy as plain text"
                >
                  <Icons.Copy /> Text
                </button>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(narrative.content, 'markdown')}
                  title="Copy as markdown"
                >
                  <Icons.Code /> MD
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-small u-text-tertiary">
              {narrative.createdAt && (
                <span>
                  Created {new Date(narrative.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
              {narrative.updatedAt && narrative.createdAt !== narrative.updatedAt && (
                <span>
                  • Last message {new Date(narrative.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {narrative.metadata.wordCount ? (
                <span>• {narrative.metadata.wordCount.toLocaleString()} words</span>
              ) : null}
              {narrative.metadata.source && (
                <span>• Source: {narrative.metadata.source}</span>
              )}
            </div>
          </div>

          {/* AI Detection Results - Show inline when detection exists */}
          {transformResult?.metadata?.aiDetection ? (
            <>
              {/* Analysis Results Panel */}
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
                    <span className="text-small font-medium u-text-secondary">
                      AI Confidence
                    </span>
                    <span className="heading-lg font-bold u-text-primary">
                      {transformResult.metadata.aiDetection.confidence.toFixed(3)}%
                    </span>
                  </div>
                  <div
                    className="h-4 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${transformResult.metadata.aiDetection.confidence}%`,
                        backgroundColor:
                          transformResult.metadata.aiDetection.confidence > 70
                            ? 'var(--accent-red)'
                            : transformResult.metadata.aiDetection.confidence < 20
                            ? 'var(--accent-green)'
                            : 'var(--accent-yellow)',
                      }}
                    />
                  </div>
                </div>

                {/* GPTZero Premium - Show count of flagged sentences */}
                {transformResult.metadata.aiDetection.method === 'gptzero' &&
                  (transformResult.metadata.aiDetection.highlightedSentences?.length ?? 0) > 0 && (
                  <div
                    className="rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: 'var(--space-md)',
                    }}
                  >
                    <div className="text-small mb-2 u-text-tertiary">
                      AI-Flagged Sentences
                    </div>
                    <div className="heading-md" style={{ color: 'var(--accent-red)' }}>
                      {transformResult.metadata.aiDetection.highlightedSentences?.length ?? 0} sentences flagged
                    </div>
                    <div className="text-small mt-1 u-text-tertiary">
                      Highlighted in red below
                    </div>
                  </div>
                )}

                {/* Tell Words for Lite Detector */}
                {transformResult.metadata.aiDetection.tellWords &&
                  transformResult.metadata.aiDetection.tellWords.length > 0 && (
                    <div>
                      <div className="text-small font-medium mb-3 u-text-secondary">
                        AI Tell-Words Found ({transformResult.metadata.aiDetection.tellWords.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {transformResult.metadata.aiDetection.tellWords
                          .filter(w => w && w.word && typeof w.word === 'string')
                          .map((wordObj, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-small"
                            style={{
                              backgroundColor: 'var(--accent-yellow)20',
                              color: 'var(--accent-yellow)',
                              border: '1px solid var(--accent-yellow)40',
                            }}
                          >
                            {wordObj.word}
                          </span>
                        ))}
                      </div>
                      <div className="text-small mt-2 u-text-tertiary">
                        Highlighted in amber below
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
                    <div className="text-small font-semibold mb-2 u-text-primary">
                      Analysis
                    </div>
                    <p className="text-body u-text-secondary">
                      {transformResult.metadata.aiDetection.reasoning}
                    </p>
                  </div>
                )}
              </div>

              {/* Original Text with Inline Highlights */}
              <div className="prose max-w-none u-text-primary">
                {transformResult.metadata.aiDetection.highlightedMarkdown ? (
                  // Use pre-highlighted markdown from API (preserves markdown formatting + highlights)
                  <MarkdownRenderer content={transformResult.metadata.aiDetection.highlightedMarkdown} />
                ) : transformResult.metadata.aiDetection.method === 'gptzero' &&
                (transformResult.metadata.aiDetection.highlightedSentences?.length ?? 0) > 0 ? (
                  // GPTZero: Fallback to manual highlighting if API didn't provide highlightedMarkdown
                  <div className="gptzero-highlighted-text">
                    {(() => {
                      let highlightedText = narrative.content;
                      const sentences = transformResult.metadata.aiDetection.highlightedSentences ?? [];
                      const sortedSentences = [...sentences].sort((a, b) => b.length - a.length);
                      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                      sortedSentences.forEach((sentence) => {
                        const escapedSentence = escapeRegex(sentence);
                        const regex = new RegExp(`(${escapedSentence})`, 'gi');
                        highlightedText = highlightedText.replace(
                          regex,
                          `<mark class="gptzero-highlight">$1</mark>`
                        );
                      });

                      return <div dangerouslySetInnerHTML={{ __html: highlightedText }} />;
                    })()}
                  </div>
                ) : transformResult.metadata.aiDetection.tellWords?.length > 0 ? (
                  // Lite Detector: Fallback to manual highlighting
                  <div className="lite-highlighted-text">
                    {(() => {
                      let highlightedText = narrative.content;
                      const tellWords = transformResult.metadata.aiDetection.tellWords;
                      // Filter out invalid entries and sort by word length
                      const sortedWords = [...tellWords]
                        .filter(w => w && w.word && typeof w.word === 'string')
                        .sort((a, b) => b.word.length - a.word.length);
                      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                      sortedWords.forEach((wordObj) => {
                        const escapedWord = escapeRegex(wordObj.word);
                        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
                        highlightedText = highlightedText.replace(
                          regex,
                          `<mark class="lite-highlight">$1</mark>`
                        );
                      });

                      return <div dangerouslySetInnerHTML={{ __html: highlightedText }} />;
                    })()}
                  </div>
                ) : (
                  // No highlights available, show original
                  <MarkdownRenderer content={narrative.content} {...mediaProps} />
                )}
              </div>
            </>
          ) : (
            <>
              {/* View mode toggle - Only show when NOT in AI detection mode */}
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

              {/* Selection banner */}
              {selectedText && (
                <div className="selection-banner">
                  <Icons.Highlight />
                  <span className="word-count">
                    {selectedText.text.split(/\s+/).filter(Boolean).length} words selected
                  </span>
                  <button onClick={() => onTextSelection(null)}>Clear</button>
                </div>
              )}

              {/* Content - Normal view with optional AI highlights */}
              <div onMouseUp={handleTextSelection}>
                {originalViewMode === 'rendered' ? (
                  <MarkdownRenderer
                    content={narrative.content}
                    {...mediaProps}
                    highlights={aiAnalysisHighlights.length > 0 ? aiAnalysisHighlights : undefined}
                  />
                ) : (
                  <MarkdownEditor
                    content={editedContent}
                    onChange={setEditedContent}
                    placeholder="Enter markdown content..."
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Toast notification */}
        {toastMessage && (
          <div className="toast">
            <Icons.Check />
            {toastMessage}
          </div>
        )}
      </main>
    );
  }

  // Split pane mode
  return (
    <main
      className="flex-1 flex flex-col"
      style={{
        backgroundColor: 'var(--bg-primary)',
        minHeight: 0,
      }}
    >
      {/* Buffer Tabs - Only show when session has buffers (legacy) */}
      {useSessionRendering && !hasWorkspace && (
        <BufferTabs
          buffers={buffers}
          activeBufferId={activeBufferId}
          onSelectBuffer={setActiveBuffer}
          onCloseBuffer={closeBuffer}
        />
      )}

      {/* Workspace Buffer Comparison Toolbar - Show when workspace is active */}
      {hasWorkspace && workspaceActiveBuffer && (
        <div className="workspace-buffer-toolbar">
          <div className="workspace-buffer-toolbar__left">
            <BufferSelector
              label="Compare"
              selectedBuffer={workspaceCompareBuffer || null}
              bufferTree={bufferTree || null}
              onSelect={(id) => handleWorkspaceBufferSelect(id, true)}
              excludeId={workspaceActiveBuffer.id}
              allowClear={true}
              placeholder="Select to compare..."
            />
            {workspaceCompareBuffer && (
              <span className="workspace-buffer-toolbar__stats">
                {workspaceContent.leftWordCount.toLocaleString()} words
                {workspaceCompareBuffer.analysis?.aiScore !== undefined && (
                  <span className={`workspace-buffer-toolbar__score ${
                    workspaceCompareBuffer.analysis.aiScore <= 30 ? 'workspace-buffer-toolbar__score--good' :
                    workspaceCompareBuffer.analysis.aiScore <= 60 ? 'workspace-buffer-toolbar__score--warning' :
                    'workspace-buffer-toolbar__score--high'
                  }`}>
                    {Math.round(workspaceCompareBuffer.analysis.aiScore)}% AI
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="workspace-buffer-toolbar__center">
            {workspaceContent.aiScoreDelta !== null && (
              <span className={`workspace-buffer-toolbar__delta ${
                workspaceContent.aiScoreDelta < 0 ? 'workspace-buffer-toolbar__delta--good' :
                workspaceContent.aiScoreDelta > 0 ? 'workspace-buffer-toolbar__delta--bad' : ''
              }`}>
                {workspaceContent.aiScoreDelta > 0 ? '+' : ''}{workspaceContent.aiScoreDelta.toFixed(1)}% AI
              </span>
            )}
            <button
              className={`workspace-buffer-toolbar__toggle ${!workspaceCompareMode ? 'workspace-buffer-toolbar__toggle--active' : ''}`}
              onClick={handleToggleCompareMode}
              title={workspaceCompareMode ? 'Show single pane' : 'Show comparison'}
            >
              {workspaceCompareMode ? '◧' : '▣'}
            </button>
          </div>

          <div className="workspace-buffer-toolbar__right">
            <BufferSelector
              label="Active"
              selectedBuffer={workspaceActiveBuffer}
              bufferTree={bufferTree || null}
              onSelect={(id) => handleWorkspaceBufferSelect(id, false)}
              excludeId={workspaceCompareBuffer?.id}
            />
            <span className="workspace-buffer-toolbar__stats">
              {workspaceContent.rightWordCount.toLocaleString()} words
              {workspaceActiveBuffer.analysis?.aiScore !== undefined && (
                <span className={`workspace-buffer-toolbar__score ${
                  workspaceActiveBuffer.analysis.aiScore <= 30 ? 'workspace-buffer-toolbar__score--good' :
                  workspaceActiveBuffer.analysis.aiScore <= 60 ? 'workspace-buffer-toolbar__score--warning' :
                  'workspace-buffer-toolbar__score--high'
                }`}>
                  {Math.round(workspaceActiveBuffer.analysis.aiScore)}% AI
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* View Mode Toggle and Session Actions - Only show when session has buffers (legacy) */}
      {useSessionRendering && !hasWorkspace && currentSession && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px' }}>
          <ViewModeToggle
            viewMode={currentSession.viewMode}
            onChangeViewMode={updateViewMode}
          />
          <button
            onClick={handleReloadSession}
            className="ui-text"
            title="Reload session from disk"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ↻ Reload
          </button>
        </div>
      )}

      {/* Title and metadata panel - centered with max-width */}
      <div className="flex justify-center w-full">
        <div
          className="mx-6 mt-6 mb-4 p-4 rounded-lg w-full max-w-5xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h1 className="heading-lg mb-2 u-text-primary">
            {narrative.title}
          </h1>
        <div className="flex items-center gap-4 text-small u-text-tertiary">
          {narrative.createdAt && (
            <span>
              Created {new Date(narrative.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
          {narrative.updatedAt && narrative.createdAt !== narrative.updatedAt && (
            <span>
              • Last message {new Date(narrative.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          {narrative.metadata.wordCount ? (
            <span>• {narrative.metadata.wordCount.toLocaleString()} words</span>
          ) : null}
          {narrative.metadata.source && (
            <span>• Source: {narrative.metadata.source}</span>
          )}
          </div>
        </div>
      </div>

      {/* Desktop: Render based on view mode */}
      {/* Workspace Buffer Comparison View - Takes priority when workspace is active */}
      {hasWorkspace && workspaceActiveBuffer ? (
        workspaceCompareMode && workspaceCompareBuffer ? (
          /* Side-by-side workspace comparison */
          <div className="hidden md:flex flex-1 flex-col md:flex-row u-flex-fill">
            {/* Left pane: Compare buffer */}
            <div
              ref={leftPaneRef}
              className="flex-1 md-border-switch flex flex-col"
              style={{
                borderRight: '1px solid var(--border-color)',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-5xl u-content-center">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceCompareBuffer.displayName || 'Compare'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.left || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.left || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer content={workspaceContent.left || ''} {...mediaProps} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right pane: Active buffer */}
            <div
              ref={rightPaneRef}
              className="flex-1 flex flex-col"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-5xl u-content-center">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceActiveBuffer.displayName || 'Active'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer content={workspaceContent.right || ''} {...mediaProps} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Single pane: Active buffer only */
          <div className="hidden md:flex flex-1 u-flex-fill">
            <div
              ref={singlePaneRef}
              className="flex-1 flex flex-col"
              style={{
                minHeight: 0,
                overflow: 'hidden',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  width: '100%',
                  minHeight: 0,
                }}
              >
                <div className="w-full max-w-5xl u-content-center">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="heading-md u-text-secondary">
                      {workspaceActiveBuffer.displayName || 'Active Buffer'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'plain')}
                        title="Copy as plain text"
                      >
                        <Icons.Copy /> Text
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(workspaceContent.right || '', 'markdown')}
                        title="Copy as markdown"
                      >
                        <Icons.Code /> MD
                      </button>
                    </div>
                  </div>
                  <div className="prose max-w-none u-text-primary">
                    <MarkdownRenderer content={workspaceContent.right || ''} {...mediaProps} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      ) : useSessionRendering && currentViewMode === VIEW_MODES.SINGLE_ORIGINAL ? (
      /* Single-Original View Mode */
        <div className="hidden md:flex flex-1 u-flex-fill">
          <div
            ref={singlePaneRef}
            className="flex-1 flex flex-col"
            style={{
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div
              className="flex-1 overflow-y-auto"
              style={{
                width: '100%',
                minHeight: 0,
              }}
            >
              <div className="w-full max-w-5xl u-content-center">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
                    Original
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(displayContent.original, 'plain')}
                      title="Copy as plain text"
                    >
                      <Icons.Copy /> Text
                    </button>
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(displayContent.original, 'markdown')}
                      title="Copy as markdown"
                    >
                      <Icons.Code /> MD
                    </button>
                  </div>
                </div>
                <MarkdownRenderer content={displayContent.original} {...mediaProps} />
              </div>
            </div>
          </div>
        </div>
      ) : useSessionRendering && currentViewMode === VIEW_MODES.SINGLE_TRANSFORMED ? (
        /* Single-Transformed View Mode */
        <div className="hidden md:flex flex-1 u-flex-fill">
          <div
            ref={singlePaneRef}
            className="flex-1 flex flex-col"
            style={{
              minHeight: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div
              className="flex-1 overflow-y-auto"
              style={{
                width: '100%',
                minHeight: 0,
              }}
            >
              <div className="w-full max-w-5xl u-content-center">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
                    Transformed
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(displayContent.transformed, 'plain')}
                      title="Copy as plain text"
                    >
                      <Icons.Copy /> Text
                    </button>
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(displayContent.transformed, 'markdown')}
                      title="Copy as markdown"
                    >
                      <Icons.Code /> MD
                    </button>
                  </div>
                </div>
                <MarkdownRenderer content={displayContent.transformed} {...mediaProps} />
              </div>
            </div>
          </div>
        </div>
      ) : (useSessionRendering ? currentViewMode === VIEW_MODES.SPLIT : mode === 'split') ? (
        /* Side-by-side layout (desktop only) */
        <div className="hidden md:flex flex-1 flex-col md:flex-row u-flex-fill">
          {/* Left pane: Original */}
          <div
            ref={leftPaneRef}
            className="flex-1 md-border-switch flex flex-col"
            style={{
              borderBottom: '1px solid var(--border-color)',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Scrollable content container */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                width: '100%',
                minHeight: 0,
              }}
            >
              <div className="w-full max-w-5xl" style={{ padding: 'var(--space-xl)', minHeight: 0, margin: '0 auto' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
                    Original
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Copy buttons */}
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(displayContent.original, 'plain')}
                      title="Copy as plain text"
                    >
                      <Icons.Copy /> Text
                    </button>
                    <button
                      className="copy-button"
                      onClick={() => copyToClipboard(displayContent.original, 'markdown')}
                      title="Copy as markdown"
                    >
                      <Icons.Code /> MD
                    </button>
                    {/* Edit/Preview toggle */}
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
                </div>

                {/* Selection banner */}
                {selectedText && (
                  <div className="selection-banner">
                    <Icons.Highlight />
                    <span className="word-count">
                      {selectedText.text.split(/\s+/).filter(Boolean).length} words selected
                    </span>
                    <button onClick={() => onTextSelection(null)}>Clear</button>
                  </div>
                )}

                {/* Content */}
                <div className="w-full" onMouseUp={handleTextSelection}>
                  {originalViewMode === 'rendered' ? (
                    <MarkdownRenderer content={displayContent.original} {...mediaProps} />
                  ) : (
                    <MarkdownEditor
                      content={editedContent || displayContent.original}
                      onChange={(content) => {
                        setEditedContent(content);
                        handleContentChange(content);
                      }}
                  placeholder="Original content..."
                />
              )}
            </div>
              </div>
            </div>
          </div>

          {/* Right pane: Transformed */}
          <div
            ref={rightPaneRef}
            className="flex-1 flex flex-col"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Scrollable content container */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                width: '100%',
                minHeight: 0,
              }}
            >
              <div className="w-full max-w-5xl" style={{ paddingTop: 'var(--space-xl)', paddingRight: 'var(--space-xl)', paddingBottom: '120px', paddingLeft: 'var(--space-xl)', minHeight: 0, margin: '0 auto' }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="heading-lg" style={{ color: 'var(--text-secondary)' }}>
                  {transformResult.metadata?.aiDetection ? 'AI Detection Analysis' : 'Transformed'}
                </h2>
                <div className="flex items-center gap-2">
                  {/* Copy buttons */}
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard(displayContent.transformed, 'plain')}
                    title="Copy as plain text"
                  >
                    <Icons.Copy /> Text
                  </button>
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard(displayContent.transformed, 'markdown')}
                    title="Copy as markdown"
                  >
                    <Icons.Code /> MD
                  </button>
                  {/* View toggle (only for non-AI detection) */}
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
                  <span className="text-small font-medium u-text-secondary">
                    AI Confidence
                  </span>
                  <span className="heading-lg font-bold u-text-primary">
                    {transformResult.metadata.aiDetection.confidence.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-4 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${transformResult.metadata.aiDetection.confidence}%`,
                      backgroundColor:
                        transformResult.metadata.aiDetection.confidence > 70
                          ? 'var(--accent-red)'
                          : transformResult.metadata.aiDetection.confidence < 20
                          ? 'var(--accent-green)'
                          : 'var(--accent-yellow)',
                    }}
                  />
                </div>
              </div>

              {/* Metrics Grid - Only show for Lite Detector */}
              {transformResult.metadata.aiDetection.method !== 'gptzero' && (
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: 'var(--space-md)',
                    }}
                  >
                    <div className="text-small mb-2 u-text-tertiary">
                      Burstiness
                    </div>
                    <div className="heading-md" style={{ color: 'var(--text-primary)' }}>
                      {Math.round(transformResult.metadata.aiDetection.burstiness)}/100
                    </div>
                    <div className="text-small mt-1 u-text-tertiary">
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
                    <div className="text-small mb-2 u-text-tertiary">
                      Perplexity
                    </div>
                    <div className="heading-md" style={{ color: 'var(--text-primary)' }}>
                      {Math.round(transformResult.metadata.aiDetection.perplexity)}/100
                    </div>
                    <div className="text-small mt-1 u-text-tertiary">
                      {transformResult.metadata.aiDetection.perplexity > 60
                        ? 'Varied vocabulary'
                        : 'Predictable patterns'}
                    </div>
                  </div>
                </div>
              )}

              {/* GPTZero Premium - Show count of flagged sentences */}
              {transformResult.metadata.aiDetection.method === 'gptzero' &&
                (transformResult.metadata.aiDetection.highlightedSentences?.length ?? 0) > 0 && (
                <div
                  className="rounded-md"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: 'var(--space-md)',
                  }}
                >
                  <div className="text-small mb-2 u-text-tertiary">
                    AI-Flagged Sentences
                  </div>
                  <div className="heading-md" style={{ color: 'var(--accent-red)' }}>
                    {transformResult.metadata.aiDetection.highlightedSentences?.length ?? 0} sentences flagged
                  </div>
                  <div className="text-small mt-1 u-text-tertiary">
                    Highlighted in text below
                  </div>
                </div>
              )}

              {/* Tell Words */}
              {transformResult.metadata.aiDetection.tellWords &&
                transformResult.metadata.aiDetection.tellWords.length > 0 && (
                  <div>
                    <div className="text-small font-medium mb-3 u-text-secondary">
                      AI Tell-Words Found ({transformResult.metadata.aiDetection.tellWords.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {transformResult.metadata.aiDetection.tellWords
                        .filter(w => w && w.word && typeof w.word === 'string')
                        .map((wordObj, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-full text-small"
                          style={{
                            backgroundColor: 'var(--accent-red)20',
                            color: 'var(--accent-red)',
                            border: '1px solid var(--accent-red)40',
                          }}
                        >
                          {wordObj.word}
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
                  <div className="text-small font-semibold mb-2 u-text-primary">
                    Analysis
                  </div>
                  <p className="text-body u-text-secondary">
                    {transformResult.metadata.aiDetection.reasoning}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Round-Trip Translation Results */}
          {transformResult.metadata?.transformationType === 'round-trip' && (
            <div className="mb-8 space-y-6">
              {/* Semantic Drift Badge */}
              <div className="text-center">
                <div
                  className="inline-block px-8 py-4 rounded-lg"
                  style={{
                    backgroundColor:
                      (transformResult.metadata.semanticDrift || 0) > 0.5
                        ? 'var(--accent-yellow)'
                        : 'var(--accent-green)',
                    color: 'white',
                  }}
                >
                  <div className="text-small mb-1" style={{ opacity: 0.9 }}>
                    Semantic Drift
                  </div>
                  <div className="heading-lg font-bold">
                    {((transformResult.metadata.semanticDrift || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Forward Translation */}
              <div>
                <h3 className="text-body font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Translation to {(transformResult.metadata.intermediateLanguage || 'unknown').charAt(0).toUpperCase() + (transformResult.metadata.intermediateLanguage || 'unknown').slice(1)}
                </h3>
                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {transformResult.metadata.forwardTranslation}
                </div>
              </div>

              {/* Backward Translation */}
              <div>
                <h3 className="text-body font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Back to English
                </h3>
                <div
                  className="prose p-4 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <MarkdownRenderer content={transformResult.transformed} {...mediaProps} />
                </div>
              </div>

              {/* Analysis */}
              {((transformResult.metadata.lostElements?.length || 0) > 0 ||
                (transformResult.metadata.gainedElements?.length || 0) > 0) && (
                <div className="space-y-4">
                  {transformResult.metadata.lostElements && transformResult.metadata.lostElements.length > 0 && (
                    <div>
                      <h4
                        className="text-small font-medium mb-2"
                        style={{ color: 'var(--accent-red)' }}
                      >
                        Lost in Translation ({transformResult.metadata.lostElements.length})
                      </h4>
                      <ul className="text-small space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                        {transformResult.metadata.lostElements.map((el, i) => (
                          <li key={i}>• {el}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {transformResult.metadata.gainedElements && transformResult.metadata.gainedElements.length > 0 && (
                    <div>
                      <h4
                        className="text-small font-medium mb-2"
                        style={{ color: 'var(--accent-green)' }}
                      >
                        Gained in Translation ({transformResult.metadata.gainedElements.length})
                      </h4>
                      <ul className="text-small space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                        {transformResult.metadata.gainedElements.map((el, i) => (
                          <li key={i}>• {el}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
              // GPTZero highlighted sentences (inline highlighting)
              transformResult?.metadata?.aiDetection?.method === 'gptzero' &&
              (transformResult?.metadata?.aiDetection?.highlightedSentences?.length ?? 0) > 0 ? (
                <div className="prose" style={{ color: 'var(--text-primary)' }}>
                  {(() => {
                    // Highlight flagged sentences in the original text
                    let highlightedText = displayContent.transformed;
                    const sentences = transformResult.metadata?.aiDetection?.highlightedSentences ?? [];

                    // Sort sentences by length (longest first) to avoid partial replacements
                    const sortedSentences = [...sentences].sort((a, b) => b.length - a.length);

                    // Escape regex special characters in sentences
                    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    // Replace each flagged sentence with highlighted version
                    sortedSentences.forEach((sentence) => {
                      const escapedSentence = escapeRegex(sentence);
                      const regex = new RegExp(`(${escapedSentence})`, 'gi');
                      highlightedText = highlightedText.replace(
                        regex,
                        `<mark class="gptzero-highlight">$1</mark>`
                      );
                    });

                    return (
                      <div
                        className="gptzero-highlighted-text"
                        dangerouslySetInnerHTML={{ __html: highlightedText }}
                      />
                    );
                  })()}
                </div>
              ) : transformResult?.metadata?.aiDetection?.tellWords &&
                transformResult.metadata.aiDetection.tellWords.length > 0 ? (
                // Lite Detector: Highlight tell-words in the text
                <div className="prose lite-highlighted-text" style={{ color: 'var(--text-primary)' }}>
                  {(() => {
                    let highlightedText = displayContent.transformed;
                    const tellWords = transformResult.metadata.aiDetection.tellWords;
                    // Filter out invalid entries and sort by word length
                    const sortedWords = [...tellWords]
                      .filter(w => w && w.word && typeof w.word === 'string')
                      .sort((a, b) => b.word.length - a.word.length);
                    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    sortedWords.forEach((wordObj) => {
                      const escapedWord = escapeRegex(wordObj.word);
                      const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
                      highlightedText = highlightedText.replace(
                        regex,
                        `<mark class="lite-highlight">$1</mark>`
                      );
                    });

                    return <div dangerouslySetInnerHTML={{ __html: highlightedText }} />;
                  })()}
                </div>
              ) : transformResult?.metadata?.manualReviewSuggestions && transformResult.metadata.manualReviewSuggestions.length > 0 ? (
                <div className="prose" style={{ color: 'var(--text-primary)' }}>
                  {(() => {
                    // Highlight suspicious phrases in the transformed text
                    let highlightedText = displayContent.transformed;
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
                <MarkdownRenderer content={displayContent.transformed} {...mediaProps} />
              )
            ) : (
              <MarkdownEditor
                content={displayContent.transformed}
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
              <p className="text-body u-text-secondary">
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
                  <div className="text-small mb-2 u-text-tertiary">
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
                  <div className="text-small mb-2 u-text-tertiary">
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
        </div>
      ) : (
        /* Tab View on desktop when viewPreference === 'tabs' */
        <div className="hidden md:flex flex-1 flex-col">
          {/* Tab buttons */}
          <div className="flex border-b" style={{ borderColor: 'var(--border-color)', paddingLeft: 'var(--space-lg)' }}>
            <button
              className={`transform-tab ${activeTab === 'original' ? 'active' : ''}`}
              onClick={() => setActiveTab('original')}
              style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderBottom: activeTab === 'original' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                backgroundColor: activeTab === 'original' ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === 'original' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'original' ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              Original
            </button>
            <button
              className={`transform-tab ${activeTab === 'transformed' ? 'active' : ''}`}
              onClick={() => setActiveTab('transformed')}
              style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderBottom: activeTab === 'transformed' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                backgroundColor: activeTab === 'transformed' ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === 'transformed' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'transformed' ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              {transformResult?.metadata?.aiDetection ? 'Analysis' : 'Transformed'}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'original' ? (
              <div style={{ padding: 'var(--space-xl)' }}>
                <div className="max-w-3xl">
                  {originalViewMode === 'rendered' ? (
                    <MarkdownRenderer content={narrative.content} {...mediaProps} />
                  ) : (
                    <MarkdownEditor
                      content={editedContent || narrative.content}
                      onChange={(content) => {
                        setEditedContent(content);
                        handleContentChange(content);
                      }}
                      placeholder="Original content..."
                    />
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: 'var(--space-xl)', paddingBottom: '120px', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="max-w-3xl">
                  {transformedViewMode === 'rendered' ? (
                    <MarkdownRenderer content={transformResult?.transformed || ''} {...mediaProps} />
                  ) : (
                    <MarkdownEditor
                      content={transformResult?.transformed || ''}
                      onChange={() => {}}
                      placeholder="Transformed content..."
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Always use tabs */}
      <div className="md:hidden flex-1 flex flex-col">
        {/* Tab buttons */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
          <button
            className={`transform-tab ${activeTab === 'original' ? 'active' : ''}`}
            onClick={() => setActiveTab('original')}
            style={{
              flex: 1,
              padding: 'var(--space-md)',
              borderBottom: activeTab === 'original' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              backgroundColor: activeTab === 'original' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'original' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'original' ? '600' : '400',
              transition: 'all 0.2s',
            }}
          >
            Original
          </button>
          <button
            className={`transform-tab ${activeTab === 'transformed' ? 'active' : ''}`}
            onClick={() => setActiveTab('transformed')}
            style={{
              flex: 1,
              padding: 'var(--space-md)',
              borderBottom: activeTab === 'transformed' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              backgroundColor: activeTab === 'transformed' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'transformed' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'transformed' ? '600' : '400',
              transition: 'all 0.2s',
            }}
          >
            {transformResult?.metadata?.aiDetection ? 'Analysis' : 'Transformed'}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'original' ? (
            <div style={{ padding: 'var(--space-md)' }}>
              <div className="max-w-3xl">
                {originalViewMode === 'rendered' ? (
                  <MarkdownRenderer content={narrative.content} {...mediaProps} />
                ) : (
                  <MarkdownEditor
                    content={editedContent || narrative.content}
                    onChange={(content) => {
                      setEditedContent(content);
                      handleContentChange(content);
                    }}
                    placeholder="Original content..."
                  />
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="max-w-3xl">
                {transformedViewMode === 'rendered' ? (
                  <MarkdownRenderer content={transformResult?.transformed || ''} {...mediaProps} />
                ) : (
                  <MarkdownEditor
                    content={transformResult?.transformed || ''}
                    onChange={() => {}}
                    placeholder="Transformed content..."
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div className="toast">
          <Icons.Check />
          {toastMessage}
        </div>
      )}
    </main>
  );
}
