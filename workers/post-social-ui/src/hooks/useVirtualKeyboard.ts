/**
 * Virtual Keyboard Hook
 *
 * Detects when the virtual keyboard is open on mobile devices
 * and provides utilities for adjusting layout accordingly.
 *
 * Uses the Visual Viewport API where available, with fallback
 * to viewport height comparison.
 */

import { createSignal, onMount, onCleanup, Accessor } from 'solid-js';

interface VirtualKeyboardState {
  /** Whether the keyboard is currently visible */
  isOpen: Accessor<boolean>;
  /** Height of the keyboard in pixels (0 if closed) */
  keyboardHeight: Accessor<number>;
  /** Available viewport height (minus keyboard) */
  viewportHeight: Accessor<number>;
}

/**
 * Hook to detect virtual keyboard state on mobile
 */
export function useVirtualKeyboard(): VirtualKeyboardState {
  const [isOpen, setIsOpen] = createSignal(false);
  const [keyboardHeight, setKeyboardHeight] = createSignal(0);
  const [viewportHeight, setViewportHeight] = createSignal(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  // Track initial viewport height (before keyboard)
  let initialHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  onMount(() => {
    if (typeof window === 'undefined') return;

    // Use Visual Viewport API if available (modern browsers)
    if ('visualViewport' in window && window.visualViewport) {
      const vv = window.visualViewport;

      const handleResize = () => {
        const currentHeight = vv.height;
        const heightDiff = initialHeight - currentHeight;

        // Consider keyboard open if viewport shrunk by more than 150px
        const keyboardVisible = heightDiff > 150;

        setIsOpen(keyboardVisible);
        setKeyboardHeight(keyboardVisible ? heightDiff : 0);
        setViewportHeight(currentHeight);
      };

      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);

      // Initial check
      handleResize();

      onCleanup(() => {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      });
    } else {
      // Fallback: Listen for focus on inputs
      const handleFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true'
        ) {
          // Assume keyboard opens on input focus on mobile
          if (window.innerWidth < 768) {
            setIsOpen(true);
            // Estimate keyboard height (~40% of screen on mobile)
            setKeyboardHeight(Math.round(window.innerHeight * 0.4));
            setViewportHeight(Math.round(window.innerHeight * 0.6));
          }
        }
      };

      const handleBlur = () => {
        // Small delay to prevent false closes during focus switching
        setTimeout(() => {
          if (!document.activeElement ||
              (document.activeElement.tagName !== 'INPUT' &&
               document.activeElement.tagName !== 'TEXTAREA' &&
               (document.activeElement as HTMLElement).contentEditable !== 'true')) {
            setIsOpen(false);
            setKeyboardHeight(0);
            setViewportHeight(window.innerHeight);
          }
        }, 100);
      };

      document.addEventListener('focusin', handleFocus);
      document.addEventListener('focusout', handleBlur);

      onCleanup(() => {
        document.removeEventListener('focusin', handleFocus);
        document.removeEventListener('focusout', handleBlur);
      });
    }

    // Update initial height on orientation change
    const handleOrientationChange = () => {
      setTimeout(() => {
        initialHeight = window.innerHeight;
        setViewportHeight(window.innerHeight);
        setIsOpen(false);
        setKeyboardHeight(0);
      }, 300);
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    onCleanup(() => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    });
  });

  return {
    isOpen,
    keyboardHeight,
    viewportHeight,
  };
}

/**
 * Scroll an element into view when keyboard opens
 */
export function scrollIntoViewOnKeyboard(element: HTMLElement | null) {
  if (!element) return;

  // Wait for keyboard to finish animating
  setTimeout(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, 300);
}

export default useVirtualKeyboard;
