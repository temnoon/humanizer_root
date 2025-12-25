/**
 * Theme Toggle - Quick theme switcher in top bar
 */

import { useState } from 'react';
import { useTheme } from '../../lib/theme/ThemeContext';
import { ThemeSettingsModal } from './ThemeSettingsModal';

export function ThemeToggle() {
  const { setMode, resolved } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="theme-toggle">
        <button
          className={`theme-toggle__btn ${resolved === 'sepia' ? 'theme-toggle__btn--active' : ''}`}
          onClick={() => setMode('sepia')}
          title="Sepia theme"
        >
          📜
        </button>
        <button
          className={`theme-toggle__btn ${resolved === 'light' ? 'theme-toggle__btn--active' : ''}`}
          onClick={() => setMode('light')}
          title="Light theme"
        >
          ☀️
        </button>
        <button
          className={`theme-toggle__btn ${resolved === 'dark' ? 'theme-toggle__btn--active' : ''}`}
          onClick={() => setMode('dark')}
          title="Dark theme"
        >
          🌙
        </button>
        <button
          className="theme-toggle__btn"
          onClick={() => setShowSettings(true)}
          title="Theme settings"
        >
          ⚙
        </button>
      </div>

      {showSettings && (
        <ThemeSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
