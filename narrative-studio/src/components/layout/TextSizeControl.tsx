import { useTextSize } from '../../contexts/TextSizeContext';

export function TextSizeControl() {
  const { textSize, setTextSize, decreaseTextSize, increaseTextSize } = useTextSize();

  return (
    <div className="flex items-center gap-1">
      {/* Decrease button */}
      <button
        onClick={decreaseTextSize}
        disabled={textSize === 'sm'}
        className="ui-text p-2 rounded-md transition-smooth disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
        }}
        aria-label="Decrease text size"
        title="Decrease text size"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <text x="2" y="12" fontSize="10" fontWeight="600" fontFamily="system-ui">
            A-
          </text>
        </svg>
      </button>

      {/* Size indicators */}
      <div className="flex items-center gap-1 px-2">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <button
            key={size}
            onClick={() => setTextSize(size)}
            className="w-2 h-2 rounded-full transition-smooth"
            style={{
              backgroundColor:
                textSize === size ? 'var(--accent-primary)' : 'var(--border-strong)',
            }}
            aria-label={`Set text size to ${size}`}
            title={`Text size: ${size.toUpperCase()}`}
          />
        ))}
      </div>

      {/* Increase button */}
      <button
        onClick={increaseTextSize}
        disabled={textSize === 'lg'}
        className="ui-text p-2 rounded-md transition-smooth disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
        }}
        aria-label="Increase text size"
        title="Increase text size"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <text x="1" y="13" fontSize="12" fontWeight="600" fontFamily="system-ui">
            A+
          </text>
        </svg>
      </button>
    </div>
  );
}
