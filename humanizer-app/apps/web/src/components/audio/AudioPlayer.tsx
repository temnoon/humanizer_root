/**
 * Audio Player - Playback control for audio files
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

export function AudioPlayer({ src, title, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        setError('Could not play audio');
        console.error('Audio playback error:', err);
      });
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audioRef.current.currentTime = percentage * duration;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleError = () => {
    setError('Failed to load audio file');
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />

      <button
        className="audio-player__btn"
        onClick={togglePlay}
        disabled={!!error}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div className="audio-player__info">
        <div className="audio-player__title">
          {title || 'Audio File'}
        </div>
        <div className="audio-player__time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div
        className="audio-player__progress"
        onClick={handleProgressClick}
      >
        <div
          className="audio-player__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {onClose && (
        <button
          className="audio-player__btn"
          onClick={onClose}
          style={{ background: 'var(--studio-border)', width: '28px', height: '28px' }}
        >
          ×
        </button>
      )}

      {error && (
        <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-secondary)', padding: '0.5rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
