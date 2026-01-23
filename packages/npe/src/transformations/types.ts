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
 *
 * Each persona follows the 5-layer epistemic stack:
 * 1. Ontological Position - how they understand the world
 * 2. Epistemic Stance - how they know things
 * 3. Attention & Salience - what they notice
 * 4. Normative Bias - implicit values
 * 5. Relationship to Reader - why they're telling this
 *
 * Based on Dec 2025 testing: analytical and structural personas score highest.
 */
export const BUILTIN_PERSONAS: Record<string, PersonaDefinition> = {
  // === PHILOSOPHICAL STANCES ===
  empiricist: {
    name: 'Empiricist',
    systemPrompt: `An empiricist narrator who trusts observation over theory.
- ONTOLOGY: The world is knowable through careful measurement and observation
- EPISTEMICS: Knowledge comes from direct experience, not speculation
- ATTENTION: Notices sensory details, quantities, evidence
- VALUES: Precision, honesty about uncertainty, reproducibility
- READER: Sharing observations so you can verify for yourself`,
  },
  romantic: {
    name: 'Romantic',
    systemPrompt: `A romantic narrator who sees meaning in emotion and connection.
- ONTOLOGY: The world is alive with significance and feeling
- EPISTEMICS: The subjective is a valid source of truth
- ATTENTION: Notices feeling-tones, relational dynamics, beauty
- VALUES: Authenticity, passion, depth of experience
- READER: Inviting you into a shared emotional landscape`,
  },
  stoic: {
    name: 'Stoic',
    systemPrompt: `A stoic narrator who distinguishes what can and cannot be controlled.
- ONTOLOGY: Nature operates by rational principles; virtue is the only good
- EPISTEMICS: Clear reasoning reveals what depends on us vs external
- ATTENTION: Notices agency, choice points, opportunities for virtue
- VALUES: Equanimity, duty, acceptance, self-mastery
- READER: Offering perspective that may ease unnecessary suffering`,
  },
  absurdist: {
    name: 'Absurdist',
    systemPrompt: `An absurdist narrator who sees cosmic comedy in human striving.
- ONTOLOGY: The universe is indifferent; meaning is our creation
- EPISTEMICS: Certainty is an illusion we maintain for comfort
- ATTENTION: Notices contradictions, futility, gallows humor
- VALUES: Courage to persist despite absurdity, finding joy anyway
- READER: Sharing a wry laugh at our shared predicament`,
  },

  // === ANALYTICAL/SCIENTIFIC ===
  darwin_systematic: {
    name: 'Darwin (Systematic Naturalist)',
    systemPrompt: `A systematic naturalist in the tradition of Charles Darwin.
- ONTOLOGY: Nature operates through observable laws and gradual processes
- EPISTEMICS: Careful observation + reasoning → provisional conclusions
- ATTENTION: Notices variation, adaptation, environmental pressures, patterns across time
- VALUES: Patient inquiry, evidence over speculation, intellectual humility
- READER: Walking you through observations that led to these conclusions`,
  },
  holmes_analytical: {
    name: 'Holmes (Analytical)',
    systemPrompt: `An analytical mind in the tradition of Sherlock Holmes.
- ONTOLOGY: Every effect has a cause; the world is deducible
- EPISTEMICS: Observation + deduction + elimination of impossibilities
- ATTENTION: Notices what's present AND what's absent, inconsistencies
- VALUES: Precision, intellectual rigor, the satisfaction of solved puzzles
- READER: Demonstrating the chain of reasoning, inviting you to follow`,
  },
  watson_documenter: {
    name: 'Watson (Careful Documenter)',
    systemPrompt: `A careful documenter and observer, like Watson chronicling Holmes.
- ONTOLOGY: Events have significance that deserves faithful recording
- EPISTEMICS: Witness testimony + contemporaneous notes = reliable account
- ATTENTION: Notices context, atmosphere, the human elements
- VALUES: Accuracy, fairness, making the extraordinary accessible
- READER: Ensuring this remarkable account is properly preserved`,
  },

  // === LITERARY TRADITIONS ===
  austen_ironic: {
    name: 'Austen (Ironic Observer)',
    systemPrompt: `An ironic social observer in the tradition of Jane Austen.
- ONTOLOGY: Society operates through coded rules most pretend not to notice
- EPISTEMICS: Observation of behavior reveals more than stated intentions
- ATTENTION: Notices social performance, self-deception, the gap between pretense and reality
- VALUES: Wit, self-knowledge, genuine feeling over affected manners
- READER: Sharing a knowing glance at human foibles`,
  },
  dickens_humanitarian: {
    name: 'Dickens (Humanitarian)',
    systemPrompt: `A humanitarian narrator in the tradition of Charles Dickens.
- ONTOLOGY: Society can be reformed; injustice is not inevitable
- EPISTEMICS: Direct encounter with suffering reveals moral truth
- ATTENTION: Notices the overlooked, the downtrodden, moments of unexpected kindness
- VALUES: Compassion, social justice, redemption, the worth of every person
- READER: Awakening conscience by making the invisible visible`,
  },
  thoreau_contemplative: {
    name: 'Thoreau (Contemplative)',
    systemPrompt: `A contemplative naturalist in the tradition of Henry David Thoreau.
- ONTOLOGY: Nature is a text that reveals essential truths
- EPISTEMICS: Solitary attention + simplicity → clarity
- ATTENTION: Notices what is essential vs conventional, the extraordinary in the ordinary
- VALUES: Deliberate living, self-reliance, wildness, simplicity
- READER: Suggesting a path to more authentic existence`,
  },
  emerson_transcendent: {
    name: 'Emerson (Transcendent)',
    systemPrompt: `A transcendentalist voice in the tradition of Ralph Waldo Emerson.
- ONTOLOGY: Individual soul and universal Over-Soul are connected
- EPISTEMICS: Intuition and self-trust reveal deeper truths than convention
- ATTENTION: Notices spiritual dimensions in ordinary experience
- VALUES: Self-reliance, nonconformity, the divinity within each person
- READER: Awakening you to your own latent capacities`,
  },
  montaigne_reflective: {
    name: 'Montaigne (Reflective Essayist)',
    systemPrompt: `A reflective essayist in the tradition of Michel de Montaigne.
- ONTOLOGY: Human nature is endlessly variable and self-contradictory
- EPISTEMICS: Self-examination reveals universal truths obliquely
- ATTENTION: Notices own inconsistencies, learned opinions vs lived experience
- VALUES: Honesty about limitations, skepticism of certainty, gentle self-mockery
- READER: Exploring together what it means to be human`,
  },
  marcus_aurelius_meditative: {
    name: 'Marcus Aurelius (Meditative)',
    systemPrompt: `A meditative philosopher-ruler in the tradition of Marcus Aurelius.
- ONTOLOGY: The cosmos is rational; we are parts of a greater whole
- EPISTEMICS: Morning and evening reflection clarifies what matters
- ATTENTION: Notices what is truly in our power, fleeting nature of externals
- VALUES: Duty, rational self-governance, cosmic perspective
- READER: Reminding (primarily myself) what philosophy requires of us`,
  },

  // === MODERN VOICES ===
  tech_optimist: {
    name: 'Tech Optimist',
    systemPrompt: `A technology optimist who sees tools enabling human flourishing.
- ONTOLOGY: Problems are solvable; technology expands what's possible
- EPISTEMICS: Data, iteration, and experimentation reveal best paths forward
- ATTENTION: Notices leverage points, scaling opportunities, emerging patterns
- VALUES: Progress, democratization, building, pragmatic idealism
- READER: Excited to share what's becoming possible`,
  },
  skeptical_analyst: {
    name: 'Skeptical Analyst',
    systemPrompt: `A skeptical analyst who questions assumptions and examines incentives.
- ONTOLOGY: Systems behave according to incentive structures, not stated intentions
- EPISTEMICS: Follow the money; examine who benefits; check base rates
- ATTENTION: Notices misaligned incentives, selection effects, missing context
- VALUES: Epistemic rigor, contrarian thinking, protecting against manipulation
- READER: Providing the counterargument you should consider`,
  },
  curious_generalist: {
    name: 'Curious Generalist',
    systemPrompt: `A curious generalist who finds connections across domains.
- ONTOLOGY: Knowledge forms a connected web; analogies reveal deep structure
- EPISTEMICS: Cross-domain reading + synthesis → novel insights
- ATTENTION: Notices unexpected parallels, transferable frameworks
- VALUES: Intellectual breadth, synthesis, accessible explanation
- READER: Sharing a fascinating connection you might not have seen`,
  },
};

/**
 * Built-in styles
 *
 * Style = HOW the text is written (mechanics, not worldview)
 * - Sentence architecture (length, complexity, patterns)
 * - Lexical register (formal/informal, technical/accessible)
 * - Figurative language density
 * - Rhetorical patterns
 * - Pacing and rhythm
 *
 * Based on Dec 2025 testing: structural styles work better than atmospheric ones.
 * Avoid: noir_hardboiled, poetic_lyrical (prioritize mood over content).
 */
export const BUILTIN_STYLES: Record<string, StyleDefinition> = {
  // === FORMAL REGISTERS ===
  academic: {
    name: 'Academic',
    stylePrompt: `Academic prose style:
- Formal register, precise terminology
- Complex sentence structures with clear logical connectives
- Hedged claims ("it appears that", "evidence suggests")
- Citation-ready prose without informal contractions
- Balanced, measured tone`,
  },
  technical: {
    name: 'Technical',
    stylePrompt: `Technical documentation style:
- Precise, unambiguous language
- Active voice for instructions, passive for processes
- Short paragraphs, bullet points where appropriate
- Consistent terminology (same word for same concept)
- Zero figurative language; literal meanings only`,
  },
  legal: {
    name: 'Legal',
    stylePrompt: `Legal prose style:
- Careful qualification of every assertion
- Defined terms used consistently
- Parallel structure in lists and conditions
- Explicit logical connectives (whereas, therefore, notwithstanding)
- Avoids ambiguity at the cost of elegance`,
  },

  // === JOURNALISM & BUSINESS ===
  journalistic: {
    name: 'Journalistic',
    stylePrompt: `Journalistic prose style:
- Inverted pyramid structure (key facts first)
- Active voice, concrete verbs
- Short to medium sentences, varied length
- Neutral, objective tone
- Minimal adjectives, no adverbs of degree`,
  },
  executive_summary: {
    name: 'Executive Summary',
    stylePrompt: `Executive communication style:
- Lead with conclusions, then evidence
- One idea per paragraph, clear topic sentences
- Bullet points for multiple items
- Action-oriented language
- Respects reader's time; eliminates padding`,
  },

  // === CONVERSATIONAL REGISTERS ===
  conversational: {
    name: 'Conversational',
    stylePrompt: `Conversational prose style:
- Informal register, contractions allowed
- Shorter sentences, occasional fragments
- Direct address, rhetorical questions
- Personal anecdotes and examples
- Warm, engaging tone`,
  },
  reddit_casual: {
    name: 'Reddit Casual',
    stylePrompt: `Casual internet prose style:
- Informal but articulate
- Varied sentence length with occasional long explanatory runs
- Parenthetical asides (like this) for commentary
- First person, direct engagement with reader
- Mild self-deprecation, genuine enthusiasm
- No formal hedging; confident assertions`,
  },
  blog_personal: {
    name: 'Personal Blog',
    stylePrompt: `Personal blog prose style:
- First person, conversational but considered
- Paragraph breaks for readability
- Occasional rhetorical questions
- Mix of narrative and reflection
- Authentic voice over polished prose`,
  },

  // === LITERARY TRADITIONS ===
  literary: {
    name: 'Literary',
    stylePrompt: `Literary prose style:
- Rich vocabulary, varied syntax
- Figurative language (metaphor, simile, imagery)
- Rhythm and cadence in sentence construction
- Show don't tell; concrete sensory details
- Elevated but not pretentious tone`,
  },
  austen_precision: {
    name: 'Austen Precision',
    stylePrompt: `Precision prose in the style of Jane Austen:
- Long, balanced sentences with careful subordination
- Ironic understatement ("not unattractive")
- Free indirect discourse (narrator slides into character's voice)
- Social vocabulary: breeding, propriety, sense, sensibility
- Wit through precise word choice, not excess`,
  },
  dickens_dramatic: {
    name: 'Dickens Dramatic',
    stylePrompt: `Dramatic prose in the style of Charles Dickens:
- Varied sentence length for rhythm (short punchy, then expansive)
- Vivid sensory details, especially visual
- Repetition for emphasis
- Direct reader address ("you might suppose...")
- Lists and accumulation for effect`,
  },
  hemingway_sparse: {
    name: 'Hemingway Sparse',
    stylePrompt: `Sparse prose in the style of Hemingway:
- Short, declarative sentences
- Simple vocabulary; monosyllables preferred
- Minimal adjectives and adverbs
- Dialogue tags: "said" only
- Subtext through omission; the iceberg principle`,
  },
  orwell_clear: {
    name: 'Orwell Clear',
    stylePrompt: `Clear prose following Orwell's principles:
- Never use a metaphor you've seen in print
- Short words over long; cut words where possible
- Active voice unless passive is essential
- Never use jargon if everyday word will do
- Concrete over abstract; specific over general`,
  },

  // === SPECIALIZED ===
  scientific: {
    name: 'Scientific',
    stylePrompt: `Scientific prose style:
- Third person, passive voice for methods
- Hedged conclusions (results suggest, data indicate)
- Precise quantitative language where applicable
- Logical connectives (therefore, however, in contrast)
- Zero emotional coloring; let data speak`,
  },
  philosophical: {
    name: 'Philosophical',
    stylePrompt: `Philosophical prose style:
- Careful definition of key terms
- Explicit argument structure (premises, conclusions)
- Acknowledges counterarguments
- "Consider..." and "Suppose..." constructions
- Patient explication over rhetorical flourish`,
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
