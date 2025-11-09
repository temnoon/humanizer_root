// useTransformationPolling Hook - Poll for incomplete transformation status
// Enables resuming transformations after phone sleep or page reload

import { useEffect, useRef, useState } from 'react';
import { cloudAPI } from '../lib/cloud-api-client';

interface PollingOptions {
  /**
   * Interval between polls in milliseconds (default: 5000ms = 5 seconds)
   */
  interval?: number;

  /**
   * Maximum number of poll attempts (default: 60 = 5 minutes at 5s intervals)
   */
  maxAttempts?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

interface PollingResult {
  isPolling: boolean;
  result: any | null;
  error: string | null;
  attemptCount: number;
}

/**
 * useTransformationPolling - Poll transformation status for incomplete transformations
 *
 * @param transformationId - ID of transformation to poll (null to disable polling)
 * @param options - Polling configuration
 *
 * @example
 * const { isPolling, result, error } = useTransformationPolling(
 *   transformationId,
 *   { interval: 5000, maxAttempts: 60 }
 * );
 */
export function useTransformationPolling(
  transformationId: string | null,
  options: PollingOptions = {}
): PollingResult {
  const {
    interval = 5000, // 5 seconds
    maxAttempts = 60, // 5 minutes total
    debug = false
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptCountRef = useRef(0);

  useEffect(() => {
    // Only poll if we have a transformation ID
    if (!transformationId) {
      return;
    }

    setIsPolling(true);
    setError(null);
    attemptCountRef.current = 0;

    const poll = async () => {
      try {
        attemptCountRef.current++;
        setAttemptCount(attemptCountRef.current);

        if (debug) {
          console.log(`[Transformation Polling] Attempt ${attemptCountRef.current}/${maxAttempts} for ${transformationId}`);
        }

        const status = await cloudAPI.getTransformationStatus(transformationId);

        if (status.status === 'completed') {
          if (debug) {
            console.log('[Transformation Polling] Transformation completed');
          }

          setResult(status);
          setIsPolling(false);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (status.status === 'failed') {
          if (debug) {
            console.log('[Transformation Polling] Transformation failed:', status.error_message);
          }

          setError(status.error_message || 'Transformation failed');
          setIsPolling(false);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (attemptCountRef.current >= maxAttempts) {
          if (debug) {
            console.log('[Transformation Polling] Max attempts reached');
          }

          setError('Transformation timed out - please check history later');
          setIsPolling(false);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        console.error('[Transformation Polling] Error:', err);

        // Don't stop polling on transient errors, but stop after max attempts
        if (attemptCountRef.current >= maxAttempts) {
          setError(err instanceof Error ? err.message : 'Polling failed');
          setIsPolling(false);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    };

    // Initial poll
    poll();

    // Set up interval for subsequent polls
    intervalRef.current = setInterval(poll, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [transformationId, interval, maxAttempts, debug]);

  return {
    isPolling,
    result,
    error,
    attemptCount
  };
}
