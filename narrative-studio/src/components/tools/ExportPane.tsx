/**
 * ExportPane - Streamlined export controls for workspace buffers
 *
 * Minimal design: format selector + action buttons only
 * Preview should happen in MainWorkspace, not here
 */

import { useState, useMemo } from 'react';
import { useToolState } from '../../contexts/ToolTabContext';
import { useWorkspaceOptional } from '../../contexts/WorkspaceContext';
import type { Buffer, Workspace } from '../../types/workspace';
import './ExportPane.css';

type ExportFormat = 'plain' | 'markdown' | 'json' | 'diff';
type ExportScope = 'active' | 'compare' | 'chain' | 'starred';

// Strip markdown formatting for plain text export
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')           // headers
    .replace(/\*\*(.+?)\*\*/g, '$1')     // bold
    .replace(/\*(.+?)\*/g, '$1')         // italic
    .replace(/__(.+?)__/g, '$1')         // bold
    .replace(/_(.+?)_/g, '$1')           // italic
    .replace(/`(.+?)`/g, '$1')           // inline code
    .replace(/```[\s\S]*?```/g, '')      // code blocks
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')  // links
    .replace(/!\[.*?\]\(.+?\)/g, '')     // images
    .replace(/^\s*[-*+]\s+/gm, '')       // list items
    .replace(/^\s*\d+\.\s+/gm, '')       // numbered lists
    .replace(/^\s*>\s+/gm, '');          // blockquotes
}

// Build transformation chain from root to target buffer
function buildChain(workspace: Workspace, targetBufferId: string): Buffer[] {
  const chain: Buffer[] = [];
  let current = workspace.buffers[targetBufferId];

  while (current) {
    chain.unshift(current);
    if (current.parentId) {
      current = workspace.buffers[current.parentId];
    } else {
      break;
    }
  }

  return chain;
}

// Generate diff output between two texts
function generateDiff(leftText: string, rightText: string, leftLabel: string, rightLabel: string): string {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');

  let output = `=== COMPARISON ===\n\n`;
  output += `--- ${leftLabel}\n`;
  output += `+++ ${rightLabel}\n\n`;

  const maxLines = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i] || '';
    const rightLine = rightLines[i] || '';

    if (leftLine === rightLine) {
      output += `  ${leftLine}\n`;
    } else {
      if (leftLine) output += `- ${leftLine}\n`;
      if (rightLine) output += `+ ${rightLine}\n`;
    }
  }

  return output;
}

// Format buffer metadata as string
function formatBufferMeta(buffer: Buffer): string {
  const parts: string[] = [];

  if (buffer.transform) {
    parts.push(`Transform: ${buffer.transform.type}`);
    if (buffer.transform.parameters) {
      const params = Object.entries(buffer.transform.parameters)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      if (params) parts.push(`Parameters: ${params}`);
    }
  }

  if (buffer.analysis?.aiScore !== undefined) {
    parts.push(`AI Score: ${Math.round(buffer.analysis.aiScore)}%`);
  }

  return parts.join(' | ');
}

export function ExportPane({ content }: { content: string }) {
  const [state, setState] = useToolState('export');
  const workspaceContext = useWorkspaceOptional();

  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Get workspace data
  const hasWorkspace = !!workspaceContext?.activeWorkspaceId;
  const activeWorkspace = workspaceContext?.getActiveWorkspace();
  const activeBuffer = workspaceContext?.getActiveBuffer();
  const compareBuffer = workspaceContext?.getCompareBuffer();

  // Get starred buffers
  const starredBuffers = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.starredBufferIds
      .map(id => activeWorkspace.buffers[id])
      .filter(Boolean);
  }, [activeWorkspace]);

  // Export options from state
  const format: ExportFormat = state.format || 'markdown';
  const scope: ExportScope = state.scope || 'active';
  const includeMetadata = state.includeMetadata ?? true;
  const includeTimestamps = state.includeTimestamps ?? false;

  // Generate export content based on options
  const exportContent = useMemo(() => {
    // No workspace - just export the content prop
    if (!hasWorkspace || !activeWorkspace) {
      return format === 'plain' ? stripMarkdown(content) : content;
    }

    // Determine which buffer(s) to export
    let buffersToExport: Buffer[] = [];

    switch (scope) {
      case 'active':
        if (activeBuffer) buffersToExport = [activeBuffer];
        break;
      case 'compare':
        if (compareBuffer) buffersToExport = [compareBuffer];
        break;
      case 'chain':
        if (activeBuffer) {
          buffersToExport = buildChain(activeWorkspace, activeBuffer.id);
        }
        break;
      case 'starred':
        buffersToExport = starredBuffers;
        break;
    }

    if (buffersToExport.length === 0) {
      return '// No content to export';
    }

    // Handle diff format specially
    if (format === 'diff') {
      if (!activeBuffer || !compareBuffer) {
        return '// Diff requires both active and compare buffers';
      }
      return generateDiff(
        compareBuffer.content,
        activeBuffer.content,
        compareBuffer.displayName || 'Compare',
        activeBuffer.displayName || 'Active'
      );
    }

    // Handle JSON format
    if (format === 'json') {
      const exportData = {
        workspace: {
          id: activeWorkspace.id,
          name: activeWorkspace.name,
          source: activeWorkspace.source,
          createdAt: includeTimestamps ? new Date(activeWorkspace.createdAt).toISOString() : undefined,
          updatedAt: includeTimestamps ? new Date(activeWorkspace.updatedAt).toISOString() : undefined,
        },
        buffers: buffersToExport.map(buffer => ({
          id: buffer.id,
          parentId: buffer.parentId,
          displayName: buffer.displayName,
          content: buffer.content,
          transform: includeMetadata ? buffer.transform : undefined,
          analysis: includeMetadata ? buffer.analysis : undefined,
          starred: buffer.starred,
          createdAt: includeTimestamps ? new Date(buffer.createdAt).toISOString() : undefined,
        })),
        exportedAt: new Date().toISOString(),
      };
      return JSON.stringify(exportData, null, 2);
    }

    // Handle plain/markdown format
    let output = '';

    for (const buffer of buffersToExport) {
      if (format === 'markdown') {
        output += `## ${buffer.displayName || 'Buffer'}\n\n`;
        if (includeMetadata) {
          const meta = formatBufferMeta(buffer);
          if (meta) output += `> ${meta}\n\n`;
        }
        output += buffer.content;
        output += '\n\n---\n\n';
      } else {
        // Plain text
        output += `=== ${buffer.displayName || 'Buffer'} ===\n`;
        if (includeMetadata) {
          const meta = formatBufferMeta(buffer);
          if (meta) output += `[${meta}]\n`;
        }
        output += '\n';
        output += stripMarkdown(buffer.content);
        output += '\n\n';
      }
    }

    return output.trim();
  }, [hasWorkspace, activeWorkspace, activeBuffer, compareBuffer, starredBuffers, format, scope, includeMetadata, includeTimestamps, content]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download file
  const handleDownload = () => {
    const extensions: Record<ExportFormat, string> = {
      plain: 'txt',
      markdown: 'md',
      json: 'json',
      diff: 'diff',
    };

    const mimeTypes: Record<ExportFormat, string> = {
      plain: 'text/plain',
      markdown: 'text/markdown',
      json: 'application/json',
      diff: 'text/plain',
    };

    const workspaceName = activeWorkspace?.name || 'export';
    const safeName = workspaceName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeName}_${Date.now()}.${extensions[format]}`;

    const blob = new Blob([exportContent], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  // Update option helpers
  const setFormat = (f: ExportFormat) => setState({ format: f });
  const setScope = (s: ExportScope) => setState({ scope: s });
  const toggleMetadata = () => setState({ includeMetadata: !includeMetadata });
  const toggleTimestamps = () => setState({ includeTimestamps: !includeTimestamps });

  // Check what's available
  const hasCompare = !!compareBuffer;
  const hasStarred = starredBuffers.length > 0;
  const chainLength = activeBuffer && activeWorkspace
    ? buildChain(activeWorkspace, activeBuffer.id).length
    : 0;

  const wordCount = exportContent.split(/\s+/).filter(Boolean).length;

  return (
    <div className="export-pane">
      {/* Format Row - compact inline buttons */}
      <div className="export-pane__row">
        <span className="export-pane__label">Format</span>
        <div className="export-pane__format-row">
          <button
            className={`export-pane__chip ${format === 'markdown' ? 'export-pane__chip--active' : ''}`}
            onClick={() => setFormat('markdown')}
          >
            MD
          </button>
          <button
            className={`export-pane__chip ${format === 'plain' ? 'export-pane__chip--active' : ''}`}
            onClick={() => setFormat('plain')}
          >
            TXT
          </button>
          <button
            className={`export-pane__chip ${format === 'json' ? 'export-pane__chip--active' : ''}`}
            onClick={() => setFormat('json')}
          >
            JSON
          </button>
          <button
            className={`export-pane__chip ${format === 'diff' ? 'export-pane__chip--active' : ''}`}
            onClick={() => setFormat('diff')}
            disabled={!hasCompare}
            title={hasCompare ? 'Compare buffers' : 'Set compare buffer first (Shift+click)'}
          >
            Diff
          </button>
        </div>
      </div>

      {/* Scope Row - only for workspace mode */}
      {hasWorkspace && format !== 'diff' && (
        <div className="export-pane__row">
          <span className="export-pane__label">Scope</span>
          <select
            className="export-pane__select"
            value={scope}
            onChange={(e) => setScope(e.target.value as ExportScope)}
          >
            <option value="active">Active ({activeBuffer?.displayName || 'buffer'})</option>
            <option value="compare" disabled={!hasCompare}>
              Compare{compareBuffer ? ` (${compareBuffer.displayName})` : ' (none)'}
            </option>
            <option value="chain">
              Chain ({chainLength} buffers)
            </option>
            <option value="starred" disabled={!hasStarred}>
              Starred ({starredBuffers.length})
            </option>
          </select>
        </div>
      )}

      {/* Options Row - compact toggles */}
      {format !== 'diff' && (
        <div className="export-pane__row">
          <span className="export-pane__label">Include</span>
          <div className="export-pane__toggles">
            <button
              className={`export-pane__toggle ${includeMetadata ? 'export-pane__toggle--active' : ''}`}
              onClick={toggleMetadata}
              title="Include transform metadata"
            >
              Meta
            </button>
            <button
              className={`export-pane__toggle ${includeTimestamps ? 'export-pane__toggle--active' : ''}`}
              onClick={toggleTimestamps}
              title="Include timestamps"
            >
              Time
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="export-pane__stats">
        {wordCount.toLocaleString()} words · {exportContent.length.toLocaleString()} chars
      </div>

      {/* Action Buttons */}
      <div className="export-pane__actions">
        <button
          className={`export-pane__btn export-pane__btn--primary ${copySuccess ? 'export-pane__btn--success' : ''}`}
          onClick={handleCopy}
        >
          {copySuccess ? '✓ Copied' : 'Copy'}
        </button>
        <button
          className={`export-pane__btn export-pane__btn--secondary ${downloadSuccess ? 'export-pane__btn--success' : ''}`}
          onClick={handleDownload}
        >
          {downloadSuccess ? '✓ Done' : 'Download'}
        </button>
      </div>

      {/* No workspace hint */}
      {!hasWorkspace && (
        <div className="export-pane__hint">
          Create a workspace for chain export and diff comparison.
        </div>
      )}
    </div>
  );
}

export default ExportPane;
