// TextToSpeech - Read text aloud using Web Speech API
// Mobile-optimized for reviewing transformations on-the-go

import { useState, useEffect, useRef } from 'react';

interface TextToSpeechProps {
  text: string;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  buttonLabel?: string;
  autoPlay?: boolean;
}

export default function TextToSpeech({
  text,
  language = 'en-US',
  rate = 1.0,
  pitch = 1.0,
  volume = 1.0,
  buttonLabel = '🔊 Listen',
  autoPlay = false
}: TextToSpeechProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [progress, setProgress] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    return () => {
      // Cleanup on unmount
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (autoPlay && text && isSupported) {
      handleSpeak();
    }
  }, [autoPlay, text, isSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpeak = () => {
    if (!text.trim()) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Track progress (approximate based on word count)
    const words = text.split(/\s+/).length;
    const estimatedDuration = (words / (rate * 150)) * 60 * 1000; // ~150 words/min at rate 1.0
    let startTime = Date.now();

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min((elapsed / estimatedDuration) * 100, 100);
      setProgress(currentProgress);

      if (currentProgress >= 100 || !window.speechSynthesis.speaking) {
        clearInterval(progressInterval);
        setProgress(0);
      }
    }, 100);

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      startTime = Date.now();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setProgress(0);
      clearInterval(progressInterval);
    };

    utterance.onerror = (event) => {
      console.error('[TextToSpeech] Error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
      setProgress(0);
      clearInterval(progressInterval);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setProgress(0);
  };

  if (!isSupported) {
    return null; // Gracefully hide if not supported
  }

  if (!text.trim()) {
    return null; // Hide if no text
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-xs)',
      width: '100%'
    }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
        {!isSpeaking ? (
          <button
            onClick={handleSpeak}
            className="btn btn-secondary"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              minHeight: '44px',
              fontSize: 'var(--text-sm)',
              flex: 1,
              whiteSpace: 'nowrap'
            }}
            title="Read text aloud"
          >
            {buttonLabel}
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button
                onClick={handlePause}
                className="btn btn-secondary"
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  minHeight: '44px',
                  fontSize: 'var(--text-sm)',
                  flex: 1,
                  whiteSpace: 'nowrap'
                }}
                title="Pause"
              >
                ⏸️ Pause
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="btn btn-secondary"
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  minHeight: '44px',
                  fontSize: 'var(--text-sm)',
                  flex: 1,
                  background: 'var(--accent-purple)',
                  color: 'white',
                  border: 'none',
                  whiteSpace: 'nowrap'
                }}
                title="Resume"
              >
                ▶️ Resume
              </button>
            )}
            <button
              onClick={handleStop}
              className="btn btn-secondary"
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                minHeight: '44px',
                fontSize: 'var(--text-sm)',
                background: 'var(--accent-red)',
                color: 'white',
                border: 'none',
                whiteSpace: 'nowrap'
              }}
              title="Stop"
            >
              ⏹️ Stop
            </button>
          </>
        )}
      </div>

      {/* Progress bar */}
      {isSpeaking && (
        <div style={{
          width: '100%',
          height: '4px',
          background: 'var(--bg-tertiary)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: isPaused ? 'var(--accent-yellow)' : 'var(--accent-purple)',
            transition: 'width 0.1s linear'
          }} />
        </div>
      )}
    </div>
  );
}
