/**
 * QuotaDisplay Component
 *
 * Displays GPTZero quota usage with progress bar and tier badge
 */

import React from 'react';
import type { QuotaInfo } from '../../services/gptzeroService';
import {
  formatQuota,
  formatResetDate,
  getQuotaColor,
} from '../../services/gptzeroService';

interface QuotaDisplayProps {
  quota: QuotaInfo | null;
  tier: 'free' | 'pro' | 'premium';
  onUpgrade?: () => void;
  compact?: boolean;
}

export function QuotaDisplay({
  quota,
  tier,
  onUpgrade,
  compact = false,
}: QuotaDisplayProps) {
  // Free tier has no GPTZero access
  if (tier === 'free') {
    return (
      <div className="quota-display quota-display--free">
        <div className="quota-display__header">
          <span className="tier-badge tier-badge--free">Free</span>
          <span className="quota-display__label">GPTZero Detection</span>
        </div>
        <div className="quota-display__message">
          <svg
            className="quota-display__icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Upgrade to Pro for professional AI detection</span>
        </div>
        {onUpgrade && (
          <button
            className="btn btn-primary btn-sm quota-display__upgrade"
            onClick={onUpgrade}
          >
            Upgrade to Pro
          </button>
        )}
      </div>
    );
  }

  // Loading state
  if (!quota) {
    return (
      <div className="quota-display quota-display--loading">
        <div className="quota-display__header">
          <span className={`tier-badge tier-badge--${tier}`}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </span>
          <span className="quota-display__label">Loading quota...</span>
        </div>
      </div>
    );
  }

  const percentUsed = quota.percentUsed;
  const isNearLimit = percentUsed >= 80;
  const isOverLimit = percentUsed >= 100;
  const colorClass = getQuotaColor(percentUsed);

  if (compact) {
    return (
      <div className="quota-display quota-display--compact">
        <span className={`tier-badge tier-badge--${tier}`}>
          {tier === 'premium' ? 'Premium' : 'Pro'}
        </span>
        <span className={`quota-display__compact-text ${colorClass}`}>
          {formatQuota(quota)}
        </span>
      </div>
    );
  }

  return (
    <div className="quota-display">
      <div className="quota-display__header">
        <span className={`tier-badge tier-badge--${tier}`}>
          {tier === 'premium' ? 'Premium' : 'Pro'}
        </span>
        <span className="quota-display__label">GPTZero Quota</span>
      </div>

      <div className="quota-display__progress">
        <div className="quota-display__bar">
          <div
            className={`quota-display__fill ${
              isOverLimit
                ? 'quota-display__fill--danger'
                : isNearLimit
                ? 'quota-display__fill--warning'
                : 'quota-display__fill--normal'
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <div className="quota-display__text">
          <span className={colorClass}>{formatQuota(quota)}</span>
          <span className="quota-display__reset">
            Resets {formatResetDate(quota.resetDate)}
          </span>
        </div>
      </div>

      {isNearLimit && !isOverLimit && tier !== 'premium' && (
        <div className="quota-display__warning">
          <svg
            className="quota-display__warning-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>Running low on quota</span>
          {onUpgrade && tier === 'pro' && (
            <button
              className="btn btn-link btn-sm"
              onClick={onUpgrade}
            >
              Upgrade to Premium
            </button>
          )}
        </div>
      )}

      {isOverLimit && (
        <div className="quota-display__error">
          <svg
            className="quota-display__error-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Quota exceeded.{' '}
            {tier === 'pro' ? 'Upgrade to Premium for unlimited access.' : 'Resets soon.'}
          </span>
          {onUpgrade && tier === 'pro' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={onUpgrade}
            >
              Upgrade Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
