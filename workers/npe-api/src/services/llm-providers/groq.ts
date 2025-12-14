/**
 * Groq Provider
 * Ultra-fast inference for open-source models (Llama, Mixtral)
 * Uses OpenAI-compatible API format
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './base';

export class GroqProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private modelId: string
  ) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: request.messages,
          max_tokens: request.max_tokens,
          temperature: request.temperature
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorData}`);
      }

      const data = await response.json() as any;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('Groq returned no choices');
      }

      return {
        response: data.choices[0].message.content || '',
        tokens_used: data.usage?.total_tokens,
        model: this.modelId
      };
    } catch (error) {
      console.error('Groq call failed:', error);
      throw new Error(`Groq failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return 'groq';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async generateText(prompt: string, options: { max_tokens: number; temperature: number }): Promise<string> {
    const response = await this.call({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens,
      temperature: options.temperature
    });
    return response.response;
  }
}
