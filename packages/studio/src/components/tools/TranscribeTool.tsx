/**
 * TranscribeTool - Transcription Launcher
 *
 * Manages media transcription workflows:
 * - Select media items for transcription
 * - Choose transcription type (audio, OCR, caption, description)
 * - Monitor transcription job progress
 * - View and manage transcription versions
 *
 * @module @humanizer/studio/components/tools/TranscribeTool
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  useMedia,
  useMediaSelection,
  type TranscriptionJob,
  type TranscriptionStatus,
  type TranscriptionType as MediaTranscriptionType,
} from '../../contexts/MediaContext';
import type { TranscriptionType } from './ToolsPane';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TranscribeToolProps {
  /** Archive ID for context */
  archiveId?: string;
  /** Called when transcription is requested */
  onRequestTranscription?: (mediaId: string, archiveId: string, type: TranscriptionType) => void;
  /** Optional class name */
  className?: string;
}

interface TranscriptionOption {
  id: TranscriptionType;
  label: string;
  icon: string;
  description: string;
  supportedTypes: ('audio' | 'video' | 'image')[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TRANSCRIPTION_OPTIONS: TranscriptionOption[] = [
  {
    id: 'audio',
    label: 'Audio Transcription',
    icon: '🎙️',
    description: 'Convert speech to text using Whisper',
    supportedTypes: ['audio', 'video'],
  },
  {
    id: 'ocr',
    label: 'Text Extraction (OCR)',
    icon: '📄',
    description: 'Extract text from images',
    supportedTypes: ['image'],
  },
  {
    id: 'caption',
    label: 'Image Caption',
    icon: '🏷️',
    description: 'Generate a brief description of the image',
    supportedTypes: ['image'],
  },
  {
    id: 'description',
    label: 'Detailed Description',
    icon: '📝',
    description: 'Generate a detailed description of visual content',
    supportedTypes: ['image', 'video'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getStatusColor(status: TranscriptionStatus): string {
  switch (status) {
    case 'completed':
      return 'var(--color-success)';
    case 'processing':
      return 'var(--color-info)';
    case 'pending':
      return 'var(--color-warning)';
    case 'failed':
      return 'var(--color-error)';
    case 'cancelled':
      return 'var(--studio-text-tertiary)';
    default:
      return 'var(--studio-text-tertiary)';
  }
}

function formatStatus(status: TranscriptionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function TranscribeTool({
  archiveId,
  onRequestTranscription,
  className = '',
}: TranscribeToolProps): React.ReactElement {
  // Media context
  const { state, getJobsForMedia, addJob } = useMedia();
  const { selectedItems, selectedCount } = useMediaSelection();

  // State
  const [selectedType, setSelectedType] = useState<TranscriptionType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get active jobs
  const activeJobs = useMemo(() => {
    return Array.from(state.transcriptionJobs.values())
      .filter((job) => job.status === 'pending' || job.status === 'processing')
      .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
  }, [state.transcriptionJobs]);

  // Get available transcription options based on selected media types
  const availableOptions = useMemo(() => {
    if (selectedItems.length === 0) return TRANSCRIPTION_OPTIONS;

    const selectedTypes = new Set(selectedItems.map((item) => item.type));
    return TRANSCRIPTION_OPTIONS.filter((option) =>
      option.supportedTypes.some((type) => selectedTypes.has(type))
    );
  }, [selectedItems]);

  // Check if selection supports transcription
  const canTranscribe = selectedCount > 0 && selectedType !== null;

  // Handle transcription request
  const handleStartTranscription = useCallback(async () => {
    if (!canTranscribe || !selectedType || !archiveId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Create jobs for each selected media item
      for (const item of selectedItems) {
        // Check if transcription type is compatible with media type
        const option = TRANSCRIPTION_OPTIONS.find((o) => o.id === selectedType);
        if (!option?.supportedTypes.includes(item.type)) {
          continue; // Skip incompatible items
        }

        // Create job
        const job: TranscriptionJob = {
          id: crypto.randomUUID(),
          mediaId: item.id,
          type: selectedType as MediaTranscriptionType,
          status: 'pending',
          startedAt: new Date(),
        };

        addJob(job);

        // Notify parent
        onRequestTranscription?.(item.id, archiveId, selectedType);
      }

      // Reset selection
      setSelectedType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start transcription');
    } finally {
      setIsSubmitting(false);
    }
  }, [canTranscribe, selectedType, archiveId, selectedItems, addJob, onRequestTranscription]);

  return (
    <div className={`transcribe-tool ${className}`}>
      {/* Selection Status */}
      <div className="transcribe-tool__selection">
        {selectedCount > 0 ? (
          <div className="transcribe-tool__selection-info">
            <span className="transcribe-tool__selection-count">
              {selectedCount} media item{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="transcribe-tool__selection-types">
              {Array.from(new Set(selectedItems.map((item) => item.type))).map((type) => (
                <span key={type} className={`transcribe-tool__type-badge transcribe-tool__type-badge--${type}`}>
                  {type}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="transcribe-tool__selection-empty">
            Select media to transcribe
          </span>
        )}
      </div>

      {/* Transcription Options */}
      <div className="transcribe-tool__options">
        <div className="transcribe-tool__options-header">Transcription Type</div>
        <div className="transcribe-tool__options-list" role="listbox" aria-label="Transcription types">
          {availableOptions.map((option) => (
            <button
              key={option.id}
              className={`transcribe-option ${selectedType === option.id ? 'transcribe-option--selected' : ''}`}
              onClick={() => setSelectedType(option.id)}
              disabled={selectedCount === 0}
              role="option"
              aria-selected={selectedType === option.id}
            >
              <span className="transcribe-option__icon" aria-hidden="true">
                {option.icon}
              </span>
              <div className="transcribe-option__info">
                <span className="transcribe-option__label">{option.label}</span>
                <span className="transcribe-option__description">{option.description}</span>
              </div>
              <div className="transcribe-option__types">
                {option.supportedTypes.map((type) => (
                  <span key={type} className="transcribe-option__supported-type">
                    {type}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="transcribe-tool__error" role="alert">
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {/* Start Button */}
      <div className="transcribe-tool__actions">
        <button
          className="transcribe-tool__btn transcribe-tool__btn--primary"
          onClick={handleStartTranscription}
          disabled={!canTranscribe || isSubmitting}
        >
          {isSubmitting ? 'Starting...' : 'Start Transcription'}
        </button>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="transcribe-tool__jobs">
          <div className="transcribe-tool__jobs-header">
            Active Jobs ({activeJobs.length})
          </div>
          <div className="transcribe-tool__jobs-list">
            {activeJobs.map((job) => {
              const mediaItem = state.items.get(job.mediaId);
              return (
                <div key={job.id} className="transcribe-job">
                  <div className="transcribe-job__info">
                    <span className="transcribe-job__name">
                      {mediaItem?.filename ?? 'Unknown media'}
                    </span>
                    <span className="transcribe-job__type">{job.type}</span>
                  </div>
                  <div className="transcribe-job__status">
                    <span
                      className="transcribe-job__status-indicator"
                      style={{ backgroundColor: getStatusColor(job.status) }}
                    />
                    <span className="transcribe-job__status-text">
                      {formatStatus(job.status)}
                    </span>
                    {job.progress !== undefined && (
                      <span className="transcribe-job__progress">
                        {Math.round(job.progress)}%
                      </span>
                    )}
                  </div>
                  {job.status === 'processing' && job.progress !== undefined && (
                    <div className="transcribe-job__progress-bar">
                      <div
                        className="transcribe-job__progress-fill"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedCount === 0 && activeJobs.length === 0 && (
        <div className="transcribe-tool__placeholder">
          <span aria-hidden="true">🎙️</span>
          <p>Transcribe your media</p>
          <p className="transcribe-tool__placeholder-hint">
            Select media items from the gallery to transcribe audio, extract text, or generate descriptions
          </p>
        </div>
      )}
    </div>
  );
}

export default TranscribeTool;
