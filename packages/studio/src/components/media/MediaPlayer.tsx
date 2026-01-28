/**
 * MediaPlayer - Audio/Video Player Component
 *
 * Unified player for audio and video with:
 * - Play/pause, seek, volume controls
 * - Progress bar with time display
 * - Playback speed control
 * - Sync with transcription via currentTime prop
 * - Keyboard shortcuts
 *
 * @module @humanizer/studio/components/media/MediaPlayer
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../contexts/MediaContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MediaPlayerProps {
  /** Media item to play */
  item: MediaItem;
  /** Current playback time (for external sync) */
  currentTime?: number;
  /** Called when time updates */
  onTimeUpdate?: (time: number) => void;
  /** Called when playback state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Called when media ends */
  onEnded?: () => void;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_SECONDS = 10;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MediaPlayer({
  item,
  currentTime: externalTime,
  onTimeUpdate,
  onPlayStateChange,
  onEnded,
  autoPlay = false,
  className = '',
}: MediaPlayerProps): React.ReactElement {
  // Refs
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [internalTime, setInternalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Use external time if provided, otherwise internal
  const displayTime = externalTime ?? internalTime;

  // Sync external time changes
  useEffect(() => {
    if (externalTime !== undefined && mediaRef.current) {
      const diff = Math.abs(mediaRef.current.currentTime - externalTime);
      // Only seek if difference is significant (>0.5s)
      if (diff > 0.5) {
        mediaRef.current.currentTime = externalTime;
      }
    }
  }, [externalTime]);

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) {
      const time = mediaRef.current.currentTime;
      setInternalTime(time);
      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  // Handle loaded metadata
  const handleLoadedMetadata = useCallback(() => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
    }
  }, []);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!mediaRef.current) return;

    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play();
    }
  }, [isPlaying]);

  // Handle play state changes
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlayStateChange?.(true);
  }, [onPlayStateChange]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange?.(false);
    onEnded?.();
  }, [onPlayStateChange, onEnded]);

  // Handle buffering
  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);

  // Seek functions
  const seek = useCallback((time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);

  const skipForward = useCallback(() => {
    seek(displayTime + SKIP_SECONDS);
  }, [seek, displayTime]);

  const skipBackward = useCallback(() => {
    seek(displayTime - SKIP_SECONDS);
  }, [seek, displayTime]);

  // Handle progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current) return;

      const rect = progressRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seek(percent * duration);
    },
    [seek, duration]
  );

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (mediaRef.current) {
      mediaRef.current.volume = value;
    }
    if (value > 0) {
      setIsMuted(false);
      if (mediaRef.current) {
        mediaRef.current.muted = false;
      }
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (mediaRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      mediaRef.current.muted = newMuted;
    }
  }, [isMuted]);

  // Handle playback rate change
  const handleRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = rate;
    }
  }, []);

  // Cycle playback rate
  const cyclePlaybackRate = useCallback(() => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    handleRateChange(PLAYBACK_RATES[nextIndex]);
  }, [playbackRate, handleRateChange]);

  // Keyboard shortcuts (when player is focused)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => {
            const newVol = Math.min(1, v + 0.1);
            if (mediaRef.current) mediaRef.current.volume = newVol;
            return newVol;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => {
            const newVol = Math.max(0, v - 0.1);
            if (mediaRef.current) mediaRef.current.volume = newVol;
            return newVol;
          });
          break;
        case '.':
          e.preventDefault();
          cyclePlaybackRate();
          break;
      }
    },
    [togglePlay, skipBackward, skipForward, toggleMute, cyclePlaybackRate]
  );

  // Progress percentage
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  // Common media props
  const mediaProps = {
    ref: mediaRef as React.RefObject<HTMLVideoElement & HTMLAudioElement>,
    src: item.sourceUrl,
    autoPlay,
    onTimeUpdate: handleTimeUpdate,
    onLoadedMetadata: handleLoadedMetadata,
    onPlay: handlePlay,
    onPause: handlePause,
    onEnded: handleEnded,
    onWaiting: handleWaiting,
    onCanPlay: handleCanPlay,
  };

  return (
    <div
      className={`media-player media-player--${item.type} ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label={`${item.type} player for ${item.filename}`}
    >
      {/* Media Element */}
      <div className="media-player__media">
        {item.type === 'video' ? (
          <video {...mediaProps} className="media-player__video" playsInline />
        ) : (
          <>
            <audio {...mediaProps} className="media-player__audio" />
            <div className="media-player__audio-visual">
              <span className="media-player__audio-icon" aria-hidden="true">
                🎵
              </span>
              <span className="media-player__audio-filename">{item.filename}</span>
            </div>
          </>
        )}

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="media-player__buffering">
            <span className="media-player__spinner" aria-label="Buffering" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="media-player__controls">
        {/* Play/Pause Button */}
        <button
          className="media-player__btn media-player__btn--play"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Skip Backward */}
        <button
          className="media-player__btn media-player__btn--skip"
          onClick={skipBackward}
          aria-label={`Skip back ${SKIP_SECONDS} seconds`}
        >
          ⏪
        </button>

        {/* Skip Forward */}
        <button
          className="media-player__btn media-player__btn--skip"
          onClick={skipForward}
          aria-label={`Skip forward ${SKIP_SECONDS} seconds`}
        >
          ⏩
        </button>

        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="media-player__progress"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={displayTime}
          aria-valuetext={`${formatTime(displayTime)} of ${formatTime(duration)}`}
          tabIndex={0}
        >
          <div className="media-player__progress-bar">
            <div
              className="media-player__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Time Display */}
        <div className="media-player__time">
          <span className="media-player__time-current">{formatTime(displayTime)}</span>
          <span className="media-player__time-separator">/</span>
          <span className="media-player__time-duration">{formatTime(duration)}</span>
        </div>

        {/* Volume Control */}
        <div
          className="media-player__volume"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button
            className="media-player__btn media-player__btn--volume"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          >
            {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔈' : '🔊'}
          </button>
          {showVolumeSlider && (
            <div className="media-player__volume-slider">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
              />
            </div>
          )}
        </div>

        {/* Playback Rate */}
        <button
          className="media-player__btn media-player__btn--rate"
          onClick={cyclePlaybackRate}
          aria-label={`Playback speed: ${playbackRate}x (press . to change)`}
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
}

export default MediaPlayer;
