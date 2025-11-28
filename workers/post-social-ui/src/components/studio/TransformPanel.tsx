/**
 * Transform Panel - Right Panel for Text Transformations
 *
 * Tools available:
 * - Translate: Direct translation between 54+ languages
 * - Detect: AI content detection
 * - Humanize: Make AI text more human
 * - Persona: Transform narrative voice
 * - Style: Transform writing style
 * - Round-Trip: Semantic drift analysis
 */

import { Component, createSignal, createResource, Show, For, createEffect, on } from 'solid-js';
import { authStore } from '@/stores/auth';
import {
  transformationService,
  type TransformTool,
  type LanguageCategories,
  type AIDetectionResult,
  LANGUAGE_CATEGORY_LABELS,
  ROUND_TRIP_LANGUAGES,
  HUMANIZER_INTENSITIES,
} from '@/services/transformations';
import { PersonaBrowser } from './PersonaBrowser';

interface TransformPanelProps {
  content: string;
  onApplyTransform?: (transformedText: string) => void;
  onSubmitAsNarrative?: (transformedText: string, title?: string) => void;
}

type HumanizerIntensity = 'light' | 'moderate' | 'aggressive';

export const TransformPanel: Component<TransformPanelProps> = (props) => {
  // Tool selection
  const [activeTool, setActiveTool] = createSignal<TransformTool>('translate');

  // Translation state
  const [sourceLanguage, setSourceLanguage] = createSignal<string>('');
  const [targetLanguage, setTargetLanguage] = createSignal<string>('english');
  const [expandedCategory, setExpandedCategory] = createSignal<string | null>(null);

  // AI Detection state
  const [useLLMJudge, setUseLLMJudge] = createSignal(false);
  const [detectionResult, setDetectionResult] = createSignal<AIDetectionResult | null>(null);

  // Humanizer state
  const [humanizerIntensity, setHumanizerIntensity] = createSignal<HumanizerIntensity>('moderate');

  // Persona/Style state
  const [selectedPersona, setSelectedPersona] = createSignal<string>('');
  const [selectedStyle, setSelectedStyle] = createSignal<string>('');
  const [personaInputMode, setPersonaInputMode] = createSignal<'browse' | 'custom'>('browse');

  // Round-trip state
  const [roundTripLanguage, setRoundTripLanguage] = createSignal<string>('spanish');

  // Transform state
  const [isTransforming, setIsTransforming] = createSignal(false);
  const [transformError, setTransformError] = createSignal<string | null>(null);
  const [transformedText, setTransformedText] = createSignal<string>('');
  const [processingTime, setProcessingTime] = createSignal<number | null>(null);

  // Fetch supported languages
  const [languages] = createResource(async () => {
    try {
      return await transformationService.getSupportedLanguages();
    } catch (err) {
      console.error('Failed to load languages:', err);
      return { languages: [], categories: {} } as LanguageCategories;
    }
  });

  // Reset transformed text when content changes
  createEffect(on(
    () => props.content,
    () => {
      setTransformedText('');
      setTransformError(null);
      setDetectionResult(null);
    },
    { defer: true }
  ));

  // Tool definitions
  const tools: Array<{ id: TransformTool; label: string; icon: string }> = [
    { id: 'translate', label: 'Translate', icon: '🌐' },
    { id: 'detect', label: 'Detect', icon: '🔍' },
    { id: 'humanize', label: 'Humanize', icon: '🧬' },
    { id: 'persona', label: 'Persona', icon: '🎭' },
    { id: 'style', label: 'Style', icon: '✍️' },
    { id: 'roundtrip', label: 'Round-Trip', icon: '🔄' },
  ];

  // Categorized language picker toggle
  const toggleCategory = (category: string) => {
    setExpandedCategory(prev => prev === category ? null : category);
  };

  // Select a language
  const selectLanguage = (lang: string, isTarget: boolean = true) => {
    if (isTarget) {
      setTargetLanguage(lang);
    } else {
      setSourceLanguage(lang);
    }
    setExpandedCategory(null);
  };

  // Format language name for display
  const formatLanguageName = (lang: string) => {
    return lang.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Execute transformation
  const handleTransform = async () => {
    if (!props.content.trim()) {
      setTransformError('No content to transform');
      return;
    }

    // Get auth token
    const token = authStore.token();
    if (!token) {
      setTransformError('Please log in to use transformations');
      return;
    }

    setIsTransforming(true);
    setTransformError(null);
    setTransformedText('');
    setProcessingTime(null);

    try {
      const startTime = Date.now();
      const tool = activeTool();

      switch (tool) {
        case 'translate': {
          const result = await transformationService.translate(
            props.content,
            targetLanguage(),
            sourceLanguage() || undefined,
            token
          );
          setTransformedText(result.translated_text);
          setProcessingTime(result.processing_time_ms);
          break;
        }

        case 'detect': {
          const result = await transformationService.detectAI(props.content, useLLMJudge(), token);
          setDetectionResult(result);
          setProcessingTime(result.processingTimeMs);
          // For detect, we don't set transformed text - we show the detection result
          break;
        }

        case 'humanize': {
          const result = await transformationService.humanize(props.content, humanizerIntensity(), undefined, token);
          setTransformedText(result.humanizedText);
          setProcessingTime(result.processing?.total_ms || Date.now() - startTime);
          break;
        }

        case 'persona': {
          if (!selectedPersona()) {
            setTransformError('Please select a persona');
            break;
          }
          const result = await transformationService.transformPersona(props.content, selectedPersona(), token);
          setTransformedText(result.transformed_text);
          setProcessingTime(result.processing?.total_ms || Date.now() - startTime);
          break;
        }

        case 'style': {
          if (!selectedStyle()) {
            setTransformError('Please select a style');
            break;
          }
          const result = await transformationService.transformStyle(props.content, selectedStyle(), token);
          setTransformedText(result.transformed_text);
          setProcessingTime(result.processing?.total_ms || Date.now() - startTime);
          break;
        }

        case 'roundtrip': {
          const result = await transformationService.roundTrip(props.content, roundTripLanguage(), token);
          setTransformedText(result.backward_translation);
          setProcessingTime(Date.now() - startTime);
          break;
        }
      }
    } catch (err) {
      console.error('Transformation failed:', err);
      setTransformError(err instanceof Error ? err.message : 'Transformation failed');
    } finally {
      setIsTransforming(false);
    }
  };

  // Apply transformation to editor
  const handleApply = () => {
    if (transformedText() && props.onApplyTransform) {
      props.onApplyTransform(transformedText());
    }
  };

  // Submit as narrative
  const handleSubmitAsNarrative = () => {
    if (transformedText() && props.onSubmitAsNarrative) {
      props.onSubmitAsNarrative(transformedText());
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (transformedText()) {
      await navigator.clipboard.writeText(transformedText());
    }
  };

  // Get AI detection label color
  const getDetectionColor = (label: string) => {
    switch (label) {
      case 'likely_human': return 'var(--color-success, #22c55e)';
      case 'mixed': return 'var(--color-warning, #f59e0b)';
      case 'likely_ai': return 'var(--color-error, #ef4444)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div class="transform-panel">
      {/* Tool Tabs */}
      <div class="transform-tabs">
        <For each={tools}>
          {(tool) => (
            <button
              class={`transform-tab ${activeTool() === tool.id ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
            >
              <span class="tab-icon">{tool.icon}</span>
              <span class="tab-label">{tool.label}</span>
            </button>
          )}
        </For>
      </div>

      {/* Tool-Specific Controls */}
      <div class="transform-controls">
        {/* Translate Controls */}
        <Show when={activeTool() === 'translate'}>
          <div class="control-group">
            <label class="control-label">Source Language</label>
            <div class="language-picker">
              <button
                class="language-selected"
                onClick={() => toggleCategory('source')}
              >
                {sourceLanguage() ? formatLanguageName(sourceLanguage()) : 'Auto-detect'}
              </button>
              <Show when={expandedCategory() === 'source'}>
                <div class="language-dropdown">
                  <button
                    class="language-option"
                    onClick={() => { setSourceLanguage(''); setExpandedCategory(null); }}
                  >
                    Auto-detect
                  </button>
                  <For each={Object.entries(languages()?.categories || {})}>
                    {([category, langs]) => (
                      <div class="language-category">
                        <div class="category-header">
                          {LANGUAGE_CATEGORY_LABELS[category] || category}
                        </div>
                        <For each={langs}>
                          {(lang) => (
                            <button
                              class={`language-option ${sourceLanguage() === lang ? 'selected' : ''}`}
                              onClick={() => selectLanguage(lang, false)}
                            >
                              {formatLanguageName(lang)}
                            </button>
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          <div class="control-group">
            <label class="control-label">Target Language</label>
            <div class="language-picker">
              <button
                class="language-selected"
                onClick={() => toggleCategory('target')}
              >
                {formatLanguageName(targetLanguage())}
              </button>
              <Show when={expandedCategory() === 'target'}>
                <div class="language-dropdown">
                  <For each={Object.entries(languages()?.categories || {})}>
                    {([category, langs]) => (
                      <div class="language-category">
                        <div class="category-header">
                          {LANGUAGE_CATEGORY_LABELS[category] || category}
                        </div>
                        <For each={langs}>
                          {(lang) => (
                            <button
                              class={`language-option ${targetLanguage() === lang ? 'selected' : ''}`}
                              onClick={() => selectLanguage(lang, true)}
                            >
                              {formatLanguageName(lang)}
                            </button>
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        {/* AI Detection Controls */}
        <Show when={activeTool() === 'detect'}>
          <div class="control-group">
            <label class="control-checkbox">
              <input
                type="checkbox"
                checked={useLLMJudge()}
                onChange={(e) => setUseLLMJudge(e.currentTarget.checked)}
              />
              <span>Use LLM Judge (more accurate, slower)</span>
            </label>
          </div>
        </Show>

        {/* Humanizer Controls */}
        <Show when={activeTool() === 'humanize'}>
          <div class="control-group">
            <label class="control-label">Intensity</label>
            <div class="intensity-options">
              <For each={Object.entries(HUMANIZER_INTENSITIES)}>
                {([key, { label, description }]) => (
                  <button
                    class={`intensity-option ${humanizerIntensity() === key ? 'active' : ''}`}
                    onClick={() => setHumanizerIntensity(key as HumanizerIntensity)}
                    title={description}
                  >
                    {label}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Persona Controls */}
        <Show when={activeTool() === 'persona'}>
          <div class="control-group">
            {/* Mode Toggle */}
            <div class="persona-mode-toggle">
              <button
                class={`mode-btn ${personaInputMode() === 'browse' ? 'active' : ''}`}
                onClick={() => setPersonaInputMode('browse')}
              >
                Browse Personas
              </button>
              <button
                class={`mode-btn ${personaInputMode() === 'custom' ? 'active' : ''}`}
                onClick={() => setPersonaInputMode('custom')}
              >
                Enter Custom
              </button>
            </div>

            {/* Browse Mode */}
            <Show when={personaInputMode() === 'browse'}>
              <PersonaBrowser
                selectedPersona={selectedPersona()}
                onSelectPersona={(name) => setSelectedPersona(name)}
              />
            </Show>

            {/* Custom Text Mode */}
            <Show when={personaInputMode() === 'custom'}>
              <label class="control-label">Persona</label>
              <input
                type="text"
                class="control-input"
                placeholder="Enter persona name (e.g., 'Hemingway')"
                value={selectedPersona()}
                onInput={(e) => setSelectedPersona(e.currentTarget.value)}
              />
              <p class="control-hint">Enter a character name, author, or archetype</p>
            </Show>

            {/* Selected Persona Display */}
            <Show when={selectedPersona()}>
              <div class="selected-persona-display">
                Selected: <strong>{selectedPersona()}</strong>
              </div>
            </Show>
          </div>
        </Show>

        {/* Style Controls */}
        <Show when={activeTool() === 'style'}>
          <div class="control-group">
            <label class="control-label">Style</label>
            <input
              type="text"
              class="control-input"
              placeholder="Enter style (e.g., 'academic', 'casual')"
              value={selectedStyle()}
              onInput={(e) => setSelectedStyle(e.currentTarget.value)}
            />
            <p class="control-hint">Enter a writing style to apply</p>
          </div>
        </Show>

        {/* Round-Trip Controls */}
        <Show when={activeTool() === 'roundtrip'}>
          <div class="control-group">
            <label class="control-label">Intermediate Language</label>
            <select
              class="control-select"
              value={roundTripLanguage()}
              onChange={(e) => setRoundTripLanguage(e.currentTarget.value)}
            >
              <For each={ROUND_TRIP_LANGUAGES}>
                {(lang) => (
                  <option value={lang}>{formatLanguageName(lang)}</option>
                )}
              </For>
            </select>
            <p class="control-hint">Text will be translated to this language and back</p>
          </div>
        </Show>
      </div>

      {/* Transform Button */}
      <div class="transform-action">
        <button
          class="transform-btn primary"
          onClick={handleTransform}
          disabled={isTransforming() || !props.content.trim()}
        >
          {isTransforming() ? 'Transforming...' : 'Transform'}
        </button>
      </div>

      {/* Error Message */}
      <Show when={transformError()}>
        <div class="transform-error">
          {transformError()}
        </div>
      </Show>

      {/* AI Detection Results */}
      <Show when={activeTool() === 'detect' && detectionResult()}>
        <div class="detection-results">
          <div class="detection-verdict">
            <span
              class="verdict-label"
              style={{ color: getDetectionColor(detectionResult()!.label) }}
            >
              {detectionResult()!.label.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span class="verdict-score">
              {Math.round(detectionResult()!.ai_likelihood * 100)}% AI-like
            </span>
            <span class="verdict-confidence">
              ({detectionResult()!.confidence} confidence)
            </span>
          </div>

          <Show when={detectionResult()!.highlights.length > 0}>
            <div class="detection-highlights">
              <h4>Flagged Sections</h4>
              <For each={detectionResult()!.highlights.slice(0, 5)}>
                {(highlight) => (
                  <div class="highlight-item">
                    <span class="highlight-reason">{highlight.reason}</span>
                    <span class="highlight-score">
                      {Math.round(highlight.score * 100)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={detectionResult()!.label !== 'likely_human'}>
            <button
              class="transform-btn secondary"
              onClick={() => { setActiveTool('humanize'); setDetectionResult(null); }}
            >
              Humanize This Text
            </button>
          </Show>
        </div>
      </Show>

      {/* Side-by-Side Preview */}
      <Show when={transformedText() && activeTool() !== 'detect'}>
        <div class="transform-preview">
          <div class="preview-header">
            <span>Result</span>
            <Show when={processingTime()}>
              <span class="processing-time">{processingTime()}ms</span>
            </Show>
          </div>
          <div class="preview-split">
            <div class="preview-pane original">
              <div class="pane-label">Original</div>
              <div class="pane-content">{props.content}</div>
            </div>
            <div class="preview-pane transformed">
              <div class="pane-label">Transformed</div>
              <div class="pane-content">{transformedText()}</div>
            </div>
          </div>
        </div>

        {/* Result Actions */}
        <div class="transform-results-actions">
          <button
            class="transform-btn secondary"
            onClick={handleApply}
            title="Replace editor content with transformed text"
          >
            Apply to Editor
          </button>
          <button
            class="transform-btn primary"
            onClick={handleSubmitAsNarrative}
            title="Submit transformed text as a new narrative"
          >
            Submit as Narrative
          </button>
          <button
            class="transform-btn icon-only"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            📋
          </button>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!props.content.trim()}>
        <div class="transform-empty">
          <p>Enter or paste text in the editor to transform it.</p>
        </div>
      </Show>
    </div>
  );
};
