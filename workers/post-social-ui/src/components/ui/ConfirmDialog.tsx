import { createSignal, Show } from 'solid-js';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

const [confirmState, setConfirmState] = createSignal<ConfirmState | null>(null);

/**
 * Show a confirmation dialog
 * @returns Promise that resolves to true (confirmed) or false (cancelled)
 */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string'
    ? { message: options }
    : options;

  return new Promise((resolve) => {
    setConfirmState({
      ...opts,
      resolve: (confirmed: boolean) => {
        setConfirmState(null);
        resolve(confirmed);
      }
    });
  });
}

function handleConfirm() {
  confirmState()?.resolve(true);
}

function handleCancel() {
  confirmState()?.resolve(false);
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleCancel();
  }
}

/**
 * ConfirmDialog container - add once to your app root
 */
export function ConfirmDialogContainer() {
  return (
    <Show when={confirmState()}>
      {(state) => (
        <div class="confirm-backdrop" onClick={handleBackdropClick}>
          <div class="confirm-dialog">
            <Show when={state().title}>
              <h3 class="confirm-title">{state().title}</h3>
            </Show>
            <p class="confirm-message">{state().message}</p>
            <div class="confirm-actions">
              <button
                class="confirm-btn confirm-cancel"
                onClick={handleCancel}
              >
                {state().cancelText || 'Cancel'}
              </button>
              <button
                class={`confirm-btn confirm-confirm ${state().destructive ? 'destructive' : ''}`}
                onClick={handleConfirm}
              >
                {state().confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
