/**
 * Curator Panel - AI Assistant & Tools
 * 
 * Features:
 * - Real-time AI suggestions based on content
 * - Comment digest from readers with quality scores
 * - Content analysis metrics
 * - Synthesis suggestions
 * - Auto-analysis when content changes significantly (debounced)
 */

import { Component, createSignal, createEffect, createResource, Show, For, on, onCleanup } from 'solid-js';
import { authStore } from '@/stores/auth';
import { curatorService, type Suggestion, type ContentMetrics, type CommentEvaluation } from '@/services/curator';
import { nodesService } from '@/services/nodes';
import type { Narrative, NarrativeComment } from '@/types/models';

interface CommentDigest {
  id: string;
  author: string;
  preview: string;
  content: string;
  quality: number;
  relevance: number;
  synthesizable: boolean;
}

interface CuratorPanelProps {
  content?: string;
  narrative?: Narrative;
  nodeId?: string;
  onApplySuggestion?: (suggestion: Suggestion) => void;
  onIncorporateComment?: (comment: CommentDigest) => void;
}

export const CuratorPanel: Component<CuratorPanelProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'suggestions' | 'comments' | 'analysis'>('suggestions');
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [lastAnalyzedContent, setLastAnalyzedContent] = createSignal('');
  
  // Analysis results (fetched from API)
  const [suggestions, setSuggestions] = createSignal<Suggestion[]>([]);
  const [metrics, setMetrics] = createSignal<ContentMetrics | null>(null);
  const [curatedSummary, setCuratedSummary] = createSignal('');
  const [curatedTags, setCuratedTags] = createSignal<string[]>([]);
  
  // Comments with evaluations
  const [pendingComments, setPendingComments] = createSignal<CommentDigest[]>([]);
  const [isLoadingComments, setIsLoadingComments] = createSignal(false);
  
  // Selected node for publishing
  const [selectedNodeId, setSelectedNodeId] = createSignal(props.nodeId || '');
  
  // Debounce timer for auto-analysis
  let analysisDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  
  // Cleanup timer on unmount
  onCleanup(() => {
    if (analysisDebounceTimer) {
      clearTimeout(analysisDebounceTimer);
    }
  });
  
  // Fetch comments when narrative changes
  createEffect(on(() => props.narrative?.id, async (narrativeId) => {
    if (!narrativeId) {
      setPendingComments([]);
      return;
    }
    
    setIsLoadingComments(true);
    try {
      const token = authStore.token();
      const comments = await nodesService.listComments(narrativeId, 'pending', token || undefined);
      
      // Evaluate each comment if we have narrative content
      const narrativeContent = props.narrative?.content || '';
      const evaluatedComments = await Promise.all(
        comments.map(async (comment: NarrativeComment): Promise<CommentDigest> => {
          try {
            const evaluation = await curatorService.evaluateComment(
              comment.content,
              narrativeContent,
              '',
              token || undefined
            );
            return {
              id: comment.id,
              author: comment.authorName || 'anonymous',
              preview: comment.content.substring(0, 150) + (comment.content.length > 150 ? '...' : ''),
              content: comment.content,
              quality: evaluation.quality / 100,
              relevance: evaluation.relevance / 100,
              synthesizable: evaluation.synthesizable,
            };
          } catch {
            return {
              id: comment.id,
              author: comment.authorName || 'anonymous',
              preview: comment.content.substring(0, 150) + (comment.content.length > 150 ? '...' : ''),
              content: comment.content,
              quality: 0.5,
              relevance: 0.5,
              synthesizable: true,
            };
          }
        })
      );
      
      setPendingComments(evaluatedComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  }));
  
  // Analyze content function
  const handleAnalyze = async () => {
    const content = props.content;
    if (!content || content.length < 50) {
      setSuggestions([{
        id: 'default-1',
        type: 'expansion',
        text: 'Add more content to receive AI suggestions.',
      }]);
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const token = authStore.token();
      const analysis = await curatorService.analyzeContent(
        content,
        undefined,
        token || undefined
      );
      
      setSuggestions(analysis.suggestions);
      setMetrics(analysis.metrics);
      setCuratedSummary(analysis.curation.summary);
      setCuratedTags(analysis.curation.tags);
      setLastAnalyzedContent(content);
      
    } catch (err) {
      console.error('Analysis failed:', err);
      setSuggestions([{
        id: 'error-1',
        type: 'general',
        text: 'Analysis temporarily unavailable. Try again later.',
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Auto-analyze when content changes significantly (debounced 2 seconds)
  createEffect(on(() => props.content, (content) => {
    if (!content || content.length < 100) return;
    
    // Only re-analyze if content changed significantly (>100 chars different)
    const lastContent = lastAnalyzedContent();
    const charDiff = Math.abs(content.length - lastContent.length);
    
    if (charDiff > 100 || (lastContent === '' && content.length > 100)) {
      // Clear previous timer
      if (analysisDebounceTimer) {
        clearTimeout(analysisDebounceTimer);
      }
      // Debounce: wait 2 seconds after user stops typing
      analysisDebounceTimer = setTimeout(() => {
        handleAnalyze();
      }, 2000);
    }
  }));
  
  // Synthesize all comments
  const handleSynthesizeAll = async () => {
    const narrative = props.narrative;
    if (!narrative || pendingComments().length === 0) return;
    
    try {
      const token = authStore.token();
      const synthesis = await curatorService.suggestSynthesis(
        narrative.id,
        narrative.content,
        pendingComments().map(c => ({
          author: c.author,
          content: c.content,
        })),
        token || undefined
      );
      
      // TODO: Display synthesis suggestion UI
      
    } catch (err) {
      console.error('Synthesis failed:', err);
    }
  };
  
  const suggestionIcon = (type: string) => {
    switch (type) {
      case 'clarity': return '💡';
      case 'expansion': return '📝';
      case 'reference': return '📚';
      case 'style': return '✨';
      case 'structure': return '🏗️';
      default: return '💭';
    }
  };
  
  return (
    <div class="curator-panel">
      {/* Tabs */}
      <div class="curator-tabs">
        <button
          class={`curator-tab ${activeTab() === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggestions
          <Show when={suggestions().length}>
            <span class="tab-badge">{suggestions().length}</span>
          </Show>
        </button>
        <button
          class={`curator-tab ${activeTab() === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comments
          <Show when={pendingComments().length}>
            <span class="tab-badge">{pendingComments().length}</span>
          </Show>
        </button>
        <button
          class={`curator-tab ${activeTab() === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Analysis
        </button>
      </div>
      
      {/* Tab Content */}
      <div class="curator-content">
        {/* Suggestions Tab */}
        <Show when={activeTab() === 'suggestions'}>
          <div class="suggestions-panel">
            <div class="panel-header-row">
              <h4>AI Suggestions</h4>
              <button 
                class="refresh-btn"
                onClick={handleAnalyze}
                disabled={isAnalyzing()}
                title="Analyze content"
              >
                {isAnalyzing() ? '⏳' : '🔄'}
              </button>
            </div>
            
            <Show
              when={suggestions().length}
              fallback={
                <div class="empty-state">
                  <p>Write some content to get AI suggestions.</p>
                  <button class="analyze-btn" onClick={handleAnalyze}>
                    Analyze Content
                  </button>
                </div>
              }
            >
              <div class="suggestions-list">
                <For each={suggestions()}>
                  {(suggestion) => (
                    <div class={`suggestion-card type-${suggestion.type}`}>
                      <div class="suggestion-header">
                        <span class="suggestion-icon">{suggestionIcon(suggestion.type)}</span>
                        <span class="suggestion-type">{suggestion.type}</span>
                      </div>
                      <p class="suggestion-text">{suggestion.text}</p>
                      <Show when={suggestion.action}>
                        <button 
                          class="suggestion-action"
                          onClick={() => props.onApplySuggestion?.(suggestion)}
                        >
                          {suggestion.action}
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            
            {/* AI-generated summary and tags */}
            <Show when={curatedSummary()}>
              <div class="curation-preview">
                <h5>AI Summary</h5>
                <p class="curated-summary">{curatedSummary()}</p>
                <Show when={curatedTags().length}>
                  <div class="curated-tags">
                    <For each={curatedTags()}>
                      {(tag) => <span class="tag">{tag}</span>}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
        
        {/* Comments Tab */}
        <Show when={activeTab() === 'comments'}>
          <div class="comments-panel">
            <div class="panel-header-row">
              <h4>Pending Comments</h4>
              <span class="comment-count">
                {isLoadingComments() ? 'Loading...' : `${pendingComments().length} awaiting`}
              </span>
            </div>
            
            <Show
              when={!isLoadingComments() && pendingComments().length}
              fallback={
                <div class="empty-state">
                  <Show when={isLoadingComments()}>
                    <p>Loading comments...</p>
                  </Show>
                  <Show when={!isLoadingComments()}>
                    <p>No pending comments to synthesize.</p>
                  </Show>
                </div>
              }
            >
              <div class="comments-list">
                <For each={pendingComments()}>
                  {(comment) => (
                    <div class={`comment-digest-card ${comment.synthesizable ? '' : 'low-quality'}`}>
                      <div class="comment-header">
                        <span class="comment-author">@{comment.author}</span>
                        <div class="comment-scores">
                          <span class="score quality" title="Quality">
                            Q: {Math.round(comment.quality * 100)}%
                          </span>
                          <span class="score relevance" title="Relevance">
                            R: {Math.round(comment.relevance * 100)}%
                          </span>
                        </div>
                      </div>
                      <p class="comment-preview">{comment.preview}</p>
                      <div class="comment-actions">
                        <button 
                          class="action-btn incorporate"
                          onClick={() => props.onIncorporateComment?.(comment)}
                          disabled={!comment.synthesizable}
                        >
                          Incorporate
                        </button>
                        <button class="action-btn view">
                          View Full
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
              
              <button 
                class="synthesize-all-btn"
                onClick={handleSynthesizeAll}
                disabled={pendingComments().length === 0}
              >
                ⚗️ Synthesize All ({pendingComments().length})
              </button>
            </Show>
          </div>
        </Show>
        
        {/* Analysis Tab */}
        <Show when={activeTab() === 'analysis'}>
          <div class="analysis-panel">
            <h4>Content Analysis</h4>
            
            <Show
              when={metrics()}
              fallback={
                <div class="empty-state">
                  <p>Run analysis to see content metrics.</p>
                  <button class="analyze-btn" onClick={handleAnalyze}>
                    Analyze Content
                  </button>
                </div>
              }
            >
              <div class="analysis-metrics">
                <div class="metric">
                  <div class="metric-header">
                    <span class="metric-label">Clarity</span>
                    <span class="metric-value">{Math.round(metrics()!.clarity)}%</span>
                  </div>
                  <div class="metric-bar">
                    <div 
                      class="metric-fill" 
                      style={{ width: `${metrics()!.clarity}%` }}
                    />
                  </div>
                </div>
                
                <div class="metric">
                  <div class="metric-header">
                    <span class="metric-label">Depth</span>
                    <span class="metric-value">{Math.round(metrics()!.depth)}%</span>
                  </div>
                  <div class="metric-bar">
                    <div 
                      class="metric-fill"
                      style={{ width: `${metrics()!.depth}%` }}
                    />
                  </div>
                </div>
                
                <div class="metric">
                  <div class="metric-header">
                    <span class="metric-label">Coherence</span>
                    <span class="metric-value">{Math.round(metrics()!.coherence)}%</span>
                  </div>
                  <div class="metric-bar">
                    <div 
                      class="metric-fill"
                      style={{ width: `${metrics()!.coherence}%` }}
                    />
                  </div>
                </div>
                
                <div class="metric">
                  <div class="metric-header">
                    <span class="metric-label">Accessibility</span>
                    <span class="metric-value">{Math.round(metrics()!.accessibility)}%</span>
                  </div>
                  <div class="metric-bar">
                    <div 
                      class="metric-fill"
                      style={{ width: `${metrics()!.accessibility}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div class="analysis-stats">
                <div class="stat-row">
                  <span class="stat-label">Words</span>
                  <span class="stat-value">{metrics()!.wordCount}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Sentences</span>
                  <span class="stat-value">{metrics()!.sentenceCount}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Paragraphs</span>
                  <span class="stat-value">{metrics()!.paragraphCount}</span>
                </div>
              </div>
            </Show>
            
            <button 
              class="full-analysis-btn" 
              onClick={handleAnalyze}
              disabled={isAnalyzing()}
            >
              {isAnalyzing() ? 'Analyzing...' : 'Run Full Analysis'}
            </button>
          </div>
        </Show>
      </div>
      
      {/* Node Selection (for context) */}
      <div class="curator-footer">
        <div class="node-selector">
          <label>Target Node:</label>
          <select 
            class="node-select"
            value={selectedNodeId()}
            onChange={(e) => setSelectedNodeId(e.currentTarget.value)}
          >
            <option value="">Select a Node...</option>
            {/* Node options would be populated from props or fetched */}
          </select>
        </div>
      </div>
    </div>
  );
};
