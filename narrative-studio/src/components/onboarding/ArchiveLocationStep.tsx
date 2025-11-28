import { useState, useEffect } from 'react';

interface ArchiveLocationStepProps {
  archivePath: string | null;
  onPathChange: (path: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ArchiveLocationStep({
  archivePath,
  onPathChange,
  onNext,
  onBack
}: ArchiveLocationStepProps) {
  const [diskSpace, setDiskSpace] = useState<{ free: number; total: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Get disk space when path changes
  useEffect(() => {
    async function checkDiskSpace() {
      if (window.electronAPI && archivePath) {
        const space = await window.electronAPI.getDiskSpace(archivePath);
        setDiskSpace(space);
      }
    }
    checkDiskSpace();
  }, [archivePath]);

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;

    setIsSelecting(true);
    try {
      const selectedPath = await window.electronAPI.selectFolder();
      if (selectedPath) {
        onPathChange(selectedPath);
      }
    } finally {
      setIsSelecting(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const isValidPath = archivePath && archivePath.length > 0;

  return (
    <div>
      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        Choose Archive Location
      </h2>
      <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
        Select where to store your conversation archives and session data.
      </p>

      {/* Current path display */}
      <div
        className="rounded-lg p-4 mb-4"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Archive Folder
          </span>
          <button
            onClick={handleSelectFolder}
            disabled={isSelecting}
            className="text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent-primary)' }}
          >
            {isSelecting ? 'Selecting...' : 'Change'}
          </button>
        </div>
        <div
          className="font-mono text-sm p-3 rounded"
          style={{
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)'
          }}
        >
          {archivePath || 'No folder selected'}
        </div>
      </div>

      {/* Disk space info */}
      {diskSpace && diskSpace.total > 0 && (
        <div
          className="rounded-lg p-4 mb-6"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Available Space
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatBytes(diskSpace.free)} free of {formatBytes(diskSpace.total)}
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${((diskSpace.total - diskSpace.free) / diskSpace.total) * 100}%`,
                backgroundColor: diskSpace.free < 5 * 1024 * 1024 * 1024
                  ? 'var(--error)'
                  : 'var(--accent-primary)'
              }}
            />
          </div>
          {diskSpace.free < 5 * 1024 * 1024 * 1024 && (
            <p className="text-sm mt-2" style={{ color: 'var(--warning)' }}>
              Low disk space. Consider choosing a different location.
            </p>
          )}
        </div>
      )}

      {/* Info box */}
      <div
        className="rounded-lg p-4 mb-8 flex gap-3"
        style={{
          backgroundColor: 'var(--accent-primary)',
          opacity: 0.1
        }}
      >
        <svg
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--accent-primary)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            What gets stored here?
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Imported conversation archives</li>
            <li>Embedding databases for semantic search</li>
            <li>Session history and transformations</li>
          </ul>
        </div>
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
          onClick={onNext}
          disabled={!isValidPath}
          className="px-6 py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
