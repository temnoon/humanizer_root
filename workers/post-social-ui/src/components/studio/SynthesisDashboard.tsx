/**
 * Synthesis Dashboard - Phase 5
 *
 * UI for reviewing and applying AI-generated narrative synthesis:
 * - View pending synthesis tasks across all owned narratives
 * - Side-by-side diff of proposed changes
 * - Approve/reject with feedback
 * - History of applied syntheses
 *
 * The synthesis flow:
 * 1. Comments accumulate on narratives
 * 2. When threshold reached, owner can compile synthesis
 * 3. AI generates proposed changes with reasoning
 * 4. Owner reviews in this dashboard
 * 5. Approve → new version created, comments marked synthesized
 */

import { Component, Show, For, createSignal, createResource, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { curatorAgentService, type SynthesisTask } from '@/services/curator';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { Node, Narrative } from '@/types/models';

interface SynthesisDashboardProps {
  /** Optional: Focus on a specific narrative */
  narrativeId?: string;
  /** Callback when synthesis is applied */
  onSynthesisApplied?: (narrativeId: string, newVersion: number) => void;
  /** Navigate to a narrative */
  onNavigateToNarrative?: (nodeSlug: string, narrativeSlug: string) => void;
}

export const SynthesisDashboard: Component<SynthesisDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'pending' | 'history'>('pending');
  const [selectedTask, setSelectedTask] = createSignal<SynthesisTask | null>(null);
  const [expandedNarrative, setExpandedNarrative] = createSignal<string | null>(null);
  const [compiling, setCompiling] = createSignal<string | null>(null);
  const [applying, setApplying] = createSignal<string | null>(null);
  const [rejecting, setRejecting] = createSignal<string | null>(null);
  const [rejectReason, setRejectReason] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);

  // Fetch user's nodes with narratives that have approved comments
  const [narrativesWithComments, { refetch }] = createResource(
    () => authStore.token(),
    async (token) => {
      if (!token) return [];

      try {
        // Get user's nodes
        const nodes = await nodesService.listNodes(token, { mine: true });

        // For each node, get narratives and their synthesis tasks
        const narrativesData: Array<{
          narrative: Narrative;
          node: Node;
          tasks: SynthesisTask[];
          approvedCommentCount: number;
        }> = [];

        for (const node of nodes) {
          if (node.narratives) {
            for (const narrative of node.narratives) {
              // Get synthesis tasks for this narrative
              try {
                const { tasks } = await curatorAgentService.listSynthesisTasks(narrative.id, token);

                // Get approved comment count
                const comments = await nodesService.listComments(narrative.id, 'approved', token);
                const approvedCount = comments.filter(c => !c.synthesizedInVersion).length;

                if (tasks.length > 0 || approvedCount > 0) {
                  narrativesData.push({
                    narrative,
                    node,
                    tasks,
                    approvedCommentCount: approvedCount,
                  });
                }
              } catch (err) {
                console.error(`Failed to get tasks for ${narrative.id}:`, err);
              }
            }
          }
        }

        return narrativesData;
      } catch (err) {
        console.error('Failed to load narratives:', err);
        return [];
      }
    }
  );

  // Filter for pending vs history
  const pendingItems = () => {
    const items = narrativesWithComments();
    if (!items) return [];
    return items.filter(item =>
      item.tasks.some(t => t.status === 'pending') || item.approvedCommentCount > 0
    );
  };

  const historyItems = () => {
    const items = narrativesWithComments();
    if (!items) return [];
    return items.filter(item =>
      item.tasks.some(t => t.status === 'applied' || t.status === 'rejected')
    );
  };

  // Compile synthesis for a narrative
  const handleCompileSynthesis = async (narrativeId: string) => {
    const token = authStore.token();
    if (!token) return;

    setCompiling(narrativeId);
    setError(null);

    try {
      const result = await curatorAgentService.compileSynthesis(narrativeId, token);
      setSuccess(`Synthesis compiled from ${result.commentCount} comments`);
      refetch();

      // Auto-expand to show the new task
      setExpandedNarrative(narrativeId);
    } catch (err: any) {
      setError(err.message || 'Failed to compile synthesis');
    } finally {
      setCompiling(null);
    }
  };

  // Apply synthesis
  const handleApplySynthesis = async (taskId: string, customContent?: string) => {
    const token = authStore.token();
    if (!token) return;

    setApplying(taskId);
    setError(null);

    try {
      const result = await curatorAgentService.applySynthesis(taskId, customContent, token);
      setSuccess(`Created version ${result.newVersion} with ${result.synthesizedComments} synthesized comments`);
      setSelectedTask(null);
      refetch();

      if (props.onSynthesisApplied) {
        // Find the narrative for this task
        const items = narrativesWithComments();
        const item = items?.find(i => i.tasks.some(t => t.id === taskId));
        if (item) {
          props.onSynthesisApplied(item.narrative.id, result.newVersion);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply synthesis');
    } finally {
      setApplying(null);
    }
  };

  // Reject synthesis
  const handleRejectSynthesis = async (taskId: string) => {
    const token = authStore.token();
    if (!token) return;

    setRejecting(taskId);
    setError(null);

    try {
      await curatorAgentService.rejectSynthesis(taskId, rejectReason(), token);
      setSuccess('Synthesis rejected');
      setSelectedTask(null);
      setRejectReason('');
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to reject synthesis');
    } finally {
      setRejecting(null);
    }
  };

  // Clear messages after delay
  createEffect(() => {
    if (success()) {
      setTimeout(() => setSuccess(null), 5000);
    }
  });

  return (
    <div class="synthesis-dashboard">
      <header class="synthesis-header">
        <h2>🔄 Synthesis Dashboard</h2>
        <p class="synthesis-subtitle">
          Review AI-generated narrative updates from community feedback
        </p>
      </header>

      {/* Messages */}
      <Show when={error()}>
        <div class="message error">
          <span>⚠️ {error()}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      </Show>

      <Show when={success()}>
        <div class="message success">
          <span>✓ {success()}</span>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      </Show>

      {/* Tabs */}
      <div class="synthesis-tabs">
        <button
          class={`synthesis-tab ${activeTab() === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Review
          <Show when={pendingItems().length > 0}>
            <span class="tab-count">{pendingItems().length}</span>
          </Show>
        </button>
        <button
          class={`synthesis-tab ${activeTab() === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div class="synthesis-content">
        <Show
          when={!narrativesWithComments.loading}
          fallback={<div class="synthesis-loading">Loading narratives...</div>}
        >
          {/* Pending Tab */}
          <Show when={activeTab() === 'pending'}>
            <Show
              when={pendingItems().length > 0}
              fallback={
                <div class="synthesis-empty">
                  <div class="empty-icon">📭</div>
                  <h3>No pending syntheses</h3>
                  <p>When readers leave comments on your narratives and they're approved, you can compile them into synthesis suggestions here.</p>
                </div>
              }
            >
              <For each={pendingItems()}>
                {(item) => (
                  <NarrativeSynthesisCard
                    narrative={item.narrative}
                    node={item.node}
                    tasks={item.tasks.filter(t => t.status === 'pending')}
                    approvedCommentCount={item.approvedCommentCount}
                    isExpanded={expandedNarrative() === item.narrative.id}
                    onToggleExpand={() => setExpandedNarrative(
                      expandedNarrative() === item.narrative.id ? null : item.narrative.id
                    )}
                    onCompile={() => handleCompileSynthesis(item.narrative.id)}
                    onViewTask={(task) => setSelectedTask(task)}
                    onNavigate={() => props.onNavigateToNarrative?.(item.node.slug, item.narrative.slug)}
                    isCompiling={compiling() === item.narrative.id}
                  />
                )}
              </For>
            </Show>
          </Show>

          {/* History Tab */}
          <Show when={activeTab() === 'history'}>
            <Show
              when={historyItems().length > 0}
              fallback={
                <div class="synthesis-empty">
                  <div class="empty-icon">📜</div>
                  <h3>No synthesis history</h3>
                  <p>Applied and rejected syntheses will appear here.</p>
                </div>
              }
            >
              <For each={historyItems()}>
                {(item) => (
                  <NarrativeHistoryCard
                    narrative={item.narrative}
                    node={item.node}
                    tasks={item.tasks.filter(t => t.status === 'applied' || t.status === 'rejected')}
                    onNavigate={() => props.onNavigateToNarrative?.(item.node.slug, item.narrative.slug)}
                  />
                )}
              </For>
            </Show>
          </Show>
        </Show>
      </div>

      {/* Task Detail Modal */}
      <Show when={selectedTask()}>
        <div class="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedTask(null);
        }}>
          <div class="modal-container synthesis-modal">
            <SynthesisTaskDetail
              task={selectedTask()!}
              onApply={(customContent) => handleApplySynthesis(selectedTask()!.id, customContent)}
              onReject={() => handleRejectSynthesis(selectedTask()!.id)}
              onClose={() => setSelectedTask(null)}
              isApplying={applying() === selectedTask()?.id}
              isRejecting={rejecting() === selectedTask()?.id}
              rejectReason={rejectReason()}
              onRejectReasonChange={setRejectReason}
            />
          </div>
        </div>
      </Show>
    </div>
  );
};

// Narrative card with synthesis options
const NarrativeSynthesisCard: Component<{
  narrative: Narrative;
  node: Node;
  tasks: SynthesisTask[];
  approvedCommentCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCompile: () => void;
  onViewTask: (task: SynthesisTask) => void;
  onNavigate: () => void;
  isCompiling: boolean;
}> = (props) => {
  const pendingTasks = () => props.tasks.filter(t => t.status === 'pending');

  return (
    <div class="narrative-synthesis-card">
      {/* Header */}
      <div class="synthesis-card-header" onClick={props.onToggleExpand}>
        <div class="card-title-row">
          <span class="expand-icon">{props.isExpanded ? '▼' : '▶'}</span>
          <div class="card-title-info">
            <h4 class="narrative-title">{props.narrative.title}</h4>
            <span class="node-name">in {props.node.name}</span>
          </div>
        </div>
        <div class="card-stats">
          <Show when={props.approvedCommentCount > 0}>
            <span class="stat approved-stat">
              {props.approvedCommentCount} approved comments
            </span>
          </Show>
          <Show when={pendingTasks().length > 0}>
            <span class="stat pending-stat">
              {pendingTasks().length} pending synthesis
            </span>
          </Show>
        </div>
      </div>

      {/* Expanded Content */}
      <Show when={props.isExpanded}>
        <div class="synthesis-card-content">
          {/* Compile Button */}
          <Show when={props.approvedCommentCount > 0}>
            <div class="compile-section">
              <p class="compile-description">
                {props.approvedCommentCount} approved comments ready for synthesis.
              </p>
              <button
                class="compile-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onCompile();
                }}
                disabled={props.isCompiling}
              >
                {props.isCompiling ? (
                  <>
                    <span class="spinner-small"></span>
                    Compiling...
                  </>
                ) : (
                  <>🔄 Compile Synthesis</>
                )}
              </button>
            </div>
          </Show>

          {/* Pending Tasks */}
          <Show when={pendingTasks().length > 0}>
            <div class="tasks-section">
              <h5>Pending Synthesis Tasks</h5>
              <For each={pendingTasks()}>
                {(task) => (
                  <div class="task-preview">
                    <div class="task-info">
                      <span class="task-comments">{task.commentCount} comments</span>
                      <span class="task-date">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p class="task-suggestion">{task.suggestion}</p>
                    <button
                      class="review-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onViewTask(task);
                      }}
                    >
                      Review Changes →
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Navigate Link */}
          <div class="card-actions">
            <button class="link-btn" onClick={(e) => {
              e.stopPropagation();
              props.onNavigate();
            }}>
              View Narrative →
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

// History card for applied/rejected syntheses
const NarrativeHistoryCard: Component<{
  narrative: Narrative;
  node: Node;
  tasks: SynthesisTask[];
  onNavigate: () => void;
}> = (props) => {
  const appliedTasks = () => props.tasks.filter(t => t.status === 'applied');
  const rejectedTasks = () => props.tasks.filter(t => t.status === 'rejected');

  return (
    <div class="narrative-history-card">
      <div class="history-card-header">
        <div class="card-title-info">
          <h4 class="narrative-title">{props.narrative.title}</h4>
          <span class="node-name">in {props.node.name}</span>
        </div>
        <button class="link-btn" onClick={props.onNavigate}>
          View →
        </button>
      </div>

      <div class="history-items">
        <For each={appliedTasks()}>
          {(task) => (
            <div class="history-item applied">
              <span class="history-icon">✓</span>
              <div class="history-info">
                <span class="history-action">Applied to v{task.appliedVersion}</span>
                <span class="history-date">
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span class="history-comments">{task.commentCount} comments</span>
            </div>
          )}
        </For>

        <For each={rejectedTasks()}>
          {(task) => (
            <div class="history-item rejected">
              <span class="history-icon">✗</span>
              <div class="history-info">
                <span class="history-action">Rejected</span>
                <span class="history-date">
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span class="history-comments">{task.commentCount} comments</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

// Task detail modal with full diff
const SynthesisTaskDetail: Component<{
  task: SynthesisTask;
  onApply: (customContent?: string) => void;
  onReject: () => void;
  onClose: () => void;
  isApplying: boolean;
  isRejecting: boolean;
  rejectReason: string;
  onRejectReasonChange: (reason: string) => void;
}> = (props) => {
  const [showRejectForm, setShowRejectForm] = createSignal(false);
  const [editMode, setEditMode] = createSignal(false);
  const [editedContent, setEditedContent] = createSignal('');

  return (
    <div class="synthesis-task-detail">
      {/* Header */}
      <div class="task-detail-header">
        <h3>Review Synthesis</h3>
        <button class="close-btn" onClick={props.onClose}>×</button>
      </div>

      {/* Summary */}
      <div class="task-summary">
        <div class="summary-meta">
          <span class="meta-item">
            <strong>{props.task.commentCount}</strong> comments synthesized
          </span>
          <span class="meta-item">
            Created {new Date(props.task.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div class="suggestion-box">
          <h4>AI Summary</h4>
          <p>{props.task.suggestion}</p>
        </div>

        <Show when={props.task.reasoning}>
          <div class="reasoning-box">
            <h4>Reasoning</h4>
            <p>{props.task.reasoning}</p>
          </div>
        </Show>
      </div>

      {/* Changes List */}
      <div class="changes-section">
        <h4>Proposed Changes</h4>
        <ul class="changes-list">
          <For each={props.task.changes}>
            {(change) => (
              <li class="change-item">
                <span class="change-bullet">•</span>
                {change}
              </li>
            )}
          </For>
        </ul>
      </div>

      {/* Edit Mode Toggle */}
      <div class="edit-toggle">
        <label>
          <input
            type="checkbox"
            checked={editMode()}
            onChange={(e) => setEditMode(e.currentTarget.checked)}
          />
          Edit proposed content before applying
        </label>
      </div>

      {/* Edit Area */}
      <Show when={editMode()}>
        <div class="edit-section">
          <h4>Edit Content</h4>
          <textarea
            class="content-editor"
            value={editedContent()}
            onInput={(e) => setEditedContent(e.currentTarget.value)}
            placeholder="Paste or edit the proposed content here..."
            rows={10}
          />
          <p class="edit-hint">
            Make any adjustments before applying. Leave empty to use AI's proposed content.
          </p>
        </div>
      </Show>

      {/* Reject Form */}
      <Show when={showRejectForm()}>
        <div class="reject-form">
          <h4>Rejection Reason (Optional)</h4>
          <textarea
            value={props.rejectReason}
            onInput={(e) => props.onRejectReasonChange(e.currentTarget.value)}
            placeholder="Why are you rejecting this synthesis?"
            rows={3}
          />
        </div>
      </Show>

      {/* Actions */}
      <div class="task-actions">
        <Show
          when={!showRejectForm()}
          fallback={
            <>
              <button
                class="btn-secondary"
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </button>
              <button
                class="btn-danger"
                onClick={props.onReject}
                disabled={props.isRejecting}
              >
                {props.isRejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </>
          }
        >
          <button
            class="btn-secondary"
            onClick={() => setShowRejectForm(true)}
          >
            ✗ Reject
          </button>
          <button
            class="btn-primary"
            onClick={() => props.onApply(editMode() ? editedContent() : undefined)}
            disabled={props.isApplying}
          >
            {props.isApplying ? (
              <>
                <span class="spinner-small"></span>
                Applying...
              </>
            ) : (
              <>✓ Apply Synthesis</>
            )}
          </button>
        </Show>
      </div>
    </div>
  );
};

export default SynthesisDashboard;
