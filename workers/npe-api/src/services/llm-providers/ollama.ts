/**
 * Ollama Provider
 * Uses local Ollama server for LLM inference (local development only)
 */

import type { LLMProvider, LLMRequest, LLMResponse, LLMMessage } from './base';

export class OllamaProvider implements LLMProvider {
  private ollamaUrl: string;
  private modelId: string;

  constructor(
    modelId: string,
    ollamaUrl: string = 'http://localhost:11434'
  ) {
    this.modelId = modelId;
    this.ollamaUrl = ollamaUrl;
  }

  /**
   * Clean XML metadata tags from model output
   * Removes <think>, <reasoning>, <reflection>, etc.
   */
  private cleanModelOutput(text: string): string {
    // List of XML tags commonly used by models for internal reasoning
    const xmlTagsToRemove = [
      'think',
      'thinking',
      'reasoning',
      'reflection',
      'scratchpad',
      'internal',
      'draft',
      'plan',
      'notes',
    ];

    let cleaned = text;

    // Remove each type of XML tag (with any content inside)
    for (const tag of xmlTagsToRemove) {
      // Match opening and closing tags with any content in between (non-greedy)
      const regex = new RegExp(`<${tag}>.*?</${tag}>`, 'gis');
      cleaned = cleaned.replace(regex, '');
    }

    // Also remove self-closing variants: <think />
    for (const tag of xmlTagsToRemove) {
      const regex = new RegExp(`<${tag}\\s*/?>`, 'gi');
      cleaned = cleaned.replace(regex, '');
    }

    // Clean up excessive whitespace left after tag removal
    cleaned = cleaned
      .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
      .trim();

    return cleaned;
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Format messages into Ollama chat format
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.max_tokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Ollama returns: { message: { role, content }, ... }
      const responseText = data.message?.content || '';

      // Clean XML metadata tags from model output
      const cleanedResponse = this.cleanModelOutput(responseText);

      return {
        response: cleanedResponse,
        model: this.modelId,
      };
    } catch (error) {
      console.error('Ollama call failed:', error);
      throw new Error(`Ollama failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateText(prompt: string, options: { max_tokens: number; temperature: number }): Promise<string> {
    const response = await this.call({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens,
      temperature: options.temperature,
    });
    return response.response;
  }

  getProviderName(): string {
    return 'ollama';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama is running by hitting the tags endpoint
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
