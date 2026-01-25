/**
 * Prompt Registry
 *
 * Central registry of all LLM prompts used by agents.
 * Part of Phase 3: LLM Prompt Centralization.
 *
 * Organized by agent:
 * - AGENT_LOOP_PROMPTS: Core agentic loop
 * - BUILDER_PROMPTS: Book/chapter building
 * - CURATOR_PROMPTS: Content curation
 * - HARVESTER_PROMPTS: Content harvesting
 * - REVIEWER_PROMPTS: Review and quality
 * - VIMALAKIRTI_PROMPTS: Boundary checks
 *
 * @module config/prompt-registry
 */

import type { PromptDefinition, PromptRegistry, PromptCategory } from './prompt-types.js';
import {
  CURATOR_ASSESSMENT_SCHEMA,
  VIMALAKIRTI_INQUIRY_SCHEMA,
  VIMALAKIRTI_DISTANCE_SCHEMA,
  VIMALAKIRTI_SHADOW_SCHEMA,
  BUILDER_REWRITE_SCHEMA,
  HARVESTER_EXTRACT_SCHEMA,
} from './prompt-output-schema.js';

// ═══════════════════════════════════════════════════════════════════════════
// AGENT LOOP PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const AGENT_LOOP_SYSTEM: PromptDefinition = {
  id: 'AGENT_LOOP_SYSTEM',
  name: 'Agent Loop System Prompt',
  description: 'System prompt for the agentic loop orchestrator',
  template: `You are an intelligent agent orchestrating tasks for the Humanizer platform.

Your role is to:
1. Understand user requests and break them into actionable steps
2. Select appropriate tools and agents for each step
3. Synthesize results into coherent responses

Available agents: {{agents}}

Current context:
{{context}}

Guidelines:
- Be precise and efficient
- Explain your reasoning when helpful
- Ask for clarification when requests are ambiguous
- Respect user preferences and boundaries`,
  requirements: {
    capabilities: [],
    temperature: 0.3,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['agentic-loop'],
};

export const AGENT_LOOP_REASONING: PromptDefinition = {
  id: 'AGENT_LOOP_REASONING',
  name: 'Agent Loop Reasoning Prompt',
  description: 'Prompt for agent reasoning and tool selection',
  template: `Given the user request and current state, determine the next action.

User request: {{request}}
Current state: {{state}}
Available tools: {{tools}}

Think through:
1. What is the user trying to accomplish?
2. What information do we have/need?
3. Which tool is most appropriate?

Respond with JSON:
{
  "reasoning": "Your step-by-step thinking",
  "action": "tool_name or respond",
  "parameters": {},
  "confidence": 0.0-1.0
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.2,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['agentic-loop'],
};

export const AGENT_LOOP_PROMPTS: PromptDefinition[] = [
  AGENT_LOOP_SYSTEM,
  AGENT_LOOP_REASONING,
];

// ═══════════════════════════════════════════════════════════════════════════
// BUILDER PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const BUILDER_OUTLINE_CREATION: PromptDefinition = {
  id: 'BUILDER_OUTLINE_CREATION',
  name: 'Builder Outline Creation',
  description: 'Generate a chapter outline from passages',
  template: `Create a chapter outline from these passages about "{{theme}}".

Passages:
{{passages}}

Create a logical structure with:
- Introduction that hooks the reader
- 3-5 main sections with clear themes
- Transitions between sections
- Conclusion that provides closure

Respond with JSON:
{
  "title": "Chapter title",
  "introduction": "Opening paragraph summary",
  "sections": [
    { "title": "Section title", "theme": "Core theme", "passageIds": ["id1", "id2"] }
  ],
  "conclusion": "Closing summary"
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.5,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_SECTION_COMPOSITION: PromptDefinition = {
  id: 'BUILDER_SECTION_COMPOSITION',
  name: 'Builder Section Composition',
  description: 'Compose a section from passages',
  template: `Compose a coherent section for the chapter "{{chapterTitle}}".

Section theme: {{sectionTheme}}
Voice guidance: {{voiceGuidance}}

Source passages:
{{passages}}

Requirements:
- Weave passages naturally into flowing prose
- Maintain the author's voice throughout
- Add minimal bridging text where needed
- Preserve key ideas and insights

Output the composed section text only.`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 4096,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_TRANSITION_GENERATION: PromptDefinition = {
  id: 'BUILDER_TRANSITION_GENERATION',
  name: 'Builder Transition Writing',
  description: 'Generate transitions between sections',
  template: `Write a brief transition (1-2 sentences) that bridges from one section to the next in a chapter about "{{theme}}".

Previous section ended with:
{{previousEnding}}

Transitioning to: "{{nextSectionPreview}}"

The transition should feel natural and maintain flow.

Output only the transition text.`,
  requirements: {
    capabilities: [],
    temperature: 0.7,
    maxTokens: 256,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_STRUCTURE_ANALYSIS: PromptDefinition = {
  id: 'BUILDER_STRUCTURE_ANALYSIS',
  name: 'Builder Structure Analysis',
  description: 'Analyze chapter narrative structure',
  template: `Analyze this chapter's structure:
1. Identify the narrative arc (building/peak/resolution/flat)
2. Evaluate pacing (0-1 scale)
3. Find structural issues (weak transitions, abrupt shifts, imbalanced sections)
4. Suggest improvements

Chapter:
{{content}}

Respond with JSON:
{
  "narrativeArc": "building|peak|resolution|flat",
  "pacingScore": 0.0-1.0,
  "issues": ["Issue description"],
  "suggestions": ["Improvement suggestion"]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_DRAFT_REVISION: PromptDefinition = {
  id: 'BUILDER_DRAFT_REVISION',
  name: 'Builder Draft Revision',
  description: 'Revise chapter with specific focus areas',
  template: `Revise this chapter draft. Focus on: {{focusAreas}}

Draft:
{{content}}

Apply targeted improvements while preserving voice and meaning.
Output the revised text.`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 8192,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_IMPROVEMENT_SUGGESTIONS: PromptDefinition = {
  id: 'BUILDER_IMPROVEMENT_SUGGESTIONS',
  name: 'Builder Improvement Suggestions',
  description: 'Suggest specific chapter improvements',
  template: `Analyze this chapter and suggest specific improvements.
Focus on actionable changes, not general advice.

Chapter:
{{content}}

Respond with JSON:
{
  "suggestions": [
    {
      "location": "Description of where in text",
      "issue": "What's wrong",
      "suggestedFix": "Specific fix"
    }
  ]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.4,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_STYLE_ANALYSIS: PromptDefinition = {
  id: 'BUILDER_STYLE_ANALYSIS',
  name: 'Builder Style Analysis',
  description: 'Analyze text style against persona',
  template: `Analyze this text's style compared to the persona "{{personaName}}".

Persona traits: {{voiceTraits}}
Persona tone: {{toneMarkers}}
{{#if forbiddenPhrases}}
Forbidden phrases to check: {{forbiddenPhrases}}
{{/if}}

Text:
{{content}}

Evaluate: voice consistency, formality match, pattern usage, forbidden phrase presence.

Respond with JSON:
{
  "voiceMatch": 0.0-1.0,
  "issues": ["Issue description"],
  "suggestions": ["Suggestion"],
  "forbiddenPhrasesFound": ["phrase found"]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_ISSUE_FIX: PromptDefinition = {
  id: 'BUILDER_ISSUE_FIX',
  name: 'Builder Issue Fix Application',
  description: 'Fix specific issue in text',
  template: `You need to fix an issue in this text.

Issue: {{issueDescription}}
Location: {{location}}
Suggested fix: {{suggestedFix}}

Text:
{{content}}

Apply the fix naturally. Output only the corrected text.`,
  requirements: {
    capabilities: [],
    temperature: 0.5,
    maxTokens: 4096,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_FOCUSED_REVISION: PromptDefinition = {
  id: 'BUILDER_FOCUSED_REVISION',
  name: 'Builder Focused Revision',
  description: 'Revision based on Reviewer feedback',
  template: `Revise this chapter text. Focus specifically on:
{{#each focusAreas}}
- {{this}}
{{/each}}

Issues to address:
{{#each issues}}
- {{this.type}}: {{this.description}} at {{this.location}}
{{/each}}

Text:
{{content}}

Output the revised text with all issues addressed.`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 8192,
  },
  version: 1,
  usedBy: ['builder'],
};

export const BUILDER_PROMPTS: PromptDefinition[] = [
  BUILDER_OUTLINE_CREATION,
  BUILDER_SECTION_COMPOSITION,
  BUILDER_TRANSITION_GENERATION,
  BUILDER_STRUCTURE_ANALYSIS,
  BUILDER_DRAFT_REVISION,
  BUILDER_IMPROVEMENT_SUGGESTIONS,
  BUILDER_STYLE_ANALYSIS,
  BUILDER_ISSUE_FIX,
  BUILDER_FOCUSED_REVISION,
];

// ═══════════════════════════════════════════════════════════════════════════
// CURATOR PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const CURATOR_PASSAGE_ASSESSMENT: PromptDefinition = {
  id: 'CURATOR_PASSAGE_ASSESSMENT',
  name: 'Curator Passage Quality Assessment',
  description: 'Evaluate passage on clarity, depth, originality, relevance',
  template: `You are a literary curator assessing passage quality.

Evaluate this passage on four dimensions (0-1 each):
- Clarity: How clear and understandable?
- Depth: How insightful or profound?
- Originality: How unique or fresh?
- Relevance: How relevant to theme "{{theme}}"?

Passage:
{{passage}}

Respond with JSON:
{
  "clarity": 0.0-1.0,
  "depth": 0.0-1.0,
  "originality": 0.0-1.0,
  "relevance": 0.0-1.0,
  "overallQuality": 0.0-1.0,
  "isGem": true/false,
  "reasoning": "Brief explanation"
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 512,
  },
  outputSchema: CURATOR_ASSESSMENT_SCHEMA,
  version: 1,
  usedBy: ['curator'],
};

export const CURATOR_THREAD_COHERENCE: PromptDefinition = {
  id: 'CURATOR_THREAD_COHERENCE',
  name: 'Curator Thread Coherence Analysis',
  description: 'Assess passage flow, gaps, redundancy, ordering',
  template: `You are analyzing thread coherence for a book chapter.

Evaluate these passages for:
- Flow: Do they connect logically?
- Gaps: Are there missing links?
- Redundancy: Is content repeated?
- Ordering: Is the sequence optimal?

Passages:
{{passages}}

Respond with JSON:
{
  "flowScore": 0.0-1.0,
  "gaps": ["Description of gap"],
  "redundancies": ["Description of redundancy"],
  "suggestedOrder": ["passageId1", "passageId2", ...]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    minContextWindow: 8192,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['curator'],
};

export const CURATOR_CLUSTER_SUGGESTION: PromptDefinition = {
  id: 'CURATOR_CLUSTER_SUGGESTION',
  name: 'Curator Cluster Identification',
  description: 'Identify thematic clusters in passages',
  template: `Identify {{numClusters}} thematic clusters in these passages.

For each cluster:
- Name: Brief descriptive label
- Theme: Core concept
- Passages: Which passage IDs belong

Passages:
{{passages}}

Respond with JSON:
{
  "clusters": [
    {
      "name": "Cluster name",
      "theme": "Core theme description",
      "passageIds": ["id1", "id2"]
    }
  ]
}`,
  requirements: {
    capabilities: ['json-mode'],
    minContextWindow: 8192,
    temperature: 0.4,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['curator'],
};

export const CURATOR_CARD_ASSIGNMENT: PromptDefinition = {
  id: 'CURATOR_CARD_ASSIGNMENT',
  name: 'Curator Card-to-Chapter Assignment',
  description: 'Match content cards to chapter sections',
  template: `You are a literary curator helping organize content into chapters.

Match each card to the most appropriate chapter section.

Cards:
{{cards}}

Chapter structure:
{{chapterStructure}}

Respond with JSON:
{
  "assignments": [
    {
      "cardId": "card id",
      "sectionId": "section id",
      "confidence": 0.0-1.0
    }
  ]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['curator'],
};

export const CURATOR_PROMPTS: PromptDefinition[] = [
  CURATOR_PASSAGE_ASSESSMENT,
  CURATOR_THREAD_COHERENCE,
  CURATOR_CLUSTER_SUGGESTION,
  CURATOR_CARD_ASSIGNMENT,
];

// ═══════════════════════════════════════════════════════════════════════════
// HARVESTER PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const HARVESTER_PASSAGE_EXTRACTION: PromptDefinition = {
  id: 'HARVESTER_PASSAGE_EXTRACTION',
  name: 'Harvester Passage Extraction',
  description: 'Extract relevant passages from content',
  template: `Extract passages relevant to the theme "{{theme}}" from this content.

For each passage:
- Extract the complete thought (don't truncate mid-sentence)
- Assess relevance to theme (0-1)
- Identify sub-themes

Content:
{{content}}

Respond with JSON:
{
  "passages": [
    {
      "text": "The extracted passage",
      "relevance": 0.0-1.0,
      "themes": ["theme1", "theme2"]
    }
  ],
  "totalFound": number,
  "confidence": 0.0-1.0
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    minContextWindow: 8192,
    maxTokens: 4096,
  },
  outputSchema: HARVESTER_EXTRACT_SCHEMA,
  version: 1,
  usedBy: ['harvester'],
};

export const HARVESTER_THEME_IDENTIFICATION: PromptDefinition = {
  id: 'HARVESTER_THEME_IDENTIFICATION',
  name: 'Harvester Theme Identification',
  description: 'Identify themes in content',
  template: `Identify the main themes in this content.

Content:
{{content}}

For each theme:
- Name: Brief label
- Description: What it covers
- Prevalence: How prominent (0-1)

Respond with JSON:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "Description",
      "prevalence": 0.0-1.0
    }
  ]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.4,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['harvester'],
};

export const HARVESTER_PROMPTS: PromptDefinition[] = [
  HARVESTER_PASSAGE_EXTRACTION,
  HARVESTER_THEME_IDENTIFICATION,
];

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWER PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const REVIEWER_STYLE_CHECK: PromptDefinition = {
  id: 'REVIEWER_STYLE_CHECK',
  name: 'Reviewer Style Consistency Check',
  description: 'Evaluate text style against persona',
  template: `Analyze this text's style{{#if persona}} compared to the persona "{{persona}}"{{/if}}.

{{#if voiceTraits}}
Persona voice traits: {{voiceTraits}}
{{/if}}

Evaluate:
- Voice consistency with persona traits
- Formality level appropriateness
- Pattern usage (contractions, rhetorical questions)
- AI tell presence

Text:
{{content}}

Respond with JSON:
{
  "styleScore": 0.0-1.0,
  "voiceMatch": 0.0-1.0,
  "formalityMatch": 0.0-1.0,
  "aiTellsDetected": ["Tell description"],
  "issues": ["Issue description"]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['reviewer'],
};

export const REVIEWER_STRUCTURE_CHECK: PromptDefinition = {
  id: 'REVIEWER_STRUCTURE_CHECK',
  name: 'Reviewer Structure Analysis',
  description: 'Analyze chapter structural quality',
  template: `Analyze this chapter's structure:
- Opening: Does it hook the reader?
- Body: Is it well-organized with clear sections?
- Transitions: Are section bridges smooth?
- Conclusion: Does it provide satisfying closure?

Chapter:
{{content}}

Respond with JSON:
{
  "structureScore": 0.0-1.0,
  "openingQuality": 0.0-1.0,
  "transitionQuality": 0.0-1.0,
  "conclusionQuality": 0.0-1.0,
  "issues": ["Issue description"]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['reviewer'],
};

export const REVIEWER_FACT_EXTRACTION: PromptDefinition = {
  id: 'REVIEWER_FACT_EXTRACTION',
  name: 'Reviewer Fact Claim Extraction',
  description: 'Extract verifiable factual claims',
  template: `Extract verifiable factual claims from this text.

For each claim:
- claim: The factual statement
- location: Where in text
- verifiable: Can it be fact-checked?

Text:
{{content}}

Respond with JSON:
{
  "claims": [
    {
      "claim": "The factual statement",
      "location": "Beginning/middle/end or quote",
      "verifiable": true/false
    }
  ]
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['reviewer'],
};

export const REVIEWER_PROMPTS: PromptDefinition[] = [
  REVIEWER_STYLE_CHECK,
  REVIEWER_STRUCTURE_CHECK,
  REVIEWER_FACT_EXTRACTION,
];

// ═══════════════════════════════════════════════════════════════════════════
// VIMALAKIRTI PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const VIMALAKIRTI_INQUIRY_LEVEL: PromptDefinition = {
  id: 'VIMALAKIRTI_INQUIRY_LEVEL',
  name: 'Vimalakirti Inquiry Level Assessment',
  description: 'Assess the inquiry level of text',
  template: `Assess the inquiry level of this text on a 1-5 scale:
1. Surface/casual
2. Curious/exploratory
3. Engaged/seeking
4. Deep/philosophical
5. Profound/transformative

Text:
{{text}}

Respond with JSON:
{
  "level": 1-5,
  "category": "surface|curious|engaged|deep|profound",
  "indicators": ["Indicator 1", "Indicator 2"],
  "confidence": 0.0-1.0,
  "recommendation": "How to engage with this level"
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 512,
  },
  outputSchema: VIMALAKIRTI_INQUIRY_SCHEMA,
  version: 1,
  usedBy: ['vimalakirti'],
};

export const VIMALAKIRTI_PROFESSIONAL_DISTANCE: PromptDefinition = {
  id: 'VIMALAKIRTI_PROFESSIONAL_DISTANCE',
  name: 'Vimalakirti Professional Distance Check',
  description: 'Check professional distance in text',
  template: `Evaluate the professional distance in this text.

Professional distance means:
- Avoiding overly personal or intimate language
- Maintaining appropriate boundaries
- Not making assumptions about personal life
- Respecting user autonomy

Text:
{{text}}

Respond with JSON:
{
  "distance": 0.0-1.0,
  "concerns": ["Concern description"],
  "isAppropriate": true/false,
  "reasoning": "Explanation"
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 512,
  },
  outputSchema: VIMALAKIRTI_DISTANCE_SCHEMA,
  version: 1,
  usedBy: ['vimalakirti'],
};

export const VIMALAKIRTI_SHADOW_CHECK: PromptDefinition = {
  id: 'VIMALAKIRTI_SHADOW_CHECK',
  name: 'Vimalakirti Shadow Content Detection',
  description: 'Detect shadow content in text',
  template: `Check for shadow content in this text.

Shadow content includes:
- Unprocessed negative emotions
- Projection onto others
- Denial or avoidance
- Passive aggression
- Unconscious biases

Text:
{{text}}

Respond with JSON:
{
  "hasShadowContent": true/false,
  "shadowScore": 0.0-1.0,
  "indicators": ["Indicator description"],
  "recommendation": "How to address if present"
}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 512,
  },
  outputSchema: VIMALAKIRTI_SHADOW_SCHEMA,
  version: 1,
  usedBy: ['vimalakirti'],
};

export const VIMALAKIRTI_PROMPTS: PromptDefinition[] = [
  VIMALAKIRTI_INQUIRY_LEVEL,
  VIMALAKIRTI_PROFESSIONAL_DISTANCE,
  VIMALAKIRTI_SHADOW_CHECK,
];

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All prompts combined into a single array.
 */
export const ALL_PROMPTS: PromptDefinition[] = [
  ...AGENT_LOOP_PROMPTS,
  ...BUILDER_PROMPTS,
  ...CURATOR_PROMPTS,
  ...HARVESTER_PROMPTS,
  ...REVIEWER_PROMPTS,
  ...VIMALAKIRTI_PROMPTS,
];

/**
 * Prompt registry mapping ID to definition.
 */
export const PROMPT_REGISTRY: PromptRegistry = Object.fromEntries(
  ALL_PROMPTS.map((p) => [p.id, p])
);

/**
 * Category mapping for all prompts.
 */
export const PROMPT_CATEGORIES: Record<string, PromptCategory> = {
  AGENT_LOOP_SYSTEM: 'agent-loop',
  AGENT_LOOP_REASONING: 'agent-loop',
  BUILDER_OUTLINE_CREATION: 'builder',
  BUILDER_SECTION_COMPOSITION: 'builder',
  BUILDER_TRANSITION_GENERATION: 'builder',
  BUILDER_STRUCTURE_ANALYSIS: 'builder',
  BUILDER_DRAFT_REVISION: 'builder',
  BUILDER_IMPROVEMENT_SUGGESTIONS: 'builder',
  BUILDER_STYLE_ANALYSIS: 'builder',
  BUILDER_ISSUE_FIX: 'builder',
  BUILDER_FOCUSED_REVISION: 'builder',
  CURATOR_PASSAGE_ASSESSMENT: 'curator',
  CURATOR_THREAD_COHERENCE: 'curator',
  CURATOR_CLUSTER_SUGGESTION: 'curator',
  CURATOR_CARD_ASSIGNMENT: 'curator',
  HARVESTER_PASSAGE_EXTRACTION: 'harvester',
  HARVESTER_THEME_IDENTIFICATION: 'harvester',
  REVIEWER_STYLE_CHECK: 'reviewer',
  REVIEWER_STRUCTURE_CHECK: 'reviewer',
  REVIEWER_FACT_EXTRACTION: 'reviewer',
  VIMALAKIRTI_INQUIRY_LEVEL: 'vimalakirti',
  VIMALAKIRTI_PROFESSIONAL_DISTANCE: 'vimalakirti',
  VIMALAKIRTI_SHADOW_CHECK: 'vimalakirti',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a prompt by ID.
 */
export function getPrompt(id: string): PromptDefinition | undefined {
  return PROMPT_REGISTRY[id];
}

/**
 * Get all prompts for an agent.
 */
export function getPromptsForAgent(agentName: string): PromptDefinition[] {
  return ALL_PROMPTS.filter((p) => p.usedBy?.includes(agentName));
}

/**
 * Get all prompts in a category.
 */
export function getPromptsInCategory(category: PromptCategory): PromptDefinition[] {
  return ALL_PROMPTS.filter((p) => PROMPT_CATEGORIES[p.id] === category);
}

/**
 * Get all prompts requiring a capability.
 */
export function getPromptsRequiringCapability(capability: string): PromptDefinition[] {
  return ALL_PROMPTS.filter((p) =>
    p.requirements.capabilities.includes(capability as any)
  );
}

/**
 * List all prompt IDs.
 */
export function listPromptIds(): string[] {
  return Object.keys(PROMPT_REGISTRY);
}

/**
 * Check if a prompt exists.
 */
export function hasPrompt(id: string): boolean {
  return id in PROMPT_REGISTRY;
}
