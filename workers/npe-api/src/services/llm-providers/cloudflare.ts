/**
 * Cloudflare Workers AI Provider
 * Uses Cloudflare's native AI binding (@cf/ models)
 */

import type { Env } from '../../../shared/types';
import type { LLMProvider, LLMRequest, LLMResponse, LLMMessage } from './base';

/**
 * Model API format types
 * - chat: Standard chat format with messages array (Llama, Qwen, DeepSeek)
 * - completion: Completion format with input string (GPT-OSS)
 */
type ApiFormat = 'chat' | 'completion';

export class CloudflareProvider implements LLMProvider {
  private apiFormat: ApiFormat;

  constructor(
    private env: Env,
    private modelId: string
  ) {
    // Determine API format based on model
    this.apiFormat = this.getModelApiFormat(modelId);
  }

  /**
   * Detect API format for a given model
   */
  private getModelApiFormat(modelId: string): ApiFormat {
    // Completion format models (use 'input' field)
    const completionModels = [
      '@cf/openai/gpt-oss-20b'
    ];

    if (completionModels.includes(modelId)) {
      return 'completion';
    }

    // Default to chat format (Llama, Qwen, DeepSeek models)
    return 'chat';
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Format request body based on API format
      const requestBody = this.formatRequest(request);

      console.log('CloudflareProvider calling AI.run:', {
        modelId: this.modelId,
        apiFormat: this.apiFormat,
        max_tokens: request.max_tokens
      });

      const response = await this.env.AI.run(this.modelId, requestBody);

      // Debug: Log response structure
      console.log('CloudflareProvider response keys:', Object.keys(response));
      console.log('CloudflareProvider response.text type:', typeof response.text);
      console.log('CloudflareProvider response.output type:', typeof response.output);

      // Log object structure to understand the format
      if (typeof response.text === 'object' && response.text !== null) {
        console.log('CloudflareProvider response.text keys:', Object.keys(response.text));
        console.log('CloudflareProvider response.text:', JSON.stringify(response.text).substring(0, 200));
      }
      if (typeof response.output === 'object' && response.output !== null) {
        console.log('CloudflareProvider response.output keys:', Object.keys(response.output));
        console.log('CloudflareProvider response.output:', JSON.stringify(response.output).substring(0, 200));
      }

      // Try different response field names based on API format
      let responseText = '';
      if (this.apiFormat === 'completion') {
        // GPT-OSS returns output as array of objects with content
        const outputField = response.output;
        const textField = response.text;

        // Try to extract from output field first (GPT-OSS format)
        if (Array.isArray(outputField) && outputField.length > 0) {
          // GPT-OSS format: [{id, content: [{text}]}]
          responseText = outputField.map((item: any) => {
            if (item.content && Array.isArray(item.content) && item.content.length > 0) {
              return item.content[0].text || '';
            }
            return '';
          }).join('');
        } else if (Array.isArray(textField) && textField.length > 0) {
          // Similar format but in text field
          responseText = textField.map((item: any) => {
            if (item.content && Array.isArray(item.content) && item.content.length > 0) {
              return item.content[0].text || '';
            }
            return '';
          }).join('');
        } else if (typeof textField === 'string' && textField) {
          responseText = textField;
        } else {
          responseText = response.generated_text || response.response || '';
        }
      } else {
        // Chat models use response field
        responseText = response.response || '';
      }

      // Ensure responseText is a string
      if (typeof responseText !== 'string') {
        console.log('CloudflareProvider WARNING: responseText is not a string, converting');
        responseText = String(responseText || '');
      }

      console.log('CloudflareProvider extracted text length:', responseText.length);
      if (responseText.length > 0) {
        console.log('CloudflareProvider text preview:', responseText.substring(0, 200));
      }

      // Post-process response (e.g., clean reasoning artifacts)
      const cleanedResponse = this.cleanResponse(responseText);

      return {
        response: cleanedResponse,
        model: this.modelId
      };
    } catch (error) {
      console.error('Cloudflare AI call failed:', error);
      throw new Error(`Cloudflare AI failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format request based on model's API format
   */
  private formatRequest(request: LLMRequest): any {
    if (this.apiFormat === 'completion') {
      // Completion format: Convert messages to single input string
      return {
        input: this.messagesToPrompt(request.messages),
        max_tokens: request.max_tokens,
        temperature: request.temperature
      };
    } else {
      // Chat format: Standard messages array
      return {
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature
      };
    }
  }

  /**
   * Convert structured messages to plain text prompt for completion models
   */
  private messagesToPrompt(messages: LLMMessage[]): string {
    return messages.map(m => {
      if (m.role === 'system') return `System: ${m.content}\n\n`;
      if (m.role === 'user') return `User: ${m.content}\n\n`;
      return `Assistant: ${m.content}\n\n`;
    }).join('');
  }

  /**
   * Clean response from model-specific artifacts
   */
  private cleanResponse(response: string): string {
    let cleaned = response;

    // Remove reasoning artifacts from DeepSeek R1
    if (this.modelId.includes('deepseek-r1')) {
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    // Remove thinking prefixes from GPT-OSS (and similar reasoning models)
    if (this.modelId.includes('gpt-oss') || this.modelId.includes('qwen-qwq')) {
      // GPT-OSS often outputs reasoning before actual content
      // Look for common reasoning patterns and strip them

      // Pattern 1: Remove everything before a clear markdown section break (## heading)
      const headingMatch = cleaned.match(/^[\s\S]*?(##\s)/);
      if (headingMatch) {
        cleaned = cleaned.substring(headingMatch[0].indexOf('##'));
      }
      // Pattern 2: Remove reasoning that ends with "Here is..." or similar
      else if (cleaned.match(/^[\s\S]*?(Here\s+(?:is|are)|The\s+following|Below\s+(?:is|are))\s*:?\s*\n/i)) {
        cleaned = cleaned.replace(/^[\s\S]*?(Here\s+(?:is|are)|The\s+following|Below\s+(?:is|are))\s*:?\s*\n/i, '');
      }
      // Pattern 3: Remove initial reasoning paragraphs (text before double newline + substantive content)
      else {
        // Look for paragraph break followed by structured content (lists, headings, or multiple paragraphs)
        const contentMatch = cleaned.match(/^[^\n]*\n\n([\s\S]+)$/);
        if (contentMatch && contentMatch[1].length > 100) {
          // If there's substantial content after the first paragraph, treat first para as reasoning
          const firstPara = cleaned.substring(0, cleaned.indexOf('\n\n'));
          // Only strip if first paragraph looks like reasoning (contains meta-phrases)
          if (/(?:need to|let me|task is|going to|will now|analysis|deconstruct|examine)/i.test(firstPara)) {
            cleaned = contentMatch[1];
          }
        }
      }
    }

    // Clean up HTML tags that models sometimes mix with markdown
    // Convert <br> tags to markdown line breaks (two spaces + newline)
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '  \n');

    // Remove other common HTML tags (safer than allowing HTML rendering)
    cleaned = cleaned.replace(/<\/?(?:p|div|span|strong|b|em|i|u)>/gi, '');

    return cleaned.trim();
  }

  getProviderName(): string {
    return 'cloudflare';
  }

  async isAvailable(): Promise<boolean> {
    // Cloudflare models are always available (no API key needed)
    return true;
  }
}
