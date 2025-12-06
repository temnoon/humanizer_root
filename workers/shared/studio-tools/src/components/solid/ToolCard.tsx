/**
 * ToolCard - Clickable card representing a single tool
 */

import { Component, Show } from 'solid-js';
import type { ToolDefinition } from '../../types';

export interface ToolCardProps {
  tool: ToolDefinition;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}

export const ToolCard: Component<ToolCardProps> = (props) => {
  const handleClick = () => {
    if (!props.disabled) {
      props.onClick();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      class="st-tool-card"
      classList={{
        'st-tool-card--selected': props.selected,
        'st-tool-card--disabled': props.disabled,
      }}
      style={{ '--tool-color': props.tool.color ?? 'var(--accent-color)' }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={props.disabled ? -1 : 0}
      aria-pressed={props.selected}
      aria-disabled={props.disabled}
      title={props.disabled ? props.disabledReason : props.tool.description}
    >
      <div class="st-tool-card__icon">
        {props.tool.icon}
      </div>

      <div class="st-tool-card__content">
        <h4 class="st-tool-card__name">{props.tool.name}</h4>
        <p class="st-tool-card__description">{props.tool.description}</p>
      </div>

      <Show when={props.disabled && props.disabledReason}>
        <div class="st-tool-card__lock">
          <span class="st-tool-card__lock-icon">🔒</span>
        </div>
      </Show>

      <Show when={props.tool.tier !== 'free'}>
        <div class="st-tool-card__tier" classList={{
          'st-tool-card__tier--pro': props.tool.tier === 'pro',
          'st-tool-card__tier--premium': props.tool.tier === 'premium',
        }}>
          {props.tool.tier.toUpperCase()}
        </div>
      </Show>
    </div>
  );
};
