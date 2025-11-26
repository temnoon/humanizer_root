/**
 * Node Seeder Component
 *
 * Seed a Node with narratives from Project Gutenberg.
 * The Curator takes on its identity from these founding documents.
 *
 * Flow:
 * 1. Select a Node (or create one)
 * 2. Browse Gutenberg for relevant passages
 * 3. Extract and preview passages
 * 4. Publish to Node as seed narratives
 * 5. Curator learns from the published content
 */

import { Component, Show, For, createSignal, createResource, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import {
  gutenbergService,
  CURATED_BOOKS,
  type SimpleBook,
  type ExtractedPassage
} from '@/services/gutenberg';
import { curatorAgentService } from '@/services/curator';
import type { Node } from '@/types/models';

interface NodeSeederProps {
  initialNodeId?: string;
  onComplete?: () => void;
  onClose?: () => void;
}

export const NodeSeeder: Component<NodeSeederProps> = (props) => {
  // Step state
  const [step, setStep] = createSignal<'select-node' | 'select-book' | 'extract' | 'publish'>('select-node');
  const [selectedNode, setSelectedNode] = createSignal<Node | null>(null);
  const [selectedBook, setSelectedBook] = createSignal<SimpleBook | null>(null);
  const [passages, setPassages] = createSignal<ExtractedPassage[]>([]);
  const [selectedPassages, setSelectedPassages] = createSignal<Set<string>>(new Set());

  // UI state
  const [isLoading, setIsLoading] = createSignal(false);
  const [isPublishing, setIsPublishing] = createSignal(false);
  const [publishProgress, setPublishProgress] = createSignal({ current: 0, total: 0 });
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);

  // Extraction options
  const [minWords, setMinWords] = createSignal(300);
  const [maxWords, setMaxWords] = createSignal(1500);
  const [minInterestingness, setMinInterestingness] = createSignal(50);

  // Fetch user's nodes
  const [nodes] = createResource(
    () => authStore.token(),
    async (token) => {
      if (!token) return [];
      return await nodesService.listNodes(token, { mine: true });
    }
  );

  // Set initial node if provided
  createEffect(() => {
    if (props.initialNodeId && nodes()) {
      const node = nodes()?.find(n => n.id === props.initialNodeId);
      if (node) {
        setSelectedNode(node);
        setStep('select-book');
      }
    }
  });

  // Select a book and extract passages
  const handleSelectBook = async (book: SimpleBook) => {
    setSelectedBook(book);
    setIsLoading(true);
    setError(null);
    setStep('extract');

    try {
      const text = await gutenbergService.fetchBookText(book);
      const extracted = gutenbergService.extractPassages(text, book, {
        minWords: minWords(),
        maxWords: maxWords(),
        minInterestingness: minInterestingness(),
        maxPassages: 20,
      });

      setPassages(extracted);

      // Auto-select top 5 passages
      const topPassages = new Set(extracted.slice(0, 5).map(p => p.id));
      setSelectedPassages(topPassages);
    } catch (err: any) {
      setError(err.message || 'Failed to extract passages');
      setPassages([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle passage selection
  const togglePassage = (passageId: string) => {
    const current = new Set(selectedPassages());
    if (current.has(passageId)) {
      current.delete(passageId);
    } else {
      current.add(passageId);
    }
    setSelectedPassages(current);
  };

  // Publish selected passages
  const handlePublishAll = async () => {
    const token = authStore.token();
    const node = selectedNode();
    if (!token || !node) return;

    const toPublish = passages().filter(p => selectedPassages().has(p.id));
    if (toPublish.length === 0) {
      setError('No passages selected');
      return;
    }

    setIsPublishing(true);
    setPublishProgress({ current: 0, total: toPublish.length });
    setError(null);

    const results: { success: boolean; title: string; error?: string }[] = [];

    for (let i = 0; i < toPublish.length; i++) {
      const passage = toPublish[i];
      setPublishProgress({ current: i + 1, total: toPublish.length });

      try {
        // Format content with attribution
        const content = formatPassageForPublication(passage);

        // Publish narrative
        await nodesService.publishNarrative(
          node.id,
          {
            title: passage.title,
            content,
            tags: passage.themes,
            visibility: 'public',
          },
          token
        );

        results.push({ success: true, title: passage.title });
      } catch (err: any) {
        results.push({ success: false, title: passage.title, error: err.message });
      }
    }

    setIsPublishing(false);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (failCount === 0) {
      setSuccess(`Successfully published ${successCount} narratives to ${node.name}!`);
      setStep('publish');
    } else {
      setError(`Published ${successCount}/${toPublish.length}. ${failCount} failed.`);
    }
  };

  // Format passage with attribution
  const formatPassageForPublication = (passage: ExtractedPassage): string => {
    const attribution = `\n\n---\n\n*From "${passage.bookTitle}" by ${passage.author}*`;
    const locationNote = passage.location.chapter
      ? `\n*${passage.location.chapter}*`
      : '';

    return passage.content + attribution + locationNote;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  };

  return (
    <div class="node-seeder">
      {/* Header */}
      <div class="seeder-header">
        <h2>Seed Node with Gutenberg</h2>
        <p class="seeder-subtitle">
          Jump-start a Curator by giving it founding documents from the public domain.
        </p>
        <Show when={props.onClose}>
          <button class="btn-icon close-btn" onClick={props.onClose}>✕</button>
        </Show>
      </div>

      {/* Progress Steps */}
      <div class="seeder-steps">
        <div class={`step ${step() === 'select-node' ? 'active' : selectedNode() ? 'done' : ''}`}>
          <span class="step-num">1</span>
          <span>Select Node</span>
        </div>
        <div class={`step ${step() === 'select-book' ? 'active' : selectedBook() ? 'done' : ''}`}>
          <span class="step-num">2</span>
          <span>Choose Source</span>
        </div>
        <div class={`step ${step() === 'extract' ? 'active' : passages().length > 0 ? 'done' : ''}`}>
          <span class="step-num">3</span>
          <span>Extract Passages</span>
        </div>
        <div class={`step ${step() === 'publish' ? 'active' : ''}`}>
          <span class="step-num">4</span>
          <span>Publish</span>
        </div>
      </div>

      {/* Alerts */}
      <Show when={error()}>
        <div class="seeder-alert error">
          <span>⚠️ {error()}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      </Show>
      <Show when={success()}>
        <div class="seeder-alert success">
          <span>✓ {success()}</span>
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      </Show>

      {/* Content */}
      <div class="seeder-content">
        {/* Step 1: Select Node */}
        <Show when={step() === 'select-node'}>
          <div class="step-content">
            <h3>Select a Node to Seed</h3>
            <p>Choose a Node that will receive the founding narratives:</p>

            <Show when={nodes.loading}>
              <div class="loading-state">Loading your nodes...</div>
            </Show>

            <Show when={!nodes.loading && nodes()?.length === 0}>
              <div class="empty-state">
                <p>You don't have any nodes yet.</p>
                <p>Create one first from the Admin panel.</p>
              </div>
            </Show>

            <div class="node-selector">
              <For each={nodes()}>
                {(node) => (
                  <div
                    class={`node-option ${selectedNode()?.id === node.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedNode(node);
                      setStep('select-book');
                    }}
                  >
                    <div class="node-name">{node.name}</div>
                    <div class="node-desc">{node.description || 'No description'}</div>
                    <div class="node-stats">
                      {node.archiveMetadata?.narrativeCount || 0} narratives
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Step 2: Select Book */}
        <Show when={step() === 'select-book'}>
          <div class="step-content">
            <div class="step-header">
              <button class="back-btn" onClick={() => setStep('select-node')}>
                ← Back
              </button>
              <h3>Choose a Source Text</h3>
            </div>

            <p>Select a book from the curated lists to extract passages from:</p>

            <div class="category-tabs">
              <For each={Object.keys(CURATED_BOOKS) as (keyof typeof CURATED_BOOKS)[]}>
                {(category) => (
                  <div class="category-section">
                    <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                    <div class="book-list">
                      <For each={CURATED_BOOKS[category]}>
                        {(book) => (
                          <div
                            class="book-option"
                            onClick={() => handleSelectBook(book as SimpleBook)}
                          >
                            <div class="book-title">{book.title}</div>
                            <div class="book-author">{book.author}</div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Step 3: Extract & Review Passages */}
        <Show when={step() === 'extract'}>
          <div class="step-content">
            <div class="step-header">
              <button class="back-btn" onClick={() => setStep('select-book')}>
                ← Back
              </button>
              <h3>Review Passages</h3>
            </div>

            <Show when={isLoading()}>
              <div class="loading-state">
                <div class="spinner"></div>
                <p>Extracting passages from "{selectedBook()?.title}"...</p>
              </div>
            </Show>

            <Show when={!isLoading() && passages().length > 0}>
              <div class="extract-summary">
                <p>
                  Found <strong>{passages().length}</strong> interesting passages.
                  <span class="selected-count">
                    {selectedPassages().size} selected for publishing
                  </span>
                </p>

                <div class="bulk-actions">
                  <button
                    class="btn-sm"
                    onClick={() => setSelectedPassages(new Set(passages().map(p => p.id)))}
                  >
                    Select All
                  </button>
                  <button
                    class="btn-sm"
                    onClick={() => setSelectedPassages(new Set())}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div class="passage-grid">
                <For each={passages()}>
                  {(passage, index) => (
                    <div
                      class={`passage-item ${selectedPassages().has(passage.id) ? 'selected' : ''}`}
                      onClick={() => togglePassage(passage.id)}
                    >
                      <div class="passage-check">
                        {selectedPassages().has(passage.id) ? '✓' : '○'}
                      </div>
                      <div class="passage-content">
                        <div class="passage-header">
                          <span class="rank">#{index() + 1}</span>
                          <span class={`score ${getScoreColor(passage.interestingnessScore)}`}>
                            {passage.interestingnessScore}%
                          </span>
                        </div>
                        <div class="passage-title">{passage.title}</div>
                        <div class="passage-preview">
                          {passage.content.substring(0, 150)}...
                        </div>
                        <div class="passage-themes">
                          <For each={passage.themes.slice(0, 3)}>
                            {(theme) => <span class="theme">{theme}</span>}
                          </For>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class="publish-action">
                <button
                  class="btn-primary"
                  onClick={handlePublishAll}
                  disabled={selectedPassages().size === 0 || isPublishing()}
                >
                  {isPublishing()
                    ? `Publishing ${publishProgress().current}/${publishProgress().total}...`
                    : `Publish ${selectedPassages().size} Narratives to ${selectedNode()?.name}`}
                </button>
              </div>
            </Show>
          </div>
        </Show>

        {/* Step 4: Complete */}
        <Show when={step() === 'publish'}>
          <div class="step-content complete">
            <div class="complete-icon">🎉</div>
            <h3>Node Seeded Successfully!</h3>
            <p>
              Your Curator now has founding documents to learn from.
              As users engage with these narratives, the Curator will develop
              its voice and perspective based on these core texts.
            </p>

            <div class="complete-stats">
              <div class="stat">
                <span class="stat-value">{selectedPassages().size}</span>
                <span class="stat-label">Narratives Published</span>
              </div>
              <div class="stat">
                <span class="stat-value">{selectedBook()?.title}</span>
                <span class="stat-label">Source Text</span>
              </div>
            </div>

            <div class="complete-actions">
              <button
                class="btn-primary"
                onClick={() => {
                  // Reset and start over
                  setStep('select-book');
                  setPassages([]);
                  setSelectedPassages(new Set());
                  setSelectedBook(null);
                  setSuccess(null);
                }}
              >
                Add More Sources
              </button>
              <button
                class="btn-secondary"
                onClick={props.onComplete || props.onClose}
              >
                Done
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default NodeSeeder;
