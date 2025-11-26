/**
 * Theme Toggle Component
 *
 * Unobtrusive button in top-right corner to toggle light/dark/system themes.
 */

import { Component, Show, createSignal } from 'solid-js';
import { themeStore, type ThemeMode } from '@/stores/theme';

interface ThemeToggleProps {
  class?: string;
}

export const ThemeToggle: Component<ThemeToggleProps> = (props) => {
  const [showMenu, setShowMenu] = createSignal(false);

  // Show icon based on RESOLVED theme (effective appearance), not selected mode
  const getIcon = () => {
    const resolved = themeStore.resolved();
    return resolved === 'dark' ? '🌙' : '☀️';
  };

  const getLabel = () => {
    const mode = themeStore.mode();
    const resolved = themeStore.resolved();
    if (mode === 'system') return `System (${resolved})`;
    return resolved === 'dark' ? 'Dark' : 'Light';
  };

  const handleSelect = (mode: ThemeMode) => {
    themeStore.setMode(mode);
    setShowMenu(false);
  };

  return (
    <div class={`theme-toggle-container ${props.class || ''}`}>
      <button
        class="theme-toggle-btn"
        onClick={() => setShowMenu(!showMenu())}
        title={`Theme: ${getLabel()}`}
        aria-label="Toggle theme"
      >
        <span class="theme-icon">{getIcon()}</span>
      </button>

      <Show when={showMenu()}>
        <div class="theme-menu" onClick={() => setShowMenu(false)}>
          <button
            class={`theme-option ${themeStore.mode() === 'light' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect('light'); }}
          >
            <span class="option-icon">☀️</span>
            <span class="option-label">Light</span>
          </button>
          <button
            class={`theme-option ${themeStore.mode() === 'dark' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect('dark'); }}
          >
            <span class="option-icon">🌙</span>
            <span class="option-label">Dark</span>
          </button>
          <button
            class={`theme-option ${themeStore.mode() === 'system' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect('system'); }}
          >
            <span class="option-icon">💻</span>
            <span class="option-label">System</span>
          </button>
        </div>
      </Show>

      {/* Click outside to close */}
      <Show when={showMenu()}>
        <div class="theme-backdrop" onClick={() => setShowMenu(false)} />
      </Show>
    </div>
  );
};

export default ThemeToggle;
