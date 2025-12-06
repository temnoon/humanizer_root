/**
 * FeedbackWidget - User feedback collection for transformations
 *
 * Displays after each transformation to collect:
 * - Thumbs up/down rating
 * - Optional text feedback
 *
 * Feeds into the model profile registry for iterative improvement.
 */

import { useState, useCallback } from 'react';

// Simple inline icons to avoid dependency issues
const ThumbsUp = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);

const ThumbsDown = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
);

const Send = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const X = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

interface FeedbackWidgetProps {
  transformationId: string;
  modelUsed?: string;
  transformationType: 'persona' | 'style' | 'humanizer' | 'round-trip';
  personaOrStyle?: string;
  onFeedbackSubmit?: (feedback: FeedbackData) => void;
  onDismiss?: () => void;
  compact?: boolean;  // Compact mode for inline display
}

export interface FeedbackData {
  transformationId: string;
  rating: 'good' | 'bad';
  feedbackText?: string;
  modelUsed?: string;
  transformationType: string;
  personaOrStyle?: string;
  timestamp: string;
}

export function FeedbackWidget({
  transformationId,
  modelUsed,
  transformationType,
  personaOrStyle,
  onFeedbackSubmit,
  onDismiss,
  compact = false,
}: FeedbackWidgetProps) {
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleRating = useCallback((value: 'good' | 'bad') => {
    setRating(value);

    // For "good" ratings, submit immediately
    // For "bad" ratings, show text input for more details
    if (value === 'good') {
      submitFeedback(value, '');
    } else {
      setShowTextInput(true);
    }
  }, []);

  const submitFeedback = useCallback((finalRating: 'good' | 'bad', text: string) => {
    const feedback: FeedbackData = {
      transformationId,
      rating: finalRating,
      feedbackText: text || undefined,
      modelUsed,
      transformationType,
      personaOrStyle,
      timestamp: new Date().toISOString(),
    };

    // Store in localStorage for now (will be synced to backend later)
    storeFeedbackLocally(feedback);

    // Update model profile stats
    updateModelStats(feedback);

    // Notify parent
    onFeedbackSubmit?.(feedback);

    setSubmitted(true);

    // Auto-dismiss after a moment
    setTimeout(() => {
      onDismiss?.();
    }, 1500);
  }, [transformationId, modelUsed, transformationType, personaOrStyle, onFeedbackSubmit, onDismiss]);

  const handleSubmitWithText = useCallback(() => {
    if (rating) {
      submitFeedback(rating, feedbackText);
    }
  }, [rating, feedbackText, submitFeedback]);

  const handleSkip = useCallback(() => {
    if (rating) {
      submitFeedback(rating, '');
    } else {
      onDismiss?.();
    }
  }, [rating, submitFeedback, onDismiss]);

  // Submitted state
  if (submitted) {
    return (
      <div className={`feedback-widget feedback-submitted ${compact ? 'compact' : ''}`}>
        <span className="feedback-thanks">Thanks for your feedback!</span>
      </div>
    );
  }

  // Compact mode - just the buttons
  if (compact) {
    return (
      <div className="feedback-widget compact">
        <span className="feedback-label">How was this?</span>
        <button
          className={`feedback-btn ${rating === 'good' ? 'selected' : ''}`}
          onClick={() => handleRating('good')}
          title="Good transformation"
        >
          <ThumbsUp size={14} />
        </button>
        <button
          className={`feedback-btn ${rating === 'bad' ? 'selected' : ''}`}
          onClick={() => handleRating('bad')}
          title="Needs improvement"
        >
          <ThumbsDown size={14} />
        </button>
        {showTextInput && (
          <div className="feedback-text-inline">
            <input
              type="text"
              placeholder="What went wrong?"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitWithText()}
              autoFocus
            />
            <button onClick={handleSubmitWithText} title="Submit">
              <Send size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full mode - card with more detail
  return (
    <div className="feedback-widget full">
      <div className="feedback-header">
        <span>How was this transformation?</span>
        <button className="feedback-close" onClick={onDismiss} title="Dismiss">
          <X size={14} />
        </button>
      </div>

      <div className="feedback-buttons">
        <button
          className={`feedback-btn good ${rating === 'good' ? 'selected' : ''}`}
          onClick={() => handleRating('good')}
        >
          <ThumbsUp size={16} />
          <span>Good</span>
        </button>
        <button
          className={`feedback-btn bad ${rating === 'bad' ? 'selected' : ''}`}
          onClick={() => handleRating('bad')}
        >
          <ThumbsDown size={16} />
          <span>Needs Work</span>
        </button>
      </div>

      {showTextInput && (
        <div className="feedback-text-section">
          <textarea
            placeholder="What went wrong? (optional)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={2}
            autoFocus
          />
          <div className="feedback-text-actions">
            <button className="feedback-skip" onClick={handleSkip}>
              Skip
            </button>
            <button className="feedback-submit" onClick={handleSubmitWithText}>
              <Send size={12} />
              Submit
            </button>
          </div>
        </div>
      )}

      {modelUsed && (
        <div className="feedback-meta">
          Model: {modelUsed}
        </div>
      )}
    </div>
  );
}

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

const FEEDBACK_STORAGE_KEY = 'transformation-feedback';
const MAX_STORED_FEEDBACK = 100;  // Keep last 100 feedbacks locally
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

/**
 * Sync feedback to backend API
 * Falls back to localStorage-only if API fails
 */
async function syncFeedbackToBackend(feedback: FeedbackData): Promise<boolean> {
  try {
    // Get auth token
    const token = localStorage.getItem('narrative-studio-auth-token') ||
                  localStorage.getItem('post-social:token');

    if (!token) {
      console.log('[FeedbackWidget] No auth token, storing locally only');
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        transformation_id: feedback.transformationId,
        transformation_type: feedback.transformationType,
        rating: feedback.rating,
        profile_name: feedback.personaOrStyle,
        feedback_text: feedback.feedbackText,
        model_used: feedback.modelUsed,
      }),
    });

    if (response.ok) {
      console.log('[FeedbackWidget] Synced feedback to backend');
      return true;
    } else {
      console.warn('[FeedbackWidget] Backend sync failed:', response.status);
      return false;
    }
  } catch (error) {
    console.warn('[FeedbackWidget] Backend sync error:', error);
    return false;
  }
}

function storeFeedbackLocally(feedback: FeedbackData): void {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    const feedbacks: FeedbackData[] = stored ? JSON.parse(stored) : [];

    // Add new feedback
    feedbacks.push(feedback);

    // Trim to max size (keep most recent)
    if (feedbacks.length > MAX_STORED_FEEDBACK) {
      feedbacks.splice(0, feedbacks.length - MAX_STORED_FEEDBACK);
    }

    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedbacks));
    console.log('[FeedbackWidget] Stored feedback locally:', feedback);

    // Also sync to backend (fire and forget)
    syncFeedbackToBackend(feedback);
  } catch (error) {
    console.warn('[FeedbackWidget] Failed to store feedback:', error);
  }
}

function updateModelStats(feedback: FeedbackData): void {
  try {
    // Dynamic import to avoid circular dependency
    import('../../services/modelProfileRegistry').then(({ modelRegistry }) => {
      if (feedback.modelUsed) {
        modelRegistry.recordResult(
          feedback.modelUsed,
          feedback.rating === 'good',
          feedback.personaOrStyle,
          feedback.feedbackText
        );
      }
    });
  } catch (error) {
    console.warn('[FeedbackWidget] Failed to update model stats:', error);
  }
}

/**
 * Get all stored feedback (for reporting)
 */
export function getStoredFeedback(): FeedbackData[] {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear stored feedback (after sync)
 */
export function clearStoredFeedback(): void {
  localStorage.removeItem(FEEDBACK_STORAGE_KEY);
}

/**
 * Sync all stored local feedback to backend
 * Useful for batch uploading feedback collected while offline
 */
export async function syncAllFeedbackToBackend(): Promise<{ synced: number; failed: number }> {
  const feedbacks = getStoredFeedback();
  if (feedbacks.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const token = localStorage.getItem('narrative-studio-auth-token') ||
                localStorage.getItem('post-social:token');

  if (!token) {
    console.warn('[FeedbackWidget] No auth token for batch sync');
    return { synced: 0, failed: feedbacks.length };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/feedback/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        feedbacks: feedbacks.map(fb => ({
          transformation_id: fb.transformationId,
          transformation_type: fb.transformationType,
          rating: fb.rating,
          profile_name: fb.personaOrStyle,
          feedback_text: fb.feedbackText,
          model_used: fb.modelUsed,
          timestamp: fb.timestamp,
        })),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      // Clear local storage after successful sync
      clearStoredFeedback();
      console.log('[FeedbackWidget] Batch sync complete:', result);
      return { synced: result.inserted || feedbacks.length, failed: 0 };
    } else {
      console.warn('[FeedbackWidget] Batch sync failed:', response.status);
      return { synced: 0, failed: feedbacks.length };
    }
  } catch (error) {
    console.warn('[FeedbackWidget] Batch sync error:', error);
    return { synced: 0, failed: feedbacks.length };
  }
}

/**
 * Get feedback summary for reporting
 */
export function getFeedbackSummary(): {
  total: number;
  good: number;
  bad: number;
  successRate: number;
  byModel: Record<string, { good: number; bad: number }>;
  byType: Record<string, { good: number; bad: number }>;
} {
  const feedbacks = getStoredFeedback();

  const summary = {
    total: feedbacks.length,
    good: 0,
    bad: 0,
    successRate: 0,
    byModel: {} as Record<string, { good: number; bad: number }>,
    byType: {} as Record<string, { good: number; bad: number }>,
  };

  for (const fb of feedbacks) {
    // Overall counts
    if (fb.rating === 'good') {
      summary.good++;
    } else {
      summary.bad++;
    }

    // By model
    if (fb.modelUsed) {
      if (!summary.byModel[fb.modelUsed]) {
        summary.byModel[fb.modelUsed] = { good: 0, bad: 0 };
      }
      summary.byModel[fb.modelUsed][fb.rating]++;
    }

    // By type
    if (!summary.byType[fb.transformationType]) {
      summary.byType[fb.transformationType] = { good: 0, bad: 0 };
    }
    summary.byType[fb.transformationType][fb.rating]++;
  }

  summary.successRate = summary.total > 0
    ? (summary.good / summary.total) * 100
    : 0;

  return summary;
}

// ============================================================
// STYLES (to be added to index.css)
// ============================================================

/*
Add these styles to src/index.css:

.feedback-widget {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 12px;
}

.feedback-widget.compact {
  padding: 4px 8px;
}

.feedback-widget.full {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feedback-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
}

.feedback-label {
  color: var(--text-secondary);
  margin-right: 4px;
}

.feedback-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.feedback-btn:hover {
  background: var(--bg-hover);
}

.feedback-btn.selected.good,
.feedback-btn.good:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: #22c55e;
  color: #22c55e;
}

.feedback-btn.selected.bad,
.feedback-btn.bad:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}

.feedback-buttons {
  display: flex;
  gap: 8px;
}

.feedback-text-inline {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.feedback-text-inline input {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  width: 150px;
}

.feedback-text-section textarea {
  width: 100%;
  padding: 8px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: none;
}

.feedback-text-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.feedback-skip {
  padding: 4px 12px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.feedback-submit {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: var(--accent-purple);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.feedback-meta {
  font-size: 10px;
  color: var(--text-tertiary);
}

.feedback-thanks {
  color: #22c55e;
}

.feedback-submitted {
  justify-content: center;
}
*/

export default FeedbackWidget;
