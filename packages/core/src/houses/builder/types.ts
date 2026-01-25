/**
 * Builder Agent - Types
 *
 * All type definitions for the Builder agent.
 *
 * @module @humanizer/core/houses/builder/types
 */

// ═══════════════════════════════════════════════════════════════════
// BUILDER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ChapterDraft {
  id: string;
  title: string;
  content: string;
  passageRefs: string[];           // IDs of source passages
  wordCount: number;
  structure: ChapterStructure;
  styleAnalysis: StyleAnalysis;
  version: number;
}

export interface ChapterStructure {
  sections: Array<{
    type: 'opening' | 'body' | 'transition' | 'conclusion';
    passageRefs: string[];
    bridgeText?: string;           // AI-generated connecting text
    wordCount: number;
  }>;
  narrativeArc: 'building' | 'peak' | 'resolution' | 'flat';
  pacingScore: number;             // 0-1, how well-paced
}

export interface StyleAnalysis {
  voiceConsistency: number;        // 0-1 match with persona
  formalityLevel: number;          // 0-1, informal to formal
  emotionalTone: string;           // e.g., "reflective", "urgent"
  readabilityScore: number;        // 0-1
  concerns: string[];
}

export interface CompositionPlan {
  chapterId: string;
  title: string;
  theme: string;
  passages: PassageForComposition[];
  targetLength: number;
  styleGuidelines: string;
  personaRef?: string;
}

export interface PassageForComposition {
  id: string;
  text: string;
  role: 'anchor' | 'supporting' | 'contrast' | 'evidence';
  suggestedPosition: number;       // 0-1, where in chapter
}

export interface BuilderIntention {
  type: 'compose' | 'revise' | 'restructure' | 'bridge';
  priority: number;
  reason: string;
  targetChapterId?: string;
  context: Record<string, unknown>;
}

export interface ChapterOutline {
  theme: string;
  sections: Array<{
    type: 'opening' | 'body' | 'transition' | 'conclusion';
    passageIds: string[];
    purpose: string;
  }>;
  suggestedTitle: string;
  estimatedLength: number;
}

export interface TransitionResult {
  fromSectionIndex: number;
  toSectionIndex: number;
  bridgeText: string;
}

export interface StructureAnalysis {
  narrativeArc: 'building' | 'peak' | 'resolution' | 'flat';
  pacingScore: number;
  issues: string[];
  suggestions: string[];
}

export interface ImprovementSuggestion {
  type: string;
  location: string;
  issue: string;
  fix: string;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CreateOutlineRequest {
  passages: PassageForComposition[];
  theme: string;
  targetLength: number;
}

export interface WriteTransitionsRequest {
  sections: Array<{
    endingPassageId: string;
    openingText: string;
  }>;
  theme: string;
}

export interface AnalyzeStructureRequest {
  content: string;
  passageRefs: string[];
}

export interface ReviseDraftRequest {
  chapterId: string;
  focusAreas: Array<'voice' | 'pacing' | 'clarity' | 'transitions' | string>;
  preservePassageRefs?: boolean;
}

export interface SuggestImprovementsRequest {
  chapterId: string;
  content: string;
}

export interface RewriteForPersonaRequest {
  /** Text to rewrite */
  text: string;
  /** Persona profile with voice traits and style guide */
  persona: PersonaProfileForRewrite;
  /** Original source type for context */
  sourceType?: string;
  /** Detected voice issues to address */
  voiceIssues?: string[];
}

/**
 * Minimal persona profile for rewriting
 * Can be full PersonaProfile or subset for efficiency
 */
export interface PersonaProfileForRewrite {
  name: string;
  description?: string;
  voiceTraits: string[];
  toneMarkers: string[];
  formalityRange: [number, number];
  styleGuide: {
    forbiddenPhrases: string[];
    preferredPatterns: string[];
    useContractions: boolean;
    useRhetoricalQuestions: boolean;
  };
  referenceExamples?: string[];
}

export interface RewriteResult {
  original: string;
  rewritten: string;
  changesApplied: string[];
  confidenceScore: number;
  remainingIssues?: string[];
  passCount?: number;
}

/**
 * Options for multi-pass rewriting to eliminate forbidden phrases
 */
export interface MultiPassRewriteOptions {
  /** Maximum number of rewrite passes (default: 3) */
  maxPasses?: number;
  /** Stop early if no remaining issues (default: true) */
  stopOnClean?: boolean;
}

export interface BatchRewriteRequest {
  passages: Array<{
    id: string;
    text: string;
    sourceType?: string;
    voiceIssues?: string[];
  }>;
  persona: PersonaProfileForRewrite;
}

/**
 * Revision request from Reviewer feedback loop
 */
export interface ReviseFromFeedbackRequest {
  chapterId: string;
  focusAreas: Array<'voice' | 'pacing' | 'clarity' | 'transitions' | 'humanization' | 'structure'>;
  issuesWithFixes: Array<{
    type: string;
    description: string;
    location: string;
    suggestedFix?: string;
  }>;
  passagesForRewrite?: Array<{
    location: string;
    voiceIssues: string[];
  }>;
  iterationCount: number;
  maxIterations: number;
  personaRef?: string;
}

export interface RevisionResponse {
  success: boolean;
  chapterId: string;
  newVersion: number;
  changesApplied: string[];
  remainingIssues?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// INTERNAL REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ComposeSectionRequest {
  type: 'opening' | 'body' | 'transition' | 'conclusion';
  passages: PassageForComposition[];
  theme: string;
  styleGuidelines: string;
  personaRef?: string;
  isFirst: boolean;
  isLast: boolean;
}
