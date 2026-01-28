/**
 * TranscriptionPanel - Transcription Version List and Segments
 *
 * Displays transcription versions and their content:
 * - Version selector with model badges
 * - Timestamped segment list (for audio/video)
 * - Sync with media player
 * - Set preferred version
 * - Full text view for non-timestamped content
 *
 * @module @humanizer/studio/components/media/TranscriptionPanel
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TranscriptionPanelProps {
  /** Media ID to show transcriptions for */
  mediaId: string;
  /** Archive ID for context */
  archiveId?: string;
  /** Current playback time (for highlighting active segment) */
  currentTime?: number;
  /** Called when segment is clicked (for seeking) */
  onSegmentClick?: (startTime: number) => void;
  /** Called when transcription is requested */
  onRequestTranscription?: () => void;
  /** Optional class name */
  className?: string;
}

/** Transcription version data */
interface TranscriptionVersion {
  id: string;
  versionNumber: number;
  type: 'audio' | 'ocr' | 'caption' | 'description' | 'manual';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  segments?: TranscriptionSegment[];
  model: {
    id: string;
    provider: string;
    variant?: string;
  };
  isPreferred: boolean;
  completedAt?: Date;
  confidence?: number;
  language?: string;
}

/** Transcription segment */
interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
  speaker?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Format timestamp */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format date */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Get provider color class */
function getProviderClass(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'ollama':
      return 'model-badge--ollama';
    case 'openai':
      return 'model-badge--openai';
    case 'anthropic':
      return 'model-badge--anthropic';
    case 'google':
      return 'model-badge--google';
    case 'cloudflare':
      return 'model-badge--cloudflare';
    default:
      return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function TranscriptionPanel({
  mediaId,
  archiveId,
  currentTime,
  onSegmentClick,
  onRequestTranscription,
  className = '',
}: TranscriptionPanelProps): React.ReactElement {
  // State
  const [versions, setVersions] = useState<TranscriptionVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const segmentsRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLButtonElement>(null);

  // Load versions
  useEffect(() => {
    const loadVersions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: Wire to API - GET /api/transcriptions/{mediaId}
        // For now, use empty placeholder
        await new Promise((resolve) => setTimeout(resolve, 300));
        setVersions([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transcriptions');
      } finally {
        setIsLoading(false);
      }
    };

    loadVersions();
  }, [mediaId, archiveId]);

  // Auto-select preferred version
  useEffect(() => {
    if (versions.length > 0 && !selectedVersionId) {
      const preferred = versions.find((v) => v.isPreferred) || versions[0];
      setSelectedVersionId(preferred.id);
    }
  }, [versions, selectedVersionId]);

  // Get selected version
  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  // Find active segment based on current time
  const activeSegmentId = useMemo(() => {
    if (!selectedVersion?.segments || currentTime === undefined) return null;

    const segment = selectedVersion.segments.find(
      (s) => currentTime >= s.start && currentTime < s.end
    );
    return segment?.id ?? null;
  }, [selectedVersion, currentTime]);

  // Scroll active segment into view
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentId]);

  // Handle segment click
  const handleSegmentClick = useCallback(
    (segment: TranscriptionSegment) => {
      onSegmentClick?.(segment.start);
    },
    [onSegmentClick]
  );

  // Handle version selection
  const handleVersionSelect = useCallback((versionId: string) => {
    setSelectedVersionId(versionId);
  }, []);

  // Handle set preferred
  const handleSetPreferred = useCallback(async (versionId: string) => {
    try {
      // TODO: Wire to API - POST /api/transcriptions/{versionId}/prefer
      setVersions((prev) =>
        prev.map((v) => ({
          ...v,
          isPreferred: v.id === versionId,
        }))
      );
    } catch (err) {
      console.error('Failed to set preferred version:', err);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={`transcription-panel transcription-panel--loading ${className}`}>
        <div className="transcription-panel__loading">
          <span className="transcription-panel__spinner" />
          Loading transcriptions...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`transcription-panel transcription-panel--error ${className}`}>
        <div className="transcription-panel__error">
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      </div>
    );
  }

  // Empty state
  if (versions.length === 0) {
    return (
      <div className={`transcription-panel transcription-panel--empty ${className}`}>
        <div className="transcription-panel__empty">
          <span aria-hidden="true">📝</span>
          <p>No transcriptions yet</p>
          {onRequestTranscription && (
            <button
              className="transcription-panel__request-btn"
              onClick={onRequestTranscription}
            >
              Create Transcription
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`transcription-panel ${className}`}>
      {/* Version Selector */}
      <div className="transcription-versions">
        {versions.map((version) => (
          <button
            key={version.id}
            className={`transcription-version-chip ${selectedVersionId === version.id ? 'transcription-version-chip--selected' : ''} ${version.isPreferred ? 'transcription-version-chip--preferred' : ''}`}
            onClick={() => handleVersionSelect(version.id)}
            aria-pressed={selectedVersionId === version.id}
          >
            <span className={`model-badge ${getProviderClass(version.model.provider)}`}>
              <span className="model-badge__provider">{version.model.provider}</span>
              <span className="model-badge__name">{version.model.variant || version.model.id}</span>
            </span>
            {version.isPreferred && (
              <span className="transcription-version-chip__preferred" aria-label="Preferred">
                ★
              </span>
            )}
            {version.completedAt && (
              <span className="transcription-version-chip__date">
                {formatDate(version.completedAt)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Version Actions */}
      {selectedVersion && (
        <div className="transcription-panel__version-info">
          <div className="transcription-panel__version-meta">
            <span className="transcription-panel__type">{selectedVersion.type}</span>
            {selectedVersion.language && (
              <span className="transcription-panel__language">{selectedVersion.language}</span>
            )}
            {selectedVersion.confidence !== undefined && (
              <span className="transcription-panel__confidence">
                {Math.round(selectedVersion.confidence * 100)}% confidence
              </span>
            )}
          </div>
          {!selectedVersion.isPreferred && (
            <button
              className="transcription-panel__prefer-btn"
              onClick={() => handleSetPreferred(selectedVersion.id)}
            >
              Set as Preferred
            </button>
          )}
        </div>
      )}

      {/* Segments or Full Text */}
      {selectedVersion?.status === 'completed' && (
        <div ref={segmentsRef} className="transcription-segments">
          {selectedVersion.segments && selectedVersion.segments.length > 0 ? (
            // Timestamped segments
            selectedVersion.segments.map((segment) => {
              const isActive = segment.id === activeSegmentId;
              return (
                <button
                  key={segment.id}
                  ref={isActive ? activeSegmentRef : undefined}
                  className={`transcription-segment ${isActive ? 'transcription-segment--active' : ''}`}
                  onClick={() => handleSegmentClick(segment)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="transcription-segment__timestamp">
                    {formatTimestamp(segment.start)}
                  </span>
                  <span className="transcription-segment__text">
                    {segment.speaker && (
                      <span className="transcription-segment__speaker">
                        {segment.speaker}:
                      </span>
                    )}
                    {segment.text}
                  </span>
                </button>
              );
            })
          ) : selectedVersion.text ? (
            // Full text (no timestamps)
            <div className="transcription-panel__full-text">
              {selectedVersion.text}
            </div>
          ) : (
            <div className="transcription-panel__no-content">
              No content available
            </div>
          )}
        </div>
      )}

      {/* Processing/Pending State */}
      {selectedVersion?.status === 'processing' && (
        <div className="transcription-panel__processing">
          <span className="transcription-panel__spinner" />
          Transcription in progress...
        </div>
      )}

      {selectedVersion?.status === 'pending' && (
        <div className="transcription-panel__pending">
          <span aria-hidden="true">⏳</span>
          Transcription queued
        </div>
      )}

      {selectedVersion?.status === 'failed' && (
        <div className="transcription-panel__failed">
          <span aria-hidden="true">❌</span>
          Transcription failed
          {onRequestTranscription && (
            <button
              className="transcription-panel__retry-btn"
              onClick={onRequestTranscription}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TranscriptionPanel;
