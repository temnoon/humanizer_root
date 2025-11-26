/**
 * Editor Panel - Main Content Editing Area
 * 
 * Features:
 * - Split view: Edit | Preview
 * - Markdown toolbar
 * - Auto-save
 * - Word count / reading time
 * - Media insertion with lightbox preview
 * - Node selection for publishing
 * - AI Curator integration with pre-publish approval
 */

import { Component, createSignal, createEffect, Show, For, onCleanup, createResource, on } from 'solid-js';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import { curatorAgentService, type PrePublishResult, type CuratorRules } from '@/services/curator';
import type { Node, Narrative } from '@/types/models';

interface EditorPanelProps {
  initialContent?: string;
  initialTitle?: string;
  editingNarrative?: Narrative; // If editing existing
  targetNodeId?: string; // Pre-selected node
  onChange?: (content: string, title: string) => void;
  onSave?: (content: string, title: string) => void;
  onPublish?: (narrative: Narrative) => void;
  onCancel?: () => void;
  onOpenLightbox?: (src: string, alt?: string) => void;
  onContentAnalysis?: (content: string) => void; // Trigger curator analysis
  onOpenCuratorSettings?: (nodeId: string) => void; // Open curator config
}

type ViewMode = 'edit' | 'preview' | 'split';
type PublishState = 'editing' | 'checking' | 'review' | 'publishing' | 'success';

export const EditorPanel: Component<EditorPanelProps> = (props) => {
  const [title, setTitle] = createSignal(props.initialTitle || props.editingNarrative?.title || '');
  const [content, setContent] = createSignal(props.initialContent || props.editingNarrative?.content || '');
  const [viewMode, setViewMode] = createSignal<ViewMode>('split');
  const [tags, setTags] = createSignal<string[]>(props.editingNarrative?.metadata?.tags || []);
  const [tagInput, setTagInput] = createSignal('');
  const [isDirty, setIsDirty] = createSignal(false);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  const [selectedNodeId, setSelectedNodeId] = createSignal(props.targetNodeId || '');

  // Sync props to internal state when external content changes (e.g., Gutenberg import)
  // Use on() to explicitly track prop changes and avoid infinite loops
  createEffect(on(
    () => [props.initialContent, props.initialTitle, props.editingNarrative?.id] as const,
    ([newContent, newTitle, editingId]) => {
      // Reset content when switching narratives or importing new content
      const resolvedContent = newContent || props.editingNarrative?.content || '';
      const resolvedTitle = newTitle || props.editingNarrative?.title || '';

      setContent(resolvedContent);
      setTitle(resolvedTitle);
      setTags(props.editingNarrative?.metadata?.tags || []);
      setIsDirty(false);
      setPublishState('editing');
      setPrePublishResult(null);
      setPublishError(null);
    },
    { defer: true } // Don't run on initial mount, only on changes
  ));
  
  // Publishing state machine
  const [publishState, setPublishState] = createSignal<PublishState>('editing');
  const [publishError, setPublishError] = createSignal<string | null>(null);
  
  // Pre-publish review state
  const [prePublishResult, setPrePublishResult] = createSignal<PrePublishResult | null>(null);
  const [bypassReview, setBypassReview] = createSignal(false);
  
  let editorRef: HTMLTextAreaElement | undefined;
  let autoSaveTimer: number | undefined;
  let analysisDebounceTimer: number | undefined;
  
  // Fetch user's nodes for selection
  const [userNodes] = createResource(
    () => authStore.token(),
    async (token) => {
      if (!token) return [];
      try {
        const nodes = await nodesService.listNodes(token);
        return nodes;
      } catch (err) {
        console.error('Failed to load nodes:', err);
        return [];
      }
    }
  );
  
  // Word count & reading time
  const wordCount = () => {
    const text = content().trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  };
  
  const readingTime = () => Math.max(1, Math.ceil(wordCount() / 200));
  
  // Auto-save every 30 seconds if dirty
  createEffect(() => {
    if (isDirty()) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = window.setTimeout(() => {
        handleSave();
      }, 30000);
    }
  });
  
  // Debounced content analysis for AI suggestions
  createEffect(() => {
    const currentContent = content();
    if (currentContent.length > 100 && props.onContentAnalysis) {
      clearTimeout(analysisDebounceTimer);
      analysisDebounceTimer = window.setTimeout(() => {
        props.onContentAnalysis?.(currentContent);
      }, 2000);
    }
  });
  
  onCleanup(() => {
    clearTimeout(autoSaveTimer);
    clearTimeout(analysisDebounceTimer);
  });
  
  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
    setPublishState('editing');
    setPrePublishResult(null);
    setPublishError(null);
    props.onChange?.(newContent, title());
  };
  
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsDirty(true);
    setPublishState('editing');
    setPrePublishResult(null);
    setPublishError(null);
    props.onChange?.(content(), newTitle);
  };
  
  // Save draft (localStorage or API)
  const handleSave = () => {
    const key = props.editingNarrative?.id || `draft-${Date.now()}`;
    try {
      localStorage.setItem(`narrative-draft-${key}`, JSON.stringify({
        title: title(),
        content: content(),
        tags: tags(),
        nodeId: selectedNodeId(),
        savedAt: Date.now()
      }));
      props.onSave?.(content(), title());
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };
  
  // Pre-publish check with curator
  const handlePrePublishCheck = async () => {
    const token = authStore.token();
    if (!token) {
      setPublishError('You must be logged in to publish');
      return;
    }
    
    if (!selectedNodeId()) {
      setPublishError('Please select a Node to publish to');
      return;
    }
    
    if (!title().trim()) {
      setPublishError('Title is required');
      return;
    }
    
    if (!content().trim()) {
      setPublishError('Content is required');
      return;
    }
    
    setPublishState('checking');
    setPublishError(null);
    
    try {
      const result = await curatorAgentService.prePublishCheck(
        selectedNodeId(),
        title().trim(),
        content(),
        tags(),
        token
      );
      
      setPrePublishResult(result);
      setPublishState('review');
      
    } catch (err) {
      console.error('Pre-publish check failed:', err);
      setPublishError(err instanceof Error ? err.message : 'Curator evaluation failed');
      setPublishState('editing');
    }
  };
  
  // Final publish (after approval or bypass)
  const handlePublish = async () => {
    const token = authStore.token();
    if (!token) return;
    
    const result = prePublishResult();
    
    setPublishState('publishing');
    setPublishError(null);
    
    try {
      let narrative: Narrative;
      
      // If we have an approved request, use the publish-request endpoint
      if (result?.status === 'approved' && result.requestId) {
        const publishResult = await curatorAgentService.publishApprovedRequest(result.requestId, token);
        
        // Fetch the created narrative
        narrative = await nodesService.getNarrative(publishResult.narrativeId, token);
        
      } else if (props.editingNarrative) {
        // Update existing narrative (creates new version)
        narrative = await nodesService.updateNarrative(
          props.editingNarrative.id,
          {
            title: title().trim(),
            content: content(),
            tags: tags(),
            changeReason: 'Manual update via Studio'
          },
          token
        );
      } else {
        // Fallback: Direct publish (for nodes without requireApproval)
        narrative = await nodesService.publishNarrative(
          selectedNodeId(),
          {
            title: title().trim(),
            content: content(),
            tags: tags(),
            visibility: 'public'
          },
          token
        );
      }
      
      setPublishState('success');
      setIsDirty(false);
      
      // Clear draft from localStorage
      if (props.editingNarrative?.id) {
        localStorage.removeItem(`narrative-draft-${props.editingNarrative.id}`);
      }
      
      props.onPublish?.(narrative);
      
    } catch (err) {
      console.error('Failed to publish:', err);
      setPublishError(err instanceof Error ? err.message : 'Failed to publish narrative');
      setPublishState('review');
    }
  };
  
  // Reset to editing mode
  const handleBackToEdit = () => {
    setPublishState('editing');
    setPrePublishResult(null);
  };
  
  // Tag management
  const addTag = () => {
    const tag = tagInput().trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !tags().includes(tag) && tags().length < 10) {
      setTags([...tags(), tag]);
      setTagInput('');
      setIsDirty(true);
    }
  };
  
  const removeTag = (tag: string) => {
    setTags(tags().filter(t => t !== tag));
    setIsDirty(true);
  };
  
  // Toolbar actions
  const insertMarkdown = (before: string, after: string = '') => {
    if (!editorRef) return;
    
    const start = editorRef.selectionStart;
    const end = editorRef.selectionEnd;
    const selected = content().substring(start, end);
    const newContent = 
      content().substring(0, start) + 
      before + selected + after + 
      content().substring(end);
    
    setContent(newContent);
    setIsDirty(true);
    
    setTimeout(() => {
      if (editorRef) {
        editorRef.focus();
        const newPos = start + before.length + selected.length;
        editorRef.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };
  
  const toolbarActions = [
    { icon: 'B', action: () => insertMarkdown('**', '**'), title: 'Bold (Ctrl+B)' },
    { icon: 'I', action: () => insertMarkdown('*', '*'), title: 'Italic (Ctrl+I)' },
    { icon: 'H', action: () => insertMarkdown('\n## ', '\n'), title: 'Heading' },
    { icon: '—', action: () => insertMarkdown('\n---\n'), title: 'Divider' },
    { icon: '•', action: () => insertMarkdown('\n- ', ''), title: 'List' },
    { icon: '"', action: () => insertMarkdown('\n> ', '\n'), title: 'Quote' },
    { icon: '`', action: () => insertMarkdown('`', '`'), title: 'Code' },
    { icon: '```', action: () => insertMarkdown('\n```\n', '\n```\n'), title: 'Code Block' },
    { icon: '🔗', action: () => insertMarkdown('[', '](url)'), title: 'Link' },
    { icon: '🖼', action: () => insertMarkdown('![', '](image-url)'), title: 'Image' },
    { icon: '∑', action: () => insertMarkdown('$', '$'), title: 'Math (inline)' },
    { icon: '∫', action: () => insertMarkdown('\n$$\n', '\n$$\n'), title: 'Math (block)' },
  ];
  
  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          insertMarkdown('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertMarkdown('*', '*');
          break;
        case 's':
          e.preventDefault();
          handleSave();
          break;
      }
    }
  };
  
  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'var(--color-success, #22c55e)';
    if (score >= 0.4) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-error, #ef4444)';
  };
  
  return (
    <div class="editor-panel">
      {/* Header with title input */}
      <div class="editor-header">
        <input
          type="text"
          class="editor-title-input"
          placeholder="Narrative Title..."
          value={title()}
          onInput={(e) => handleTitleChange(e.currentTarget.value)}
          disabled={publishState() !== 'editing'}
        />
        
        <div class="editor-meta">
          <span class="word-count">{wordCount()} words</span>
          <span class="reading-time">{readingTime()} min read</span>
          <Show when={isDirty()}>
            <span class="dirty-indicator">• Unsaved</span>
          </Show>
          <Show when={lastSaved()}>
            <span class="saved-time">
              Saved {lastSaved()?.toLocaleTimeString()}
            </span>
          </Show>
        </div>
      </div>
      
      {/* Main content area - show editor or review */}
      <Show when={publishState() === 'editing' || publishState() === 'checking'}>
        {/* Toolbar */}
        <div class="editor-toolbar">
          <div class="toolbar-group">
            {toolbarActions.map(action => (
              <button
                class="toolbar-btn"
                onClick={action.action}
                title={action.title}
              >
                {action.icon}
              </button>
            ))}
          </div>
          
          <div class="toolbar-group view-toggle">
            <button
              class={`toolbar-btn ${viewMode() === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
              title="Edit only"
            >
              Edit
            </button>
            <button
              class={`toolbar-btn ${viewMode() === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split view"
            >
              Split
            </button>
            <button
              class={`toolbar-btn ${viewMode() === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              title="Preview only"
            >
              Preview
            </button>
          </div>
        </div>
        
        {/* Editor/Preview Area */}
        <div class={`editor-content view-${viewMode()}`}>
          <Show when={viewMode() !== 'preview'}>
            <div class="editor-pane">
              <textarea
                ref={editorRef}
                class="editor-textarea"
                placeholder="Begin your narrative...

Use Markdown for formatting:
- **bold** and *italic*
- ## Headings
- > Blockquotes
- `code` and code blocks
- $math$ and $$equations$$"
                value={content()}
                onInput={(e) => handleContentChange(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                spellcheck={true}
              />
            </div>
          </Show>
          
          <Show when={viewMode() === 'split'}>
            <div class="editor-divider" />
          </Show>
          
          <Show when={viewMode() !== 'edit'}>
            <div class="preview-pane">
              <Show
                when={content().trim()}
                fallback={
                  <div class="preview-empty">
                    Preview will appear here...
                  </div>
                }
              >
                <MarkdownRenderer content={content()} />
              </Show>
            </div>
          </Show>
        </div>
        
        {/* Tags Input */}
        <div class="editor-tags">
          <div class="tags-list">
            <For each={tags()}>
              {(tag) => (
                <span class="tag-chip">
                  {tag}
                  <button 
                    class="tag-remove"
                    onClick={() => removeTag(tag)}
                  >
                    ×
                  </button>
                </span>
              )}
            </For>
          </div>
          <input
            type="text"
            class="tag-input"
            placeholder="Add tag..."
            value={tagInput()}
            onInput={(e) => setTagInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
              }
            }}
          />
        </div>
        
        {/* Node Selector */}
        <div class="editor-node-selector">
          <label class="selector-label">Publish to Node:</label>
          <div class="node-selector-row">
            <select 
              class="node-select"
              value={selectedNodeId()}
              onChange={(e) => setSelectedNodeId(e.currentTarget.value)}
            >
              <option value="">Select a Node...</option>
              <Show when={!userNodes.loading}>
                <For each={userNodes()}>
                  {(node) => (
                    <option value={node.id}>{node.name}</option>
                  )}
                </For>
              </Show>
            </select>
            <Show when={selectedNodeId() && props.onOpenCuratorSettings}>
              <button 
                class="curator-settings-btn"
                onClick={() => props.onOpenCuratorSettings?.(selectedNodeId())}
                title="Configure Curator Rules"
              >
                ⚙️
              </button>
            </Show>
          </div>
          <Show when={userNodes.loading}>
            <span class="loading-indicator">Loading nodes...</span>
          </Show>
        </div>
      </Show>
      
      {/* Pre-Publish Review View */}
      <Show when={publishState() === 'review' && prePublishResult()}>
        <div class="pre-publish-review">
          <div class="pre-publish-header">
            <span class={`pre-publish-status ${prePublishResult()!.status}`}>
              {prePublishResult()!.status === 'approved' && '✅ Approved'}
              {prePublishResult()!.status === 'needs_revision' && '⚠️ Needs Revision'}
              {prePublishResult()!.status === 'rejected' && '❌ Rejected'}
            </span>
            <span class="pre-publish-message">{prePublishResult()!.message}</span>
          </div>
          
          {/* Scores */}
          <Show when={prePublishResult()!.scores}>
            <div class="pre-publish-scores">
              <div class="score-badge">
                <span 
                  class="score-value"
                  style={{ color: getScoreColor(prePublishResult()!.scores.quality) }}
                >
                  {Math.round(prePublishResult()!.scores.quality * 100)}%
                </span>
                <span class="score-label">Quality</span>
              </div>
              <div class="score-badge">
                <span 
                  class="score-value"
                  style={{ color: getScoreColor(prePublishResult()!.scores.relevance) }}
                >
                  {Math.round(prePublishResult()!.scores.relevance * 100)}%
                </span>
                <span class="score-label">Relevance</span>
              </div>
              <div class="score-badge">
                <span 
                  class="score-value"
                  style={{ color: getScoreColor(prePublishResult()!.scores.clarity) }}
                >
                  {Math.round(prePublishResult()!.scores.clarity * 100)}%
                </span>
                <span class="score-label">Clarity</span>
              </div>
            </div>
          </Show>
          
          {/* Feedback */}
          <Show when={prePublishResult()!.feedback}>
            <div class="pre-publish-feedback">
              <h4>Curator Feedback</h4>
              <p>{prePublishResult()!.feedback}</p>
            </div>
          </Show>
          
          {/* Suggestions */}
          <Show when={prePublishResult()!.suggestions?.length}>
            <div class="pre-publish-suggestions">
              <h4>Suggestions for Improvement</h4>
              <ul>
                <For each={prePublishResult()!.suggestions}>
                  {(suggestion) => <li>{suggestion}</li>}
                </For>
              </ul>
            </div>
          </Show>
          
          {/* Content Preview */}
          <div class="pre-publish-preview">
            <h4>Your Narrative</h4>
            <div class="preview-content">
              <h3>{title()}</h3>
              <MarkdownRenderer content={content().substring(0, 500) + (content().length > 500 ? '...' : '')} />
            </div>
          </div>
          
          {/* Review Actions */}
          <div class="pre-publish-actions">
            <button 
              class="editor-btn secondary"
              onClick={handleBackToEdit}
            >
              ← Back to Edit
            </button>
            
            <Show when={prePublishResult()!.status === 'needs_revision'}>
              <label class="bypass-checkbox">
                <input 
                  type="checkbox"
                  checked={bypassReview()}
                  onChange={(e) => setBypassReview(e.currentTarget.checked)}
                />
                <span>Publish anyway (not recommended)</span>
              </label>
            </Show>
            
            <Show when={prePublishResult()!.canPublish || bypassReview()}>
              <button 
                class="editor-btn primary"
                onClick={handlePublish}
              >
                {prePublishResult()!.status === 'approved' 
                  ? 'Publish Now' 
                  : 'Publish Despite Issues'}
              </button>
            </Show>
          </div>
        </div>
      </Show>
      
      {/* Status Messages */}
      <Show when={publishError()}>
        <div class="editor-message error">
          ❌ {publishError()}
        </div>
      </Show>
      
      <Show when={publishState() === 'success'}>
        <div class="editor-message success">
          ✅ {props.editingNarrative ? 'Narrative updated!' : 'Narrative published!'}
        </div>
      </Show>
      
      <Show when={publishState() === 'checking'}>
        <div class="editor-message checking">
          🤖 Curator is reviewing your narrative...
        </div>
      </Show>
      
      <Show when={publishState() === 'publishing'}>
        <div class="editor-message publishing">
          📤 Publishing...
        </div>
      </Show>
      
      {/* Footer Actions */}
      <div class="editor-footer">
        <Show when={props.onCancel}>
          <button 
            class="editor-btn secondary"
            onClick={props.onCancel}
          >
            Cancel
          </button>
        </Show>
        
        <Show when={publishState() === 'editing'}>
          <button 
            class="editor-btn secondary"
            onClick={handleSave}
            disabled={!isDirty()}
          >
            Save Draft
          </button>
          <button 
            class="editor-btn primary"
            onClick={handlePrePublishCheck}
            disabled={!title().trim() || !content().trim() || !selectedNodeId()}
          >
            {props.editingNarrative ? 'Submit Update' : 'Submit for Review'}
          </button>
        </Show>
      </div>
    </div>
  );
};
