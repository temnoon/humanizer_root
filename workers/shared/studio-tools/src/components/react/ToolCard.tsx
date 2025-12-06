/** @jsxImportSource react */
/**
 * ToolCard - Clickable card representing a single tool (React version)
 */

import type { ToolDefinition } from '../../types';

export interface ToolCardProps {
  tool: ToolDefinition;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}

export function ToolCard({ tool, selected, disabled, disabledReason, onClick }: ToolCardProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const className = [
    'st-tool-card',
    selected && 'st-tool-card--selected',
    disabled && 'st-tool-card--disabled',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      style={{ '--tool-color': tool.color ?? 'var(--accent-color)' } as React.CSSProperties}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      title={disabled ? disabledReason : tool.description}
    >
      <div className="st-tool-card__icon">
        {tool.icon}
      </div>

      <div className="st-tool-card__content">
        <h4 className="st-tool-card__name">{tool.name}</h4>
        <p className="st-tool-card__description">{tool.description}</p>
      </div>

      {disabled && disabledReason && (
        <div className="st-tool-card__lock">
          <span className="st-tool-card__lock-icon">🔒</span>
        </div>
      )}

      {tool.tier !== 'free' && (
        <div className={`st-tool-card__tier st-tool-card__tier--${tool.tier}`}>
          {tool.tier.toUpperCase()}
        </div>
      )}
    </div>
  );
}
