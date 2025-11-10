/**
 * TypeScript types for the Attribute Builder feature
 */

export type AttributeType = 'persona' | 'namespace' | 'style' | 'voice';

export interface AttributeDefinition {
  name: string;
  description: string;
  systemPrompt?: string;    // For personas/voices
  contextPrompt?: string;   // For namespaces
  stylePrompt?: string;     // For styles
  examples?: string[];
  tags?: string[];
  category?: string;
}

export interface ExtractAttributeResponse {
  definition?: AttributeDefinition;
  questions?: string[];
  confidence: number;
  reasoning?: string;
  dialogueId?: string;
}

export interface DialogueMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AttributeDialogue {
  id: string;
  type: AttributeType;
  messages: DialogueMessage[];
  currentDefinition?: AttributeDefinition;
  status: 'in_progress' | 'completed' | 'abandoned';
  createdAt: number;
  completedAt?: number;
}

export interface UserAttribute extends AttributeDefinition {
  id: string;
  userId: string;
  type: AttributeType;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface ExampleStarter {
  type: AttributeType;
  title: string;
  description: string;
  prompt: string;
  category: string;
}