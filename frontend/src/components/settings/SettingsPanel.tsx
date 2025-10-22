import { useState } from 'react';
import { useSettingsStore } from '../../store/settings';
import './SettingsPanel.css';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const settings = useSettingsStore((state) => state.settings);
  const updateEphemeralListSettings = useSettingsStore((state) => state.updateEphemeralListSettings);
  const updateFeatureSettings = useSettingsStore((state) => state.updateFeatureSettings);
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults);

  const [activeTab, setActiveTab] = useState<'ephemeral' | 'features' | 'about'>('ephemeral');

  if (!isOpen) return null;

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      resetToDefaults();
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`tab ${activeTab === 'ephemeral' ? 'active' : ''}`}
            onClick={() => setActiveTab('ephemeral')}
          >
            Working Memory
          </button>
          <button
            className={`tab ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            Features
          </button>
          <button
            className={`tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'ephemeral' && (
            <div className="settings-section">
              <h3>Working Memory Settings</h3>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.ephemeralLists.autoSaveEnabled}
                    onChange={(e) =>
                      updateEphemeralListSettings({ autoSaveEnabled: e.target.checked })
                    }
                  />
                  Enable auto-tracking on startup
                </label>
                <p className="setting-description">
                  Automatically start tracking conversations when you open the app
                </p>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.ephemeralLists.autoClearOnSave}
                    onChange={(e) =>
                      updateEphemeralListSettings({ autoClearOnSave: e.target.checked })
                    }
                  />
                  Clear working memory after saving
                </label>
                <p className="setting-description">
                  Automatically clear tracked items after saving to an interest list
                </p>
              </div>

              <div className="setting-item">
                <label htmlFor="max-items">Maximum items to track</label>
                <select
                  id="max-items"
                  value={settings.ephemeralLists.maxItems}
                  onChange={(e) =>
                    updateEphemeralListSettings({ maxItems: parseInt(e.target.value) })
                  }
                >
                  <option value="10">10 items</option>
                  <option value="25">25 items</option>
                  <option value="50">50 items</option>
                  <option value="100">100 items</option>
                </select>
                <p className="setting-description">
                  Older items will be automatically removed when this limit is reached
                </p>
              </div>

              <div className="setting-item">
                <label htmlFor="default-list-type">Default list type when saving</label>
                <select
                  id="default-list-type"
                  value={settings.ephemeralLists.defaultListType}
                  onChange={(e) =>
                    updateEphemeralListSettings({
                      defaultListType: e.target.value as 'custom' | 'ephemeral' | 'discovery',
                    })
                  }
                >
                  <option value="ephemeral">Ephemeral</option>
                  <option value="custom">Custom</option>
                  <option value="discovery">Discovery</option>
                </select>
                <p className="setting-description">
                  Default type for interest lists created from working memory
                </p>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="settings-section">
              <h3>Feature Settings</h3>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.features.enableTransformationTracking}
                    onChange={(e) =>
                      updateFeatureSettings({ enableTransformationTracking: e.target.checked })
                    }
                  />
                  Track transformations
                </label>
                <p className="setting-description">
                  Automatically track TRM transformations in working memory
                </p>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.features.enableSearchTracking}
                    onChange={(e) =>
                      updateFeatureSettings({ enableSearchTracking: e.target.checked })
                    }
                  />
                  Track searches
                </label>
                <p className="setting-description">
                  Automatically track search queries in working memory (coming soon)
                </p>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.features.enableMediaTracking}
                    onChange={(e) =>
                      updateFeatureSettings({ enableMediaTracking: e.target.checked })
                    }
                  />
                  Track media views
                </label>
                <p className="setting-description">
                  Automatically track media items you view (coming soon)
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <h3>About Humanizer</h3>
              <p>
                <strong>Version:</strong> 1.0.0
              </p>
              <p>
                <strong>ChatGPT Archive Manager</strong> with TRM Quantum Reading
              </p>
              <p>
                Humanizer helps you organize, explore, and transform your ChatGPT conversations
                using advanced text analysis and semantic search.
              </p>

              <h4>Features</h4>
              <ul>
                <li>1,659 conversations from your ChatGPT archive</li>
                <li>TRM (Tetralemma Reading Method) transformations</li>
                <li>Semantic search and exploration</li>
                <li>Interest lists and working memory</li>
                <li>AI-powered agent interface (Cmd+K)</li>
              </ul>

              <h4>Stats</h4>
              <p>
                <strong>Conversations:</strong> 1,659
                <br />
                <strong>Messages:</strong> 46,355
                <br />
                <strong>Images:</strong> 811
              </p>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="reset-button" onClick={handleReset}>
            Reset to Defaults
          </button>
          <button className="save-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
