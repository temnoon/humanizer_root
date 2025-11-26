/**
 * Version Compare Page
 * 
 * Side-by-side or unified diff view of two narrative versions.
 * Shows what changed between versions with semantic shift indicator.
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { A, useParams, useSearchParams, useNavigate } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { VersionComparison, DiffLine, SideBySideLine } from '@/types/models';

// Diff Line Component
const DiffLineView: Component<{ line: DiffLine }> = (props) => {
  const typeClass = () => {
    switch (props.line.type) {
      case 'added': return 'diff-added';
      case 'removed': return 'diff-removed';
      default: return 'diff-unchanged';
    }
  };
  
  const prefix = () => {
    switch (props.line.type) {
      case 'added': return '+';
      case 'removed': return '-';
      default: return ' ';
    }
  };
  
  return (
    <div class={`diff-line ${typeClass()}`}>
      <span class="line-prefix">{prefix()}</span>
      <span class="line-number">{props.line.lineNumber || ''}</span>
      <span class="line-content">{props.line.content}</span>
    </div>
  );
};

// Side by Side View
const SideBySideView: Component<{ lines: SideBySideLine[] }> = (props) => {
  return (
    <div class="side-by-side-view">
      <div class="side-by-side-header">
        <div class="side-header left">Previous Version</div>
        <div class="side-header right">Current Version</div>
      </div>
      <div class="side-by-side-content">
        <For each={props.lines}>
          {(line) => (
            <div class="side-by-side-row">
              <div class={`side-cell left ${line.left.type}`}>
                <span class="cell-line-num">{line.left.lineNumber ?? ''}</span>
                <span class="cell-content">{line.left.content}</span>
              </div>
              <div class={`side-cell right ${line.right.type}`}>
                <span class="cell-line-num">{line.right.lineNumber ?? ''}</span>
                <span class="cell-content">{line.right.content}</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

// Unified Diff View
const UnifiedDiffView: Component<{ diff: string }> = (props) => {
  const lines = () => props.diff.split('\n');
  
  return (
    <pre class="unified-diff">
      <For each={lines()}>
        {(line) => {
          const lineClass = line.startsWith('+') 
            ? 'diff-added' 
            : line.startsWith('-') 
              ? 'diff-removed' 
              : line.startsWith('@@')
                ? 'diff-hunk'
                : '';
          return <div class={`unified-line ${lineClass}`}>{line}</div>;
        }}
      </For>
    </pre>
  );
};

export const VersionComparePage: Component = () => {
  const params = useParams<{ nodeSlug: string; narrativeSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Default comparison: v1 to current
  const fromVersion = () => parseInt(searchParams.from || '1');
  const toVersion = () => parseInt(searchParams.to || '2');
  const format = () => (searchParams.format || 'structured') as 'structured' | 'unified' | 'side-by-side';
  
  // Fetch comparison
  const [comparison] = createResource(
    () => ({ 
      nodeSlug: params.nodeSlug, 
      narrativeSlug: params.narrativeSlug,
      from: fromVersion(),
      to: toVersion(),
      format: format()
    }),
    async ({ nodeSlug, narrativeSlug, from, to, format }) => {
      // First get narrative to get ID
      const narrative = await nodesService.getNarrativeBySlug(
        nodeSlug,
        narrativeSlug,
        undefined,
        authStore.token() || undefined
      );
      
      if (!narrative) return null;
      
      return await nodesService.compareVersions(
        narrative.id,
        from,
        to,
        format,
        authStore.token() || undefined
      );
    }
  );
  
  // Change format
  const setFormat = (newFormat: 'structured' | 'unified' | 'side-by-side') => {
    setSearchParams({ ...searchParams, format: newFormat });
  };
  
  // Semantic shift indicator
  const semanticShiftLabel = (shift: number) => {
    if (shift < 0.1) return 'Minor refinement';
    if (shift < 0.3) return 'Moderate changes';
    if (shift < 0.5) return 'Significant revision';
    return 'Major rewrite';
  };
  
  const semanticShiftColor = (shift: number) => {
    if (shift < 0.1) return 'var(--color-success)';
    if (shift < 0.3) return 'var(--color-warning)';
    return 'var(--color-error)';
  };
  
  return (
    <div class="version-compare-page">
      {/* Header */}
      <header class="compare-header">
        <div class="header-nav">
          <A 
            href={`/node/${params.nodeSlug}/${params.narrativeSlug}`} 
            class="back-link"
          >
            ← Back to Narrative
          </A>
        </div>
        
        <h1 class="compare-title">Version Comparison</h1>
      </header>
      
      {/* Loading / Error / Content */}
      <Show
        when={!comparison.loading}
        fallback={<div class="loading">Loading comparison...</div>}
      >
        <Show
          when={comparison()}
          fallback={
            <div class="error">
              <h2>Comparison not available</h2>
              <p>Could not load version comparison. The versions may not exist.</p>
            </div>
          }
        >
          <main class="compare-content">
            {/* Comparison Info */}
            <div class="compare-info">
              <div class="version-badges">
                <span class="version-badge from">v{comparison()!.from.version}</span>
                <span class="arrow">→</span>
                <span class="version-badge to">v{comparison()!.to.version}</span>
              </div>
              
              <h2 class="narrative-title">{comparison()!.narrativeTitle}</h2>
              
              {/* Stats */}
              <div class="compare-stats">
                <div 
                  class="stat semantic-shift"
                  style={{ '--shift-color': semanticShiftColor(comparison()!.stats.semanticShift) }}
                >
                  <span class="stat-label">Semantic Shift</span>
                  <span class="stat-value">
                    {(comparison()!.stats.semanticShift * 100).toFixed(0)}%
                  </span>
                  <span class="stat-description">
                    {semanticShiftLabel(comparison()!.stats.semanticShift)}
                  </span>
                </div>
                
                <Show when={comparison()!.stats.addedLines !== undefined}>
                  <div class="stat added">
                    <span class="stat-label">Added</span>
                    <span class="stat-value">+{comparison()!.stats.addedLines}</span>
                  </div>
                </Show>
                
                <Show when={comparison()!.stats.removedLines !== undefined}>
                  <div class="stat removed">
                    <span class="stat-label">Removed</span>
                    <span class="stat-value">-{comparison()!.stats.removedLines}</span>
                  </div>
                </Show>
                
                <Show when={comparison()!.stats.similarity !== undefined}>
                  <div class="stat similarity">
                    <span class="stat-label">Similarity</span>
                    <span class="stat-value">
                      {(comparison()!.stats.similarity! * 100).toFixed(0)}%
                    </span>
                  </div>
                </Show>
              </div>
              
              {/* Change Summary */}
              <Show when={comparison()!.to.changes?.summary}>
                <div class="change-summary">
                  <strong>Change summary:</strong> {comparison()!.to.changes.summary as string}
                </div>
              </Show>
            </div>
            
            {/* Format Toggle */}
            <div class="format-toggle">
              <span class="toggle-label">View:</span>
              <div class="toggle-buttons">
                <button
                  class={`toggle-btn ${format() === 'structured' ? 'active' : ''}`}
                  onClick={() => setFormat('structured')}
                >
                  Structured
                </button>
                <button
                  class={`toggle-btn ${format() === 'unified' ? 'active' : ''}`}
                  onClick={() => setFormat('unified')}
                >
                  Unified
                </button>
                <button
                  class={`toggle-btn ${format() === 'side-by-side' ? 'active' : ''}`}
                  onClick={() => setFormat('side-by-side')}
                >
                  Side by Side
                </button>
              </div>
            </div>
            
            {/* Diff View */}
            <div class="diff-container">
              <Show when={format() === 'structured' && Array.isArray((comparison()!.diff as any)?.lines)}>
                <div class="structured-diff">
                  <For each={(comparison()!.diff as any).lines as DiffLine[]}>
                    {(line) => <DiffLineView line={line} />}
                  </For>
                </div>
              </Show>
              
              <Show when={format() === 'unified' && typeof comparison()!.diff === 'string'}>
                <UnifiedDiffView diff={comparison()!.diff as string} />
              </Show>
              
              <Show when={format() === 'side-by-side' && Array.isArray(comparison()!.diff)}>
                <SideBySideView lines={comparison()!.diff as SideBySideLine[]} />
              </Show>
            </div>
            
            {/* Full Content Comparison (optional) */}
            <details class="full-content-toggle">
              <summary>View full content of each version</summary>
              <div class="full-content-compare">
                <div class="full-version">
                  <h3>Version {comparison()!.from.version}</h3>
                  <div class="version-content">
                    <MarkdownRenderer content={comparison()!.from.content} />
                  </div>
                </div>
                <div class="full-version">
                  <h3>Version {comparison()!.to.version}</h3>
                  <div class="version-content">
                    <MarkdownRenderer content={comparison()!.to.content} />
                  </div>
                </div>
              </div>
            </details>
          </main>
        </Show>
      </Show>
    </div>
  );
};
