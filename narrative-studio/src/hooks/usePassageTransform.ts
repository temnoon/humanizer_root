/**
 * usePassageTransform Hook
 *
 * Bridges PassageContext with transformationService.
 * Handles block markers, API calls, and result recording.
 *
 * @see /docs/PASSAGE_SYSTEM_SPEC_v1.1.md
 */

import { useCallback, useState } from 'react';
import { usePassages } from '../contexts/PassageContext';
import {
  computerHumanizer,
  aiDetection,
  personaTransform,
  styleTransform,
  namespaceTransform,
  type ComputerHumanizerOptions,
  type AIDetectionOptions,
  type PersonaOptions,
  type StyleOptions,
  type NamespaceOptions,
} from '../services/transformationService';
import { getBlockMarkerInstructions } from '../services/block-markers';
import type { Passage, TransformationRecord } from '../types/passage';

// ============================================================
// TYPES
// ============================================================

export type TransformationType =
  | 'computer-humanizer'
  | 'ai-detection'
  | 'persona'
  | 'style'
  | 'namespace';

export interface TransformOptions {
  // Computer Humanizer
  intensity?: 'light' | 'moderate' | 'aggressive';
  useLLM?: boolean;
  voiceProfile?: string;

  // AI Detection
  detectorType?: 'lite' | 'gptzero';
  useLLMJudge?: boolean;
  threshold?: number;

  // Persona
  persona?: string;

  // Style
  style?: string;

  // Namespace
  namespace?: string;

  // Common
  preserveFormatting?: boolean;
}

export interface TransformState {
  isTransforming: boolean;
  progress: number;
  currentTool: TransformationType | null;
  error: string | null;
}

export interface TransformResult {
  success: boolean;
  passage?: Passage;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// HOOK
// ============================================================

export function usePassageTransform() {
  const {
    passages,
    getPassage,
    getMarkedContent,
    updateFromMarkedContent,
    getMarkerInstructions,
    recordTransformation,
    setActivePassage,
  } = usePassages();

  const [state, setState] = useState<TransformState>({
    isTransforming: false,
    progress: 0,
    currentTool: null,
    error: null,
  });

  /**
   * Transform a single passage using the specified tool.
   * Handles block markers automatically for format preservation.
   */
  const transformPassage = useCallback(async (
    passageId: string,
    type: TransformationType,
    options: TransformOptions = {}
  ): Promise<TransformResult> => {
    const passage = getPassage(passageId);
    if (!passage) {
      return { success: false, error: `Passage not found: ${passageId}` };
    }

    setState({
      isTransforming: true,
      progress: 0,
      currentTool: type,
      error: null,
    });

    try {
      // Get content - use marked content for format preservation if markdown
      const useMarkers = options.preserveFormatting !== false &&
        passage.contentType === 'markdown';
      const content = useMarkers ? getMarkedContent(passageId) : passage.content;

      setState(prev => ({ ...prev, progress: 20 }));

      let result: any;
      let transformedContent: string;
      let analysisResult: Record<string, unknown> | undefined;

      switch (type) {
        case 'computer-humanizer': {
          result = await computerHumanizer(content, {
            intensity: options.intensity || 'moderate',
            useLLM: options.useLLM ?? true,
            voiceProfile: options.voiceProfile,
          });
          transformedContent = result.transformed;
          analysisResult = {
            aiConfidenceBefore: result.metadata.aiConfidenceBefore,
            aiConfidenceAfter: result.metadata.aiConfidenceAfter,
            burstinessBefore: result.metadata.burstinessBefore,
            burstinessAfter: result.metadata.burstinessAfter,
            tellWordsRemoved: result.metadata.tellWordsRemoved,
            tellWordsFound: result.metadata.tellWordsFound,
          };
          break;
        }

        case 'ai-detection': {
          result = await aiDetection(content, {
            detectorType: options.detectorType || 'lite',
            useLLMJudge: options.useLLMJudge,
            threshold: options.threshold,
          });
          // AI detection doesn't transform, just analyzes
          transformedContent = passage.content;
          analysisResult = {
            confidence: result.metadata.aiDetection.confidence,
            verdict: result.metadata.aiDetection.verdict,
            tellWords: result.metadata.aiDetection.tellWords,
            burstiness: result.metadata.aiDetection.burstiness,
            perplexity: result.metadata.aiDetection.perplexity,
            reasoning: result.metadata.aiDetection.reasoning,
            highlightedMarkdown: result.metadata.aiDetection.highlightedMarkdown,
            method: result.metadata.aiDetection.method,
          };
          break;
        }

        case 'persona': {
          result = await personaTransform(content, {
            persona: options.persona || 'holmes_analytical',
          });
          transformedContent = result.transformed;
          analysisResult = {
            persona: options.persona,
          };
          break;
        }

        case 'style': {
          result = await styleTransform(content, {
            style: options.style || 'austen_precision',
          });
          transformedContent = result.transformed;
          analysisResult = {
            style: options.style,
          };
          break;
        }

        case 'namespace': {
          result = await namespaceTransform(content, {
            namespace: options.namespace || 'enlightenment_science',
          });
          transformedContent = result.transformed;
          analysisResult = {
            namespace: options.namespace,
          };
          break;
        }

        default:
          throw new Error(`Unknown transformation type: ${type}`);
      }

      setState(prev => ({ ...prev, progress: 80 }));

      // Record the transformation (creates new derived passage)
      const settings: Record<string, unknown> = {
        type,
        ...options,
        usedBlockMarkers: useMarkers,
      };

      const newPassage = recordTransformation(
        passageId,
        type,
        settings,
        transformedContent,
        analysisResult
      );

      setState({
        isTransforming: false,
        progress: 100,
        currentTool: null,
        error: null,
      });

      return {
        success: true,
        passage: newPassage,
        metadata: analysisResult,
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Transformation failed';
      setState({
        isTransforming: false,
        progress: 0,
        currentTool: null,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [getPassage, getMarkedContent, recordTransformation]);

  /**
   * Transform multiple passages in sequence
   */
  const transformMultiple = useCallback(async (
    passageIds: string[],
    type: TransformationType,
    options: TransformOptions = {}
  ): Promise<TransformResult[]> => {
    const results: TransformResult[] = [];

    for (let i = 0; i < passageIds.length; i++) {
      setState(prev => ({
        ...prev,
        progress: Math.round((i / passageIds.length) * 100),
      }));

      const result = await transformPassage(passageIds[i], type, options);
      results.push(result);

      // Brief pause between transformations to avoid rate limiting
      if (i < passageIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }, [transformPassage]);

  /**
   * Run AI detection on a passage without creating a new passage
   * (Just returns analysis results)
   */
  const analyzePassage = useCallback(async (
    passageId: string,
    options: Pick<TransformOptions, 'detectorType' | 'useLLMJudge' | 'threshold'> = {}
  ): Promise<TransformResult> => {
    const passage = getPassage(passageId);
    if (!passage) {
      return { success: false, error: `Passage not found: ${passageId}` };
    }

    setState({
      isTransforming: true,
      progress: 0,
      currentTool: 'ai-detection',
      error: null,
    });

    try {
      setState(prev => ({ ...prev, progress: 30 }));

      const result = await aiDetection(passage.content, {
        detectorType: options.detectorType || 'lite',
        useLLMJudge: options.useLLMJudge,
        threshold: options.threshold,
      });

      setState({
        isTransforming: false,
        progress: 100,
        currentTool: null,
        error: null,
      });

      return {
        success: true,
        metadata: {
          confidence: result.metadata.aiDetection.confidence,
          verdict: result.metadata.aiDetection.verdict,
          tellWords: result.metadata.aiDetection.tellWords,
          burstiness: result.metadata.aiDetection.burstiness,
          perplexity: result.metadata.aiDetection.perplexity,
          reasoning: result.metadata.aiDetection.reasoning,
          highlightedMarkdown: result.metadata.aiDetection.highlightedMarkdown,
          method: result.metadata.aiDetection.method,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Analysis failed';
      setState({
        isTransforming: false,
        progress: 0,
        currentTool: null,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [getPassage]);

  /**
   * Get the block marker instructions for LLM prompts
   */
  const getInstructions = useCallback(() => {
    return getMarkerInstructions();
  }, [getMarkerInstructions]);

  /**
   * Cancel current transformation (if possible)
   * Note: Most API calls can't be cancelled, this just resets state
   */
  const cancel = useCallback(() => {
    setState({
      isTransforming: false,
      progress: 0,
      currentTool: null,
      error: null,
    });
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    state,

    // Actions
    transformPassage,
    transformMultiple,
    analyzePassage,
    getInstructions,
    cancel,
    clearError,

    // Convenience getters
    isTransforming: state.isTransforming,
    progress: state.progress,
    currentTool: state.currentTool,
    error: state.error,
  };
}

export default usePassageTransform;
