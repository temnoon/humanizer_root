import type { WizardState } from './SetupWizard';

interface CompletionStepProps {
  state: WizardState;
  onComplete: () => void;
  onBack: () => void;
}

export function CompletionStep({ state, onComplete, onBack }: CompletionStepProps) {
  return (
    <div className="text-center">
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
        style={{ backgroundColor: 'var(--success)' }}
      >
        <svg
          className="w-10 h-10 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        You're All Set!
      </h2>
      <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
        Humanizer Studio is ready to use.
      </p>

      {/* Configuration summary */}
      <div
        className="rounded-lg p-4 mb-8 text-left"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <h3
          className="font-medium mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Configuration Summary
        </h3>

        <div className="space-y-3">
          {/* Archive location */}
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: 'var(--success)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Archive Location
              </p>
              <p
                className="text-sm font-mono"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {state.archivePath}
              </p>
            </div>
          </div>

          {/* AI Engine status */}
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: state.ollamaSkipped ? 'var(--warning)' : 'var(--success)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {state.ollamaSkipped ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              )}
            </svg>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                AI Engine (Ollama)
              </p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {state.ollamaSkipped
                  ? 'Skipped - AI features disabled (can enable later in Settings)'
                  : 'Configured and ready'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Read-only mode warning */}
        {state.ollamaSkipped && (
          <div
            className="mt-4 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--warning)', opacity: 0.2 }}
          >
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              <strong>Read-only mode:</strong> Without Ollama, you can browse
              and search archives, but AI detection and transformations are disabled.
              Enable AI features anytime in Settings.
            </p>
          </div>
        )}
      </div>

      {/* What's next */}
      <div
        className="rounded-lg p-4 mb-8 text-left"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <h3
          className="font-medium mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Getting Started
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--accent-primary)' }}>1.</span>
            Import a conversation archive (OpenAI export or ZIP)
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--accent-primary)' }}>2.</span>
            Browse conversations and select text to transform
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--accent-primary)' }}>3.</span>
            Use AI detection and humanization tools
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)'
          }}
        >
          Back
        </button>
        <button
          onClick={onComplete}
          className="px-8 py-3 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Start Using Humanizer Studio
        </button>
      </div>
    </div>
  );
}
