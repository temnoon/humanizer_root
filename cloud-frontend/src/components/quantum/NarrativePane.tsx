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
  onSentenceClick?: (index: number) => void;
}

export function NarrativePane({ sentences, currentIndex, onSentenceClick }: NarrativePaneProps) {
  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      padding: 'var(--spacing-xl)',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)'
    }}>
      <h3 style={{
        color: 'var(--text-primary)',
        fontSize: 'var(--text-xl)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-lg)',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-secondary)',
        paddingBottom: 'var(--spacing-sm)',
        zIndex: 1
      }}>
        Narrative Text
      </h3>

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
