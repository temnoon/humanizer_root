// SpeechToText - Voice input component using Web Speech API
// Mobile-optimized with visual feedback and error handling

import { useState, useEffect, useRef } from 'react';

interface SpeechToTextProps {
  onTranscript: (text: string) => void;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  buttonLabel?: string;
}

export default function SpeechToText({
  onTranscript,
  language = 'en-US',
  continuous = true,
  interimResults = true,
  buttonLabel = '🎤 Voice Input'
}: SpeechToTextProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    // Initialize recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    // Handle results
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript.trim());
      }
    };

    // Handle errors
    recognition.onerror = (event: any) => {
      console.error('[SpeechToText] Error:', event.error);

      switch (event.error) {
        case 'no-speech':
          setError('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setError('Microphone not found or not accessible.');
          break;
        case 'not-allowed':
          setError('Microphone permission denied.');
          break;
        case 'network':
          setError('Network error. Please check your connection.');
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }

      setIsListening(false);
    };

    // Handle end
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, continuous, interimResults, onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setError(null);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('[SpeechToText] Start error:', err);
        setError('Failed to start speech recognition');
      }
    }
  };

  if (!isSupported) {
    return (
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        padding: 'var(--spacing-xs)',
        textAlign: 'center'
      }}>
        Voice input not supported in this browser
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      <button
        onClick={toggleListening}
        className="btn btn-secondary"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          minHeight: '44px',
          fontSize: 'var(--text-sm)',
          background: isListening ? 'var(--accent-red)' : 'var(--bg-secondary)',
          color: isListening ? 'white' : 'var(--text-primary)',
          border: isListening ? 'none' : '1px solid var(--border-color)',
          position: 'relative',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}
        title={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {/* Pulsing animation when listening */}
        {isListening && (
          <span style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        )}

        <span style={{ position: 'relative', zIndex: 1 }}>
          {isListening ? '🎤 Listening...' : buttonLabel}
        </span>
      </button>

      {error && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--accent-red)',
          padding: 'var(--spacing-xs)',
          background: 'rgba(248, 113, 113, 0.1)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--accent-red)'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

// Add pulse animation to global styles
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.05);
    }
  }
`;
document.head.appendChild(style);
