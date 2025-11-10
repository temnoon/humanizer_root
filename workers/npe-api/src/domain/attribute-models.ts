/**
 * Attribute Models - LLM-Assisted Attribute Builder
 *
 * Purpose: Define domain models for conversational attribute extraction
 * allowing users to create unlimited custom personas, namespaces, styles, and voices
 * through natural language dialogue with LLMs.
 */

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export const AttributeTypeSchema = z.enum(['persona', 'namespace', 'style', 'voice']);
export type AttributeType = z.infer<typeof AttributeTypeSchema>;

// ============================================================================
// Attribute Definition - The extracted/refined attribute
// ============================================================================

export const AttributeDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),

  // Different prompts for different attribute types
  systemPrompt: z.string().optional(), // For personas/voices
  contextPrompt: z.string().optional(), // For namespaces
  stylePrompt: z.string().optional(), // For styles

  // Examples of how this attribute would sound/look
  examples: z.array(z.string()).optional(),

  // Metadata
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;

// ============================================================================
// Extraction Request/Response
// ============================================================================

export const ExtractAttributeRequestSchema = z.object({
  type: AttributeTypeSchema,
  description: z.string().min(1).max(2000),
  context: z.array(z.string()).optional(), // Previous dialogue messages
});

export type ExtractAttributeRequest = z.infer<typeof ExtractAttributeRequestSchema>;

export const ExtractAttributeResponseSchema = z.object({
  definition: AttributeDefinitionSchema.optional(), // Present if extraction successful
  questions: z.array(z.string()).optional(), // Present if clarification needed
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(), // LLM's internal reasoning (for debugging)
});

export type ExtractAttributeResponse = z.infer<typeof ExtractAttributeResponseSchema>;

// ============================================================================
// Refinement Request/Response
// ============================================================================

export const RefineAttributeRequestSchema = z.object({
  dialogueId: z.string(),
  feedback: z.string().min(1).max(2000),
  currentDefinition: AttributeDefinitionSchema.optional(),
});

export type RefineAttributeRequest = z.infer<typeof RefineAttributeRequestSchema>;

export const RefineAttributeResponseSchema = ExtractAttributeResponseSchema;
export type RefineAttributeResponse = ExtractAttributeResponse;

// ============================================================================
// Dialogue Session - For tracking multi-turn conversations
// ============================================================================

export const DialogueMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number(),
});

export type DialogueMessage = z.infer<typeof DialogueMessageSchema>;

export const AttributeDialogueSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: AttributeTypeSchema,
  messages: z.array(DialogueMessageSchema),
  currentDefinition: AttributeDefinitionSchema.optional(),
  status: z.enum(['in_progress', 'completed', 'abandoned']),
  createdAt: z.number(),
  completedAt: z.number().optional(),
});

export type AttributeDialogue = z.infer<typeof AttributeDialogueSchema>;

// ============================================================================
// User Attribute - Saved custom attributes
// ============================================================================

export const UserAttributeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: AttributeTypeSchema,
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string().optional(),
  contextPrompt: z.string().optional(),
  stylePrompt: z.string().optional(),
  examples: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  usageCount: z.number().default(0),
});

export type UserAttribute = z.infer<typeof UserAttributeSchema>;

// ============================================================================
// Example Starters - Pre-written patterns to inspire users
// ============================================================================

export const ExampleStarterSchema = z.object({
  type: AttributeTypeSchema,
  title: z.string(),
  description: z.string(),
  prompt: z.string(), // The actual text to use as input
  category: z.string(),
});

export type ExampleStarter = z.infer<typeof ExampleStarterSchema>;

// Pre-defined example starters
export const EXAMPLE_STARTERS: ExampleStarter[] = [
  // Personas
  {
    type: 'persona',
    title: 'Victorian Naturalist',
    description: 'A curious explorer documenting discoveries with wonder',
    prompt: 'A Victorian naturalist explaining discoveries with childlike wonder and precise scientific detail',
    category: 'Historical'
  },
  {
    type: 'persona',
    title: 'Jazz Musician',
    description: 'Complex ideas through musical metaphors',
    prompt: 'A jazz musician who describes everything through improvisation and rhythm metaphors',
    category: 'Artistic'
  },
  {
    type: 'persona',
    title: 'Stoic Philosopher',
    description: 'Calm analysis through classical wisdom',
    prompt: 'A stoic philosopher analyzing situations with detachment and ancient wisdom',
    category: 'Philosophical'
  },

  // Namespaces
  {
    type: 'namespace',
    title: 'Quantum Mechanics',
    description: 'Superposition, entanglement, and uncertainty',
    prompt: 'Quantum mechanics concepts like superposition, wave functions, and observer effects',
    category: 'Scientific'
  },
  {
    type: 'namespace',
    title: 'Culinary Arts',
    description: 'Flavors, techniques, and gastronomy',
    prompt: 'Culinary metaphors using cooking techniques, flavors, and kitchen chemistry',
    category: 'Artistic'
  },
  {
    type: 'namespace',
    title: 'Ocean Navigation',
    description: 'Tides, currents, and maritime wisdom',
    prompt: 'Maritime navigation using stars, tides, currents, and seafaring traditions',
    category: 'Adventure'
  },

  // Styles
  {
    type: 'style',
    title: 'Hemingway Brevity',
    description: 'Short sentences. Clear meaning.',
    prompt: 'Ernest Hemingway style with short, declarative sentences and no unnecessary words',
    category: 'Literary'
  },
  {
    type: 'style',
    title: 'Stream of Consciousness',
    description: 'Flowing thoughts without interruption',
    prompt: 'Stream of consciousness style like Virginia Woolf with flowing, uninterrupted thoughts',
    category: 'Literary'
  },
  {
    type: 'style',
    title: 'Academic Precision',
    description: 'Formal, cited, thoroughly explained',
    prompt: 'Academic writing with precise terminology, citations, and structured argumentation',
    category: 'Formal'
  },

  // Voices
  {
    type: 'voice',
    title: 'Wise Grandmother',
    description: 'Warm stories with hidden lessons',
    prompt: 'A wise grandmother sharing life lessons through warm personal stories',
    category: 'Personal'
  },
  {
    type: 'voice',
    title: 'Tech Startup Founder',
    description: 'Disrupting paradigms with enthusiasm',
    prompt: 'A tech startup founder disrupting industries and pivoting paradigms with infectious enthusiasm',
    category: 'Professional'
  },
  {
    type: 'voice',
    title: 'Nature Documentary',
    description: 'David Attenborough-style observation',
    prompt: 'David Attenborough narrating the hidden dramas of everyday life',
    category: 'Documentary'
  }
];

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateAttributeType(type: string): AttributeType {
  const result = AttributeTypeSchema.safeParse(type);
  if (!result.success) {
    throw new Error(`Invalid attribute type: ${type}. Must be one of: persona, namespace, style, voice`);
  }
  return result.data;
}

export function validateDefinition(definition: unknown): AttributeDefinition {
  const result = AttributeDefinitionSchema.safeParse(definition);
  if (!result.success) {
    throw new Error(`Invalid attribute definition: ${result.error.message}`);
  }
  return result.data;
}