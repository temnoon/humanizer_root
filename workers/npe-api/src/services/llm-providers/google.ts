/**
 * Google Gemini Provider
 * Supports Gemini 2.0 Flash, Gemini 1.5 Pro
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './base';

export class GoogleProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private modelId: string
  ) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Gemini uses a different format - system message goes into systemInstruction
      const systemMessage = request.messages.find(m => m.role === 'system');
      const otherMessages = request.messages.filter(m => m.role !== 'system');

      // Convert to Gemini format
      const geminiContents = otherMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const requestBody: any = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: request.max_tokens,
          temperature: request.temperature
        }
      };

      // Add system instruction if present
      if (systemMessage) {
        requestBody.systemInstruction = {
          parts: [{ text: systemMessage.content }]
        };
      }

      // Gemini API endpoint format
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Google API error (${response.status}): ${errorData}`);
      }

      const data = await response.json() as any;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Google returned no candidates');
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Google returned no content parts');
      }

      // Extract text from parts
      const textContent = candidate.content.parts
        .filter((part: any) => part.text)
        .map((part: any) => part.text)
        .join('');

      return {
        response: textContent,
        tokens_used: data.usageMetadata?.totalTokenCount,
        model: this.modelId
      };
    } catch (error) {
      console.error('Google call failed:', error);
      throw new Error(`Google failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return 'google';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}
