// useWakeLock Hook - Battery-Safe Screen Wake Lock
// Prevents phone sleep during transformations with automatic timeout

import { useEffect, useRef } from 'react';

interface WakeLockOptions {
  /**
   * Maximum duration in milliseconds (default: 5 minutes)
   * Prevents excessive battery drain
   */
  maxDuration?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * useWakeLock - Keep screen awake during active operations
 *
 * @param isActive - Whether wake lock should be active
 * @param options - Configuration options
 *
 * @example
 * const [isTransforming, setIsTransforming] = useState(false);
 * useWakeLock(isTransforming, { maxDuration: 3 * 60 * 1000 }); // 3 minutes max
 */
export function useWakeLock(isActive: boolean, options: WakeLockOptions = {}) {
  const {
    maxDuration = 5 * 60 * 1000, // 5 minutes default
    debug = false
  } = options;

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check browser support
    if (!('wakeLock' in navigator)) {
      if (debug) {
        console.log('[Wake Lock] Not supported in this browser');
      }
      return;
    }

    // Only activate if isActive is true
    if (!isActive) {
      return;
    }

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');

        if (debug) {
          console.log('[Wake Lock] Screen lock acquired');
        }

        // Set up automatic release after maxDuration
        timeoutRef.current = setTimeout(() => {
          if (wakeLockRef.current) {
            wakeLockRef.current.release();
            wakeLockRef.current = null;

            if (debug) {
              console.log(`[Wake Lock] Auto-released after ${maxDuration / 1000}s (battery safety)`);
            }
          }
        }, maxDuration);

        // Handle visibility change (user switches tabs/apps)
        const handleVisibilityChange = async () => {
          if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
            try {
              wakeLockRef.current = await navigator.wakeLock.request('screen');

              if (debug) {
                console.log('[Wake Lock] Re-acquired after visibility change');
              }
            } catch (err) {
              if (debug) {
                console.error('[Wake Lock] Failed to re-acquire:', err);
              }
            }
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup handler for visibility listener
        return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

      } catch (err) {
        if (debug) {
          console.error('[Wake Lock] Failed to acquire:', err);
        }
      }
    };

    requestWakeLock();

    // Cleanup function
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;

        if (debug) {
          console.log('[Wake Lock] Released (cleanup)');
        }
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isActive, maxDuration, debug]);

  // Return wake lock status (useful for debugging)
  return {
    isSupported: 'wakeLock' in navigator,
    isActive: wakeLockRef.current !== null
  };
}
