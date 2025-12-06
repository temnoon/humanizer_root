/**
 * Model Profile Registry
 *
 * Stores model-specific "tricks" for getting clean transformation output.
 * Each model behaves differently - this registry captures what works.
 *
 * Profiles are updated based on user feedback to improve over time.
 */

// ============================================================
// TYPES
// ============================================================

export interface ModelTricks {
  useSystemPrompt: boolean;           // Some models ignore system prompts
  instructionFormat: 'inline' | 'xml' | 'markdown';  // How to format instructions
  emphasisMethod: 'caps' | 'asterisks' | 'repeated'; // How to emphasize key points
  outputDelimiter?: string;           // Marker to help extraction (e.g., "---OUTPUT---")
  avoidPhrases?: string[];            // Phrases that trigger reasoning mode
  temperature: number;                // Optimal temperature for this model
  requiresExplicitStop?: boolean;     // Needs "stop reasoning" instruction
  prefersShortPrompts?: boolean;      // Some models do better with concise prompts
  thinkingTagFormat?: string;         // e.g., "<think>" for models that use thinking tags
}

export interface FailurePatterns {
  thinkingPreambles: string[];        // Common thinking phrases this model uses
  reasoningMarkers: RegExp[];         // Patterns that indicate reasoning
  postambles?: string[];              // Common ending patterns to strip
}

export interface ModelStats {
  totalTransformations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastUpdated: string;
  commonFailures: Array<{
    persona: string;
    failureRate: number;
    commonIssue: string;
  }>;
}

export interface ModelProfile {
  id: string;                         // e.g., "llama3.2:3b", "qwen3:latest"
  family: string;                     // e.g., "llama", "qwen", "cloudflare"
  displayName: string;                // Human-readable name
  tricks: ModelTricks;
  failurePatterns: FailurePatterns;
  stats: ModelStats;
}

// ============================================================
// SEED PROFILES
// ============================================================

const DEFAULT_STATS: ModelStats = {
  totalTransformations: 0,
  successCount: 0,
  failureCount: 0,
  successRate: 0,
  lastUpdated: '',
  commonFailures: [],
};

/**
 * Initial model profiles based on observed behavior.
 * These will be refined through user feedback.
 */
const SEED_PROFILES: Record<string, ModelProfile> = {
  // Llama 3.2 (3B) - Common local model
  'llama3.2:3b': {
    id: 'llama3.2:3b',
    family: 'llama',
    displayName: 'Llama 3.2 (3B)',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'inline',
      emphasisMethod: 'caps',
      temperature: 0.7,
      requiresExplicitStop: true,
      prefersShortPrompts: true,
    },
    failurePatterns: {
      thinkingPreambles: [
        'Let me',
        "I'll",
        'First,',
        'Okay,',
        'Sure,',
        'Alright,',
      ],
      reasoningMarkers: [
        /^(?:okay|alright|sure|let me|i'll)[,\s]/i,
        /^(?:first,?\s+(?:i|let))/i,
      ],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Llama 3.2 (1B) - Smaller, faster
  'llama3.2:1b': {
    id: 'llama3.2:1b',
    family: 'llama',
    displayName: 'Llama 3.2 (1B)',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'inline',
      emphasisMethod: 'caps',
      temperature: 0.6,  // Lower temp for smaller model
      requiresExplicitStop: true,
      prefersShortPrompts: true,
    },
    failurePatterns: {
      thinkingPreambles: ['Let me', "I'll", 'First,'],
      reasoningMarkers: [/^(?:let me|i'll)[,\s]/i],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Qwen 3 - Known for verbose reasoning
  'qwen3:latest': {
    id: 'qwen3:latest',
    family: 'qwen',
    displayName: 'Qwen 3',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'markdown',
      emphasisMethod: 'asterisks',
      temperature: 0.6,  // Lower temp reduces verbosity
      requiresExplicitStop: true,
      outputDelimiter: '---TRANSFORMED---',  // Help extraction
      thinkingTagFormat: '<think>',  // Qwen uses thinking tags
    },
    failurePatterns: {
      thinkingPreambles: [
        'First, I need to',
        'To accomplish this',
        'The user wants',
        'Let me understand',
        'I should',
        'This requires',
      ],
      reasoningMarkers: [
        /^(?:first,?\s+i\s+need)/i,
        /^(?:to accomplish|the user wants|let me understand)/i,
        /^<think>[\s\S]*?<\/think>\s*/i,  // Thinking tags
      ],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Qwen 2.5 variants
  'qwen2.5:7b': {
    id: 'qwen2.5:7b',
    family: 'qwen',
    displayName: 'Qwen 2.5 (7B)',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'markdown',
      emphasisMethod: 'asterisks',
      temperature: 0.65,
      requiresExplicitStop: true,
      thinkingTagFormat: '<think>',
    },
    failurePatterns: {
      thinkingPreambles: [
        'First, I need to',
        'To accomplish this',
        'The user wants',
      ],
      reasoningMarkers: [
        /^<think>[\s\S]*?<\/think>\s*/i,
        /^(?:first,?\s+i)/i,
      ],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Mistral
  'mistral:latest': {
    id: 'mistral:latest',
    family: 'mistral',
    displayName: 'Mistral',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'inline',
      emphasisMethod: 'caps',
      temperature: 0.7,
      requiresExplicitStop: false,  // Mistral is better at following instructions
    },
    failurePatterns: {
      thinkingPreambles: ['Certainly', 'Of course', "Here's"],
      reasoningMarkers: [/^(?:certainly|of course)[,!.\s]/i],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Cloudflare Workers AI (llama-based)
  'cloudflare-llama': {
    id: 'cloudflare-llama',
    family: 'cloudflare',
    displayName: 'Cloudflare Workers AI',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'inline',
      emphasisMethod: 'caps',
      temperature: 0.7,
      requiresExplicitStop: true,
    },
    failurePatterns: {
      thinkingPreambles: [
        'An intriguing',
        'A fascinating',
        'Let me dissect',
        'Let me analyze',
        'What a',
      ],
      reasoningMarkers: [
        /^(?:an?\s+)?(?:intriguing|fascinating|interesting|delightful)/i,
        /^(?:let me\s+(?:dissect|analyze|examine))/i,
        /^(?:what a\s+(?:fascinating|intriguing|interesting))/i,
      ],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Phi-3 (Microsoft)
  'phi3:latest': {
    id: 'phi3:latest',
    family: 'phi',
    displayName: 'Phi-3',
    tricks: {
      useSystemPrompt: true,
      instructionFormat: 'xml',  // Phi works well with XML-style formatting
      emphasisMethod: 'caps',
      temperature: 0.7,
      requiresExplicitStop: false,
    },
    failurePatterns: {
      thinkingPreambles: ['I will', "I'm going to", 'Let me'],
      reasoningMarkers: [/^(?:i will|i'm going to)\s/i],
    },
    stats: { ...DEFAULT_STATS },
  },

  // Gemma 2 (Google)
  'gemma2:latest': {
    id: 'gemma2:latest',
    family: 'gemma',
    displayName: 'Gemma 2',
    tricks: {
      useSystemPrompt: false,  // Gemma often ignores system prompts
      instructionFormat: 'inline',
      emphasisMethod: 'repeated',  // Repeat key instructions
      temperature: 0.7,
      requiresExplicitStop: true,
    },
    failurePatterns: {
      thinkingPreambles: ['Here is', "Here's", 'Below is'],
      reasoningMarkers: [/^(?:here(?:'s|\s+is)|below is)/i],
    },
    stats: { ...DEFAULT_STATS },
  },
};

// ============================================================
// REGISTRY CLASS
// ============================================================

class ModelProfileRegistry {
  private profiles: Map<string, ModelProfile>;
  private storageKey = 'model-profile-registry';

  constructor() {
    this.profiles = new Map();
    this.loadProfiles();
  }

  /**
   * Load profiles from localStorage, merging with seed profiles
   */
  private loadProfiles(): void {
    // Start with seed profiles
    for (const [id, profile] of Object.entries(SEED_PROFILES)) {
      this.profiles.set(id, { ...profile });
    }

    // Overlay any saved profiles (preserves user feedback stats)
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const savedProfiles = JSON.parse(saved) as Record<string, Partial<ModelProfile>>;
        for (const [id, savedProfile] of Object.entries(savedProfiles)) {
          const existing = this.profiles.get(id);
          if (existing && savedProfile.stats) {
            // Merge saved stats into existing profile
            existing.stats = { ...existing.stats, ...savedProfile.stats };
          }
        }
      }
    } catch (error) {
      console.warn('[ModelProfileRegistry] Failed to load saved profiles:', error);
    }
  }

  /**
   * Save profiles to localStorage
   */
  private saveProfiles(): void {
    try {
      const toSave: Record<string, { stats: ModelStats }> = {};
      for (const [id, profile] of this.profiles) {
        // Only save stats (tricks come from seed data)
        toSave[id] = { stats: profile.stats };
      }
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
    } catch (error) {
      console.warn('[ModelProfileRegistry] Failed to save profiles:', error);
    }
  }

  /**
   * Get profile for a model (creates default if unknown)
   */
  getProfile(modelId: string): ModelProfile {
    // Normalize model ID (handle variations like "llama3.2:3b-instruct")
    const normalizedId = this.normalizeModelId(modelId);

    if (this.profiles.has(normalizedId)) {
      return this.profiles.get(normalizedId)!;
    }

    // Try to find a family match
    const family = this.detectFamily(modelId);
    const familyProfile = this.getFamilyDefault(family);

    if (familyProfile) {
      // Create a new profile based on family defaults
      const newProfile: ModelProfile = {
        ...familyProfile,
        id: normalizedId,
        displayName: modelId,
      };
      this.profiles.set(normalizedId, newProfile);
      return newProfile;
    }

    // Create generic profile for unknown models
    return this.createGenericProfile(normalizedId);
  }

  /**
   * Normalize model ID for consistent lookup
   */
  private normalizeModelId(modelId: string): string {
    // Remove common suffixes that don't affect behavior
    return modelId
      .toLowerCase()
      .replace(/-instruct$/, '')
      .replace(/-chat$/, '')
      .trim();
  }

  /**
   * Detect model family from ID
   */
  private detectFamily(modelId: string): string {
    const lower = modelId.toLowerCase();
    if (lower.includes('llama')) return 'llama';
    if (lower.includes('qwen')) return 'qwen';
    if (lower.includes('mistral')) return 'mistral';
    if (lower.includes('phi')) return 'phi';
    if (lower.includes('gemma')) return 'gemma';
    if (lower.includes('cloudflare')) return 'cloudflare';
    return 'unknown';
  }

  /**
   * Get default profile for a model family
   */
  private getFamilyDefault(family: string): ModelProfile | null {
    for (const profile of this.profiles.values()) {
      if (profile.family === family) {
        return profile;
      }
    }
    return null;
  }

  /**
   * Create generic profile for unknown models
   */
  private createGenericProfile(modelId: string): ModelProfile {
    const profile: ModelProfile = {
      id: modelId,
      family: 'unknown',
      displayName: modelId,
      tricks: {
        useSystemPrompt: true,
        instructionFormat: 'inline',
        emphasisMethod: 'caps',
        temperature: 0.7,
        requiresExplicitStop: true,
      },
      failurePatterns: {
        thinkingPreambles: [
          'Let me',
          "I'll",
          'First,',
          'Okay,',
          'The user',
          'To accomplish',
        ],
        reasoningMarkers: [
          /^(?:okay|let me|first,?\s+i|the user|to accomplish)/i,
        ],
      },
      stats: { ...DEFAULT_STATS },
    };

    this.profiles.set(modelId, profile);
    return profile;
  }

  /**
   * Record a transformation result (success or failure)
   */
  recordResult(modelId: string, success: boolean, persona?: string, issue?: string): void {
    const profile = this.getProfile(modelId);

    profile.stats.totalTransformations++;
    if (success) {
      profile.stats.successCount++;
    } else {
      profile.stats.failureCount++;

      // Track common failures by persona
      if (persona && issue) {
        const existing = profile.stats.commonFailures.find(f => f.persona === persona);
        if (existing) {
          existing.failureRate = (existing.failureRate + 1) / 2;  // Moving average
          existing.commonIssue = issue;
        } else {
          profile.stats.commonFailures.push({
            persona,
            failureRate: 1,
            commonIssue: issue,
          });
        }
      }
    }

    profile.stats.successRate =
      profile.stats.totalTransformations > 0
        ? (profile.stats.successCount / profile.stats.totalTransformations) * 100
        : 0;

    profile.stats.lastUpdated = new Date().toISOString();

    this.saveProfiles();
  }

  /**
   * Get all profiles (for reporting)
   */
  getAllProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Reset stats for a model (for testing)
   */
  resetStats(modelId: string): void {
    const profile = this.profiles.get(modelId);
    if (profile) {
      profile.stats = { ...DEFAULT_STATS };
      this.saveProfiles();
    }
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const modelRegistry = new ModelProfileRegistry();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build a model-optimized prompt based on profile tricks
 */
export function buildOptimizedPrompt(
  profile: ModelProfile,
  systemInstruction: string,
  userContent: string
): { system?: string; prompt: string } {
  const { tricks } = profile;

  // Format emphasis based on model preference
  const emphasize = (text: string): string => {
    switch (tricks.emphasisMethod) {
      case 'caps':
        return text.toUpperCase();
      case 'asterisks':
        return `**${text}**`;
      case 'repeated':
        return `${text}. ${text}.`;
      default:
        return text;
    }
  };

  // Build the core instruction
  const coreInstruction = emphasize('Output ONLY the transformed text. No explanations, no preamble, no commentary.');

  // Add explicit stop if needed
  const stopInstruction = tricks.requiresExplicitStop
    ? '\n\nDO NOT explain your reasoning. DO NOT say "let me" or "I will". Just output the result directly.'
    : '';

  // Add output delimiter if model supports it
  const delimiterInstruction = tricks.outputDelimiter
    ? `\n\nStart your response with: ${tricks.outputDelimiter}`
    : '';

  // Format based on instruction style
  let formattedPrompt: string;
  switch (tricks.instructionFormat) {
    case 'xml':
      formattedPrompt = `<instruction>${coreInstruction}</instruction>
<task>${systemInstruction}</task>
${stopInstruction}
${delimiterInstruction}

<input>
${userContent}
</input>

<output>`;
      break;

    case 'markdown':
      formattedPrompt = `## Instructions
${coreInstruction}
${stopInstruction}

## Task
${systemInstruction}
${delimiterInstruction}

## Input
${userContent}

## Output`;
      break;

    case 'inline':
    default:
      formattedPrompt = `${coreInstruction}
${stopInstruction}

${systemInstruction}
${delimiterInstruction}

Text to transform:
---
${userContent}
---

Transformed text:`;
  }

  // Return with or without system prompt based on model preference
  if (tricks.useSystemPrompt) {
    return {
      system: `You are a text transformation tool. ${coreInstruction}`,
      prompt: formattedPrompt,
    };
  } else {
    return {
      prompt: formattedPrompt,
    };
  }
}

/**
 * Strip thinking patterns based on model profile
 */
export function stripModelSpecificThinking(
  text: string,
  profile: ModelProfile
): string {
  let result = text.trim();

  // Handle thinking tags if model uses them
  if (profile.tricks.thinkingTagFormat) {
    const tagPattern = new RegExp(
      `${profile.tricks.thinkingTagFormat}[\\s\\S]*?<\\/think>\\s*`,
      'gi'
    );
    result = result.replace(tagPattern, '');
  }

  // Strip output delimiter if present
  if (profile.tricks.outputDelimiter) {
    const delimIndex = result.indexOf(profile.tricks.outputDelimiter);
    if (delimIndex !== -1) {
      result = result.substring(delimIndex + profile.tricks.outputDelimiter.length).trim();
    }
  }

  // Apply model-specific reasoning markers
  for (const marker of profile.failurePatterns.reasoningMarkers) {
    const match = result.match(marker);
    if (match && match.index === 0) {
      // Find where the preamble ends (double newline or sentence end)
      const preambleEnd = result.search(/\n\n|(?<=\.)\s+(?=[A-Z])/);
      if (preambleEnd > 0 && preambleEnd < 500) {
        result = result.substring(preambleEnd).trim();
      }
    }
  }

  return result;
}
