import { useState, useRef } from 'react';

interface SplitClickButtonProps {
  label: string;
  onTopClick: () => void;
  onBottomClick: () => void;
  sortDirection: 'asc' | 'desc' | null;
  isActive: boolean;
}

export function SplitClickButton({
  label,
  onTopClick,
  onBottomClick,
  sortDirection,
  isActive,
}: SplitClickButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const midPoint = rect.height / 2;

    if (clickY < midPoint) {
      onTopClick();
    } else {
      onBottomClick();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const touchY = event.touches[0].clientY - rect.top;
    const midPoint = rect.height / 2;

    if (touchY < midPoint) {
      onTopClick();
    } else {
      onBottomClick();
    }

    event.preventDefault();
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="tag relative"
      style={{
        backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
        color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
        border: '1px solid',
        borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
        fontWeight: 600,
        paddingRight: '2rem', // Extra space for chevrons
        minHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span>{label}</span>
      {(isHovered || isActive) && (
        <span
          className="flex flex-col absolute right-2 leading-none"
          style={{
            fontSize: '0.625rem',
          }}
        >
          <span
            style={{
              color: sortDirection === 'asc' && isActive
                ? 'var(--accent-salmon)'
                : 'var(--text-secondary)',
              opacity: sortDirection === 'asc' && isActive ? 1 : 0.5,
            }}
          >
            ▲
          </span>
          <span
            style={{
              color: sortDirection === 'desc' && isActive
                ? 'var(--accent-salmon)'
                : 'var(--text-secondary)',
              opacity: sortDirection === 'desc' && isActive ? 1 : 0.5,
              marginTop: '2px',
            }}
          >
            ▼
          </span>
        </span>
      )}
    </button>
  );
}
