/**
 * IntensityHelp - Help icon with tooltip for humanizer intensity settings
 *
 * Provides user guidance on what each intensity level does and when to use it.
 * Dec 2025 - Added as part of humanizer quality improvements
 */

import { useState, useRef, useEffect } from 'react';

interface IntensityHelpProps {
  className?: string;
}

const INTENSITY_HELP = {
  title: "Humanization Intensity",
  description: "Controls how much the text is modified to reduce AI detection.",
  levels: [
    {
      name: "Light (50%)",
      description: "Minimal changes. Best for text that's already mostly human-like or when you need to preserve exact wording.",
      changes: [
        "Adds some contractions (don't, it's)",
        "Replaces ~50% of AI tell-words",
        "Minor structural adjustments"
      ],
      useWhen: [
        "Text is only slightly flagged as AI",
        "You need to preserve technical accuracy",
        "Formal tone must be maintained"
      ],
      expectedDrop: "10-20 points"
    },
    {
      name: "Moderate (70%)",
      description: "Balanced approach. Good for most content while maintaining meaning.",
      changes: [
        "Consistent use of contractions",
        "Replaces ~70% of AI tell-words",
        "Varies sentence lengths",
        "Adds conversational touches"
      ],
      useWhen: [
        "General-purpose humanization",
        "Blog posts, articles, essays",
        "Professional but accessible content"
      ],
      expectedDrop: "20-35 points"
    },
    {
      name: "Aggressive (95%)",
      description: "Maximum humanization. Significantly rewrites text for casual, conversational tone.",
      changes: [
        "Heavy use of contractions",
        "Replaces ~95% of AI tell-words",
        "Major sentence restructuring",
        "Casual, conversational voice",
        "May restructure paragraphs"
      ],
      useWhen: [
        "Text scores very high on AI detection",
        "Casual/informal tone is acceptable",
        "Social media, personal blogs",
        "Content where personality matters"
      ],
      expectedDrop: "30-50 points"
    }
  ],
  tips: [
    "Start with Moderate - it works for most content",
    "If detection is still high, try Aggressive",
    "Light is best when you need minimal changes",
    "Em-dashes (—) are automatically removed at all levels"
  ]
};

export function IntensityHelp({ className }: IntensityHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} className={className}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          color: 'var(--text-tertiary)',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
        aria-label="Intensity help"
        title="Learn about intensity levels"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            zIndex: 1000,
            width: '320px',
            maxHeight: '70vh',
            overflowY: 'auto',
            padding: '12px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            top: '100%',
            left: '-12px',
            marginTop: '4px',
            fontSize: '0.75rem',
            color: 'var(--text-primary)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {INTENSITY_HELP.title}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: 'var(--text-tertiary)',
                fontSize: '1rem',
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {INTENSITY_HELP.description}
          </p>

          {/* Intensity Levels */}
          {INTENSITY_HELP.levels.map((level, idx) => (
            <div
              key={level.name}
              style={{
                marginBottom: idx < INTENSITY_HELP.levels.length - 1 ? '12px' : '8px',
                paddingBottom: idx < INTENSITY_HELP.levels.length - 1 ? '12px' : '0',
                borderBottom: idx < INTENSITY_HELP.levels.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}
            >
              <h4 style={{
                margin: '0 0 4px 0',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: idx === 1 ? 'var(--accent-primary)' : 'var(--text-primary)',
              }}>
                {level.name} {idx === 1 && <span style={{ fontWeight: 400, fontSize: '0.6875rem' }}>(Recommended)</span>}
              </h4>
              <p style={{ margin: '0 0 6px 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {level.description}
              </p>

              <div style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  What it does:
                </span>
                <ul style={{ margin: '2px 0 0 0', paddingLeft: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {level.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>

              <div style={{
                display: 'inline-block',
                padding: '2px 6px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.625rem',
                color: 'var(--accent-primary)',
                fontWeight: 500,
              }}>
                Expected: {level.expectedDrop}
              </div>
            </div>
          ))}

          {/* Tips */}
          <div style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Tips:
            </span>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {INTENSITY_HELP.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
