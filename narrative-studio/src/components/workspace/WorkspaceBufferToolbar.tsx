/**
 * WorkspaceBufferToolbar - Buffer selection and comparison controls
 *
 * Extracted from MainWorkspace.tsx to reduce duplication.
 * This toolbar appears at the top of the workspace when a workspace is active.
 */

import { BufferSelector } from './BufferSelector';
import type { Buffer, BufferNode } from '../../types/workspace';

interface WorkspaceBufferToolbarProps {
  /** Currently active buffer */
  activeBuffer: Buffer;
  /** Buffer selected for comparison (optional) */
  compareBuffer: Buffer | null;
  /** Full buffer tree for selection dropdown */
  bufferTree: BufferNode | null;
  /** Workspace content metrics */
  content: {
    leftWordCount: number;
    rightWordCount: number;
    aiScoreDelta: number | null;
  };
  /** Whether comparison mode is active */
  compareMode: boolean;
  /** Callback when buffer is selected */
  onSelectBuffer: (bufferId: string, isCompare: boolean) => void;
  /** Callback when compare mode is toggled */
  onToggleCompareMode: () => void;
}

export function WorkspaceBufferToolbar({
  activeBuffer,
  compareBuffer,
  bufferTree,
  content,
  compareMode,
  onSelectBuffer,
  onToggleCompareMode,
}: WorkspaceBufferToolbarProps) {
  return (
    <div className="workspace-buffer-toolbar">
      {/* Left: Compare buffer selector */}
      <div className="workspace-buffer-toolbar__left">
        <BufferSelector
          label="Compare"
          selectedBuffer={compareBuffer}
          bufferTree={bufferTree}
          onSelect={(id) => onSelectBuffer(id, true)}
          excludeId={activeBuffer.id}
          allowClear={true}
          placeholder="Select to compare..."
        />
        {compareBuffer && (
          <span className="workspace-buffer-toolbar__stats">
            {content.leftWordCount.toLocaleString()} words
            {compareBuffer.analysis?.aiScore !== undefined && (
              <span
                className={`workspace-buffer-toolbar__score ${
                  compareBuffer.analysis.aiScore <= 30
                    ? 'workspace-buffer-toolbar__score--good'
                    : compareBuffer.analysis.aiScore <= 60
                    ? 'workspace-buffer-toolbar__score--warning'
                    : 'workspace-buffer-toolbar__score--high'
                }`}
              >
                {Math.round(compareBuffer.analysis.aiScore)}% AI
              </span>
            )}
          </span>
        )}
      </div>

      {/* Center: Delta and toggle */}
      <div className="workspace-buffer-toolbar__center">
        {content.aiScoreDelta !== null && (
          <span
            className={`workspace-buffer-toolbar__delta ${
              content.aiScoreDelta < 0
                ? 'workspace-buffer-toolbar__delta--good'
                : content.aiScoreDelta > 0
                ? 'workspace-buffer-toolbar__delta--bad'
                : ''
            }`}
          >
            {content.aiScoreDelta > 0 ? '+' : ''}
            {content.aiScoreDelta.toFixed(1)}% AI
          </span>
        )}
        <button
          className={`workspace-buffer-toolbar__toggle ${
            !compareMode ? 'workspace-buffer-toolbar__toggle--active' : ''
          }`}
          onClick={onToggleCompareMode}
          title={compareMode ? 'Show single pane' : 'Show comparison'}
        >
          {compareMode ? '◧' : '▣'}
        </button>
      </div>

      {/* Right: Active buffer selector */}
      <div className="workspace-buffer-toolbar__right">
        <BufferSelector
          label="Active"
          selectedBuffer={activeBuffer}
          bufferTree={bufferTree}
          onSelect={(id) => onSelectBuffer(id, false)}
          excludeId={compareBuffer?.id}
        />
        <span className="workspace-buffer-toolbar__stats">
          {content.rightWordCount.toLocaleString()} words
          {activeBuffer.analysis?.aiScore !== undefined && (
            <span
              className={`workspace-buffer-toolbar__score ${
                activeBuffer.analysis.aiScore <= 30
                  ? 'workspace-buffer-toolbar__score--good'
                  : activeBuffer.analysis.aiScore <= 60
                  ? 'workspace-buffer-toolbar__score--warning'
                  : 'workspace-buffer-toolbar__score--high'
              }`}
            >
              {Math.round(activeBuffer.analysis.aiScore)}% AI
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
