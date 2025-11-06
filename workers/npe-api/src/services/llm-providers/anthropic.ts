/**
 * Anthropic Provider
 * Supports Claude 3.5 Sonnet, Claude 3.5 Haiku
 */

import type { LLMProvider, LLMRequest, LLMResponse, LLMMessage } from './base';

export class AnthropicProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private modelId: string
  ) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Anthropic API format: separate system message from other messages
      const systemMessage = request.messages.find(m => m.role === 'system');
      const otherMessages = request.messages.filter(m => m.role !== 'system');

      // Convert to Anthropic format (they don't use 'system' role in messages array)
      const anthropicMessages = otherMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const requestBody: any = {
        model: this.modelId,
        messages: anthropicMessages,
        max_tokens: request.max_tokens,
        temperature: request.temperature
      };

      // Add system message if present
      if (systemMessage) {
        requestBody.system = systemMessage.content;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorData}`);
      }

      const data = await response.json() as any;

      if (!data.content || data.content.length === 0) {
        throw new Error('Anthropic returned no content');
      }

      // Extract text from content blocks
      const textContent = data.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      return {
        response: textContent,
        tokens_used: data.usage?.input_tokens + data.usage?.output_tokens,
        model: this.modelId
      };
    } catch (error) {
      console.error('Anthropic call failed:', error);
      throw new Error(`Anthropic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return 'anthropic';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}
