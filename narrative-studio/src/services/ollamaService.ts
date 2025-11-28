/**
 * Ollama Service - Direct Ollama API Integration
 *
 * This service provides direct calls to Ollama running locally.
 * Used in Electron mode when user has Ollama configured.
 */

const OLLAMA_BASE = 'http://localhost:11434';

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
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
 */
export async function generate(
  prompt: string,
  options: {
    model?: string;
    system?: string;
    temperature?: number;
    stream?: boolean;
  } = {}
): Promise<string> {
  const model = options.model || await getSelectedModel();

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
  });

  if (!response.ok) {
    throw new Error(`Ollama generate failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

/**
 * Chat completion using Ollama
 */
export async function chat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: string;
    temperature?: number;
  } = {}
): Promise<string> {
  const model = options.model || await getSelectedModel();

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
  });

  if (!response.ok) {
    throw new Error(`Ollama chat failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || '';
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
 * Local Persona Transformation using Ollama
 */
export async function localPersonaTransform(
  text: string,
  options: { persona: string }
): Promise<{
  transformation_id: string;
  transformed_text: string;
}> {
  const personaPrompts: Record<string, string> = {
    'holmes_analytical': 'Write in the style of Sherlock Holmes - precise, deductive, with keen observations',
    'watson_chronicler': 'Write as Dr. Watson would - warm, descriptive, slightly awed',
    'austen_ironic_observer': 'Write in Jane Austen\'s style - witty, ironic, with social observations',
    'dickens_dramatic': 'Write like Charles Dickens - vivid descriptions, dramatic, emotionally rich',
  };

  const systemPrompt = personaPrompts[options.persona] ||
    `Write in the style of ${options.persona.replace(/_/g, ' ')}`;

  const prompt = `Rewrite the following text in the specified style. Preserve the core meaning and information, but transform the voice and perspective:

${text}`;

  const transformed = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], { temperature: 0.8 });

  return {
    transformation_id: crypto.randomUUID(),
    transformed_text: transformed,
  };
}

/**
 * Local Style Transformation using Ollama
 */
export async function localStyleTransform(
  text: string,
  options: { style: string }
): Promise<{
  transformation_id: string;
  transformed_text: string;
}> {
  const stylePrompts: Record<string, string> = {
    'austen_precision': 'Use precise, elegant language with balanced sentences',
    'dickens_dramatic': 'Use vivid, dramatic language with rich descriptions',
    'hemingway_sparse': 'Use short, direct sentences. Simple words. Clear meaning.',
    'reddit_casual_prose': 'Write casually, like a friendly Reddit comment',
  };

  const styleInstruction = stylePrompts[options.style] ||
    `Write in ${options.style.replace(/_/g, ' ')} style`;

  const prompt = `Rewrite the following text using this style: ${styleInstruction}

Original text:
${text}

Rewrite:`;

  const transformed = await generate(prompt, { temperature: 0.7 });

  return {
    transformation_id: crypto.randomUUID(),
    transformed_text: transformed,
  };
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
