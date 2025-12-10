/**
 * WorkspaceCompareView - Side-by-side buffer comparison view
 *
 * Extracted from MainWorkspace.tsx to consolidate the workspace
 * comparison rendering that was duplicated in 3+ places.
 */

import { useRef, useState, useCallback } from 'react';
import { WorkspaceBufferToolbar } from './WorkspaceBufferToolbar';
import { WorkspaceContentPane, type HighlightRange } from './WorkspaceContentPane';
import { Icons } from '../layout/Icons';
import type { Buffer, BufferNode, Workspace } from '../../types/workspace';
import type { Narrative, MediaManifest } from '../../types';

interface WorkspaceCompareViewProps {
  /** Active workspace */
  workspace: Workspace;
  /** Currently active buffer */
  activeBuffer: Buffer;
  /** Buffer selected for comparison (optional) */
  compareBuffer: Buffer | null;
  /** Full buffer tree for selection */
  bufferTree: BufferNode | null;
  /** Workspace content metrics and text */
  content: {
    left: string | null;
    right: string | null;
    leftWordCount: number;
    rightWordCount: number;
    aiScoreDelta: number | null;
  };
  /** Whether comparison mode is active */
  compareMode: boolean;
  /** External highlights from AIAnalysisPane */
  externalHighlights?: HighlightRange[];
  /** Narrative for title display (optional) */
  narrative?: Narrative | null;
  /** Media props for MarkdownRenderer */
  mediaProps?: {
    mediaManifest?: MediaManifest;
    mediaBaseUrl?: string;
  };
  /** Callback when buffer is selected */
  onSelectBuffer: (bufferId: string, isCompare: boolean) => void;
  /** Callback when compare mode is toggled */
  onToggleCompareMode: () => void;
}

export function WorkspaceCompareView({
  workspace,
  activeBuffer,
  compareBuffer,
  bufferTree,
  content,
  compareMode,
  externalHighlights,
  narrative,
  mediaProps,
  onSelectBuffer,
  onToggleCompareMode,
}: WorkspaceCompareViewProps) {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const singlePaneRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const title = narrative?.title || workspace.name || 'Workspace';
  const bufferCount = Object.keys(workspace.buffers).length;

  return (
    <main
      className="flex-1 flex flex-col"
      style={{
        backgroundColor: 'var(--bg-primary)',
        minHeight: 0,
      }}
    >
      {/* Buffer Comparison Toolbar */}
      <WorkspaceBufferToolbar
        activeBuffer={activeBuffer}
        compareBuffer={compareBuffer}
        bufferTree={bufferTree}
        content={content}
        compareMode={compareMode}
        onSelectBuffer={onSelectBuffer}
        onToggleCompareMode={onToggleCompareMode}
      />

      {/* Title Header */}
      <div className="flex justify-center w-full">
        <div
          className="mx-6 mt-4 mb-2 p-3 rounded-lg w-full max-w-5xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h1 className="heading-lg" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
          <div
            className="flex items-center gap-4 text-small mt-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span>{bufferCount} versions</span>
            <span>•</span>
            <span>{activeBuffer.displayName}</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {compareMode && compareBuffer ? (
        /* Side-by-side comparison */
        <div
          className="flex-1 flex flex-col md:flex-row"
          style={{ minHeight: 0, overflow: 'hidden' }}
        >
          {/* Left pane: Compare buffer */}
          <div
            className="flex-1 md:border-r flex flex-col"
            style={{
              borderColor: 'var(--border-color)',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <WorkspaceContentPane
              ref={leftPaneRef}
              content={content.left || ''}
              buffer={compareBuffer}
              mediaProps={mediaProps}
              variant="primary"
              wordCount={content.leftWordCount}
              onToast={handleToast}
            />
          </div>

          {/* Right pane: Active buffer */}
          <div
            className="flex-1 flex flex-col"
            style={{
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <WorkspaceContentPane
              ref={rightPaneRef}
              content={content.right || ''}
              buffer={activeBuffer}
              externalHighlights={externalHighlights}
              mediaProps={mediaProps}
              variant="secondary"
              wordCount={content.rightWordCount}
              onToast={handleToast}
            />
          </div>
        </div>
      ) : (
        /* Single pane: Active buffer only */
        <div
          className="flex-1 flex"
          style={{ minHeight: 0, overflow: 'hidden' }}
        >
          <WorkspaceContentPane
            ref={singlePaneRef}
            content={content.right || ''}
            buffer={activeBuffer}
            externalHighlights={externalHighlights}
            mediaProps={mediaProps}
            variant="secondary"
            wordCount={content.rightWordCount}
            onToast={handleToast}
          />
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
