/**
 * Synthesis Dashboard - Phase 5
 *
 * UI for reviewing and applying AI-generated narrative updates from comments.
 *
 * Features:
 * - List pending/applied/rejected synthesis tasks
 * - Diff view showing proposed changes
 * - Approve/reject with feedback
 * - History of applied syntheses
 */

import { Component, Show, For, createSignal, createResource, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import { curatorAgentService, type SynthesisTask } from '@/services/curator';
import { nodesService } from '@/services/nodes';
import type { Narrative } from '@/types/models';

interface SynthesisDashboardProps {
  narrative: Narrative;
  onVersionCreated?: (newVersion: number) => void;
  onClose?: () => void;
}

export const SynthesisDashboard: Component<SynthesisDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'pending' | 'history'>('pending');
  const [selectedTask, setSelectedTask] = createSignal<SynthesisTask | null>(null);
  const [isCompiling, setIsCompiling] = createSignal(false);
  const [isApplying, setIsApplying] = createSignal(false);
  const [rejectReason, setRejectReason] = createSignal('');
  const [showRejectModal, setShowRejectModal] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);

  // Fetch synthesis tasks
  const [tasks, { refetch: refetchTasks }] = createResource(
    () => props.narrative?.id,
    async (narrativeId) => {
      if (!narrativeId) return { tasks: [] };
      const token = authStore.token();
      if (!token) return { tasks: [] };

      try {
        return await curatorAgentService.listSynthesisTasks(narrativeId, token);
      } catch (err) {
        console.error('Failed to fetch synthesis tasks:', err);
        return { tasks: [] };
      }
    }
  );

  // Filter tasks by status
  const pendingTasks = () => tasks()?.tasks?.filter(t => t.status === 'pending') || [];
  const historyTasks = () => tasks()?.tasks?.filter(t => t.status !== 'pending') || [];

  // Compile new synthesis
  const handleCompileSynthesis = async () => {
    const token = authStore.token();
    if (!token || !props.narrative?.id) return;

    setIsCompiling(true);
    setError(null);

    try {
      const result = await curatorAgentService.compileSynthesis(props.narrative.id, token);
      setSuccess(`Synthesis compiled from ${result.commentCount} comments`);
      await refetchTasks();

      // Auto-select the new task
      const newTask: SynthesisTask = {
        id: result.taskId,
        status: 'pending',
        commentCount: result.commentCount,
        suggestion: result.suggestion,
        reasoning: result.reasoning,
        changes: result.changes,
        createdAt: Date.now(),
      };
      setSelectedTask(newTask);
    } catch (err: any) {
      setError(err.message || 'Failed to compile synthesis');
    } finally {
      setIsCompiling(false);
    }
  };

  // Apply synthesis
  const handleApplySynthesis = async (taskId: string, customContent?: string) => {
    const token = authStore.token();
    if (!token) return;

    setIsApplying(true);
    setError(null);

    try {
      const result = await curatorAgentService.applySynthesis(taskId, customContent, token);
      setSuccess(`Created version ${result.newVersion} with ${result.synthesizedComments} synthesized comments`);
      setSelectedTask(null);
      await refetchTasks();
      props.onVersionCreated?.(result.newVersion);
    } catch (err: any) {
      setError(err.message || 'Failed to apply synthesis');
    } finally {
      setIsApplying(false);
    }
  };

  // Reject synthesis
  const handleRejectSynthesis = async (taskId: string) => {
    const token = authStore.token();
    if (!token) return;

    try {
      await curatorAgentService.rejectSynthesis(taskId, rejectReason(), token);
      setSuccess('Synthesis rejected');
      setSelectedTask(null);
      setShowRejectModal(false);
      setRejectReason('');
      await refetchTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to reject synthesis');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { class: 'warning', label: 'Pending Review' };
      case 'approved': return { class: 'info', label: 'Approved' };
      case 'applied': return { class: 'success', label: 'Applied' };
      case 'rejected': return { class: 'error', label: 'Rejected' };
      case 'expired': return { class: 'muted', label: 'Expired' };
      default: return { class: 'muted', label: status };
    }
  };

  return (
    <div class="synthesis-dashboard">
      {/* Header */}
      <div class="synthesis-header">
        <div class="synthesis-title">
          <h2>Synthesis Dashboard</h2>
          <span class="narrative-name">{props.narrative?.title}</span>
        </div>
        <Show when={props.onClose}>
          <button class="btn-icon" onClick={props.onClose}>✕</button>
        </Show>
      </div>

      {/* Status Messages */}
      <Show when={error()}>
        <div class="synthesis-alert error">
          <span>⚠️ {error()}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      </Show>
      <Show when={success()}>
        <div class="synthesis-alert success">
          <span>✓ {success()}</span>
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      </Show>

      {/* Actions */}
      <div class="synthesis-actions">
        <button
          class="btn-primary"
          onClick={handleCompileSynthesis}
          disabled={isCompiling()}
        >
          {isCompiling() ? '⏳ Compiling...' : '🔄 Compile New Synthesis'}
        </button>
        <span class="pending-count">
          {pendingTasks().length} pending • {historyTasks().length} in history
        </span>
      </div>

      {/* Tabs */}
      <div class="synthesis-tabs">
        <button
          class={`synthesis-tab ${activeTab() === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Review
          <Show when={pendingTasks().length > 0}>
            <span class="tab-badge">{pendingTasks().length}</span>
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
        <Show when={tasks.loading}>
          <div class="loading-state">Loading synthesis tasks...</div>
        </Show>

        {/* Pending Tab */}
        <Show when={activeTab() === 'pending' && !tasks.loading}>
          <Show
            when={pendingTasks().length > 0}
            fallback={
              <div class="empty-state">
                <p>No pending synthesis tasks.</p>
                <p class="hint">Compile a synthesis from approved comments to start.</p>
              </div>
            }
          >
            <div class="task-list">
              <For each={pendingTasks()}>
                {(task) => (
                  <TaskCard
                    task={task}
                    selected={selectedTask()?.id === task.id}
                    onClick={() => setSelectedTask(task)}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>

        {/* History Tab */}
        <Show when={activeTab() === 'history' && !tasks.loading}>
          <Show
            when={historyTasks().length > 0}
            fallback={
              <div class="empty-state">
                <p>No synthesis history yet.</p>
              </div>
            }
          >
            <div class="task-list history">
              <For each={historyTasks()}>
                {(task) => (
                  <TaskCard
                    task={task}
                    selected={selectedTask()?.id === task.id}
                    onClick={() => setSelectedTask(task)}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Selected Task Detail Panel */}
      <Show when={selectedTask()}>
        <div class="task-detail-panel">
          <div class="detail-header">
            <h3>Synthesis Detail</h3>
            <button class="btn-icon" onClick={() => setSelectedTask(null)}>✕</button>
          </div>

          <div class="detail-meta">
            <span class={`status-badge ${getStatusBadge(selectedTask()!.status).class}`}>
              {getStatusBadge(selectedTask()!.status).label}
            </span>
            <span class="detail-date">{formatDate(selectedTask()!.createdAt)}</span>
            <span class="comment-count">{selectedTask()!.commentCount} comments</span>
          </div>

          <div class="detail-section">
            <h4>Summary</h4>
            <p class="suggestion-text">{selectedTask()!.suggestion}</p>
          </div>

          <Show when={selectedTask()!.reasoning}>
            <div class="detail-section">
              <h4>Reasoning</h4>
              <p class="reasoning-text">{selectedTask()!.reasoning}</p>
            </div>
          </Show>

          <Show when={selectedTask()!.changes?.length}>
            <div class="detail-section">
              <h4>Proposed Changes</h4>
              <ul class="changes-list">
                <For each={selectedTask()!.changes}>
                  {(change) => (
                    <li class="change-item">
                      <span class="change-icon">✏️</span>
                      <span>{change}</span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          {/* Actions for pending tasks */}
          <Show when={selectedTask()!.status === 'pending'}>
            <div class="detail-actions">
              <button
                class="btn-success"
                onClick={() => handleApplySynthesis(selectedTask()!.id)}
                disabled={isApplying()}
              >
                {isApplying() ? 'Applying...' : '✓ Apply Synthesis'}
              </button>
              <button
                class="btn-danger"
                onClick={() => setShowRejectModal(true)}
              >
                ✕ Reject
              </button>
            </div>
          </Show>

          {/* History info for applied tasks */}
          <Show when={selectedTask()!.status === 'applied' && selectedTask()!.appliedVersion}>
            <div class="applied-info">
              <span class="applied-icon">✓</span>
              <span>Applied as version {selectedTask()!.appliedVersion}</span>
            </div>
          </Show>
        </div>
      </Show>

      {/* Reject Modal */}
      <Show when={showRejectModal()}>
        <div class="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Synthesis</h3>
            <p>Provide a reason for rejecting this synthesis (optional):</p>
            <textarea
              value={rejectReason()}
              onInput={(e) => setRejectReason(e.currentTarget.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
            <div class="modal-actions">
              <button class="btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                class="btn-danger"
                onClick={() => handleRejectSynthesis(selectedTask()!.id)}
              >
                Reject Synthesis
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

// Task Card Component
const TaskCard: Component<{
  task: SynthesisTask;
  selected: boolean;
  onClick: () => void;
}> = (props) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { class: 'warning', icon: '⏳' };
      case 'approved': return { class: 'info', icon: '✓' };
      case 'applied': return { class: 'success', icon: '✅' };
      case 'rejected': return { class: 'error', icon: '✕' };
      case 'expired': return { class: 'muted', icon: '⌛' };
      default: return { class: 'muted', icon: '•' };
    }
  };

  const badge = getStatusBadge(props.task.status);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      class={`task-card ${props.selected ? 'selected' : ''} status-${badge.class}`}
      onClick={props.onClick}
    >
      <div class="task-card-header">
        <span class={`task-status ${badge.class}`}>
          {badge.icon} {props.task.status}
        </span>
        <span class="task-date">{formatDate(props.task.createdAt)}</span>
      </div>

      <p class="task-suggestion">{props.task.suggestion?.substring(0, 150)}...</p>

      <div class="task-card-footer">
        <span class="comment-count">
          📝 {props.task.commentCount} comments
        </span>
        <Show when={props.task.changes?.length}>
          <span class="changes-count">
            ✏️ {props.task.changes.length} changes
          </span>
        </Show>
      </div>
    </div>
  );
};

export default SynthesisDashboard;
