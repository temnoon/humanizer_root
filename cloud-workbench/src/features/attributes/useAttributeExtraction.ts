/**
 * Custom hook for attribute extraction logic
 */

import { useState, useCallback } from 'react';
import type { AttributeType, DialogueMessage } from './types';
import { extractAttribute, refineAttribute } from './api';

export function useAttributeExtraction() {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogueId, setDialogueId] = useState<string | null>(null);

  const extract = useCallback(async (type: AttributeType, description: string) => {
    setIsLoading(true);

    // Add user message
    const userMessage: DialogueMessage = {
      role: 'user',
      content: description,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await extractAttribute(
        type,
        description,
        messages.map(m => m.content)
      );

      // Add assistant response
      const assistantMessage: DialogueMessage = {
        role: 'assistant',
        content: response.questions
          ? response.questions.join('\n\n')
          : `I've extracted a ${type} definition based on your description. You can see it in the preview panel.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Store dialogue ID if provided
      if (response.dialogueId) {
        setDialogueId(response.dialogueId);
      }

      return response;
    } catch (error) {
      console.error('Extraction failed:', error);

      // Add error message
      const errorMessage: DialogueMessage = {
        role: 'assistant',
        content: 'I encountered an error while processing your request. Please try again or provide more details.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const refine = useCallback(async (dialogueId: string, feedback: string) => {
    setIsLoading(true);

    // Add user message
    const userMessage: DialogueMessage = {
      role: 'user',
      content: feedback,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await refineAttribute(dialogueId, feedback);

      // Add assistant response
      const assistantMessage: DialogueMessage = {
        role: 'assistant',
        content: response.questions
          ? response.questions.join('\n\n')
          : 'I\'ve refined the definition based on your feedback. Check the preview panel.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      return response;
    } catch (error) {
      console.error('Refinement failed:', error);

      // Add error message
      const errorMessage: DialogueMessage = {
        role: 'assistant',
        content: 'I couldn\'t refine the definition. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setDialogueId(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    dialogueId,
    extract,
    refine,
    reset,
  };
}