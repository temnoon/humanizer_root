/**
 * Apex Summary Component
 *
 * Displays the node's apex summary (the curator's consciousness).
 * This is the L4 summary that captures:
 * - Narrative arc
 * - Core themes
 * - The central question
 * - Voice characteristics
 * - Resonance hooks
 *
 * Used in:
 * - Node detail page (shows what the curator "knows")
 * - Sidebar (context for curator responses)
 */

import { Component, Show, For, createResource } from 'solid-js';
import { nodeAdminService, type PyramidStats } from '@/services/node-admin';
import { authStore } from '@/stores/auth';
import './ApexSummary.css';

interface ApexSummaryProps {
  nodeId: string;
  compact?: boolean; // Compact view for sidebar
  className?: string;
}

export const ApexSummary: Component<ApexSummaryProps> = (props) => {
  const [pyramidStats] = createResource(
    () => props.nodeId,
    async (nodeId) => {
      const token = authStore.token();
      if (!token) return null;

      try {
        return await nodeAdminService.getNodePyramidStats(nodeId, token);
      } catch (error) {
        console.error('Failed to load apex summary:', error);
        return null;
      }
    }
  );

  return (
    <div class={`apex-summary ${props.compact ? 'compact' : 'full'} ${props.className || ''}`}>
      <Show
        when={!pyramidStats.loading && pyramidStats()}
        fallback={
          <div class="apex-loading">
            <div class="loading-spinner" />
            <p>Loading apex summary...</p>
          </div>
        }
      >
        <Show
          when={pyramidStats()!.apex}
          fallback={
            <div class="apex-missing">
              <p>📚 No apex summary available for this node yet.</p>
              <p class="hint">The apex summary is generated when the book is processed.</p>
            </div>
          }
        >
          {(() => {
            const apex = pyramidStats()!.apex!;

            return (
              <>
                {/* Source Info */}
                <Show when={!props.compact && (apex.sourceTitle || apex.sourceAuthor)}>
                  <div class="apex-source">
                    <Show when={apex.sourceTitle}>
                      <h2 class="source-title">"{apex.sourceTitle}"</h2>
                    </Show>
                    <Show when={apex.sourceAuthor}>
                      <p class="source-author">by {apex.sourceAuthor}</p>
                    </Show>
                  </div>
                </Show>

                {/* The Question (Most Important) */}
                <div class="apex-section the-question">
                  <h3>The Question</h3>
                  <blockquote class="question-text">{apex.theQuestion}</blockquote>
                </div>

                {/* Core Themes */}
                <Show when={apex.coreThemes && apex.coreThemes.length > 0}>
                  <div class="apex-section core-themes">
                    <h3>Core Themes</h3>
                    <ul class="themes-list">
                      <For each={apex.coreThemes}>
                        {(theme) => <li>{theme}</li>}
                      </For>
                    </ul>
                  </div>
                </Show>

                {/* Narrative Arc (collapsed in compact mode) */}
                <Show when={!props.compact}>
                  <div class="apex-section narrative-arc">
                    <h3>Narrative Arc</h3>
                    <div class="arc-text">
                      {apex.narrativeArc}
                    </div>
                  </div>
                </Show>

                {/* Resonance Hooks */}
                <Show when={apex.resonanceHooks && apex.resonanceHooks.length > 0}>
                  <div class="apex-section resonance-hooks">
                    <h3>Resonance Hooks</h3>
                    <p class="hooks-description">Connections to other works and ideas:</p>
                    <ul class="hooks-list">
                      <For each={apex.resonanceHooks}>
                        {(hook) => <li>{hook}</li>}
                      </For>
                    </ul>
                  </div>
                </Show>

                {/* Lifecycle State */}
                <Show when={!props.compact}>
                  <div class="apex-meta">
                    <span class={`lifecycle-badge ${apex.lifecycleState}`}>
                      {apex.lifecycleState}
                    </span>
                  </div>
                </Show>
              </>
            );
          })()}
        </Show>
      </Show>
    </div>
  );
};

/**
 * Compact Apex Card
 *
 * Minimal version for sidebar/quick view
 */

interface ApexCardProps {
  nodeId: string;
  title?: string;
}

export const ApexCard: Component<ApexCardProps> = (props) => {
  return (
    <div class="apex-card">
      <Show when={props.title}>
        <h4 class="card-title">{props.title}</h4>
      </Show>
      <ApexSummary nodeId={props.nodeId} compact={true} />
    </div>
  );
};

export default ApexSummary;
