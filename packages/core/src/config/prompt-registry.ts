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
// TRANSFORMATION PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const TRANSFORMATION_SYSTEM: PromptDefinition = {
  id: 'TRANSFORMATION_SYSTEM',
  name: 'Transformation System Prompt',
  description: 'Base system prompt for all narrative transformations',
  template: `You are a narrative transformation specialist.
You transform text while preserving specified invariants.
Output ONLY the transformed text with no explanation or commentary.`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 8192,
  },
  version: 1,
  usedBy: ['builder', 'transformation-service'],
};

export const TRANSFORMATION_PERSONA: PromptDefinition = {
  id: 'TRANSFORMATION_PERSONA',
  name: 'Persona Transformation',
  description: 'Transform WHO perceives/narrates while preserving WHAT and HOW',
  template: `You are a narrative perspective transformation specialist. Your task is to rewrite the following text through the lens of "{{personaName}}".

PERSONA DEFINITION:
{{personaSystemPrompt}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 1: INVARIANTS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════════════════════
These elements define WHAT happens and HOW it's written. Do not change them.

• PLOT & EVENTS: Every event must happen in the same sequence with same outcomes
• FACTS & ENTITIES: All names, locations, objects, dates, and specific details stay the same
• SETTING & UNIVERSE: The world remains the same (don't shift genres or eras)
• DIALOGUE CONTENT: Keep dialogue meaning intact
• WRITING STYLE: Preserve sentence patterns, vocabulary register, figurative language density
  (Persona changes WHO perceives, not HOW they write)

⚠️ VOCABULARY RULE (CRITICAL):
Keep ALL specific nouns, verbs, names, and key terms from the original.
Only change the FRAMING and PERSPECTIVE, not the vocabulary.
Do not replace "boss" with "supervisor", "email" with "correspondence", etc.

═══════════════════════════════════════════════════════════════════════════════
LAYER 2: PERSONA DIMENSIONS (WHAT YOU MAY CHANGE)
═══════════════════════════════════════════════════════════════════════════════
Persona is a stable epistemic operator - it determines WHO perceives, WHAT counts
as salient, WHAT is taken for granted, and HOW uncertainty is handled.

ONTOLOGICAL FRAMING:
• How the narrator understands the world (orderly vs chaotic, improvable vs fixed)
• What forces the narrator sees as primary (systems vs individuals, fate vs agency)

EPISTEMIC STANCE:
• How the narrator knows things (observation, inference, intuition, authority)
• Certainty level (confident assertions vs hedged observations vs open questions)

ATTENTION & SALIENCE:
• What the narrator notices first and lingers on
• What the narrator treats as background or unremarkable

NORMATIVE FRAMING:
• What the narrator implicitly approves or finds admirable (shown, not stated)
• What provokes the narrator's skepticism or concern

{{lengthGuidance}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 3: PROHIBITIONS (HARD NO - NEVER DO THESE)
═══════════════════════════════════════════════════════════════════════════════

❌ NO STYLE CHANGES: Don't alter sentence length patterns, vocabulary register,
   or figurative language density.

❌ NO NEW FACTS: Don't invent new objects, characters, locations, or details.

❌ NO NARRATOR BIOGRAPHY: Don't add "As a scientist, I..." framing.

❌ NO MORAL SERMONS: Values should be implicit, not stated as lessons.

❌ NO PLATFORM ARTIFACTS: Never add "EDIT:", "Thanks for reading", etc.

❌ NO GENRE SHIFTS: Don't turn narrative into essay or vice versa.

═══════════════════════════════════════════════════════════════════════════════
SOURCE TEXT:
═══════════════════════════════════════════════════════════════════════════════
{{text}}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT:
═══════════════════════════════════════════════════════════════════════════════
Output ONLY the transformed text - no explanations, no thinking process.
Begin directly with the transformed content.`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 8192,
  },
  version: 1,
  usedBy: ['builder', 'transformation-service'],
};

export const TRANSFORMATION_STYLE: PromptDefinition = {
  id: 'TRANSFORMATION_STYLE',
  name: 'Style Transformation',
  description: 'Transform HOW the text is written while preserving WHO and WHAT',
  template: `You are a writing style transformation specialist. Your task is to rewrite the following text in "{{styleName}}" style.

STYLE GUIDANCE:
{{stylePrompt}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 1: INVARIANTS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════════════════════

• EVENT ORDER: Every event must happen in the same sequence
• CAUSE/EFFECT: Preserve all causal relationships between events
• DIALOGUE CONTENT: Keep dialogue meaning intact
• CHARACTER KNOWLEDGE: Characters know only what they knew originally
• NARRATIVE VIEWPOINT: {{viewpointHint}} - maintain this perspective throughout
• FACTS & ENTITIES: All names, locations, objects, and details stay the same
• GENRE IDENTITY: The text type remains the same

⚠️ VOCABULARY RULE (CRITICAL):
Keep ALL specific nouns, names, and key terms from the original.
Transform sentence STRUCTURE and hedging style only.
Do not replace "boss" with "supervisor", "email" with "missive", etc.

═══════════════════════════════════════════════════════════════════════════════
LAYER 2: STYLE CHANGES (WHAT YOU MAY CHANGE)
═══════════════════════════════════════════════════════════════════════════════

SENTENCE-LEVEL:
• Sentence length and variation
• Clause complexity
• Lexical register
• Cadence and rhythm

FIGURATIVE LANGUAGE:
• Metaphor and simile frequency (within reason)
• Imagery source domains
• Sound devices (light use)

DISCOURSE-LEVEL:
• Connective tissue
• Rhetorical devices
• Pacing of description

{{lengthGuidance}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 3: PROHIBITIONS (HARD NO)
═══════════════════════════════════════════════════════════════════════════════

❌ NO PLATFORM ARTIFACTS: Never add "EDIT:", "Thanks for reading", etc.
❌ NO NARRATOR IDENTITY SHIFT: Don't turn third-person into first-person.
❌ NO NEW FACTS OR ENTITIES: Don't invent new details.
❌ NO MORAL REFRAMING: Don't change the fundamental tone or meaning.
❌ NO VIEWPOINT MIXING: Maintain consistent perspective throughout.

═══════════════════════════════════════════════════════════════════════════════
SOURCE TEXT:
═══════════════════════════════════════════════════════════════════════════════
{{text}}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT:
═══════════════════════════════════════════════════════════════════════════════
Output ONLY the transformed text - no explanations.
Begin directly with the transformed content.`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 8192,
  },
  version: 1,
  usedBy: ['builder', 'transformation-service'],
};

/**
 * Namespace transformation prompts - DEPRECATED
 * @deprecated Namespace transformations lose original meaning. Use persona/style instead.
 */
export const TRANSFORMATION_NAMESPACE_EXTRACT: PromptDefinition = {
  id: 'TRANSFORMATION_NAMESPACE_EXTRACT',
  name: 'Namespace Structure Extraction (Deprecated)',
  description: 'Extract core structure for namespace transformation - DEPRECATED',
  deprecated: true,
  template: `You are a narrative structure analyst.

Extract the CORE STRUCTURE of this narrative without any universe-specific details:
- Who does what (roles, not names)
- What happens (events, not locations)
- What conflicts arise (tensions, not specifics)
- How things resolve (outcomes, not details)

Preserve the NARRATIVE VOICE and TONE completely.

Source Text:
"""
{{text}}
"""

Core Structure (abstract, universe-neutral):`,
  requirements: {
    capabilities: [],
    temperature: 0.5,
    maxTokens: 4096,
  },
  version: 1,
  usedBy: ['transformation-service'],
};

export const TRANSFORMATION_NAMESPACE_MAP: PromptDefinition = {
  id: 'TRANSFORMATION_NAMESPACE_MAP',
  name: 'Namespace Mapping (Deprecated)',
  description: 'Map abstract structure to new namespace - DEPRECATED',
  deprecated: true,
  template: `You are a narrative universe mapper.

Map this abstract narrative structure into the "{{namespaceName}}" universe:

{{namespaceContextPrompt}}

MAPPING RULES:
1. Translate roles → appropriate entities in {{namespaceName}}
2. Translate events → equivalent actions in {{namespaceName}}
3. Translate conflicts → analogous tensions in {{namespaceName}}
4. Keep the NARRATIVE VOICE and TONE from the original
5. Use proper {{namespaceName}} terminology and concepts

Abstract Structure:
"""
{{structure}}
"""

Mapped to {{namespaceName}}:`,
  requirements: {
    capabilities: [],
    temperature: 0.5,
    maxTokens: 4096,
  },
  version: 1,
  usedBy: ['transformation-service'],
};

export const TRANSFORMATION_NAMESPACE_RECONSTRUCT: PromptDefinition = {
  id: 'TRANSFORMATION_NAMESPACE_RECONSTRUCT',
  name: 'Namespace Reconstruction (Deprecated)',
  description: 'Reconstruct full narrative from mapped structure - DEPRECATED',
  deprecated: true,
  template: `You are a narrative reconstruction specialist.

Take this {{namespaceName}}-mapped structure and write it as a complete, engaging narrative.

RECONSTRUCTION RULES:
1. Fully realize the {{namespaceName}} universe with vivid details
2. Maintain the EXACT narrative voice and tone from the mapping
3. Keep the same sentence patterns and paragraph structure
4. Make it feel natural and immersive in {{namespaceName}}
{{lengthGuidance}}

Mapped Structure:
"""
{{mapped}}
"""

Complete Narrative in {{namespaceName}}:`,
  requirements: {
    capabilities: [],
    temperature: 0.6,
    maxTokens: 8192,
  },
  version: 1,
  usedBy: ['transformation-service'],
};

export const TRANSFORMATION_PROMPTS: PromptDefinition[] = [
  TRANSFORMATION_SYSTEM,
  TRANSFORMATION_PERSONA,
  TRANSFORMATION_STYLE,
  TRANSFORMATION_NAMESPACE_EXTRACT,
  TRANSFORMATION_NAMESPACE_MAP,
  TRANSFORMATION_NAMESPACE_RECONSTRUCT,
];

// ═══════════════════════════════════════════════════════════════════════════
// SIC (SUBJECTIVE INTENTIONAL CONSTRAINT) PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Guardrails appended to all SIC prompts
 */
export const SIC_GUARDRAILS = `
CRITICAL RULES:
- Output ONLY valid JSON. No markdown, no explanation, no preamble.
- Do NOT evaluate style, aesthetics, or quality.
- Do NOT suggest improvements or rewrites.
- Focus ONLY on detecting constraint traces as specified.
- Every claim must cite specific evidence from the text.
- If uncertain, say "insufficient evidence" rather than guessing.
`;

export const SIC_GENRE_DETECTION: PromptDefinition = {
  id: 'SIC_GENRE_DETECTION',
  name: 'SIC Genre Detection',
  description: 'Classify text genre for SIC analysis calibration (Pass 0)',
  template: `You are a genre classifier. Analyze the text and determine its primary genre.

Your task:
1. Read the text carefully
2. Identify the primary genre from: narrative, argument, technical, legal, marketing, unknown
3. Note any genre mixing or ambiguity

Text:
{{text}}

Output JSON only:
{
  "genre": "narrative" | "argument" | "technical" | "legal" | "marketing" | "unknown",
  "confidence": 0.0-1.0,
  "notes": "brief explanation of genre signals"
}
${SIC_GUARDRAILS}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.2,
    maxTokens: 512,
  },
  version: 1,
  usedBy: ['sic-analyzer'],
};

export const SIC_EXTRACTOR: PromptDefinition = {
  id: 'SIC_EXTRACTOR',
  name: 'SIC Evidence Extractor',
  description: 'Extract evidence of subjective intentional constraint (Pass 1)',
  template: `You are a constraint detector. Your task is to find evidence of SUBJECTIVE INTENTIONAL CONSTRAINT in the text.

Subjective Intentional Constraint measures the cost of authorship: traces of commitment, tradeoff, irreversibility, and situated stakes. It is NOT about style or quality.

For EACH feature category, extract relevant quotes (max 25 words each) with rationale:

POSITIVE FEATURES (indicators of human authorship):

1. commitment_irreversibility
   - Concrete decisions with consequences
   - Claims that narrow future options
   - "Humans trap themselves. LLMs keep exits open."

2. epistemic_risk_uncertainty
   - Being wrong, surprises, ignorance that mattered
   - NOT just hedging words, but genuine not-knowing with stakes
   - "I thought X but Y", discoveries that cost something

3. time_pressure_tradeoffs
   - Urgency, deadlines, asymmetric time awareness
   - "suddenly", "before I could", "too late"

4. situatedness_body_social
   - Embodied risk, social cost, friction
   - Physical presence, social exposure

5. scar_tissue_specificity
   - PERSISTENT residue in the PRESENT
   - Physical involuntary reactions: flinch, wince, freeze
   - Temporal persistence: "still", "even now", "years later"
   - NOT formulaic apology language

6. bounded_viewpoint
   - Non-omniscient narration
   - Limited perspective, acknowledged gaps

NEGATIVE FEATURES (indicators of AI generation):

7. anti_smoothing (high score = GOOD)
   - REFUSAL OF SYMMETRY
   - HIGH: Asymmetric commitment, closure of alternatives
   - LOW: "Valid arguments on both sides", performed balance

8. meta_contamination
   - Preambles, "EDIT:", roleplay wrappers
   - "In conclusion", "It is important to note"

Text:
{{text}}

Output JSON only:
{
  "features": {
    "commitment_irreversibility": {
      "evidence": [{"quote": "...", "rationale": "..."}],
      "signal_strength": "none" | "weak" | "moderate" | "strong"
    }
  },
  "preliminary_notes": "overall observations"
}
${SIC_GUARDRAILS}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['sic-analyzer'],
};

export const SIC_JUDGE: PromptDefinition = {
  id: 'SIC_JUDGE',
  name: 'SIC Judge',
  description: 'Score constraint evidence and calculate final SIC score (Pass 2)',
  template: `You are a constraint judge. Given extracted evidence, score each feature and provide final assessment.

GENRE CONTEXT: {{genreContext}}

Your task:
1. Review the extracted evidence for each feature
2. Score each feature 0-100 based on evidence strength
3. Apply genre-appropriate calibration
4. Identify key inflection points (collapse moments)
5. Calculate overall SIC score

SCORING GUIDELINES:
- 0-20: No evidence or very weak signals
- 21-40: Some evidence but inconsistent
- 41-60: Moderate evidence, clear constraint traces
- 61-80: Strong evidence, multiple constraint types
- 81-100: Exceptional, load-bearing constraint throughout

INFLECTION POINTS:
Collapse moments where interpretive freedom reduces.
Types: commitment, reversal, reframe, stakes, constraint-reveal

Evidence:
{{extractedEvidence}}

Output JSON only:
{
  "features": {
    "commitment_irreversibility": {
      "score": 0-100,
      "notes": "brief scoring rationale",
      "evidence": [{"quote": "...", "rationale": "..."}]
    }
  },
  "inflectionPoints": [
    {
      "chunkId": "chunk_0",
      "kind": "commitment",
      "quote": "the specific sentence",
      "whyItMatters": "why this reduces degrees of freedom"
    }
  ],
  "sicScore": 0-100,
  "aiProbability": 0.0-1.0,
  "diagnostics": {
    "genreBaselineUsed": true/false,
    "corporateBureaucratRisk": true/false,
    "highFluencyLowCommitmentPattern": true/false
  },
  "notes": "human-readable summary"
}
${SIC_GUARDRAILS}`,
  requirements: {
    capabilities: ['json-mode', 'analysis'],
    temperature: 0.3,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['sic-analyzer'],
};

export const SIC_STYLE_CHECK_EXTRACTOR: PromptDefinition = {
  id: 'SIC_STYLE_CHECK_EXTRACTOR',
  name: 'Style Check Extractor',
  description: 'Extract style features for comparison against profile',
  template: `You are a style analyzer. Compare the text against the provided style profile.

Style Profile:
{{styleProfile}}

Text:
{{text}}

Output JSON only:
{
  "matches": [{"pattern": "...", "evidence": "...", "strength": 0.0-1.0}],
  "deviations": [{"expected": "...", "actual": "...", "severity": "minor" | "moderate" | "major"}],
  "metrics": {
    "avgSentenceLength": number,
    "vocabularyLevel": "basic" | "intermediate" | "advanced",
    "formalityLevel": "informal" | "neutral" | "formal"
  }
}
${SIC_GUARDRAILS}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['sic-analyzer'],
};

export const SIC_STYLE_CHECK_JUDGE: PromptDefinition = {
  id: 'SIC_STYLE_CHECK_JUDGE',
  name: 'Style Check Judge',
  description: 'Score overall style consistency',
  template: `You are a style consistency judge. Score the overall consistency.

Extraction Results:
{{extractionResults}}

Output JSON only:
{
  "consistencyScore": 0-100,
  "profileMatchScore": 0-100,
  "deviations": ["human-readable deviation descriptions"],
  "metrics": {
    "perplexity": number or null,
    "burstiness": number or null,
    "avgSentenceLength": number,
    "typeTokenRatio": number or null
  }
}
${SIC_GUARDRAILS}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['sic-analyzer'],
};

export const SIC_PROFILE_VETTING: PromptDefinition = {
  id: 'SIC_PROFILE_VETTING',
  name: 'Profile Vetting',
  description: 'Evaluate if text is suitable for extracting a writing profile',
  template: `You are a profile source evaluator. Determine if this text is suitable for extracting a writing profile.

Text:
{{text}}

Output JSON only:
{
  "suitable": true/false,
  "qualityScore": 0-100,
  "sicScore": 0-100,
  "concerns": ["list of specific concerns"],
  "recommendations": ["suggestions for better samples"]
}
${SIC_GUARDRAILS}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['sic-analyzer'],
};

export const SIC_PROMPTS: PromptDefinition[] = [
  SIC_GENRE_DETECTION,
  SIC_EXTRACTOR,
  SIC_JUDGE,
  SIC_STYLE_CHECK_EXTRACTOR,
  SIC_STYLE_CHECK_JUDGE,
  SIC_PROFILE_VETTING,
];

// ═══════════════════════════════════════════════════════════════════════════
// MODEL-MASTER UTILITY PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const MODEL_MASTER_TRANSLATE: PromptDefinition = {
  id: 'MODEL_MASTER_TRANSLATE',
  name: 'Translation',
  description: 'Translate text to a target language',
  template: `Translate the following text to {{targetLanguage}}. Return only the translation, no explanation.

Text:
{{text}}`,
  requirements: {
    capabilities: [],
    temperature: 0.3,
    maxTokens: 4096,
  },
  version: 1,
  usedBy: ['model-master'],
};

export const MODEL_MASTER_ANALYZE: PromptDefinition = {
  id: 'MODEL_MASTER_ANALYZE',
  name: 'Text Analysis',
  description: 'Analyze text and provide structured output',
  template: `Analyze the following text. Provide structured analysis.

Text:
{{text}}`,
  requirements: {
    capabilities: ['json-mode'],
    temperature: 0.3,
    maxTokens: 2048,
  },
  version: 1,
  usedBy: ['model-master'],
};

export const MODEL_MASTER_SUMMARIZE: PromptDefinition = {
  id: 'MODEL_MASTER_SUMMARIZE',
  name: 'Summarization',
  description: 'Summarize text concisely',
  template: `Summarize the following text concisely.

Text:
{{text}}`,
  requirements: {
    capabilities: [],
    temperature: 0.4,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['model-master'],
};

export const MODEL_MASTER_DETECT_AI: PromptDefinition = {
  id: 'MODEL_MASTER_DETECT_AI',
  name: 'AI Detection',
  description: 'Detect AI-generated content indicators',
  template: `Analyze this text for AI-generated content indicators. Return a JSON object with probability (0-1) and evidence array.

Text:
{{text}}`,
  requirements: {
    capabilities: ['json-mode', 'analysis'],
    temperature: 0.2,
    maxTokens: 1024,
  },
  version: 1,
  usedBy: ['model-master'],
};

export const MODEL_MASTER_HUMANIZE: PromptDefinition = {
  id: 'MODEL_MASTER_HUMANIZE',
  name: 'Humanization',
  description: 'Rewrite text to sound more natural and human-like',
  template: `Rewrite this text to sound more natural and human-like while preserving the meaning.

Text:
{{text}}`,
  requirements: {
    capabilities: ['creative'],
    temperature: 0.7,
    maxTokens: 4096,
  },
  version: 1,
  usedBy: ['model-master'],
};

export const MODEL_MASTER_PROMPTS: PromptDefinition[] = [
  MODEL_MASTER_TRANSLATE,
  MODEL_MASTER_ANALYZE,
  MODEL_MASTER_SUMMARIZE,
  MODEL_MASTER_DETECT_AI,
  MODEL_MASTER_HUMANIZE,
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
  ...TRANSFORMATION_PROMPTS,
  ...SIC_PROMPTS,
  ...MODEL_MASTER_PROMPTS,
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
  TRANSFORMATION_SYSTEM: 'transform',
  TRANSFORMATION_PERSONA: 'transform',
  TRANSFORMATION_STYLE: 'transform',
  TRANSFORMATION_NAMESPACE_EXTRACT: 'transform',
  TRANSFORMATION_NAMESPACE_MAP: 'transform',
  TRANSFORMATION_NAMESPACE_RECONSTRUCT: 'transform',
  SIC_GENRE_DETECTION: 'reviewer',
  SIC_EXTRACTOR: 'reviewer',
  SIC_JUDGE: 'reviewer',
  SIC_STYLE_CHECK_EXTRACTOR: 'reviewer',
  SIC_STYLE_CHECK_JUDGE: 'reviewer',
  SIC_PROFILE_VETTING: 'reviewer',
  MODEL_MASTER_TRANSLATE: 'utility',
  MODEL_MASTER_ANALYZE: 'utility',
  MODEL_MASTER_SUMMARIZE: 'utility',
  MODEL_MASTER_DETECT_AI: 'utility',
  MODEL_MASTER_HUMANIZE: 'utility',
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
