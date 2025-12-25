/**
 * Theme Settings Modal - Configure appearance
 */

import { createPortal } from 'react-dom';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { ThemeMode, ThemeSettings } from '../../lib/theme';

interface ThemeSettingsModalProps {
  onClose: () => void;
}

export function ThemeSettingsModal({ onClose }: ThemeSettingsModalProps) {
  const { settings, setMode, setFontFamily, setFontSize, setLineHeight, setColorAccent } = useTheme();

  const themeOptions: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'sepia', icon: '📜', label: 'Sepia' },
    { mode: 'light', icon: '☀️', label: 'Light' },
    { mode: 'dark', icon: '🌙', label: 'Dark' },
  ];

  const fontOptions: { family: ThemeSettings['fontFamily']; icon: string; label: string }[] = [
    { family: 'serif', icon: 'Aa', label: 'Serif' },
    { family: 'sans-serif', icon: 'Aa', label: 'Sans' },
    { family: 'mono', icon: '</>', label: 'Mono' },
  ];

  const sizeOptions: { size: ThemeSettings['fontSize']; icon: string; label: string }[] = [
    { size: 'small', icon: 'A', label: 'Small' },
    { size: 'medium', icon: 'A', label: 'Medium' },
    { size: 'large', icon: 'A', label: 'Large' },
  ];

  const spacingOptions: { height: ThemeSettings['lineHeight']; icon: string; label: string }[] = [
    { height: 'tight', icon: '≡', label: 'Tight' },
    { height: 'normal', icon: '☰', label: 'Normal' },
    { height: 'relaxed', icon: '⋮', label: 'Relaxed' },
  ];

  const colorOptions: { accent: ThemeSettings['colorAccent']; label: string }[] = [
    { accent: 'amber', label: 'Amber' },
    { accent: 'blue', label: 'Blue' },
    { accent: 'green', label: 'Green' },
    { accent: 'purple', label: 'Purple' },
  ];

  const modalContent = (
    <div className="theme-modal" onClick={onClose}>
      <div className="theme-modal__content" onClick={e => e.stopPropagation()}>
        <div className="theme-modal__header">
          <h2 className="theme-modal__title">Appearance</h2>
          <button className="theme-modal__close" onClick={onClose}>×</button>
        </div>

        {/* Theme Mode */}
        <div className="theme-modal__section">
          <label className="theme-modal__label">Theme</label>
          <div className="theme-modal__options">
            {themeOptions.map(opt => (
              <button
                key={opt.mode}
                className={`theme-modal__option ${settings.mode === opt.mode ? 'theme-modal__option--active' : ''}`}
                onClick={() => setMode(opt.mode)}
              >
                <span className="theme-modal__option-icon">{opt.icon}</span>
                <span className="theme-modal__option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="theme-modal__section">
          <label className="theme-modal__label">Font</label>
          <div className="theme-modal__options">
            {fontOptions.map(opt => (
              <button
                key={opt.family}
                className={`theme-modal__option ${settings.fontFamily === opt.family ? 'theme-modal__option--active' : ''}`}
                onClick={() => setFontFamily(opt.family)}
                style={{ fontFamily: opt.family === 'mono' ? 'monospace' : opt.family }}
              >
                <span className="theme-modal__option-icon">{opt.icon}</span>
                <span className="theme-modal__option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="theme-modal__section">
          <label className="theme-modal__label">Size</label>
          <div className="theme-modal__options">
            {sizeOptions.map(opt => (
              <button
                key={opt.size}
                className={`theme-modal__option ${settings.fontSize === opt.size ? 'theme-modal__option--active' : ''}`}
                onClick={() => setFontSize(opt.size)}
                style={{ fontSize: opt.size === 'small' ? '0.8rem' : opt.size === 'large' ? '1.2rem' : '1rem' }}
              >
                <span className="theme-modal__option-icon">{opt.icon}</span>
                <span className="theme-modal__option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Line Height */}
        <div className="theme-modal__section">
          <label className="theme-modal__label">Line Spacing</label>
          <div className="theme-modal__options">
            {spacingOptions.map(opt => (
              <button
                key={opt.height}
                className={`theme-modal__option ${settings.lineHeight === opt.height ? 'theme-modal__option--active' : ''}`}
                onClick={() => setLineHeight(opt.height)}
              >
                <span className="theme-modal__option-icon">{opt.icon}</span>
                <span className="theme-modal__option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div className="theme-modal__section">
          <label className="theme-modal__label">Accent Color</label>
          <div className="theme-modal__options theme-modal__options--4">
            {colorOptions.map(opt => (
              <button
                key={opt.accent}
                className={`theme-modal__option ${settings.colorAccent === opt.accent ? 'theme-modal__option--active' : ''}`}
                onClick={() => setColorAccent(opt.accent)}
              >
                <span className={`theme-modal__swatch theme-modal__swatch--${opt.accent}`} />
                <span className="theme-modal__option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render at document body level to avoid stacking context issues
  return createPortal(modalContent, document.body);
}
