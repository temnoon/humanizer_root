import { createSignal, createEffect, Show, For } from 'solid-js';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

// Global toast state
const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
let toastId = 0;

/**
 * Show a toast notification
 * @param message - The message to display
 * @param type - Toast type: 'success' | 'error' | 'info' | 'warning'
 * @param duration - Duration in ms (default: 4000, use 0 for persistent)
 */
export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = ++toastId;
  setToasts(prev => [...prev, { id, message, type }]);

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export function dismissToast(id: number) {
  setToasts(prev => prev.filter(t => t.id !== id));
}

// Convenience functions
export const toast = {
  success: (msg: string, duration?: number) => showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => showToast(msg, 'error', duration ?? 6000),
  info: (msg: string, duration?: number) => showToast(msg, 'info', duration),
  warning: (msg: string, duration?: number) => showToast(msg, 'warning', duration ?? 5000),
};

/**
 * Toast container component - add once to your app root
 */
export function ToastContainer() {
  return (
    <div class="toast-container">
      <For each={toasts()}>
        {(t) => (
          <div class={`toast toast-${t.type}`} onClick={() => dismissToast(t.id)}>
            <span class="toast-icon">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'warning' && '⚠'}
              {t.type === 'info' && 'ℹ'}
            </span>
            <span class="toast-message">{t.message}</span>
            <button class="toast-close" onClick={() => dismissToast(t.id)}>×</button>
          </div>
        )}
      </For>
    </div>
  );
}
