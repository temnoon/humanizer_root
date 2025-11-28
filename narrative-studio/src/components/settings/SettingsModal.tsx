import { useState, useEffect } from 'react';
import { OllamaSettings } from './OllamaSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'ollama' | 'archive' | 'appearance';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ollama');

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'ollama', label: 'Local AI', icon: '🤖' },
    { id: 'archive', label: 'Archive', icon: '📁' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[700px] md:max-h-[80vh] z-50 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-tertiary)',
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div
            className="w-48 p-2 flex-shrink-0"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderRight: '1px solid var(--border-color)',
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor:
                    activeTab === tab.id
                      ? 'var(--accent-primary)'
                      : 'transparent',
                  color:
                    activeTab === tab.id
                      ? 'white'
                      : 'var(--text-secondary)',
                }}
              >
                <span>{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'ollama' && <OllamaSettings />}

            {activeTab === 'archive' && (
              <div className="p-6">
                <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                  Archive Settings
                </h3>
                <ArchiveSettings />
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="p-6">
                <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                  Appearance
                </h3>
                <AppearanceSettings />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Archive path settings (Electron only)
 */
function ArchiveSettings() {
  const [archivePath, setArchivePath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isElectron = !!window.isElectron;

  // Load current archive path
  useEffect(() => {
    async function load() {
      if (window.electronAPI) {
        const path = await window.electronAPI.getArchivePath();
        setArchivePath(path || '');
      }
      setIsLoading(false);
    }
    load();
  }, []);

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;

    setError(null);
    setSuccess(null);

    const path = await window.electronAPI.selectFolder();
    if (path) {
      setArchivePath(path);
      setIsRestarting(true);

      // Restart the archive server with the new path
      const result = await window.electronAPI.restartArchiveServer(path);

      setIsRestarting(false);

      if (result.success) {
        setSuccess(`Archive path updated. Server running on port ${result.port}.`);
      } else {
        setError(result.error || 'Failed to restart archive server');
      }
    }
  };

  if (!isElectron) {
    return (
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Archive settings are only available in the desktop app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
          Archive Location
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={archivePath || 'Not configured'}
            readOnly
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: archivePath ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          />
          <button
            onClick={handleSelectFolder}
            disabled={isRestarting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
            }}
          >
            {isRestarting ? 'Restarting...' : 'Browse'}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Select the folder containing your parsed ChatGPT export (with conversation folders like 2024-01-01_Title).
        </p>

        {/* Status messages */}
        {error && (
          <div
            className="mt-3 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="mt-3 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid var(--accent-green)',
              color: 'var(--accent-green)',
            }}
          >
            {success}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Appearance settings (theme, text size)
 */
function AppearanceSettings() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Theme and appearance settings are managed via the theme toggle in the top bar.
      </p>
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          More appearance options coming soon:
        </p>
        <ul className="text-sm mt-2 space-y-1" style={{ color: 'var(--text-tertiary)' }}>
          <li>• Font size preferences</li>
          <li>• Accent color customization</li>
          <li>• Panel layout options</li>
        </ul>
      </div>
    </div>
  );
}
