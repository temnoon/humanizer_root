/**
 * Post Composer Component
 */

import { Component, createSignal } from 'solid-js';
import { Button } from '@/components/ui/Button';
import { postsService } from '@/services/posts';
import { authStore } from '@/stores/auth';

interface PostComposerProps {
  onSuccess?: () => void;
}

export const PostComposer: Component<PostComposerProps> = (props) => {
  const [content, setContent] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    const text = content().trim();
    if (!text || !authStore.token()) return;

    setIsSubmitting(true);
    setError('');

    try {
      await postsService.create(text, 'public', authStore.token()!);
      setContent('');
      props.onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount = () => content().length;
  const maxChars = 5000;

  return (
    <div class="card post-composer">
      <form onSubmit={handleSubmit}>
        <textarea
          class="textarea"
          placeholder="Share a thought, start a discussion..."
          value={content()}
          onInput={(e) => setContent(e.currentTarget.value)}
          maxLength={maxChars}
        />
        
        {error() && (
          <div style={{ color: 'var(--color-error)', 'margin-top': 'var(--space-sm)', 'font-size': 'var(--text-sm)' }}>
            {error()}
          </div>
        )}

        <div class="flex justify-between items-center" style={{ 'margin-top': 'var(--space-md)' }}>
          <span class="text-secondary text-sm">
            {charCount()} / {maxChars}
          </span>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting()}
            disabled={!content().trim() || isSubmitting()}
          >
            Post
          </Button>
        </div>
      </form>
    </div>
  );
};
