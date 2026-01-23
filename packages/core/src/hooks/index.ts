/**
 * Hooks Module - Barrel Export
 *
 * Automatic review hook system that triggers development agent reviews
 * on file changes, commits, and other development events.
 */

export {
  ReviewHooksManager,
  getReviewHooksManager,
  resetReviewHooksManager,
  triggerFileChangeReview,
  runFullReview,
  setReviewHooksEnabled,
  areReviewHooksEnabled,
  getReviewTriggers,
  type ReviewHooksConfig,
  type CombinedReviewResult,
} from './review-hooks.js';
