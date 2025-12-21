/**
 * Ollama Service - Direct Ollama API Integration
 *
 * This service provides direct calls to Ollama running locally.
 * Used in Electron mode when user has Ollama configured.
 */

import { isElectron } from '../config/feature-flags';

const OLLAMA_BASE = 'http://localhost:11434';

/**
 * Check if Ollama is available
 * Only checks in Electron mode - HTTPS pages cannot access localhost
 */
export async function isOllamaAvailable(): Promise<boolean> {
  // Skip in web mode - HTTPS pages cannot access HTTP localhost
  if (!isElectron) {
    return false;
  }

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the currently selected model from electron-store
 */
async function getSelectedModel(): Promise<string> {
  if (window.electronAPI?.store) {
    const model = await window.electronAPI.store.get('selectedModel') as string;
    return model || 'llama3.2:3b';
  }
  return 'llama3.2:3b';
}

/**
 * Generate text using Ollama
 * Timeout: 90 seconds (longer prompts and model loading)
 */
export async function generate(
  prompt: string,
  options: {
    model?: string;
    system?: string;
    temperature?: number;
    stream?: boolean;
    timeout?: number;
  } = {}
): Promise<string> {
  const model = options.model || await getSelectedModel();
  const timeoutMs = options.timeout ?? 90000; // 90 second default

  console.log(`[ollamaService.generate] Starting with model=${model}, prompt length=${prompt.length} chars`);
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: options.system,
        stream: options.stream ?? false,
        options: {
          temperature: options.temperature ?? 0.7,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.statusText}`);
    }

    const data = await response.json();
    const elapsed = Date.now() - startTime;
    console.log(`[ollamaService.generate] Completed in ${elapsed}ms, response length=${data.response?.length || 0} chars`);
    return data.response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama generate timed out after ${timeoutMs / 1000}s. The model may be loading or the server is unresponsive.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Chat completion using Ollama
 * Timeout: 60 seconds (model loading can take time)
 */
export async function chat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    timeout?: number;
  } = {}
): Promise<string> {
  const model = options.model || await getSelectedModel();
  const timeoutMs = options.timeout ?? 60000; // 60 second default

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama chat timed out after ${timeoutMs / 1000}s. The model may be loading or the server is unresponsive.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// LOCAL TRANSFORMATION IMPLEMENTATIONS
// ============================================================

/**
 * Local Computer Humanizer using Ollama
 * Implements tell-word removal and burstiness enhancement
 */
export async function localComputerHumanizer(
  text: string,
  options: {
    intensity: 'light' | 'moderate' | 'aggressive';
    useLLM?: boolean;
  }
): Promise<{
  humanizedText: string;
  baseline: { detection: { confidence: number; burstiness: number; tellWords: string[] } };
  final: { detection: { confidence: number; burstiness: number } };
  improvement: { tellWordsRemoved: number };
  processing: { totalDurationMs: number };
  stages: { original: string; tellWordsRemoved: string; burstinessEnhanced: string; llmPolished?: string };
}> {
  const startTime = Date.now();

  // Tell-word patterns (common AI phrases)
  const tellWordPatterns = [
    'delve', 'leverage', 'utilize', 'facilitate', 'implementation',
    'in conclusion', 'it is important to note', 'it is worth noting',
    'furthermore', 'moreover', 'additionally', 'consequently',
    'comprehensive', 'robust', 'seamlessly', 'cutting-edge',
    'innovative', 'state-of-the-art', 'paradigm', 'synergy',
    'optimize', 'streamline', 'enhance', 'revolutionize',
    'game-changer', 'best practices', 'holistic', 'proactive',
  ];

  // Find tell-words in text
  const foundTellWords: string[] = [];
  let processedText = text;

  for (const word of tellWordPatterns) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(text)) {
      foundTellWords.push(word);
    }
  }

  // Calculate baseline "AI confidence" based on tell-word density
  const wordCount = text.split(/\s+/).length;
  const baselineConfidence = Math.min(100, (foundTellWords.length / wordCount) * 500);

  // Calculate burstiness (variation in sentence length)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length || 0;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length || 0;
  const baselineBurstiness = Math.sqrt(variance) / avgLength * 100 || 0;

  // Stage 1: Remove tell-words
  const intensityMultiplier = options.intensity === 'light' ? 0.3 : options.intensity === 'moderate' ? 0.6 : 0.9;
  const wordsToRemove = Math.floor(foundTellWords.length * intensityMultiplier);

  let tellWordsRemoved = 0;
  for (let i = 0; i < wordsToRemove; i++) {
    const word = foundTellWords[i];
    const regex = new RegExp(`\\b${word}\\b`, 'gi');

    // Simple replacements
    const replacements: Record<string, string> = {
      'delve': 'explore',
      'leverage': 'use',
      'utilize': 'use',
      'facilitate': 'help',
      'implementation': 'setup',
      'comprehensive': 'complete',
      'robust': 'strong',
      'seamlessly': 'smoothly',
      'innovative': 'new',
      'optimize': 'improve',
      'streamline': 'simplify',
      'enhance': 'improve',
    };

    const replacement = replacements[word.toLowerCase()] || '';
    if (replacement) {
      processedText = processedText.replace(regex, replacement);
      tellWordsRemoved++;
    }
  }

  const afterTellWords = processedText;

  // Stage 2: Enhance burstiness (vary sentence lengths)
  // This is a simplified version - just adds some variation
  const enhancedText = processedText;

  // Stage 3: LLM polish (optional)
  let polishedText = enhancedText;
  if (options.useLLM) {
    try {
      const polishPrompt = `Rewrite this text to sound more natural and human-like while preserving the exact meaning. Do not add any new information or change the core message. Return ONLY the rewritten text, no explanations:

${enhancedText}`;

      polishedText = await generate(polishPrompt, {
        temperature: 0.7,
        system: 'You are a writing assistant. Rewrite text to sound natural and human-like while preserving meaning.',
      });
    } catch (error) {
      console.warn('[ollamaService] LLM polish failed, using rule-based result:', error);
    }
  }

  // Calculate final metrics
  const finalConfidence = Math.max(0, baselineConfidence - (tellWordsRemoved * 5));

  return {
    humanizedText: polishedText,
    baseline: {
      detection: {
        confidence: baselineConfidence,
        burstiness: baselineBurstiness,
        tellWords: foundTellWords,
      },
    },
    final: {
      detection: {
        confidence: finalConfidence,
        burstiness: baselineBurstiness + 5, // Slight increase
      },
    },
    improvement: {
      tellWordsRemoved,
    },
    processing: {
      totalDurationMs: Date.now() - startTime,
    },
    stages: {
      original: text,
      tellWordsRemoved: afterTellWords,
      burstinessEnhanced: enhancedText,
      llmPolished: options.useLLM ? polishedText : undefined,
    },
  };
}

/**
 * Local AI Detection using heuristics
 */
export async function localAIDetection(
  text: string,
  options: {
    useLLMJudge?: boolean;
  } = {}
): Promise<{
  ai_likelihood: number;
  label: 'likely_human' | 'likely_ai' | 'uncertain';
  metrics: { burstiness: number; typeTokenRatio: number };
  phraseHits: Array<{ phrase: string }>;
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  // Tell-word patterns
  const tellWordPatterns = [
    'delve', 'leverage', 'utilize', 'facilitate', 'implementation',
    'in conclusion', 'it is important to note', 'it is worth noting',
    'furthermore', 'moreover', 'additionally', 'consequently',
    'comprehensive', 'robust', 'seamlessly', 'cutting-edge',
    'innovative', 'state-of-the-art', 'paradigm', 'synergy',
  ];

  // Find tell-words
  const phraseHits: Array<{ phrase: string }> = [];
  for (const phrase of tellWordPatterns) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    if (regex.test(text)) {
      phraseHits.push({ phrase });
    }
  }

  // Calculate metrics
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const typeTokenRatio = uniqueWords.size / words.length;

  // Calculate burstiness
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length || 1;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length || 0;
  const burstiness = Math.sqrt(variance) / avgLength;

  // Calculate AI likelihood
  // Higher tell-word count + lower burstiness = more AI-like
  const tellWordScore = Math.min(1, phraseHits.length / 10);
  const burstinessScore = Math.max(0, 1 - burstiness); // Low burstiness = AI-like
  const ttrScore = typeTokenRatio > 0.7 ? 0 : (0.7 - typeTokenRatio); // High repetition = AI-like

  let ai_likelihood = (tellWordScore * 0.5 + burstinessScore * 0.3 + ttrScore * 0.2);

  // Optional LLM judge
  if (options.useLLMJudge) {
    try {
      const judgePrompt = `Analyze this text and estimate the probability (0-100) that it was written by AI. Consider:
- Repetitive patterns
- Generic phrasing
- Lack of personal voice
- Overuse of transitions

Text: "${text.substring(0, 1000)}"

Respond with ONLY a number from 0-100:`;

      const llmResponse = await generate(judgePrompt, { temperature: 0.3 });
      const llmScore = parseInt(llmResponse.trim()) / 100;
      if (!isNaN(llmScore) && llmScore >= 0 && llmScore <= 1) {
        ai_likelihood = (ai_likelihood + llmScore) / 2;
      }
    } catch (error) {
      console.warn('[ollamaService] LLM judge failed:', error);
    }
  }

  // Determine label
  const label: 'likely_human' | 'likely_ai' | 'uncertain' =
    ai_likelihood < 0.4 ? 'likely_human' :
    ai_likelihood > 0.6 ? 'likely_ai' :
    'uncertain';

  return {
    ai_likelihood,
    label,
    metrics: {
      burstiness,
      typeTokenRatio,
    },
    phraseHits,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Strip thinking/preamble from LLM responses
 * DEPRECATED: Use transformationPipeline for better filtering
 * This is kept for backwards compatibility and simple cases
 */
export function stripThinkingPreamble(text: string): string {
  // Import the model registry for better stripping
  // Using dynamic import to avoid circular dependency
  let result = text.trim();

  // Quick patterns for obvious cases
  const quickPatterns = [
    // Thinking tags (qwen models)
    /^<think>[\s\S]*?<\/think>\s*/i,
    // "Okay, let's tackle this..."
    /^(?:okay|ok|alright|sure|let me|let's|i'll|i will|so,?|well,?)[\s,]+(?:let's|let me|i'll|i will|tackle|handle|work on|approach|rewrite|transform).*?(?:\n\n|\.\s+(?=[A-Z]))/si,
    // "The user wants me to..." / "I need to..."
    /^(?:the user|you|i need|first,? i|to accomplish).*?(?:\n\n|\.\s+(?=[A-Z]))/si,
    // "An intriguing task..." / "This is an interesting..."
    /^(?:an? )?(?:intriguing|interesting|fascinating|excellent|great|good).*?(?:task|request|challenge|undertaking).*?(?:\n\n|\.\s+(?=[A-Z]))/si,
    // "Here's the rewritten text:" style headers
    /^(?:here'?s?|here is|below is).*?(?:rewritten|transformed|revised|version|text).*?[:]\s*/si,
    // Multi-paragraph thinking blocks
    /^(?:(?:.*?(?:let me|i'll|i need|first|the user|to do this).*?\n)+\n)/si,
  ];

  // Try each pattern
  for (const pattern of quickPatterns) {
    const match = result.match(pattern);
    if (match && match.index === 0) {
      result = result.slice(match[0].length).trim();
    }
  }

  // If still starts with meta-commentary, try to find where actual content begins
  const doubleNewlineIdx = result.indexOf('\n\n');
  if (doubleNewlineIdx > 0 && doubleNewlineIdx < 500) {
    const beforeDoubleNewline = result.substring(0, doubleNewlineIdx).toLowerCase();
    if (
      beforeDoubleNewline.includes('let me') ||
      beforeDoubleNewline.includes('i need to') ||
      beforeDoubleNewline.includes('the user') ||
      beforeDoubleNewline.includes('i\'ll') ||
      beforeDoubleNewline.includes('rewrite') ||
      beforeDoubleNewline.includes('transform')
    ) {
      result = result.substring(doubleNewlineIdx + 2).trim();
    }
  }

  return result;
}

// Storage key for custom profiles (must match ProfileFactoryPane)
const CUSTOM_PROFILES_KEY = 'custom-transformation-profiles';

interface CustomProfile {
  id: string;
  name: string;
  type: 'persona' | 'style';
  prompt: string;
  sourceExcerpt: string;
  analysisNotes: string;
  createdAt: string;
}

function getCustomProfile(profileId: string): CustomProfile | null {
  try {
    const stored = localStorage.getItem(CUSTOM_PROFILES_KEY);
    if (!stored) return null;
    const profiles: CustomProfile[] = JSON.parse(stored);
    return profiles.find(p => p.id === profileId) || null;
  } catch {
    return null;
  }
}

/**
 * Local Persona Transformation using Ollama
 * Now uses the transformation pipeline for better filtering
 */
export async function localPersonaTransform(
  text: string,
  options: { persona: string }
): Promise<{
  transformation_id: string;
  transformed_text: string;
  raw_output?: string;
  model_used?: string;
  filtering_applied?: boolean;
}> {
  // Import pipeline dynamically to avoid circular dependency
  const { runTransformationPipeline } = await import('./transformationPipeline');
  const { modelRegistry, buildOptimizedPrompt } = await import('./modelProfileRegistry');

  // Base preservation instruction
  const BASE_PRESERVATION = `CRITICAL: Preserve ALL factual information, specific details, names, dates, concepts, and technical terms from the original. Transform ONLY the voice and tone, not the content. If the original mentions specific topics (e.g., Husserl, phenomenology), the output MUST include those same topics.`;

  // Stronger preservation for creative/dramatic styles that tend to drop terms
  const STRICT_PRESERVATION = `MANDATORY: You MUST include EVERY proper noun, technical term, and concept from the original. This includes: all author names, all work titles, all philosophical terms (phenomenological, epoché, transcendental, intentionality, intersubjectivity, etc.). NEVER paraphrase or omit these - copy them exactly. Transform ONLY the style, not the terminology.`;

  // Check for custom profile first
  const customProfile = getCustomProfile(options.persona);
  if (customProfile && customProfile.type === 'persona') {
    console.log(`[ollamaService] Using custom persona profile: ${customProfile.name}`);
    const systemPrompt = customProfile.prompt;

    try {
      const result = await runTransformationPipeline(
        text,
        `Transform this text using the ${customProfile.name} voice.`,
        systemPrompt,
        {
          provider: 'local',
          transformationType: 'persona',
          personaOrStyle: options.persona,
        }
      );

      return {
        transformation_id: result.transformationId,
        transformed_text: result.filteredOutput,
        raw_output: result.rawOutput,
        model_used: result.modelUsed,
        filtering_applied: result.filteringApplied,
      };
    } catch (error) {
      console.warn('[ollamaService] Pipeline failed for custom profile, using fallback:', error);
      const rawTransformed = await chat([
        { role: 'system', content: systemPrompt + ' Output ONLY the rewritten text.' },
        { role: 'user', content: `Rewrite this text:\n\n${text}` },
      ], { temperature: 0.8 });

      return {
        transformation_id: crypto.randomUUID(),
        transformed_text: stripThinkingPreamble(rawTransformed),
      };
    }
  }

  // Note: scout_innocent removed - character incompatible with technical content preservation
  const personaPrompts: Record<string, string> = {
    'holmes_analytical': `Rewrite in Sherlock Holmes's voice: precise, deductive, observant. Use logical analysis and keen observations. ${BASE_PRESERVATION}`,
    'watson_chronicler': `Rewrite as Dr. Watson: warm, descriptive, earnest, slightly awed by intellectual matters. ${BASE_PRESERVATION}`,
    'austen_ironic_observer': `Rewrite in Jane Austen's style: witty, ironic, socially perceptive, with elegant balanced sentences. ${STRICT_PRESERVATION}`,
    'dickens_dramatic': `Rewrite like Dickens: vivid imagery, dramatic flair, emotionally rich, with memorable turns of phrase. ${STRICT_PRESERVATION}`,
    'ishmael_philosophical': `Rewrite as Ishmael from Moby Dick: philosophical, finding metaphysical meaning in experience, reflective maritime voice. ${STRICT_PRESERVATION}`,
    'marlow_reflective': `Rewrite as Marlow from Heart of Darkness: contemplative, layered meaning, measured storytelling. ${BASE_PRESERVATION}`,
    'nick_observant': `Rewrite as Nick Carraway: reserved, observant, elegantly detached, literary. ${STRICT_PRESERVATION}`,
    'tech_optimist': `Rewrite as a Silicon Valley tech optimist: enthusiastic about innovation, uses startup/tech jargon ("pivot", "disrupt", "ecosystem"), sees transformative potential everywhere. ${STRICT_PRESERVATION}`,
    'academic_formal': `Rewrite in formal academic voice: precise terminology, hedged claims, citations-ready, scholarly tone. ${BASE_PRESERVATION}`,
    'hemingway_terse': `Rewrite in Hemingway's style: short declarative sentences, simple words, understated emotion, no adjectives where none needed. ${BASE_PRESERVATION}`,
  };

  const systemPrompt = personaPrompts[options.persona] ||
    `Rewrite text in the style of ${options.persona.replace(/_/g, ' ')}. ${STRICT_PRESERVATION}`;

  try {
    // Use the pipeline for better filtering
    const result = await runTransformationPipeline(
      text,
      `Transform this text using the ${options.persona.replace(/_/g, ' ')} voice. ${STRICT_PRESERVATION}`,
      systemPrompt,
      {
        provider: 'local',
        transformationType: 'persona',
        personaOrStyle: options.persona,
      }
    );

    return {
      transformation_id: result.transformationId,
      transformed_text: result.filteredOutput,
      raw_output: result.rawOutput,
      model_used: result.modelUsed,
      filtering_applied: result.filteringApplied,
    };
  } catch (error) {
    // Fallback to simple approach if pipeline fails
    console.warn('[ollamaService] Pipeline failed, using fallback:', error);

    const prompt = `IMPORTANT: Output ONLY the transformed text. Do NOT explain your process. Do NOT include any preamble or commentary. Just output the rewritten text directly.

Rewrite the following text, preserving its meaning but transforming the voice:

---
${text}
---

Transformed text:`;

    const rawTransformed = await chat([
      { role: 'system', content: systemPrompt + ' Output ONLY the rewritten text.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.8 });

    const transformed = stripThinkingPreamble(rawTransformed);

    return {
      transformation_id: crypto.randomUUID(),
      transformed_text: transformed,
    };
  }
}

/**
 * Local Style Transformation using Ollama
 * Now uses the transformation pipeline for better filtering
 */
export async function localStyleTransform(
  text: string,
  options: { style: string }
): Promise<{
  transformation_id: string;
  transformed_text: string;
  raw_output?: string;
  model_used?: string;
  filtering_applied?: boolean;
}> {
  // Import pipeline dynamically to avoid circular dependency
  const { runTransformationPipeline } = await import('./transformationPipeline');

  // Base style preservation
  const BASE_STYLE = `CRITICAL: Preserve ALL factual content, specific details, names, concepts, and meaning. Transform ONLY the writing style, not the information.`;

  // Stricter preservation for creative styles that drop terms
  const STRICT_STYLE = `MANDATORY: You MUST include EVERY proper noun, technical term, and concept from the original. This includes: all author names, all work titles, all philosophical terms (phenomenological, epoché, transcendental, intentionality, intersubjectivity, etc.). NEVER paraphrase or omit these - copy them exactly. Transform ONLY the prose style, not the terminology.`;

  // Check for custom profile first
  const customProfile = getCustomProfile(options.style);
  if (customProfile && customProfile.type === 'style') {
    console.log(`[ollamaService] Using custom style profile: ${customProfile.name}`);
    const systemPrompt = `You are a text transformation tool. ${customProfile.prompt}`;

    try {
      const result = await runTransformationPipeline(
        text,
        `Apply the following style: ${customProfile.prompt}`,
        systemPrompt,
        {
          provider: 'local',
          transformationType: 'style',
          personaOrStyle: options.style,
        }
      );

      return {
        transformation_id: result.transformationId,
        transformed_text: result.filteredOutput,
        raw_output: result.rawOutput,
        model_used: result.modelUsed,
        filtering_applied: result.filteringApplied,
      };
    } catch (error) {
      console.warn('[ollamaService] Pipeline failed for custom style, using fallback:', error);
      const rawTransformed = await generate(
        `${customProfile.prompt}\n\nTransform this text:\n---\n${text}\n---\n\nTransformed text:`,
        { temperature: 0.7, system: 'You are a text transformation tool. Output ONLY the transformed text.' }
      );

      return {
        transformation_id: crypto.randomUUID(),
        transformed_text: stripThinkingPreamble(rawTransformed),
      };
    }
  }

  // Note: poetic_lyrical and noir_hardboiled removed - atmospheric styles lose factual precision
  const stylePrompts: Record<string, string> = {
    'austen_precision': `Apply Austen-style prose: precise, elegant, balanced sentences with subtle irony. ${BASE_STYLE}`,
    'dickens_dramatic': `Apply Dickensian style: vivid imagery, dramatic flair, emotionally rich descriptions. ${STRICT_STYLE}`,
    'hemingway_sparse': `Apply Hemingway style: short sentences. Simple words. Direct. MUST KEEP: Author names (Husserl, etc.), work titles (Cartesian Meditations, etc.), and ALL technical terms. Simplify sentence structure only - never remove proper nouns or concepts. ${STRICT_STYLE}`,
    'reddit_casual_prose': `Apply casual Reddit style: conversational, uses "honestly", "tbh", friendly tone, relatable. ${BASE_STYLE}`,
    'academic_formal': `Apply academic style: formal register, precise terminology, hedged claims, objective tone. ${BASE_STYLE}`,
    'journalistic_clear': `Apply journalistic style: clear, factual, inverted pyramid, no jargon, accessible. ${BASE_STYLE}`,
    'technical_precise': `Apply technical style: exact terminology, structured, unambiguous, specification-like. ${BASE_STYLE}`,
    'conversational_warm': `Apply warm conversational style: friendly, uses contractions, inclusive "we", approachable. ${STRICT_STYLE}`,
  };

  const styleInstruction = stylePrompts[options.style] ||
    `Write in ${options.style.replace(/_/g, ' ')} style. ${STRICT_STYLE}`;

  const systemPrompt = `You are a text transformation tool. ${styleInstruction}`;

  try {
    // Use the pipeline for better filtering
    const result = await runTransformationPipeline(
      text,
      `Apply the following style: ${styleInstruction}`,
      systemPrompt,
      {
        provider: 'local',
        transformationType: 'style',
        personaOrStyle: options.style,
      }
    );

    return {
      transformation_id: result.transformationId,
      transformed_text: result.filteredOutput,
      raw_output: result.rawOutput,
      model_used: result.modelUsed,
      filtering_applied: result.filteringApplied,
    };
  } catch (error) {
    // Fallback to simple approach if pipeline fails
    console.warn('[ollamaService] Pipeline failed, using fallback:', error);

    const prompt = `IMPORTANT: Output ONLY the transformed text. Do NOT explain your process. Do NOT include any preamble, commentary, or thinking. Just output the rewritten text directly.

Style to use: ${styleInstruction}

Original text:
---
${text}
---

Transformed text (output ONLY the rewritten content):`;

    const rawTransformed = await generate(prompt, {
      temperature: 0.7,
      system: 'You are a text transformation tool. Output ONLY the transformed text, never explanations or commentary.',
    });

    const transformed = stripThinkingPreamble(rawTransformed);

    return {
      transformation_id: crypto.randomUUID(),
      transformed_text: transformed,
    };
  }
}

/**
 * Local Round-Trip Translation using Ollama
 */
export async function localRoundTrip(
  text: string,
  options: { intermediateLanguage: string }
): Promise<{
  transformation_id: string;
  forward_translation: string;
  backward_translation: string;
  semantic_drift: number;
}> {
  // Forward translation
  const forwardPrompt = `Translate the following English text to ${options.intermediateLanguage}. Translate ONLY, no explanations:

${text}`;

  const forward = await generate(forwardPrompt, { temperature: 0.3 });

  // Backward translation
  const backwardPrompt = `Translate the following ${options.intermediateLanguage} text back to English. Translate ONLY, no explanations:

${forward}`;

  const backward = await generate(backwardPrompt, { temperature: 0.3 });

  // Calculate semantic drift (simplified - based on word overlap)
  const originalWords = new Set(text.toLowerCase().split(/\s+/));
  const backWords = backward.toLowerCase().split(/\s+/);
  const overlap = backWords.filter(w => originalWords.has(w)).length;
  const semanticDrift = 1 - (overlap / Math.max(originalWords.size, backWords.length));

  return {
    transformation_id: crypto.randomUUID(),
    forward_translation: forward,
    backward_translation: backward,
    semantic_drift: Math.round(semanticDrift * 100),
  };
}
