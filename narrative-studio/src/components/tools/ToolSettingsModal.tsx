/**
 * ToolSettingsModal - Manage tool visibility and favorites
 *
 * Allows users to:
 * - Hide/show individual tools
 * - Mark tools as favorites (appear first in nav)
 */

import { TOOL_REGISTRY, useToolTabs, type ToolId } from '../../contexts/ToolTabContext';
import './ToolSettingsModal.css';

interface ToolSettingsModalProps {
  onClose: () => void;
}

export function ToolSettingsModal({ onClose }: ToolSettingsModalProps) {
  const {
    isToolHidden,
    isToolFavorite,
    toggleToolHidden,
    toggleToolFavorite,
  } = useToolTabs();

  // Separate admin tools
  const userTools = TOOL_REGISTRY.filter(t => t.id !== 'admin-profiles');

  return (
    <div className="tool-settings-modal__overlay" onClick={onClose}>
      <div className="tool-settings-modal" onClick={e => e.stopPropagation()}>
        <header className="tool-settings-modal__header">
          <h2 className="tool-settings-modal__title">Manage Tools</h2>
          <button
            className="tool-settings-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="tool-settings-modal__description">
          Star your favorite tools to pin them first. Hide tools you don't use.
        </p>

        <div className="tool-settings-modal__list">
          {userTools.map(tool => {
            const hidden = isToolHidden(tool.id);
            const favorite = isToolFavorite(tool.id);

            return (
              <div
                key={tool.id}
                className={`tool-settings-modal__item ${hidden ? 'tool-settings-modal__item--hidden' : ''}`}
              >
                <div className="tool-settings-modal__item-info">
                  <span className="tool-settings-modal__item-icon">{tool.icon}</span>
                  <div className="tool-settings-modal__item-text">
                    <span className="tool-settings-modal__item-label">{tool.label}</span>
                    <span className="tool-settings-modal__item-desc">{tool.description}</span>
                  </div>
                </div>

                <div className="tool-settings-modal__item-actions">
                  {/* Favorite toggle */}
                  <button
                    className={`tool-settings-modal__star ${favorite ? 'tool-settings-modal__star--active' : ''}`}
                    onClick={() => toggleToolFavorite(tool.id)}
                    title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                    disabled={hidden}
                  >
                    {favorite ? '★' : '☆'}
                  </button>

                  {/* Visibility toggle */}
                  <button
                    className={`tool-settings-modal__toggle ${hidden ? 'tool-settings-modal__toggle--hidden' : ''}`}
                    onClick={() => toggleToolHidden(tool.id)}
                    title={hidden ? 'Show tool' : 'Hide tool'}
                  >
                    {hidden ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="tool-settings-modal__footer">
          <button
            className="tool-settings-modal__done"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
