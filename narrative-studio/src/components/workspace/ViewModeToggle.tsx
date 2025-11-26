import type { Session } from '../../services/sessionStorage';
import { VIEW_MODES, VIEW_MODE_LABELS } from '../../config/view-modes';

interface ViewModeToggleProps {
  viewMode: Session['viewMode'];
  onChangeViewMode: (mode: Session['viewMode']) => void;
}

export function ViewModeToggle({ viewMode, onChangeViewMode }: ViewModeToggleProps) {
  const buttonStyle = (isActive: boolean) => ({
    padding: '6px 10px',
    fontSize: '16px',
    fontWeight: 400,
    color: isActive ? 'white' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
  });

  const handleHover = (e: React.MouseEvent<HTMLButtonElement>, isActive: boolean, isEntering: boolean) => {
    if (!isActive) {
      e.currentTarget.style.backgroundColor = isEntering ? 'var(--bg-hover)' : 'var(--bg-tertiary)';
      e.currentTarget.style.borderColor = isEntering ? 'var(--accent-primary)' : 'var(--border-color)';
    }
  };

  return (
    <div
      className="view-mode-toggle"
      style={{
        display: 'flex',
        gap: '6px',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        alignItems: 'center'
      }}
    >
      <span className="text-small" style={{ color: 'var(--text-tertiary)', marginRight: '4px', fontSize: '11px' }}>
        View:
      </span>
      <button
        onClick={() => onChangeViewMode(VIEW_MODES.SPLIT)}
        title={VIEW_MODE_LABELS[VIEW_MODES.SPLIT]}
        style={buttonStyle(viewMode === VIEW_MODES.SPLIT)}
        onMouseEnter={(e) => handleHover(e, viewMode === VIEW_MODES.SPLIT, true)}
        onMouseLeave={(e) => handleHover(e, viewMode === VIEW_MODES.SPLIT, false)}
      >
        ⇄
      </button>

      <button
        onClick={() => onChangeViewMode(VIEW_MODES.SINGLE_ORIGINAL)}
        title={VIEW_MODE_LABELS[VIEW_MODES.SINGLE_ORIGINAL]}
        style={buttonStyle(viewMode === VIEW_MODES.SINGLE_ORIGINAL)}
        onMouseEnter={(e) => handleHover(e, viewMode === VIEW_MODES.SINGLE_ORIGINAL, true)}
        onMouseLeave={(e) => handleHover(e, viewMode === VIEW_MODES.SINGLE_ORIGINAL, false)}
      >
        ◧
      </button>

      <button
        onClick={() => onChangeViewMode(VIEW_MODES.SINGLE_TRANSFORMED)}
        title={VIEW_MODE_LABELS[VIEW_MODES.SINGLE_TRANSFORMED]}
        style={buttonStyle(viewMode === VIEW_MODES.SINGLE_TRANSFORMED)}
        onMouseEnter={(e) => handleHover(e, viewMode === VIEW_MODES.SINGLE_TRANSFORMED, true)}
        onMouseLeave={(e) => handleHover(e, viewMode === VIEW_MODES.SINGLE_TRANSFORMED, false)}
      >
        ▣
      </button>
    </div>
  );
}
