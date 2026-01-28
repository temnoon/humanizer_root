/**
 * ImportView - Archive Import Wizard
 *
 * Multi-step wizard for importing archives from various sources:
 * 1. Source Selection - Choose import type
 * 2. Folder/File Selection - Browse or drag-drop
 * 3. Parsing - Real-time progress
 * 4. Preview - Review conversations, media, warnings
 * 5. Apply - Merge into existing or create new archive
 *
 * @module @humanizer/studio/components/archive/ImportView
 */

import React, { useState, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ImportViewProps {
  /** Called when import completes successfully */
  onImportComplete?: () => void;
  /** Optional class name */
  className?: string;
}

/** Import source types */
type ImportSource = 'openai' | 'claude' | 'local' | 'cloud';

/** Import wizard step */
type ImportStep = 'source' | 'select' | 'parsing' | 'preview' | 'apply';

/** Import job status */
interface ImportJob {
  id: string;
  status: 'parsing' | 'ready' | 'applying' | 'completed' | 'failed';
  progress: number;
  stats: {
    conversations: number;
    messages: number;
    media: number;
    warnings: number;
  };
  warnings?: string[];
  error?: string;
}

// Source configuration
const SOURCES: Array<{
  id: ImportSource;
  name: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'openai',
    name: 'ChatGPT Export',
    description: 'Import from OpenAI data export (conversations.json)',
    icon: '🤖',
  },
  {
    id: 'claude',
    name: 'Claude Export',
    description: 'Import from Anthropic Claude export',
    icon: '🎭',
  },
  {
    id: 'local',
    name: 'Local Folder',
    description: 'Import from a local markdown or JSON archive',
    icon: '📁',
  },
  {
    id: 'cloud',
    name: 'Cloud Backup',
    description: 'Restore from humanizer cloud backup',
    icon: '☁️',
  },
];

// Steps configuration
const STEPS: Array<{ id: ImportStep; label: string; number: number }> = [
  { id: 'source', label: 'Source', number: 1 },
  { id: 'select', label: 'Select', number: 2 },
  { id: 'parsing', label: 'Parse', number: 3 },
  { id: 'preview', label: 'Preview', number: 4 },
  { id: 'apply', label: 'Apply', number: 5 },
];

// ═══════════════════════════════════════════════════════════════════════════
// MOCK API (Replace with actual API calls)
// ═══════════════════════════════════════════════════════════════════════════

async function startImport(
  source: ImportSource,
  path: string
): Promise<{ jobId: string }> {
  // POST /api/import/archive/folder
  return { jobId: 'mock-job-id' };
}

async function getImportStatus(jobId: string): Promise<ImportJob> {
  // GET /api/import/archive/status/{jobId}
  return {
    id: jobId,
    status: 'ready',
    progress: 100,
    stats: {
      conversations: 0,
      messages: 0,
      media: 0,
      warnings: 0,
    },
  };
}

async function applyImport(
  jobId: string,
  options: { archiveId?: string; createNew?: boolean }
): Promise<void> {
  // POST /api/import/archive/apply/{jobId}
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ImportView({
  onImportComplete,
  className = '',
}: ImportViewProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<ImportStep>('source');
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get current step index
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Handle source selection
  const handleSourceSelect = useCallback((source: ImportSource) => {
    setSelectedSource(source);
    setCurrentStep('select');
  }, []);

  // Handle path selection
  const handlePathSelect = useCallback(async () => {
    if (!selectedSource || !selectedPath) return;

    setCurrentStep('parsing');
    setError(null);

    try {
      const { jobId } = await startImport(selectedSource, selectedPath);

      // Start polling for status
      pollingRef.current = setInterval(async () => {
        try {
          const status = await getImportStatus(jobId);
          setImportJob(status);

          if (status.status === 'ready' || status.status === 'failed') {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            if (status.status === 'ready') {
              setCurrentStep('preview');
            } else if (status.error) {
              setError(status.error);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to check status');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import');
      setCurrentStep('select');
    }
  }, [selectedSource, selectedPath]);

  // Handle apply
  const handleApply = useCallback(async () => {
    if (!importJob) return;

    setCurrentStep('apply');
    setError(null);

    try {
      await applyImport(importJob.id, { createNew: true });
      onImportComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply import');
    }
  }, [importJob, onImportComplete]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    switch (currentStep) {
      case 'select':
        setCurrentStep('source');
        setSelectedSource(null);
        break;
      case 'parsing':
      case 'preview':
        setCurrentStep('select');
        setImportJob(null);
        break;
      default:
        break;
    }
  }, [currentStep]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'source':
        return (
          <div className="import-sources">
            {SOURCES.map((source) => (
              <div
                key={source.id}
                className={`import-source ${
                  selectedSource === source.id ? 'import-source--selected' : ''
                }`}
                role="button"
                tabIndex={0}
                onClick={() => handleSourceSelect(source.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSourceSelect(source.id);
                }}
              >
                <span className="import-source__icon">{source.icon}</span>
                <div className="import-source__info">
                  <h3 className="import-source__name">{source.name}</h3>
                  <p className="import-source__description">{source.description}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'select':
        return (
          <div className="import-sources">
            <div className="import-source" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="archive-search-input__field" style={{ marginBottom: 'var(--space-sm)' }}>
                <span className="archive-search-input__icon">📁</span>
                <input
                  type="text"
                  className="archive-search-input__input"
                  placeholder="Enter folder path or drag & drop..."
                  value={selectedPath}
                  onChange={(e) => setSelectedPath(e.target.value)}
                  aria-label="Archive path"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                // @ts-expect-error - webkitdirectory is not in React types
                webkitdirectory=""
                directory=""
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    // Get the common parent path
                    const path = files[0].webkitRelativePath.split('/')[0];
                    setSelectedPath(path);
                  }
                }}
              />
              <button
                className="search-results__filter search-results__filter--active"
                onClick={() => fileInputRef.current?.click()}
                style={{ alignSelf: 'flex-start' }}
              >
                Browse Folder...
              </button>
            </div>
          </div>
        );

      case 'parsing':
        return (
          <div className="import-progress">
            <div className="import-progress__bar">
              <div
                className="import-progress__fill"
                style={{ width: `${importJob?.progress || 0}%` }}
              />
            </div>
            <div className="import-progress__stats">
              <div className="import-progress__stat">
                <span className="import-progress__stat-value">
                  {importJob?.stats.conversations || 0}
                </span>
                <span className="import-progress__stat-label">Conversations</span>
              </div>
              <div className="import-progress__stat">
                <span className="import-progress__stat-value">
                  {importJob?.stats.messages || 0}
                </span>
                <span className="import-progress__stat-label">Messages</span>
              </div>
              <div className="import-progress__stat">
                <span className="import-progress__stat-value">
                  {importJob?.stats.media || 0}
                </span>
                <span className="import-progress__stat-label">Media Files</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--studio-text-secondary)' }}>
              Parsing archive... {importJob?.progress || 0}%
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="import-progress">
            <div className="import-progress__stats">
              <div className="import-progress__stat">
                <span className="import-progress__stat-value">
                  {importJob?.stats.conversations || 0}
                </span>
                <span className="import-progress__stat-label">Conversations</span>
              </div>
              <div className="import-progress__stat">
                <span className="import-progress__stat-value">
                  {importJob?.stats.messages || 0}
                </span>
                <span className="import-progress__stat-label">Messages</span>
              </div>
              <div className="import-progress__stat">
                <span className="import-progress__stat-value">
                  {importJob?.stats.media || 0}
                </span>
                <span className="import-progress__stat-label">Media Files</span>
              </div>
            </div>
            {importJob?.warnings && importJob.warnings.length > 0 && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <div className="cluster-card__title" style={{ marginBottom: 'var(--space-xs)' }}>
                  ⚠️ {importJob.warnings.length} Warning{importJob.warnings.length > 1 ? 's' : ''}
                </div>
                {importJob.warnings.slice(0, 5).map((warning, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 'var(--space-xs)',
                      background: 'rgba(var(--color-warning-rgb), 0.1)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--space-xs)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {warning}
                  </div>
                ))}
                {importJob.warnings.length > 5 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-tertiary)' }}>
                    And {importJob.warnings.length - 5} more...
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'apply':
        return (
          <div className="panel__loading">
            <div className="panel__loading-spinner" />
            <div style={{ marginTop: 'var(--space-md)' }}>Applying import...</div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`import-wizard ${className}`}>
      {/* Steps indicator */}
      <div className="import-wizard__steps">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={`import-wizard__step ${
              index === currentStepIndex
                ? 'import-wizard__step--active'
                : index < currentStepIndex
                  ? 'import-wizard__step--completed'
                  : ''
            }`}
          >
            <span className="import-wizard__step-number">
              {index < currentStepIndex ? '✓' : step.number}
            </span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="import-wizard__content">
        {error && (
          <div
            style={{
              padding: 'var(--space-sm)',
              background: 'rgba(var(--color-error-rgb), 0.1)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-md)',
              color: 'var(--color-error)',
            }}
          >
            {error}
          </div>
        )}
        {renderStepContent()}
      </div>

      {/* Footer with navigation */}
      <div className="import-wizard__footer">
        <button
          className="search-results__filter"
          onClick={handleBack}
          disabled={currentStep === 'source' || currentStep === 'apply'}
        >
          ← Back
        </button>
        <div>
          {currentStep === 'select' && (
            <button
              className="search-results__filter search-results__filter--active"
              onClick={handlePathSelect}
              disabled={!selectedPath}
            >
              Start Import →
            </button>
          )}
          {currentStep === 'preview' && (
            <button
              className="search-results__filter search-results__filter--active"
              onClick={handleApply}
            >
              Apply Import →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportView;
