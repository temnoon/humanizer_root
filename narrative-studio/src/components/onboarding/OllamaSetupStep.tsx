import { useState, useEffect } from 'react';
import type { OllamaStatus, OllamaModel } from '../../types/electron';

interface OllamaSetupStepProps {
  onConfigured: () => void;
  onSkip: () => void;
  onBack: () => void;
}

type SetupState = 'checking' | 'not-installed' | 'not-running' | 'ready' | 'pulling';

const RECOMMENDED_MODELS = [
  { name: 'llama3.2:1b', size: '1.3 GB', ram: '4 GB', description: 'Fast, lightweight' },
  { name: 'llama3.2:3b', size: '2.0 GB', ram: '8 GB', description: 'Balanced (recommended)' },
  { name: 'llama3.2:8b', size: '4.7 GB', ram: '16 GB', description: 'Higher quality' },
];

export function OllamaSetupStep({ onConfigured, onSkip, onBack }: OllamaSetupStepProps) {
  const [state, setState] = useState<SetupState>('checking');
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b');
  const [pullProgress, setPullProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check Ollama status on mount
  useEffect(() => {
    checkOllamaStatus();
  }, []);

  // Listen for pull progress
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onOllamaProgress((progress) => {
      setPullProgress(progress.percent);
      if (progress.percent >= 100) {
        setState('ready');
        loadInstalledModels();
      }
    });

    return () => {
      window.electronAPI?.removeAllListeners('ollama-progress');
    };
  }, []);

  const checkOllamaStatus = async () => {
    if (!window.electronAPI) {
      setState('not-installed');
      return;
    }

    setState('checking');
    try {
      const ollamaStatus = await window.electronAPI.ollama.getStatus();
      setStatus(ollamaStatus);

      if (!ollamaStatus.installed) {
        setState('not-installed');
      } else if (!ollamaStatus.running) {
        setState('not-running');
      } else {
        setState('ready');
        await loadInstalledModels();
      }
    } catch (err) {
      console.error('Failed to check Ollama status:', err);
      setState('not-installed');
    }
  };

  const loadInstalledModels = async () => {
    if (!window.electronAPI) return;

    try {
      const models = await window.electronAPI.ollama.listModels();
      setInstalledModels(models);

      // If we have a recommended model installed, select it
      const hasRecommended = models.some(m =>
        RECOMMENDED_MODELS.some(r => m.name.startsWith(r.name.split(':')[0]))
      );
      if (hasRecommended) {
        const installed = models.find(m =>
          RECOMMENDED_MODELS.some(r => m.name === r.name)
        );
        if (installed) {
          setSelectedModel(installed.name);
        }
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const handleStartOllama = async () => {
    if (!window.electronAPI) return;

    setError(null);
    try {
      const started = await window.electronAPI.ollama.startServer();
      if (started) {
        await checkOllamaStatus();
      } else {
        setError('Failed to start Ollama. Please start it manually.');
      }
    } catch (err) {
      setError('Failed to start Ollama');
    }
  };

  const handlePullModel = async () => {
    if (!window.electronAPI) return;

    setState('pulling');
    setPullProgress(0);
    setError(null);

    try {
      const success = await window.electronAPI.ollama.pullModel(selectedModel);
      if (success) {
        await loadInstalledModels();
        setState('ready');
      } else {
        setError('Failed to download model');
        setState('ready');
      }
    } catch (err) {
      setError('Failed to download model');
      setState('ready');
    }
  };

  const hasSelectedModelInstalled = installedModels.some(m => m.name === selectedModel);

  const handleContinue = async () => {
    if (window.electronAPI) {
      await window.electronAPI.store.set('ollamaModel', selectedModel);
    }
    onConfigured();
  };

  return (
    <div>
      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        AI Engine Setup
      </h2>
      <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
        Humanizer Studio uses Ollama for local AI processing.
        Your data never leaves your device.
      </p>

      {/* Status card */}
      <div
        className="rounded-lg p-4 mb-6"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        {state === 'checking' && (
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Checking Ollama status...</span>
          </div>
        )}

        {state === 'not-installed' && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--warning)', opacity: 0.2 }}
              >
                <svg className="w-4 h-4" style={{ color: 'var(--warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Ollama Not Installed</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Install Ollama to enable AI features</p>
              </div>
            </div>
            <a
              href="https://ollama.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Download Ollama
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {state === 'not-running' && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-primary)', opacity: 0.2 }}
              >
                <svg className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Ollama Installed</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Start the Ollama service to continue</p>
              </div>
            </div>
            <button
              onClick={handleStartOllama}
              className="px-4 py-2 rounded-lg font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Start Ollama
            </button>
          </div>
        )}

        {state === 'ready' && (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--success)', opacity: 0.2 }}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Ollama Running</p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {status?.version ? `Version ${status.version}` : 'Ready for AI processing'}
              </p>
            </div>
          </div>
        )}

        {state === 'pulling' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--text-secondary)' }}>Downloading {selectedModel}</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{pullProgress}%</span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-primary)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pullProgress}%`,
                  backgroundColor: 'var(--accent-primary)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Model selection (only show when ready) */}
      {(state === 'ready' || state === 'pulling') && (
        <div className="mb-6">
          <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            Select Model
          </h3>
          <div className="space-y-2">
            {RECOMMENDED_MODELS.map((model) => {
              const isInstalled = installedModels.some(m => m.name === model.name);
              return (
                <label
                  key={model.name}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedModel === model.name ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    ringColor: 'var(--accent-primary)'
                  }}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.name}
                    checked={selectedModel === model.name}
                    onChange={() => setSelectedModel(model.name)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {model.name}
                      </span>
                      {isInstalled && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--success)', color: 'white' }}
                        >
                          Installed
                        </span>
                      )}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {model.description} · {model.size} · {model.ram} RAM
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center`}
                    style={{
                      borderColor: selectedModel === model.name
                        ? 'var(--accent-primary)'
                        : 'var(--border-subtle)'
                    }}
                  >
                    {selectedModel === model.name && (
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      />
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Download button if model not installed */}
          {state === 'ready' && !hasSelectedModelInstalled && (
            <button
              onClick={handlePullModel}
              className="mt-4 w-full px-4 py-2.5 rounded-lg font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Download {selectedModel}
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ backgroundColor: 'var(--error)', color: 'white' }}
        >
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
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

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="px-6 py-2.5 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-tertiary)'
            }}
          >
            Skip for now
          </button>

          {state === 'ready' && hasSelectedModelInstalled && (
            <button
              onClick={handleContinue}
              className="px-6 py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
