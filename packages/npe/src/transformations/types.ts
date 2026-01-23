/**
 * Transformation Types
 *
 * Types for persona, style, and namespace transformations.
 */

/**
 * Base transformation options
 */
export interface TransformOptions {
  /** Keep output similar length to input */
  preserveLength?: boolean;
  /** Model to use (passed to adapter) */
  model?: string;
  /** Temperature (0-1) */
  temperature?: number;
  /** Max output tokens */
  maxTokens?: number;
}

/**
 * Base transformation result
 */
export interface TransformResult {
  /** Transformed text */
  text: string;
  /** Processing time in ms */
  durationMs: number;
  /** Word count of input */
  inputWordCount: number;
  /** Word count of output */
  outputWordCount: number;
}

/**
 * Persona definition
 * Controls WHO perceives/narrates
 */
export interface PersonaDefinition {
  /** Display name */
  name: string;
  /** System prompt describing the persona's epistemics and worldview */
  systemPrompt: string;
}

/**
 * Style definition
 * Controls HOW the text is written
 */
export interface StyleDefinition {
  /** Display name */
  name: string;
  /** Prompt describing sentence patterns, vocabulary, and rhetoric */
  stylePrompt: string;
}

/**
 * Namespace definition
 * Controls WHERE/WHAT universe the text exists in
 */
export interface NamespaceDefinition {
  /** Display name */
  name: string;
  /** Prompt describing the universe's concepts, terminology, and rules */
  contextPrompt: string;
}

/**
 * Built-in personas
 */
export const BUILTIN_PERSONAS: Record<string, PersonaDefinition> = {
  empiricist: {
    name: 'Empiricist',
    systemPrompt: `An empiricist narrator who trusts observation over theory.
- Notices sensory details before abstractions
- Treats uncertainty as honest acknowledgment
- Values what can be measured, counted, or directly witnessed
- Skeptical of unfounded claims; asks "how do we know?"
- Sees patterns emerge from data, not impose themselves on it`,
  },
  romantic: {
    name: 'Romantic',
    systemPrompt: `A romantic narrator who sees meaning in emotion and connection.
- Notices feeling-tones and relational dynamics first
- Treats the subjective as a valid source of truth
- Values authenticity, passion, and depth of experience
- Skeptical of cold calculation or purely instrumental thinking
- Sees the world as alive with significance`,
  },
  stoic: {
    name: 'Stoic',
    systemPrompt: `A stoic narrator who distinguishes what can and cannot be controlled.
- Notices agency and choice points in events
- Treats adversity as material for character
- Values equanimity, duty, and clear-eyed acceptance
- Skeptical of complaints about circumstance
- Sees virtue as the only true good`,
  },
  absurdist: {
    name: 'Absurdist',
    systemPrompt: `An absurdist narrator who sees cosmic comedy in human striving.
- Notices contradictions between effort and outcome
- Treats meaninglessness as liberating, not nihilistic
- Values the courage to persist despite absurdity
- Skeptical of grand narratives and final answers
- Sees humor as an appropriate response to the void`,
  },
};

/**
 * Built-in styles
 */
export const BUILTIN_STYLES: Record<string, StyleDefinition> = {
  academic: {
    name: 'Academic',
    stylePrompt: `Academic prose style:
- Formal register, precise terminology
- Complex sentence structures with clear logical connectives
- Hedged claims ("it appears that", "evidence suggests")
- Citation-ready prose without informal contractions
- Balanced, measured tone`,
  },
  journalistic: {
    name: 'Journalistic',
    stylePrompt: `Journalistic prose style:
- Inverted pyramid structure (key facts first)
- Active voice, concrete verbs
- Short to medium sentences, varied length
- Neutral, objective tone
- Minimal adjectives, no adverbs of degree`,
  },
  conversational: {
    name: 'Conversational',
    stylePrompt: `Conversational prose style:
- Informal register, contractions allowed
- Shorter sentences, occasional fragments
- Direct address, rhetorical questions
- Personal anecdotes and examples
- Warm, engaging tone`,
  },
  literary: {
    name: 'Literary',
    stylePrompt: `Literary prose style:
- Rich vocabulary, varied syntax
- Figurative language (metaphor, simile, imagery)
- Rhythm and cadence in sentence construction
- Show don't tell; concrete sensory details
- Elevated but not pretentious tone`,
  },
};

/**
 * Built-in namespaces
 */
export const BUILTIN_NAMESPACES: Record<string, NamespaceDefinition> = {
  scifi: {
    name: 'Science Fiction',
    contextPrompt: `Science fiction universe:
- Technology: FTL travel, AI, genetic engineering, neural interfaces
- Society: Interstellar civilizations, megacorporations, post-scarcity or dystopia
- Concepts: Quantum effects, simulated realities, transhumanism
- Aesthetic: Chrome, holographics, void of space, alien geometries`,
  },
  fantasy: {
    name: 'Fantasy',
    contextPrompt: `Fantasy universe:
- Magic: Elemental forces, arcane rituals, enchanted artifacts
- Society: Kingdoms, guilds, ancient orders, prophecies
- Creatures: Dragons, spirits, mythical beasts
- Aesthetic: Stone castles, enchanted forests, mystical symbols`,
  },
  noir: {
    name: 'Noir',
    contextPrompt: `Noir universe:
- Setting: Rain-slicked streets, smoky bars, shadowy offices
- Society: Corruption runs deep, everyone has a secret
- Characters: Cynical detectives, femmes fatales, desperate criminals
- Aesthetic: Chiaroscuro lighting, fedoras, neon signs, cigarette smoke`,
  },
  corporate: {
    name: 'Corporate',
    contextPrompt: `Corporate universe:
- Setting: Glass towers, conference rooms, Slack channels
- Society: Hierarchies, quarterly targets, strategic pivots
- Characters: Executives, analysts, disruptors, legacy employees
- Language: Synergy, bandwidth, leverage, circle back, align`,
  },
};
