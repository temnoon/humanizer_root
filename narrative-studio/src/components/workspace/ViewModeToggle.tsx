import type { Session } from '../../services/sessionStorage';

interface ViewModeToggleProps {
  viewMode: Session['viewMode'];
  onChangeViewMode: (mode: Session['viewMode']) => void;
}

export function ViewModeToggle({ viewMode, onChangeViewMode }: ViewModeToggleProps) {
  return (
    <div
      className="view-mode-toggle"
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}
    >
      <button
        onClick={() => onChangeViewMode('split')}
        className="ui-text"
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: viewMode === 'split' ? 600 : 400,
          color: viewMode === 'split' ? 'white' : 'var(--text-secondary)',
          backgroundColor: viewMode === 'split' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: `1px solid ${viewMode === 'split' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== 'split') {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (viewMode !== 'split') {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        ⟷ Split View
      </button>

      <button
        onClick={() => onChangeViewMode('single-original')}
        className="ui-text"
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: viewMode === 'single-original' ? 600 : 400,
          color: viewMode === 'single-original' ? 'white' : 'var(--text-secondary)',
          backgroundColor: viewMode === 'single-original' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: `1px solid ${viewMode === 'single-original' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== 'single-original') {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (viewMode !== 'single-original') {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        📄 Original Only
      </button>

      <button
        onClick={() => onChangeViewMode('single-transformed')}
        className="ui-text"
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: viewMode === 'single-transformed' ? 600 : 400,
          color: viewMode === 'single-transformed' ? 'white' : 'var(--text-secondary)',
          backgroundColor: viewMode === 'single-transformed' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: `1px solid ${viewMode === 'single-transformed' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (viewMode !== 'single-transformed') {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (viewMode !== 'single-transformed') {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        ✨ Result Only
      </button>
    </div>
  );
}
