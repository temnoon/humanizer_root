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
    // Completion format models (use 'input' field, return structured output)
    const completionModels = [
      '@cf/openai/gpt-oss-20b',
      '@cf/openai/gpt-oss-120b'
    ];

    if (completionModels.includes(modelId)) {
      return 'completion';
    }

    // Default to chat format (Llama, Qwen, DeepSeek models)
    return 'chat';
  }

  /**
   * Maximum retry attempts for transient errors (502, 504, timeouts)
   */
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_MS = 1000;

  /**
   * Check if error is retryable (gateway errors, timeouts)
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('504') ||
        message.includes('502') ||
        message.includes('gateway') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('network')
      );
    }
    return false;
  }

  /**
   * Sleep helper for retry delay
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= CloudflareProvider.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[Cloudflare AI] Retry attempt ${attempt}/${CloudflareProvider.MAX_RETRIES} after error`);
          await this.sleep(CloudflareProvider.RETRY_DELAY_MS * attempt); // Exponential backoff
        }

        return await this.callOnce(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.isRetryableError(error) && attempt < CloudflareProvider.MAX_RETRIES) {
          console.warn(`[Cloudflare AI] Retryable error: ${lastError.message}`);
          continue;
        }

        // Non-retryable error or max retries exceeded
        break;
      }
    }

    throw lastError || new Error('Cloudflare AI call failed');
  }

  /**
   * Single call attempt (extracted from original call method)
   */
  private async callOnce(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Format request body based on API format
      const requestBody = this.formatRequest(request);
      const response = await this.env.AI.run(this.modelId, requestBody);

      // Try different response field names based on API format
      let responseText = '';
      if (this.apiFormat === 'completion') {
        // GPT-OSS returns structured output with reasoning and message blocks:
        // { output: [
        //   { type: "reasoning", content: [{ type: "reasoning_text", text: "..." }] },
        //   { type: "message", content: [{ type: "output_text", text: "..." }] }
        // ]}
        const outputField = response.output;
        const textField = response.text;

        // Extract ONLY from message blocks (skip reasoning blocks)
        if (Array.isArray(outputField) && outputField.length > 0) {
          responseText = outputField
            .filter((item: any) => item.type === 'message')  // Only message blocks
            .map((item: any) => {
              if (item.content && Array.isArray(item.content)) {
                // Extract only output_text content
                return item.content
                  .filter((c: any) => c.type === 'output_text')
                  .map((c: any) => c.text || '')
                  .join('');
              }
              return '';
            })
            .join('');
        } else if (Array.isArray(textField) && textField.length > 0) {
          // Fallback: similar format but in text field
          responseText = textField
            .filter((item: any) => item.type === 'message')
            .map((item: any) => {
              if (item.content && Array.isArray(item.content)) {
                return item.content
                  .filter((c: any) => c.type === 'output_text')
                  .map((c: any) => c.text || '')
                  .join('');
              }
              return '';
            })
            .join('');
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
        responseText = String(responseText || '');
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

    // Remove reasoning artifacts from models that use <think> tags
    // DeepSeek R1 and Qwen QwQ both output reasoning in <think></think> blocks
    if (this.modelId.includes('deepseek-r1') || this.modelId.includes('qwen')) {
      // First try to remove complete <think>...</think> blocks
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');

      // Fallback: If there's a closing </think> without opening tag (malformed),
      // remove everything from the start up to and including the closing tag
      if (cleaned.includes('</think>')) {
        cleaned = cleaned.replace(/^[\s\S]*?<\/think>\s*/g, '');
      }

      cleaned = cleaned.trim();
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

  async generateText(prompt: string, options: { max_tokens: number; temperature: number }): Promise<string> {
    const response = await this.call({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens,
      temperature: options.temperature
    });
    return response.response;
  }

  getProviderName(): string {
    return 'cloudflare';
  }

  async isAvailable(): Promise<boolean> {
    // Cloudflare models are always available (no API key needed)
    return true;
  }
}
