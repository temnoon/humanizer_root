/**
 * Node Creation Wizard
 *
 * Multi-step wizard for creating nodes with optional Gutenberg book source.
 *
 * Steps:
 * 1. Node basics (name, description)
 * 2. Source type (Empty, Gutenberg Book, PDF upload)
 * 3. Source selection (book picker or file upload)
 * 4. Build progress (pyramid construction)
 * 5. Complete (show curator ready)
 */

import { Component, Show, For, createSignal, createResource, createEffect, onCleanup } from 'solid-js';
import { authStore } from '@/stores/auth';
import { nodesService } from '@/services/nodes';
import type { Node } from '@/types/models';

type WizardStep = 'basics' | 'source-type' | 'source-select' | 'building' | 'complete';
type SourceType = 'empty' | 'gutenberg' | 'pdf';

interface WellKnownBook {
  slug: string;
  gutenbergId: string;
  title?: string;
}

// Book titles for display (ordered by length - shortest first)
const BOOK_TITLES: Record<string, string> = {
  // Short works - fast to build
  'crito': 'Crito (Plato)',
  'apology': 'Apology (Plato)',
  'metamorphosis': 'The Metamorphosis',
  'symposium': 'Symposium (Plato)',
  'phaedo': 'Phaedo (Plato)',

  // Medium works
  'frankenstein': 'Frankenstein',
  'picture-of-dorian-gray': 'The Picture of Dorian Gray',
  'great-gatsby': 'The Great Gatsby',
  'pride-and-prejudice': 'Pride and Prejudice',
  'dracula': 'Dracula',
  'jane-eyre': 'Jane Eyre',
  'wuthering-heights': 'Wuthering Heights',
  'crime-and-punishment': 'Crime and Punishment',
  'tale-of-two-cities': 'A Tale of Two Cities',
  'republic': 'The Republic (Plato)',

  // Long works - may take longer
  'moby-dick': 'Moby Dick',
  'war-and-peace': 'War and Peace',
  'odyssey': 'The Odyssey',
  'iliad': 'The Iliad',
  'divine-comedy': 'Divine Comedy',
  'don-quixote': 'Don Quixote',
  'brothers-karamazov': 'The Brothers Karamazov',
  'anna-karenina': 'Anna Karenina',
  'les-miserables': 'Les Misérables',
  'count-of-monte-cristo': 'The Count of Monte Cristo',

  // Science & Philosophy
  'principia': 'Principia (Newton)',
};

interface NodeCreationWizardProps {
  onComplete?: (node: Node) => void;
  onClose?: () => void;
}

export const NodeCreationWizard: Component<NodeCreationWizardProps> = (props) => {
  // Step state
  const [step, setStep] = createSignal<WizardStep>('basics');

  // Form data
  const [nodeName, setNodeName] = createSignal('');
  const [nodeDescription, setNodeDescription] = createSignal('');
  const [sourceType, setSourceType] = createSignal<SourceType>('gutenberg');
  const [selectedBook, setSelectedBook] = createSignal<WellKnownBook | null>(null);
  const [customGutenbergId, setCustomGutenbergId] = createSignal('');

  // Build state
  const [createdNode, setCreatedNode] = createSignal<Node | null>(null);
  const [buildProgress, setBuildProgress] = createSignal('');
  const [buildResult, setBuildResult] = createSignal<{
    success: boolean;
    chunks?: number;
    themes?: string[];
    question?: string;
    error?: string;
  } | null>(null);

  // UI state
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch well-known books
  const [books] = createResource(async () => {
    try {
      return await nodesService.getWellKnownBooks();
    } catch (e) {
      console.error('Failed to fetch books:', e);
      return [];
    }
  });

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  };

  // Step 1: Create the node
  const handleCreateNode = async () => {
    const token = authStore.token();
    if (!token || !nodeName()) return;

    setIsLoading(true);
    setError(null);

    try {
      const node = await nodesService.createNode({
        name: nodeName(),
        description: nodeDescription() || `A node exploring ${nodeName()}`,
      }, token);

      setCreatedNode(node);

      if (sourceType() === 'empty') {
        setStep('complete');
      } else {
        setStep('source-select');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create node');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Build pyramid from source
  const handleBuildPyramid = async () => {
    const token = authStore.token();
    const node = createdNode();
    if (!token || !node) return;

    setIsLoading(true);
    setError(null);
    setStep('building');
    setBuildProgress('Fetching text from Project Gutenberg...');

    try {
      let result;

      if (selectedBook()) {
        setBuildProgress(`Building pyramid for "${BOOK_TITLES[selectedBook()!.slug] || selectedBook()!.slug}"...`);
        result = await nodesService.buildPyramidFromGutenberg(
          node.id,
          selectedBook()!.slug,
          token
        );
      } else if (customGutenbergId()) {
        setBuildProgress(`Building pyramid for Gutenberg ID ${customGutenbergId()}...`);
        result = await nodesService.buildPyramidFromGutenbergId(
          node.id,
          customGutenbergId(),
          token
        );
      } else {
        throw new Error('No source selected');
      }

      setBuildProgress('Pyramid complete! Curator is awakening...');
      setBuildResult({
        success: true,
        chunks: result.stats.totalChunks,
        themes: result.apex.themes.filter(t => t.length < 100).slice(0, 3),
        question: result.apex.theQuestion?.split('\n')[0],
      });

      setStep('complete');
    } catch (e) {
      setBuildResult({
        success: false,
        error: e instanceof Error ? e.message : 'Build failed',
      });
      setError(e instanceof Error ? e.message : 'Failed to build pyramid');
      setStep('complete');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate back
  const handleBack = () => {
    const currentStep = step();
    if (currentStep === 'source-type') setStep('basics');
    else if (currentStep === 'source-select') setStep('source-type');
  };

  return (
    <div class="node-wizard-overlay">
      <div class="node-wizard">
        {/* Header */}
        <div class="wizard-header">
          <h2>Create New Node</h2>
          <button class="close-btn" onClick={props.onClose}>×</button>
        </div>

        {/* Progress indicator */}
        <div class="wizard-progress">
          <div class={`step ${step() === 'basics' ? 'active' : (step() !== 'basics' ? 'done' : '')}`}>1. Basics</div>
          <div class={`step ${step() === 'source-type' ? 'active' : ''}`}>2. Source</div>
          <div class={`step ${step() === 'source-select' || step() === 'building' ? 'active' : ''}`}>3. Build</div>
          <div class={`step ${step() === 'complete' ? 'active' : ''}`}>4. Done</div>
        </div>

        {/* Error display */}
        <Show when={error()}>
          <div class="wizard-error">{error()}</div>
        </Show>

        {/* Step 1: Node Basics */}
        <Show when={step() === 'basics'}>
          <div class="wizard-step">
            <h3>Node Details</h3>
            <p class="step-description">Give your node a name. The curator's identity will emerge from the content you add.</p>

            <div class="form-group">
              <label>Node Name *</label>
              <input
                type="text"
                value={nodeName()}
                onInput={(e) => setNodeName(e.currentTarget.value)}
                placeholder="e.g., Moby Dick, Philosophy of Mind, My Research"
                maxLength={100}
              />
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea
                value={nodeDescription()}
                onInput={(e) => setNodeDescription(e.currentTarget.value)}
                placeholder="What is this node about? What themes will it explore?"
                rows={3}
              />
            </div>

            <div class="wizard-actions">
              <button class="btn-secondary" onClick={props.onClose}>Cancel</button>
              <button
                class="btn-primary"
                disabled={!nodeName().trim()}
                onClick={() => setStep('source-type')}
              >
                Next: Choose Source
              </button>
            </div>
          </div>
        </Show>

        {/* Step 2: Source Type */}
        <Show when={step() === 'source-type'}>
          <div class="wizard-step">
            <h3>Choose Content Source</h3>
            <p class="step-description">The curator learns from the content in your node. You can start empty or seed it with a classic text.</p>

            <div class="source-options">
              <button
                class={`source-option ${sourceType() === 'gutenberg' ? 'selected' : ''}`}
                onClick={() => setSourceType('gutenberg')}
              >
                <div class="source-icon">📚</div>
                <div class="source-title">Project Gutenberg Book</div>
                <div class="source-desc">Start with a classic literary work. The curator will embody the book's themes and voice.</div>
              </button>

              <button
                class={`source-option ${sourceType() === 'empty' ? 'selected' : ''}`}
                onClick={() => setSourceType('empty')}
              >
                <div class="source-icon">✨</div>
                <div class="source-title">Start Empty</div>
                <div class="source-desc">Create an empty node. Add narratives later and the curator will learn from them.</div>
              </button>

              <button
                class={`source-option ${sourceType() === 'pdf' ? 'selected' : ''} disabled`}
                onClick={() => {}}
                disabled
              >
                <div class="source-icon">📄</div>
                <div class="source-title">Upload PDF</div>
                <div class="source-desc">Coming soon - upload your own documents.</div>
              </button>
            </div>

            <div class="wizard-actions">
              <button class="btn-secondary" onClick={handleBack}>Back</button>
              <button
                class="btn-primary"
                disabled={isLoading()}
                onClick={handleCreateNode}
              >
                {isLoading() ? 'Creating...' : (sourceType() === 'empty' ? 'Create Node' : 'Next: Select Book')}
              </button>
            </div>
          </div>
        </Show>

        {/* Step 3: Source Selection (Gutenberg) */}
        <Show when={step() === 'source-select' && sourceType() === 'gutenberg'}>
          <div class="wizard-step">
            <h3>Select a Book</h3>
            <p class="step-description">Choose a classic text. The curator will read and internalize the entire work.</p>

            <div class="book-grid">
              <For each={books()}>
                {(book) => (
                  <button
                    class={`book-card ${selectedBook()?.slug === book.slug ? 'selected' : ''}`}
                    onClick={() => setSelectedBook(book)}
                  >
                    <div class="book-title">{BOOK_TITLES[book.slug] || book.slug}</div>
                    <div class="book-id">ID: {book.gutenbergId}</div>
                  </button>
                )}
              </For>
            </div>

            <div class="custom-id-section">
              <label>Or enter a custom Gutenberg ID:</label>
              <input
                type="text"
                value={customGutenbergId()}
                onInput={(e) => {
                  setCustomGutenbergId(e.currentTarget.value);
                  if (e.currentTarget.value) setSelectedBook(null);
                }}
                placeholder="e.g., 2701"
              />
              <a href="https://www.gutenberg.org/" target="_blank" rel="noopener">
                Browse Gutenberg →
              </a>
            </div>

            <div class="wizard-actions">
              <button class="btn-secondary" onClick={handleBack}>Back</button>
              <button
                class="btn-primary"
                disabled={!selectedBook() && !customGutenbergId()}
                onClick={handleBuildPyramid}
              >
                Build Curator
              </button>
            </div>
          </div>
        </Show>

        {/* Step 4: Building */}
        <Show when={step() === 'building'}>
          <div class="wizard-step building-step">
            <div class="building-animation">
              <div class="spinner"></div>
            </div>
            <h3>Building Curator</h3>
            <p class="build-progress">{buildProgress()}</p>
            <p class="build-note">This may take 1-2 minutes for longer texts...</p>
          </div>
        </Show>

        {/* Step 5: Complete */}
        <Show when={step() === 'complete'}>
          <div class="wizard-step complete-step">
            <Show when={buildResult()?.success !== false}>
              <div class="success-icon">✓</div>
              <h3>Node Created!</h3>

              <Show when={buildResult()}>
                <div class="build-summary">
                  <div class="summary-item">
                    <span class="label">Chunks indexed:</span>
                    <span class="value">{buildResult()?.chunks}</span>
                  </div>
                  <Show when={buildResult()?.question}>
                    <div class="summary-item themes">
                      <span class="label">The curator's question:</span>
                      <p class="value">{buildResult()?.question}</p>
                    </div>
                  </Show>
                </div>
              </Show>

              <p class="complete-message">
                Your curator is ready. They've absorbed the text and are prepared to discuss it with visitors.
              </p>
            </Show>

            <Show when={buildResult()?.success === false}>
              <div class="error-icon">!</div>
              <h3>Build Failed</h3>
              <p class="error-message">{buildResult()?.error}</p>
              <p>Your node was created, but the pyramid build failed. You can try again later from the node settings.</p>
            </Show>

            <div class="wizard-actions">
              <button
                class="btn-primary"
                onClick={() => {
                  if (createdNode()) {
                    props.onComplete?.(createdNode()!);
                  }
                  props.onClose?.();
                }}
              >
                Go to Node
              </button>
            </div>
          </div>
        </Show>
      </div>

      <style>{`
        .node-wizard-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .node-wizard {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .wizard-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: var(--text-primary, #fff);
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: var(--text-primary, #fff);
        }

        .wizard-progress {
          display: flex;
          padding: 16px 24px;
          gap: 8px;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .wizard-progress .step {
          flex: 1;
          text-align: center;
          padding: 8px;
          font-size: 0.75rem;
          color: var(--text-muted, #666);
          border-radius: 4px;
          background: var(--bg-tertiary, #252540);
        }

        .wizard-progress .step.active {
          background: var(--accent-purple, #8b5cf6);
          color: white;
        }

        .wizard-progress .step.done {
          background: var(--accent-green, #22c55e);
          color: white;
        }

        .wizard-error {
          margin: 16px 24px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--accent-red, #ef4444);
          border-radius: 8px;
          color: var(--accent-red, #ef4444);
          font-size: 0.875rem;
        }

        .wizard-step {
          padding: 24px;
        }

        .wizard-step h3 {
          margin: 0 0 8px 0;
          color: var(--text-primary, #fff);
        }

        .step-description {
          color: var(--text-secondary, #888);
          margin-bottom: 24px;
          font-size: 0.875rem;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary, #888);
          font-size: 0.875rem;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          background: var(--bg-tertiary, #252540);
          color: var(--text-primary, #fff);
          font-size: 1rem;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--accent-purple, #8b5cf6);
        }

        .source-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .source-option {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          border: 2px solid var(--border-color, #333);
          border-radius: 12px;
          background: var(--bg-tertiary, #252540);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .source-option:hover:not(.disabled) {
          border-color: var(--accent-purple, #8b5cf6);
        }

        .source-option.selected {
          border-color: var(--accent-purple, #8b5cf6);
          background: rgba(139, 92, 246, 0.1);
        }

        .source-option.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .source-icon {
          font-size: 24px;
        }

        .source-title {
          font-weight: 600;
          color: var(--text-primary, #fff);
          margin-bottom: 4px;
        }

        .source-desc {
          font-size: 0.8rem;
          color: var(--text-secondary, #888);
        }

        .book-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 20px;
          padding: 4px;
        }

        .book-card {
          padding: 12px;
          border: 2px solid var(--border-color, #333);
          border-radius: 8px;
          background: var(--bg-tertiary, #252540);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .book-card:hover {
          border-color: var(--accent-purple, #8b5cf6);
        }

        .book-card.selected {
          border-color: var(--accent-purple, #8b5cf6);
          background: rgba(139, 92, 246, 0.1);
        }

        .book-title {
          font-weight: 500;
          color: var(--text-primary, #fff);
          font-size: 0.875rem;
          margin-bottom: 4px;
        }

        .book-id {
          font-size: 0.7rem;
          color: var(--text-muted, #666);
        }

        .custom-id-section {
          padding: 16px;
          background: var(--bg-tertiary, #252540);
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .custom-id-section label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary, #888);
          font-size: 0.875rem;
        }

        .custom-id-section input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #333);
          border-radius: 6px;
          background: var(--bg-secondary, #1a1a2e);
          color: var(--text-primary, #fff);
          margin-bottom: 8px;
        }

        .custom-id-section a {
          font-size: 0.8rem;
          color: var(--accent-purple, #8b5cf6);
        }

        .wizard-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #333);
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: var(--accent-purple, #8b5cf6);
          color: white;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--accent-purple-hover, #7c3aed);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-secondary, #888);
          border: 1px solid var(--border-color, #333);
        }

        .btn-secondary:hover {
          color: var(--text-primary, #fff);
          border-color: var(--text-secondary, #888);
        }

        .building-step {
          text-align: center;
          padding: 48px 24px;
        }

        .building-animation {
          margin-bottom: 24px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--border-color, #333);
          border-top-color: var(--accent-purple, #8b5cf6);
          border-radius: 50%;
          margin: 0 auto;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .build-progress {
          color: var(--text-primary, #fff);
          margin-bottom: 8px;
        }

        .build-note {
          color: var(--text-muted, #666);
          font-size: 0.8rem;
        }

        .complete-step {
          text-align: center;
          padding: 32px 24px;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          background: var(--accent-green, #22c55e);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: white;
          margin: 0 auto 24px;
        }

        .error-icon {
          width: 64px;
          height: 64px;
          background: var(--accent-red, #ef4444);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: white;
          margin: 0 auto 24px;
        }

        .build-summary {
          background: var(--bg-tertiary, #252540);
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
          text-align: left;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .summary-item.themes {
          flex-direction: column;
        }

        .summary-item .label {
          color: var(--text-secondary, #888);
          font-size: 0.875rem;
        }

        .summary-item .value {
          color: var(--text-primary, #fff);
        }

        .summary-item.themes .value {
          margin-top: 8px;
          font-style: italic;
          font-size: 0.9rem;
        }

        .complete-message {
          color: var(--text-secondary, #888);
          margin-bottom: 24px;
        }

        .error-message {
          color: var(--accent-red, #ef4444);
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
};

export default NodeCreationWizard;
