/**
 * useLayoutPreference - Hook for responsive layout management
 *
 * Manages:
 * - Mobile detection (viewport width)
 * - Split view preference (desktop only)
 * - Persists preferences to localStorage
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'narrative-studio-layout-preference';
const MOBILE_BREAKPOINT = 768; // md breakpoint

interface LayoutPreference {
  preferSplitView: boolean;
}

const defaultPreference: LayoutPreference = {
  preferSplitView: true, // Desktop defaults to split view
};

export function useLayoutPreference() {
  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  // Load preference from localStorage
  const [preference, setPreference] = useState<LayoutPreference>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreference, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load layout preference:', e);
    }
    return defaultPreference;
  });

  // Handle viewport resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist preference changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  }, [preference]);

  // Toggle split view preference
  const toggleSplitView = useCallback(() => {
    setPreference(prev => ({
      ...prev,
      preferSplitView: !prev.preferSplitView,
    }));
  }, []);

  // Set split view preference explicitly
  const setSplitView = useCallback((value: boolean) => {
    setPreference(prev => ({
      ...prev,
      preferSplitView: value,
    }));
  }, []);

  return {
    isMobile,
    preferSplitView: preference.preferSplitView,
    toggleSplitView,
    setSplitView,
    // Computed: should show full page (mobile OR user prefers full page)
    isFullPage: isMobile || !preference.preferSplitView,
  };
}
