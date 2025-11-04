/**
 * NarrativePane - Displays full narrative text with sentence highlighting
 *
 * Features:
 * - Current sentence highlighted with border
 * - Completed sentences with subtle background
 * - Clickable sentences to jump to specific measurement
 */

interface NarrativePaneProps {
  sentences: string[];
  currentIndex: number;
  totalSentences: number;
  onSentenceClick?: (index: number) => void;
  onReset?: () => void;
}

export function NarrativePane({ sentences, currentIndex, totalSentences, onSentenceClick, onReset }: NarrativePaneProps) {
  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      padding: 'var(--spacing-xl)',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'var(--bg-secondary)',
        paddingBottom: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        zIndex: 1,
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-sm)'
        }}>
          <h3 style={{
            color: 'var(--text-primary)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            margin: 0
          }}>
            Narrative Text
          </h3>
          {onReset && (
            <button
              onClick={onReset}
              className="btn"
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)'
        }}>
          Progress: {currentIndex} / {totalSentences} sentences
        </div>
      </div>

      <div style={{
        fontSize: 'var(--text-lg)',
        lineHeight: 1.8,
        color: 'var(--text-primary)'
      }}>
        {sentences.map((sentence, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <span
              key={index}
              onClick={() => onSentenceClick && isComplete && onSentenceClick(index)}
              style={{
                display: 'inline',
                padding: '0.125rem 0.25rem',
                margin: '0 -0.25rem',
                borderRadius: 'var(--radius-sm)',
                background: isCurrent
                  ? 'var(--highlight-current)'
                  : isComplete
                  ? 'var(--highlight-completed)'
                  : 'transparent',
                borderLeft: isCurrent ? '3px solid var(--highlight-current-border)' : 'none',
                paddingLeft: isCurrent ? '0.5rem' : '0.25rem',
                cursor: isComplete ? 'pointer' : 'default',
                opacity: isPending ? 0.5 : 1,
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (isComplete) {
                  e.currentTarget.style.background = 'var(--highlight-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (isComplete) {
                  e.currentTarget.style.background = 'var(--highlight-completed)';
                }
              }}
            >
              {sentence}
              {index < sentences.length - 1 && ' '}
            </span>
          );
        })}
      </div>
    </div>
  );
}
