/**
 * ToolPanes - Individual tool pane components
 *
 * Each pane maintains its own state through ToolTabContext.
 * These are used by the new tabbed ToolsPanel.
 *
 * IMPORTANT: Uses transformationService which respects provider preference (local/cloudflare/Ollama)
 */

import { useState, useEffect, useMemo } from 'react';
import { useToolState, useToolTabs } from '../../contexts/ToolTabContext';
import { useProvider } from '../../contexts/ProviderContext';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspaceTools } from '../../hooks/useWorkspaceTools';
import { runTransform, getProviderInfo } from '../../services/transformationService';
import { api } from '../../utils/api';
import { AddToBookSection } from '../panels/AddToBookSection';
import { FeedbackWidget } from './FeedbackWidget';
import { getCustomProfiles, type CustomProfile } from './ProfileFactoryPane';
import { STORAGE_PATHS } from '../../config/storage-paths';
import { IntensityHelp } from '../ui/IntensityHelp';
import {
  validateTextLength,
  validateMinWordCount,
  getCharLimit,
  type TransformationType,
  type UserTier,
} from '../../config/transformation-limits';
import {
  runChunkedTransform,
  needsChunking,
  canUseChunkedTransform,
} from '../../services/chunkedTransformationService';

// Helper to get friendly model name from model ID
function getModelDisplayName(modelId: string | undefined): string | null {
  if (!modelId) return null;
  const modelMap: Record<string, string> = {
    '@cf/meta/llama-3.1-70b-instruct': 'Llama 3.1 70B',
    '@cf/meta/llama-3.1-8b-instruct': 'Llama 3.1 8B',
    '@cf/openai/gpt-oss-120b': 'GPT-OSS 120B',
    '@cf/openai/gpt-oss-20b': 'GPT-OSS 20B',
    '@cf/meta/llama-3-70b-instruct': 'Llama 3 70B',
  };
  return modelMap[modelId] || modelId.split('/').pop() || modelId;
}

// Helper to get user tier from role
function getUserTier(role: string | undefined): UserTier {
  const tierMap: Record<string, UserTier> = {
    admin: 'admin',
    premium: 'premium',
    pro: 'pro',
    member: 'member',
    free: 'free',
  };
  return tierMap[role || 'free'] || 'free';
}

// Character count indicator component
interface CharCountIndicatorProps {
  content: string;
  transformType: TransformationType;
  userTier: UserTier;
}

function CharCountIndicator({ content, transformType, userTier }: CharCountIndicatorProps) {
  const charCount = content.length;
  const limit = getCharLimit(transformType, userTier);
  const percentage = Math.min((charCount / limit) * 100, 100);
  const isOverLimit = charCount > limit;
  const isNearLimit = charCount > limit * 0.8;

  const barColor = isOverLimit
    ? 'var(--error)'
    : isNearLimit
    ? 'var(--warning)'
    : 'var(--success)';

  return (
    <div className="tool-pane__section--compact">
      <div className={`tool-pane__char-limit ${isOverLimit ? 'tool-pane__char-limit--over' : 'tool-pane__char-limit--ok'}`}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span>{charCount.toLocaleString()} / {limit.toLocaleString()} chars</span>
        {isOverLimit && (
          <span style={{ fontWeight: 600 }}>
            {(charCount - limit).toLocaleString()} over limit
          </span>
        )}
      </div>
      <div className="tool-pane__progress-bar">
        {/* Dynamic width requires inline style */}
        <div
          className="tool-pane__progress-fill"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ====================
// Humanizer Pane
// ====================
interface HumanizerPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function HumanizerPane({ content, onApplyTransform }: HumanizerPaneProps) {
  const [state, setState] = useToolState('humanizer');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation: recordToUnifiedBuffer, isChainMode } = useUnifiedBuffer();
  const { user, isAuthenticated } = useAuth();
  const workspaceTools = useWorkspaceTools();
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Get user tier for character limits
  const userTier = getUserTier(user?.role);

  // State for chunking progress and cancellation
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsTransforming(false);
      setChunkProgress(null);
      setError('Transformation cancelled');
    }
  };

  const handleRun = async () => {
    if (!content.trim()) {
      setError('No content to transform');
      return;
    }

    // Validate minimum word count
    const minWordError = validateMinWordCount(content);
    if (minWordError) {
      setError(minWordError);
      return;
    }

    // Check if text needs chunking
    const requiresChunking = needsChunking(content, 'computer-humanizer', userTier);
    const canChunk = canUseChunkedTransform(userTier);

    // Pre-validate text length before making API call
    const lengthValidation = validateTextLength(content, 'computer-humanizer', userTier);
    if (lengthValidation && !canChunk) {
      setError(lengthValidation.error);
      return;
    }

    // Check authentication for cloud backend
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'cloudflare' && !isAuthenticated) {
      setError('Please sign in to use cloud transformations. Click the user icon in the top bar.');
      return;
    }

    // Check backend availability before starting
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    // Auto-create workspace if needed - capture workspace object for recording
    // (Workspace object is returned directly to avoid React state timing issues)
    let workspace = workspaceTools.shouldAutoCreateWorkspace(content)
      ? workspaceTools.ensureWorkspace(content)
      : null;

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);
    setChunkProgress(null);

    try {
      console.log(`[HumanizerPane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      let result;

      if (requiresChunking && canChunk) {
        // Use chunked transformation
        console.log('[HumanizerPane] Using chunked transformation');
        result = await runChunkedTransform(
          {
            type: 'computer-humanizer',
            parameters: {
              intensity: state.intensity,
              useLLM: state.useLLM,
            },
          },
          content,
          {
            userTier,
            onProgress: (current, total) => setChunkProgress({ current, total }),
            signal: controller.signal,
          }
        );
      } else {
        // Normal transformation
        result = await runTransform({
          type: 'computer-humanizer',
          parameters: {
            intensity: state.intensity,
            useLLM: state.useLLM,
          },
        }, content);
      }

      setState({ lastResult: result });

      const newTransformId = result.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to workspace buffer system (pass workspace object if we just created it)
      workspaceTools.recordTransformation({
        type: 'humanizer',
        parameters: {
          intensity: state.intensity,
          useLLM: state.useLLM,
        },
        resultContent: result.transformed,
        metrics: {
          processingTimeMs: result.metadata?.processingTime as number | undefined,
          modelUsed: result.metadata?.modelUsed as string | undefined,
          provider: providerInfo.provider,
        },
      }, workspace);

      if (onApplyTransform && result.transformed) {
        onApplyTransform(result.transformed);
      }
    } catch (err) {
      console.error('Humanizer failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Transformation failed';
      // Don't overwrite cancelled message
      if (!controller.signal.aborted) {
        setError(`${errorMsg} (using ${providerInfo.label})`);
      }
    } finally {
      setIsTransforming(false);
      setAbortController(null);
    }
  };

  return (
    <div className="tool-pane">
      {/* Intensity */}
      <div className="tool-pane__section">
        <div className="tool-pane__slider-row">
          <label className="tool-pane__label tool-pane__label--inline">Intensity</label>
          <IntensityHelp />
        </div>
        <select
          value={state.intensity}
          onChange={(e) => setState({ intensity: e.target.value as any })}
          className="tool-pane__select"
        >
          <option value="light">Light (50%)</option>
          <option value="moderate">Moderate (70%) - Recommended</option>
          <option value="aggressive">Aggressive (95%)</option>
        </select>
      </div>

      {/* LLM Polish - compact inline */}
      <div className="tool-pane__section">
        <label className="tool-pane__checkbox-row">
          <input
            type="checkbox"
            checked={state.useLLM}
            onChange={(e) => setState({ useLLM: e.target.checked })}
            className="tool-pane__checkbox"
          />
          <span className="tool-pane__checkbox-label">LLM Polish Pass</span>
        </label>
      </div>

      {/* Character Count Indicator */}
      <CharCountIndicator
        content={content}
        transformType="computer-humanizer"
        userTier={userTier}
      />

      {/* Run/Cancel Buttons */}
      <div className="tool-pane__btn-row">
        <button
          onClick={handleRun}
          disabled={isTransforming || !content.trim()}
          className="tool-pane__btn tool-pane__btn--transform"
        >
          {isTransforming
            ? chunkProgress
              ? `⏳ Chunk ${chunkProgress.current}/${chunkProgress.total}...`
              : '⏳ Processing...'
            : '🤖 Humanize'}
        </button>
        {isTransforming && (
          <button
            onClick={handleCancel}
            className="tool-pane__btn tool-pane__btn--cancel"
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="tool-pane__error">
          {error}
        </div>
      )}

      {/* Provider indicator with model and GPTZero info */}
      {providerUsed && !error && state.lastResult && (
        <div className="tool-pane__result">
          <span className="tool-pane__result-label">✓ Processed via {providerUsed}</span>
          {state.lastResult?.metadata?.chunked && (
            <span className="tool-pane__result-value tool-pane__result-value--secondary">
              Chunked: {state.lastResult.metadata.chunkCount} segments
            </span>
          )}
          {state.lastResult?.metadata?.modelUsed && (
            <span className="tool-pane__result-value tool-pane__result-value--highlight">
              Model: {getModelDisplayName(state.lastResult.metadata.modelUsed)}
            </span>
          )}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div style={{ marginTop: '8px' }}>
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={state.lastResult?.metadata?.modelUsed || providerUsed || undefined}
            transformationType="humanizer"
            personaOrStyle={state.intensity}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Persona Pane
// ====================
interface PersonaPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function PersonaPane({ content, onApplyTransform }: PersonaPaneProps) {
  const [state, setState] = useToolState('persona');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation: recordToUnifiedBuffer, isChainMode } = useUnifiedBuffer();
  const { isAuthenticated, user } = useAuth();
  const workspaceTools = useWorkspaceTools();
  const [personas, setPersonas] = useState<Array<{ id: number | string; name: string; description: string; isCustom?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Get user tier for character limits
  const userTier = getUserTier(user?.role);

  // Fetch personas on mount (API + custom)
  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        // Fetch API personas
        const data = await api.getPersonas();

        // Get custom personas from localStorage
        const customProfiles = getCustomProfiles().filter(p => p.type === 'persona');
        const customPersonas = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          description: `Custom: ${p.name}`,
          isCustom: true,
        }));

        // Merge: custom first, then API
        const merged = [...customPersonas, ...data];
        setPersonas(merged);

        if (merged.length > 0 && !state.selectedPersona) {
          setState({ selectedPersona: merged[0].name });
        }
      } catch (err) {
        console.error('Failed to fetch personas:', err);
        // Still show custom profiles even if API fails
        const customProfiles = getCustomProfiles().filter(p => p.type === 'persona');
        const customPersonas = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          description: `Custom: ${p.name}`,
          isCustom: true,
        }));
        if (customPersonas.length > 0) {
          setPersonas(customPersonas);
          if (!state.selectedPersona) {
            setState({ selectedPersona: customPersonas[0].name });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPersonas();
  }, []);

  // State for chunking progress and cancellation
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsTransforming(false);
      setChunkProgress(null);
      setError('Transformation cancelled');
    }
  };

  const handleRun = async () => {
    if (!content.trim() || !state.selectedPersona) {
      setError('No content or persona selected');
      return;
    }

    // Validate minimum word count
    const minWordError = validateMinWordCount(content);
    if (minWordError) {
      setError(minWordError);
      return;
    }

    // Check if text needs chunking
    const requiresChunking = needsChunking(content, 'persona', userTier);
    const canChunk = canUseChunkedTransform(userTier);

    // Pre-validate text length before making API call
    const lengthValidation = validateTextLength(content, 'persona', userTier);
    if (lengthValidation && !canChunk) {
      // Can't chunk - show error
      setError(lengthValidation.error);
      return;
    }

    // Check authentication for cloud backend
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'cloudflare' && !isAuthenticated) {
      setError('Please sign in to use cloud transformations. Click the user icon in the top bar.');
      return;
    }

    // Check backend availability before starting
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    // Auto-create workspace if needed - capture workspace object for recording
    // (Workspace object is returned directly to avoid React state timing issues)
    let workspace = workspaceTools.shouldAutoCreateWorkspace(content)
      ? workspaceTools.ensureWorkspace(content)
      : null;

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);
    setChunkProgress(null);

    try {
      console.log(`[PersonaPane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      let result;

      if (requiresChunking && canChunk) {
        // Use chunked transformation
        console.log('[PersonaPane] Using chunked transformation');
        result = await runChunkedTransform(
          {
            type: 'persona',
            parameters: {
              persona: state.selectedPersona,
            },
          },
          content,
          {
            userTier,
            onProgress: (current, total) => setChunkProgress({ current, total }),
            signal: controller.signal,
          }
        );
      } else {
        // Normal transformation
        result = await runTransform({
          type: 'persona',
          parameters: {
            persona: state.selectedPersona,
          },
        }, content);
      }

      setState({ lastResult: result });

      const newTransformId = result.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to workspace buffer system (pass workspace object if we just created it)
      const selectedPersonaData = personas.find(p => p.name === state.selectedPersona);
      workspaceTools.recordTransformation({
        type: 'persona',
        parameters: {
          personaId: state.selectedPersona,
          personaName: selectedPersonaData?.name || state.selectedPersona,
        },
        resultContent: result.transformed,
        metrics: {
          processingTimeMs: result.metadata?.processingTime as number | undefined,
          modelUsed: result.metadata?.modelUsed as string | undefined,
          provider: providerInfo.provider,
        },
      }, workspace);

      if (onApplyTransform && result.transformed) {
        onApplyTransform(result.transformed);
      }
    } catch (err) {
      console.error('Persona transformation failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Transformation failed';
      // Don't overwrite cancelled message
      if (!controller.signal.aborted) {
        setError(`${errorMsg} (using ${providerInfo.label})`);
      }
    } finally {
      setIsTransforming(false);
      setAbortController(null);
    }
  };

  return (
    <div className="tool-pane">
      {/* Persona Selection */}
      <div className="tool-pane__section">
        <label className="tool-pane__label">Persona</label>
        {loading ? (
          <div className="tool-pane__loading">Loading...</div>
        ) : (
          <select
            value={state.selectedPersona}
            onChange={(e) => setState({ selectedPersona: e.target.value })}
            className="tool-pane__select"
          >
            {personas.some(p => p.isCustom) && (
              <optgroup label="Custom Profiles">
                {personas.filter(p => p.isCustom).map((p) => (
                  <option key={p.id} value={p.name}>
                    ★ {p.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
            {personas.some(p => !p.isCustom) && (
              <optgroup label="Built-in Personas">
                {personas.filter(p => !p.isCustom).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Character Count Indicator */}
      <CharCountIndicator
        content={content}
        transformType="persona"
        userTier={userTier}
      />

      {/* Run/Cancel Buttons */}
      <div className="tool-pane__btn-row">
        <button
          onClick={handleRun}
          disabled={isTransforming || !content.trim() || loading}
          className="tool-pane__btn tool-pane__btn--transform"
        >
          {isTransforming
            ? chunkProgress
              ? `⏳ Chunk ${chunkProgress.current}/${chunkProgress.total}...`
              : '⏳ Transforming...'
            : '👤 Apply Persona'}
        </button>
        {isTransforming && (
          <button
            onClick={handleCancel}
            className="tool-pane__btn tool-pane__btn--cancel"
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="tool-pane__error">
          {error}
        </div>
      )}

      {/* Provider indicator with model info */}
      {providerUsed && !error && state.lastResult && (
        <div className="tool-pane__result">
          <span className="tool-pane__result-label">✓ Processed via {providerUsed}</span>
          {state.lastResult?.metadata?.chunked && (
            <span className="tool-pane__result-value tool-pane__result-value--secondary">
              Chunked: {state.lastResult.metadata.chunkCount} segments
            </span>
          )}
          {state.lastResult?.metadata?.modelUsed && (
            <span className="tool-pane__result-value tool-pane__result-value--highlight">
              Model: {getModelDisplayName(state.lastResult.metadata.modelUsed)}
            </span>
          )}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div className="tool-pane__result">
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={state.lastResult?.metadata?.modelUsed || providerUsed || undefined}
            transformationType="persona"
            personaOrStyle={state.selectedPersona}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Style Pane
// ====================
interface StylePaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

export function StylePane({ content, onApplyTransform }: StylePaneProps) {
  const [state, setState] = useToolState('style');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation: recordToUnifiedBuffer, isChainMode } = useUnifiedBuffer();
  const { isAuthenticated, user } = useAuth();
  const workspaceTools = useWorkspaceTools();
  const [styles, setStyles] = useState<Array<{ id: number | string; name: string; style_prompt: string; isCustom?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Get user tier for character limits
  const userTier = getUserTier(user?.role);

  // Fetch styles on mount (API + custom)
  useEffect(() => {
    const fetchStyles = async () => {
      try {
        // Fetch API styles
        const data = await api.getStyles();

        // Get custom styles from localStorage
        const customProfiles = getCustomProfiles().filter(p => p.type === 'style');
        const customStyles = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          style_prompt: p.prompt,
          isCustom: true,
        }));

        // Merge: custom first, then API
        const merged = [...customStyles, ...data];
        setStyles(merged);

        if (merged.length > 0 && !state.selectedStyle) {
          setState({ selectedStyle: merged[0].name });
        }
      } catch (err) {
        console.error('Failed to fetch styles:', err);
        // Still show custom profiles even if API fails
        const customProfiles = getCustomProfiles().filter(p => p.type === 'style');
        const customStyles = customProfiles.map(p => ({
          id: `custom_${p.id}`,
          name: p.id,
          style_prompt: p.prompt,
          isCustom: true,
        }));
        if (customStyles.length > 0) {
          setStyles(customStyles);
          if (!state.selectedStyle) {
            setState({ selectedStyle: customStyles[0].name });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStyles();
  }, []);

  // State for chunking progress and cancellation
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsTransforming(false);
      setChunkProgress(null);
      setError('Transformation cancelled');
    }
  };

  const handleRun = async () => {
    if (!content.trim() || !state.selectedStyle) {
      setError('No content or style selected');
      return;
    }

    // Validate minimum word count
    const minWordError = validateMinWordCount(content);
    if (minWordError) {
      setError(minWordError);
      return;
    }

    // Check if text needs chunking
    const requiresChunking = needsChunking(content, 'style', userTier);
    const canChunk = canUseChunkedTransform(userTier);

    // Pre-validate text length before making API call
    const lengthValidation = validateTextLength(content, 'style', userTier);
    if (lengthValidation && !canChunk) {
      setError(lengthValidation.error);
      return;
    }

    // Check authentication for cloud backend
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'cloudflare' && !isAuthenticated) {
      setError('Please sign in to use cloud transformations. Click the user icon in the top bar.');
      return;
    }

    // Check backend availability before starting
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    // Auto-create workspace if needed - capture workspace object for recording
    // (Workspace object is returned directly to avoid React state timing issues)
    let workspace = workspaceTools.shouldAutoCreateWorkspace(content)
      ? workspaceTools.ensureWorkspace(content)
      : null;

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);
    setChunkProgress(null);

    try {
      console.log(`[StylePane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      let result;

      if (requiresChunking && canChunk) {
        // Use chunked transformation
        console.log('[StylePane] Using chunked transformation');
        result = await runChunkedTransform(
          {
            type: 'style',
            parameters: {
              style: state.selectedStyle,
            },
          },
          content,
          {
            userTier,
            onProgress: (current, total) => setChunkProgress({ current, total }),
            signal: controller.signal,
          }
        );
      } else {
        // Normal transformation
        result = await runTransform({
          type: 'style',
          parameters: {
            style: state.selectedStyle,
          },
        }, content);
      }

      setState({ lastResult: result });

      const newTransformId = result.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to workspace buffer system (pass workspace object if we just created it)
      const selectedStyleData = styles.find(s => s.name === state.selectedStyle);
      workspaceTools.recordTransformation({
        type: 'style',
        parameters: {
          styleId: state.selectedStyle,
          styleName: selectedStyleData?.name || state.selectedStyle,
        },
        resultContent: result.transformed,
        metrics: {
          processingTimeMs: result.metadata?.processingTime as number | undefined,
          modelUsed: result.metadata?.modelUsed as string | undefined,
          provider: providerInfo.provider,
        },
      }, workspace);

      if (onApplyTransform && result.transformed) {
        onApplyTransform(result.transformed);
      }
    } catch (err) {
      console.error('Style transformation failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Transformation failed';
      // Don't overwrite cancelled message
      if (!controller.signal.aborted) {
        setError(`${errorMsg} (using ${providerInfo.label})`);
      }
    } finally {
      setIsTransforming(false);
      setAbortController(null);
    }
  };

  return (
    <div className="tool-pane">
      {/* Style Selection */}
      <div className="tool-pane__section">
        <label className="tool-pane__label">Style</label>
        {loading ? (
          <div className="tool-pane__loading">Loading...</div>
        ) : (
          <select
            value={state.selectedStyle}
            onChange={(e) => setState({ selectedStyle: e.target.value })}
            className="tool-pane__select"
          >
            {styles.some(s => s.isCustom) && (
              <optgroup label="Custom Profiles">
                {styles.filter(s => s.isCustom).map((s) => (
                  <option key={s.id} value={s.name}>
                    ★ {s.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
            {styles.some(s => !s.isCustom) && (
              <optgroup label="Built-in Styles">
                {styles.filter(s => !s.isCustom).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Character Count Indicator */}
      <CharCountIndicator
        content={content}
        transformType="style"
        userTier={userTier}
      />

      {/* Run/Cancel Buttons */}
      <div className="tool-pane__btn-row">
        <button
          onClick={handleRun}
          disabled={isTransforming || !content.trim() || loading}
          className="tool-pane__btn tool-pane__btn--transform"
        >
          {isTransforming
            ? chunkProgress
              ? `⏳ Chunk ${chunkProgress.current}/${chunkProgress.total}...`
              : '⏳ Transforming...'
            : '✍️ Apply Style'}
        </button>
        {isTransforming && (
          <button
            onClick={handleCancel}
            className="tool-pane__btn tool-pane__btn--cancel"
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="tool-pane__error">
          {error}
        </div>
      )}

      {/* Provider indicator with model info */}
      {providerUsed && !error && state.lastResult && (
        <div className="tool-pane__result">
          <span className="tool-pane__result-label">✓ Processed via {providerUsed}</span>
          {state.lastResult?.metadata?.chunked && (
            <span className="tool-pane__result-value tool-pane__result-value--secondary">
              Chunked: {state.lastResult.metadata.chunkCount} segments
            </span>
          )}
          {state.lastResult?.metadata?.modelUsed && (
            <span className="tool-pane__result-value tool-pane__result-value--highlight">
              Model: {getModelDisplayName(state.lastResult.metadata.modelUsed)}
            </span>
          )}
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div style={{ marginTop: '8px' }}>
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={state.lastResult?.metadata?.modelUsed || providerUsed || undefined}
            transformationType="style"
            personaOrStyle={state.selectedStyle}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Round-Trip Pane
// ====================
interface RoundTripPaneProps {
  content: string;
  onApplyTransform?: (text: string) => void;
}

const LANGUAGES = [
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian', label: 'Russian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'hebrew', label: 'Hebrew' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'swedish', label: 'Swedish' },
  { value: 'norwegian', label: 'Norwegian' },
  { value: 'danish', label: 'Danish' },
  { value: 'polish', label: 'Polish' },
  { value: 'czech', label: 'Czech' },
];

export function RoundTripPane({ content, onApplyTransform }: RoundTripPaneProps) {
  const [state, setState] = useToolState('round-trip');
  const { isTransforming, setIsTransforming } = useToolTabs();
  const { provider, isLocalAvailable, isCloudAvailable, useOllamaForLocal } = useProvider();
  const { recordTransformation: recordToUnifiedBuffer, isChainMode } = useUnifiedBuffer();
  const { isAuthenticated, user } = useAuth();
  const workspaceTools = useWorkspaceTools();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Get user tier for character limits
  const userTier = getUserTier(user?.role);

  const handleRun = async () => {
    if (!content.trim()) {
      setError('No content to translate');
      return;
    }

    // Pre-validate text length before making API call
    const lengthValidation = validateTextLength(content, 'round-trip', userTier);
    if (lengthValidation) {
      setError(lengthValidation.error);
      return;
    }

    // Check authentication for cloud backend
    const providerInfo = getProviderInfo();
    if (providerInfo.provider === 'cloudflare' && !isAuthenticated) {
      setError('Please sign in to use cloud transformations. Click the user icon in the top bar.');
      return;
    }

    // Check backend availability before starting
    if (providerInfo.provider === 'local' && !isLocalAvailable && !useOllamaForLocal) {
      setError(`Local backend (${STORAGE_PATHS.npeApiUrl}) is not available. Start it with: npx wrangler dev --local`);
      return;
    }
    if (providerInfo.provider === 'cloudflare' && !isCloudAvailable) {
      setError('Cloud backend is not available. Check your internet connection.');
      return;
    }

    // Auto-create workspace if needed - capture workspace object for recording
    // (Workspace object is returned directly to avoid React state timing issues)
    let workspace = workspaceTools.shouldAutoCreateWorkspace(content)
      ? workspaceTools.ensureWorkspace(content)
      : null;

    setIsTransforming(true);
    setError(null);
    setProviderUsed(providerInfo.label);
    setShowFeedback(false);

    try {
      console.log(`[RoundTripPane] Using ${providerInfo.provider} backend: ${providerInfo.label}`);

      const response = await runTransform({
        type: 'round-trip',
        parameters: {
          intermediateLanguage: state.intermediateLanguage,
        },
      }, content);

      setResult(response.metadata);
      setState({ lastResult: response });

      const newTransformId = response.metadata?.transformation_id || crypto.randomUUID();
      setTransformationId(newTransformId);
      setShowFeedback(true);

      // Record to workspace buffer system (pass workspace object if we just created it)
      workspaceTools.recordTransformation({
        type: 'round-trip',
        parameters: {
          intermediateLanguage: state.intermediateLanguage,
        },
        resultContent: response.transformed,
        metrics: {
          processingTimeMs: response.metadata?.processingTime as number | undefined,
          provider: providerInfo.provider,
        },
      }, workspace);

      if (onApplyTransform && response.transformed) {
        onApplyTransform(response.transformed);
      }
    } catch (err) {
      console.error('Round-trip translation failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Translation failed';
      setError(`${errorMsg} (using ${providerInfo.label})`);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="tool-pane">
      {/* Language Selection */}
      <div className="tool-pane__section">
        <label className="tool-pane__label">Language</label>
        <select
          value={state.intermediateLanguage}
          onChange={(e) => setState({ intermediateLanguage: e.target.value })}
          className="tool-pane__select"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Character Count Indicator */}
      <CharCountIndicator
        content={content}
        transformType="round-trip"
        userTier={userTier}
      />

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isTransforming || !content.trim()}
        className="tool-pane__btn tool-pane__btn--transform"
      >
        {isTransforming ? '⏳ Translating...' : '🔄 Round-Trip'}
      </button>

      {error && (
        <div className="tool-pane__error">
          {error}
        </div>
      )}

      {/* Results - compact */}
      {result && result.semantic_drift !== undefined && (
        <div className="tool-pane__result-row">
          <span className="tool-pane__result-label">Drift</span>
          <span
            className={`tool-pane__result-value ${
              result.semantic_drift < 20
                ? 'tool-pane__result-value--positive'
                : result.semantic_drift < 50
                ? ''
                : 'tool-pane__result-value--negative'
            }`}
            style={{ fontSize: '1.125rem' }}
          >
            {result.semantic_drift}%
          </span>
        </div>
      )}

      {/* Provider indicator */}
      {providerUsed && !error && state.lastResult && (
        <div className="tool-pane__result">
          <span className="tool-pane__result-label">✓ Processed via {providerUsed}</span>
        </div>
      )}

      {/* Feedback Widget */}
      {showFeedback && transformationId && !error && (
        <div className="tool-pane__result">
          <FeedbackWidget
            transformationId={transformationId}
            modelUsed={providerUsed || undefined}
            transformationType="round-trip"
            personaOrStyle={state.intermediateLanguage}
            onDismiss={() => setShowFeedback(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ====================
// Add to Book Pane
// ====================
interface AddToBookPaneProps {
  content: string;
}

export function AddToBookPane({ content }: AddToBookPaneProps) {
  return (
    <div style={{ padding: '12px' }}>
      <AddToBookSection content={content} sourceType="archive" />
    </div>
  );
}
