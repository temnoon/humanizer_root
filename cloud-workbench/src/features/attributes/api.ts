/**
 * API methods for Attribute Builder feature
 */

import { ApiConfig } from '../../core/adapters/api';
import type {
  AttributeType,
  AttributeDefinition,
  ExtractAttributeResponse,
  UserAttribute,
  ExampleStarter,
} from './types';

// Get base URL from ApiConfig
const getBaseUrl = () => ApiConfig.baseUrl;

// Helper to make authenticated requests
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add auth token for remote API
  if (ApiConfig.processingTarget === 'remote') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.details || 'API request failed');
  }

  return response.json();
}

// Attribute extraction and refinement
export async function extractAttribute(
  type: AttributeType,
  description: string,
  context?: string[]
): Promise<ExtractAttributeResponse> {
  return apiRequest<ExtractAttributeResponse>('v2/attributes/extract', {
    method: 'POST',
    body: JSON.stringify({ type, description, context }),
  });
}

export async function refineAttribute(
  dialogueId: string,
  feedback: string,
  currentDefinition?: AttributeDefinition
): Promise<ExtractAttributeResponse> {
  return apiRequest<ExtractAttributeResponse>('v2/attributes/refine', {
    method: 'POST',
    body: JSON.stringify({ dialogueId, feedback, currentDefinition }),
  });
}

// Example starters
export async function getExampleStarters(
  type?: AttributeType
): Promise<ExampleStarter[]> {
  const query = type ? `?type=${type}` : '';
  return apiRequest<ExampleStarter[]>(`v2/attributes/examples${query}`);
}

// Generate example
export async function generateExample(
  definition: AttributeDefinition,
  type: AttributeType,
  sampleText: string
): Promise<{ example: string }> {
  return apiRequest<{ example: string }>('v2/attributes/generate-example', {
    method: 'POST',
    body: JSON.stringify({ definition, type, sampleText }),
  });
}

// Workspace operations
export async function saveAttribute(
  type: AttributeType,
  definition: AttributeDefinition
): Promise<UserAttribute> {
  return apiRequest<UserAttribute>('v2/workspace/attributes', {
    method: 'POST',
    body: JSON.stringify({ type, definition }),
  });
}

export async function listUserAttributes(
  type?: AttributeType
): Promise<UserAttribute[]> {
  const query = type ? `?type=${type}` : '';
  return apiRequest<UserAttribute[]>(`v2/workspace/attributes${query}`);
}

export async function getUserAttribute(id: string): Promise<UserAttribute> {
  return apiRequest<UserAttribute>(`v2/workspace/attributes/${id}`);
}

export async function updateAttribute(
  id: string,
  updates: Partial<AttributeDefinition>
): Promise<UserAttribute> {
  return apiRequest<UserAttribute>(`v2/workspace/attributes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteAttribute(id: string): Promise<void> {
  await apiRequest<void>(`v2/workspace/attributes/${id}`, {
    method: 'DELETE',
  });
}

export async function incrementUsage(id: string): Promise<void> {
  await apiRequest<void>(`v2/workspace/attributes/${id}/increment-usage`, {
    method: 'POST',
  });
}

// Dialogue sessions
export async function getDialogue(id: string): Promise<any> {
  return apiRequest<any>(`v2/attributes/dialogue/${id}`);
}

export async function listDialogues(status?: string): Promise<any[]> {
  const query = status ? `?status=${status}` : '';
  return apiRequest<any[]>(`v2/workspace/dialogues${query}`);
}