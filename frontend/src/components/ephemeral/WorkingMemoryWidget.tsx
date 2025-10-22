import { useState } from 'react';
import { useEphemeralListStore } from '../../store/ephemeral';
import type { EphemeralItem } from '../../types/ephemeral';
import './WorkingMemoryWidget.css';

export interface WorkingMemoryWidgetProps {
  onNavigate?: (item: EphemeralItem) => void;
}

export default function WorkingMemoryWidget({ onNavigate }: WorkingMemoryWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const list = useEphemeralListStore((state) => state.list);
  const clear = useEphemeralListStore((state) => state.clear);
  const save = useEphemeralListStore((state) => state.save);
  const setAutoSave = useEphemeralListStore((state) => state.setAutoSave);

  if (!list) return null;

  const recentItems = list.items.slice(-10).reverse();
  const isTracking = list.autoSaveEnabled;

  const handleSave = async () => {
    const name = prompt('Name this list:');
    if (!name) return;

    try {
      await save(name);
      alert('List saved!');
      clear();
    } catch (err) {
      alert('Failed to save list');
    }
  };

  const handleItemClick = (item: EphemeralItem) => {
    if (onNavigate) {
      onNavigate(item);
    }
  };

  return (
    <div className="working-memory-widget">
      <button
        className={`widget-toggle ${isTracking ? 'tracking' : 'inactive'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isTracking ? '🧠' : '💤'} Working Memory ({list.items.length})
      </button>

      {isExpanded && (
        <div className="widget-content">
          <div className="widget-header">
            <h4>This Session</h4>
            <button
              onClick={() => setAutoSave(!isTracking)}
              className={isTracking ? 'tracking-button' : 'tracking-button-off'}
            >
              {isTracking ? '⏸ Pause' : '▶ Track'}
            </button>
            {list.items.length > 0 && (
              <>
                <button onClick={clear}>Clear</button>
                <button onClick={handleSave} className="save-button">
                  Save
                </button>
              </>
            )}
          </div>

          <div className="widget-items">
            {recentItems.length === 0 ? (
              <div className="empty-items">
                {isTracking
                  ? 'Navigate to conversations to start tracking'
                  : 'Click Track to start recording your activity'}
              </div>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.uuid}
                  className="widget-item"
                  onClick={() => handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleItemClick(item)}
                >
                  <span className="item-icon">
                    {item.type === 'conversation' && '💬'}
                    {item.type === 'search' && '🔍'}
                    {item.type === 'media' && '🖼️'}
                    {item.type === 'transformation' && '🔄'}
                  </span>
                  <span className="item-title">
                    {item.metadata.title || item.metadata.query || 'Untitled'}
                    {item.metadata.excerpt && (
                      <span className="item-excerpt"> - {item.metadata.excerpt}</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
