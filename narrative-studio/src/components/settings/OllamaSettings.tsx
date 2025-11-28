import { useState, useEffect, useCallback } from 'react';

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  endpoint: string;
}

interface OllamaModel {
  name: string;
  size: number;
  modified: string;
  digest: string;
}

interface OllamaProgress {
  model: string;
  status: string;
  completed: number;
  total: number;
  percent: number;
}

const AVAILABLE_MODELS = [
  { name: 'llama3.2:1b', size: '1.3 GB', description: 'Fastest, good for basic tasks' },
  { name: 'llama3.2:3b', size: '2.0 GB', description: 'Balanced speed and quality' },
  { name: 'llama3.2:8b', size: '4.7 GB', description: 'Best quality, slower' },
];

export function OllamaSettings() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [pullProgress, setPullProgress] = useState<OllamaProgress | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.isElectron && !!window.electronAPI);
  }, []);

  // Fetch Ollama status and models
  const refreshStatus = useCallback(async () => {
    if (!window.electronAPI?.ollama) return;

    try {
      const [ollamaStatus, installedModels] = await Promise.all([
        window.electronAPI.ollama.getStatus(),
        window.electronAPI.ollama.listModels(),
      ]);

      setStatus(ollamaStatus);
      setModels(installedModels);

      // Set default selected model from stored preference or first installed
      if (!selectedModel) {
        const storedModel = await window.electronAPI.store.get('selectedModel') as string;
        if (storedModel) {
          setSelectedModel(storedModel);
        } else if (installedModels.length > 0) {
          setSelectedModel(installedModels[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to get Ollama status:', err);
      setError('Failed to connect to Ollama');
    }
  }, [selectedModel]);

  // Initial fetch
  useEffect(() => {
    if (isElectron) {
      refreshStatus();
    }
  }, [isElectron, refreshStatus]);

  // Listen for pull progress
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onOllamaProgress((progress: OllamaProgress) => {
      setPullProgress(progress);
    });

    return () => {
      window.electronAPI?.removeAllListeners('ollama-progress');
    };
  }, []);

  // Start Ollama server
  const handleStartServer = async () => {
    if (!window.electronAPI?.ollama) return;

    setIsStarting(true);
    setError(null);

    try {
      const success = await window.electronAPI.ollama.startServer();
      if (success) {
        await refreshStatus();
      } else {
        setError('Failed to start Ollama server');
      }
    } catch (err) {
      setError('Failed to start Ollama server');
    } finally {
      setIsStarting(false);
    }
  };

  // Pull a model
  const handlePullModel = async (modelName: string) => {
    if (!window.electronAPI?.ollama) return;

    setIsPulling(true);
    setPullProgress({ model: modelName, status: 'starting', completed: 0, total: 0, percent: 0 });
    setError(null);

    try {
      const success = await window.electronAPI.ollama.pullModel(modelName);
      if (success) {
        await refreshStatus();
        setSelectedModel(modelName);
        await window.electronAPI.store.set('selectedModel', modelName);
        // Clear ollamaSkipped flag since user now has a model
        await window.electronAPI.store.set('ollamaSkipped', false);
      } else {
        setError(`Failed to pull model ${modelName}`);
      }
    } catch (err) {
      setError(`Failed to pull model ${modelName}`);
    } finally {
      setIsPulling(false);
      setPullProgress(null);
    }
  };

  // Change selected model
  const handleModelChange = async (modelName: string) => {
    setSelectedModel(modelName);
    if (window.electronAPI) {
      await window.electronAPI.store.set('selectedModel', modelName);
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  // Not in Electron
  if (!isElectron) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Local AI Not Available
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ollama settings are only available in the Humanizer Studio desktop app.
            In the browser, transformations use the cloud API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Status Section */}
      <div>
        <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
          Ollama Status
        </h3>

        <div
          className="rounded-lg p-4 space-y-3"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Installation Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Installation
            </span>
            <span
              className="text-sm font-medium flex items-center gap-2"
              style={{ color: status?.installed ? 'var(--success)' : 'var(--error)' }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: status?.installed ? 'var(--success)' : 'var(--error)' }}
              />
              {status?.installed ? `Installed (v${status.version || 'unknown'})` : 'Not Installed'}
            </span>
          </div>

          {/* Server Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Server
            </span>
            <span
              className="text-sm font-medium flex items-center gap-2"
              style={{ color: status?.running ? 'var(--success)' : 'var(--warning)' }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: status?.running ? 'var(--success)' : 'var(--warning)' }}
              />
              {status?.running ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* Endpoint */}
          {status?.running && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Endpoint
              </span>
              <span
                className="text-sm font-mono"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {status.endpoint}
              </span>
            </div>
          )}

          {/* Start Server Button */}
          {status?.installed && !status?.running && (
            <button
              onClick={handleStartServer}
              disabled={isStarting}
              className="w-full mt-2 py-2 px-4 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
              }}
            >
              {isStarting ? 'Starting...' : 'Start Ollama Server'}
            </button>
          )}

          {/* Install Instructions */}
          {!status?.installed && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                Ollama is not installed. Install it from:
              </p>
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium"
                style={{ color: 'var(--accent-primary)' }}
              >
                https://ollama.ai →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Installed Models */}
      {status?.installed && (
        <div>
          <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
            Installed Models
          </h3>

          {models.length === 0 ? (
            <div
              className="rounded-lg p-4 text-center"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No models installed. Download a model below to enable AI features.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.name}
                  className="rounded-lg p-3 flex items-center justify-between cursor-pointer transition-colors"
                  onClick={() => handleModelChange(model.name)}
                  style={{
                    backgroundColor:
                      selectedModel === model.name
                        ? 'var(--accent-primary)'
                        : 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={selectedModel === model.name}
                      onChange={() => handleModelChange(model.name)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <div>
                      <p
                        className="font-medium text-sm"
                        style={{
                          color:
                            selectedModel === model.name
                              ? 'white'
                              : 'var(--text-primary)',
                        }}
                      >
                        {model.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{
                          color:
                            selectedModel === model.name
                              ? 'rgba(255,255,255,0.8)'
                              : 'var(--text-tertiary)',
                        }}
                      >
                        {formatBytes(model.size)}
                      </p>
                    </div>
                  </div>
                  {selectedModel === model.name && (
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Download Models */}
      {status?.installed && status?.running && (
        <div>
          <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
            Download Models
          </h3>

          {/* Pull Progress */}
          {isPulling && pullProgress && (
            <div
              className="rounded-lg p-4 mb-4"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--accent-primary)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Downloading {pullProgress.model}
                </span>
                <span className="text-sm" style={{ color: 'var(--accent-primary)' }}>
                  {pullProgress.percent}%
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${pullProgress.percent}%`,
                    backgroundColor: 'var(--accent-primary)',
                  }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                {pullProgress.status}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {AVAILABLE_MODELS.map((model) => {
              const isInstalled = models.some((m) => m.name === model.name);
              return (
                <div
                  key={model.name}
                  className="rounded-lg p-3 flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    opacity: isInstalled ? 0.6 : 1,
                  }}
                >
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {model.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {model.size} • {model.description}
                    </p>
                  </div>
                  {isInstalled ? (
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        backgroundColor: 'var(--success)',
                        color: 'white',
                      }}
                    >
                      Installed
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePullModel(model.name)}
                      disabled={isPulling}
                      className="text-sm font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                      }}
                    >
                      Download
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className="rounded-lg p-3"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--error)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--error)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={refreshStatus}
        className="w-full py-2 px-4 rounded-lg font-medium transition-colors"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        Refresh Status
      </button>
    </div>
  );
}
