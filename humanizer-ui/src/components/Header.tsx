/**
 * App Header
 * Shows branding, provider switcher, privacy indicator, theme toggle, and layout controls
 */

import React from 'react';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import './Header.css';

export function Header() {
  const { environment, provider, setProvider, isElectron } = useEnvironment();
  const { theme, setTheme } = useTheme();
  const { focusMode, toggleFocusMode, resetLayout } = useLayout();

  const handleProviderToggle = () => {
    setProvider(provider === 'local' ? 'cloudflare' : 'local');
  };

  const handleThemeToggle = () => {
    const themes: Array<typeof theme> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  const themeIcon = {
    light: '☀️',
    dark: '🌙',
    system: '💻',
  }[theme];

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-logo">
          <span className="logo-main">humanizer</span>
          <span className="logo-dot">.com</span>
        </h1>
        <div className="header-env-badge">
          {isElectron ? '🖥️ Desktop' : '☁️ Web'}
        </div>
      </div>

      <div className="header-center">
        {/* Could show current workspace/project name */}
      </div>

      <div className="header-right">
        {/* Provider Switcher */}
        <button
          className={`header-btn provider-btn ${provider === 'cloudflare' ? 'cloud-active' : 'local-active'}`}
          onClick={handleProviderToggle}
          title={provider === 'local' ? 'Using local APIs' : 'Using Cloudflare Workers'}
        >
          {provider === 'local' ? '🏠 Local' : '☁️ Cloud'}
        </button>

        {/* Privacy Indicator */}
        {provider === 'cloudflare' && (
          <div className="privacy-indicator" title="Cloud mode: Data leaves your device">
            <span className="privacy-icon">🔓</span>
            <span className="privacy-text">Cloud</span>
          </div>
        )}

        {provider === 'local' && (
          <div className="privacy-indicator local" title="Local mode: Data stays on device">
            <span className="privacy-icon">🔒</span>
            <span className="privacy-text">Private</span>
          </div>
        )}

        <div className="header-divider" />

        {/* Focus Mode Toggle */}
        <button
          className={`header-btn focus-btn ${focusMode ? 'active' : ''}`}
          onClick={toggleFocusMode}
          title={`${focusMode ? 'Exit' : 'Enter'} focus mode (⌘⇧F)`}
        >
          {focusMode ? '↙️' : '⤢'}
        </button>

        {/* Layout Reset */}
        <button
          className="header-btn layout-reset-btn"
          onClick={resetLayout}
          title="Reset layout to defaults"
        >
          ⟲
        </button>

        <div className="header-divider" />

        {/* Theme Toggle */}
        <button
          className="header-btn theme-btn"
          onClick={handleThemeToggle}
          title={`Theme: ${theme}`}
        >
          {themeIcon}
        </button>
      </div>
    </header>
  );
}
