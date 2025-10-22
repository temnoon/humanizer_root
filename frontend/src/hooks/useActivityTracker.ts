import { useEffect, useRef } from 'react';
import { useEphemeralListStore } from '../store/ephemeral';

export function useActivityTracker(
  selectedConversation?: string | null,
  conversationTitle?: string,
  transformationResult?: any,
) {
  const addItem = useEphemeralListStore((state) => state.addItem);
  const list = useEphemeralListStore((state) => state.list);
  const lastTrackedConversation = useRef<{uuid: string, title: string} | null>(null);

  // Track conversation views
  useEffect(() => {
    if (selectedConversation && conversationTitle && list?.autoSaveEnabled) {
      // Only add if this is a new conversation or the title has changed for the same conversation
      const isSameAsLast = lastTrackedConversation.current?.uuid === selectedConversation &&
                          lastTrackedConversation.current?.title === conversationTitle;

      if (!isSameAsLast) {
        addItem({
          type: 'conversation',
          uuid: selectedConversation,
          metadata: {
            title: conversationTitle,
          },
        });

        // Update the ref to track what we just added
        lastTrackedConversation.current = {
          uuid: selectedConversation,
          title: conversationTitle
        };
      }
    }
  }, [selectedConversation, conversationTitle, addItem, list?.autoSaveEnabled]);

  // Track transformations
  useEffect(() => {
    if (transformationResult && list?.autoSaveEnabled) {
      const excerpt = transformationResult.original_text?.slice(0, 50) || '';
      addItem({
        type: 'transformation',
        uuid: transformationResult.transformation_id || `trans-${Date.now()}`,
        metadata: {
          method: transformationResult.method,
          title: `${transformationResult.method} transformation`,
          excerpt: excerpt + (excerpt.length >= 50 ? '...' : ''),
          convergenceScore: transformationResult.convergence_score,
        },
      });
    }
  }, [transformationResult, addItem, list?.autoSaveEnabled]);

  return { trackingEnabled: list?.autoSaveEnabled ?? false };
}
