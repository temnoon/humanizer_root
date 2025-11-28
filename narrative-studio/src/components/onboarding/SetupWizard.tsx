import { useState, useEffect } from 'react';
import { WelcomeStep } from './WelcomeStep';
import { ArchiveLocationStep } from './ArchiveLocationStep';
import { OllamaSetupStep } from './OllamaSetupStep';
import { CompletionStep } from './CompletionStep';

export interface WizardState {
  archivePath: string | null;
  ollamaConfigured: boolean;
  ollamaSkipped: boolean;
}

interface SetupWizardProps {
  onComplete: () => void;
}

type WizardStep = 'welcome' | 'archive' | 'ollama' | 'complete';

const STEPS: WizardStep[] = ['welcome', 'archive', 'ollama', 'complete'];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [state, setState] = useState<WizardState>({
    archivePath: null,
    ollamaConfigured: false,
    ollamaSkipped: false,
  });

  // Get default archive path on mount
  useEffect(() => {
    async function loadDefaults() {
      if (window.electronAPI) {
        const paths = await window.electronAPI.getPaths();
        setState(prev => ({
          ...prev,
          archivePath: `${paths.documents}/Humanizer Archives`
        }));
      } else {
        // Browser test mode - use mock path
        setState(prev => ({
          ...prev,
          archivePath: '~/Documents/Humanizer Archives'
        }));
      }
    }
    loadDefaults();
  }, []);

  const currentStepIndex = STEPS.indexOf(currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleComplete = async () => {
    // Save settings to electron-store
    if (window.electronAPI) {
      await window.electronAPI.store.set('archivePath', state.archivePath);
      await window.electronAPI.store.set('ollamaSkipped', state.ollamaSkipped);
      await window.electronAPI.completeFirstRun();
    }
    onComplete();
  };

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Progress indicator */}
        <div
          className="px-8 pt-6 pb-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index <= currentStepIndex ? 'text-white' : ''
                  }`}
                  style={{
                    backgroundColor: index <= currentStepIndex
                      ? 'var(--accent-primary)'
                      : 'var(--bg-tertiary)',
                    color: index <= currentStepIndex
                      ? 'white'
                      : 'var(--text-tertiary)'
                  }}
                >
                  {index < currentStepIndex ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className="w-16 h-0.5 mx-2"
                    style={{
                      backgroundColor: index < currentStepIndex
                        ? 'var(--accent-primary)'
                        : 'var(--bg-tertiary)'
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span>Welcome</span>
            <span>Archive</span>
            <span>AI Setup</span>
            <span>Ready</span>
          </div>
        </div>

        {/* Step content */}
        <div className="p-8">
          {currentStep === 'welcome' && (
            <WelcomeStep onNext={handleNext} />
          )}
          {currentStep === 'archive' && (
            <ArchiveLocationStep
              archivePath={state.archivePath}
              onPathChange={(path) => updateState({ archivePath: path })}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 'ollama' && (
            <OllamaSetupStep
              onConfigured={() => {
                updateState({ ollamaConfigured: true, ollamaSkipped: false });
                handleNext();
              }}
              onSkip={() => {
                updateState({ ollamaSkipped: true, ollamaConfigured: false });
                handleNext();
              }}
              onBack={handleBack}
            />
          )}
          {currentStep === 'complete' && (
            <CompletionStep
              state={state}
              onComplete={handleComplete}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
