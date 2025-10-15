import { useState, useEffect } from 'react';
import api from '@/lib/api-client';
import './InterestListPanel.css';

interface InterestList {
  id: string;
  name: string;
  description?: string;
  list_type: string;
  status: string;
  current_position: number;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  item_count?: number;
  completed_count?: number;
  progress_pct?: number;
}

interface InterestListItem {
  id: string;
  list_id: string;
  position: number;
  item_type: string;
  item_uuid?: string;
  item_metadata: any;
  notes?: string;
  status: string;
  added_at: string;
}

interface InterestListPanelProps {
  onSelectItem?: (itemType: string, itemUuid: string) => void;
}

export default function InterestListPanel({ onSelectItem }: InterestListPanelProps) {
  const [lists, setLists] = useState<InterestList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<InterestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListType, setNewListType] = useState('custom');

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadListItems(selectedListId);
    }
  }, [selectedListId]);

  const loadLists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getInterestLists();
      setLists(response.lists || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lists');
      setLoading(false);
    }
  };

  const loadListItems = async (listId: string) => {
    try {
      const list = await api.getInterestList(listId);
      setListItems(list.items || []);
    } catch (err) {
      console.error('Failed to load list items:', err);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      await api.createInterestList({
        name: newListName,
        description: newListDescription || undefined,
        listType: newListType,
      });
      setNewListName('');
      setNewListDescription('');
      setNewListType('custom');
      setShowCreateModal(false);
      loadLists();
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  const handleSelectList = (listId: string) => {
    setSelectedListId(selectedListId === listId ? null : listId);
  };

  const handleSelectItem = (item: InterestListItem) => {
    if (onSelectItem && item.item_uuid) {
      onSelectItem(item.item_type, item.item_uuid);
    }
  };

  if (loading) {
    return (
      <div className="interest-list-panel">
        <div className="panel-loading">
          <div className="loading-spinner"></div>
          <p>Loading lists...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="interest-list-panel">
        <div className="panel-error">
          <p>⚠️ {error}</p>
          <button onClick={loadLists}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="interest-list-panel">
      <div className="panel-header">
        <h3>Interest Lists</h3>
        <button
          className="create-list-button"
          onClick={() => setShowCreateModal(true)}
          title="Create new list"
        >
          +
        </button>
      </div>

      {showCreateModal && (
        <div className="create-modal">
          <div className="modal-content">
            <h4>Create New List</h4>
            <input
              type="text"
              placeholder="List name..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="modal-input"
            />
            <textarea
              placeholder="Description (optional)..."
              value={newListDescription}
              onChange={(e) => setNewListDescription(e.target.value)}
              className="modal-textarea"
              rows={3}
            />
            <select
              value={newListType}
              onChange={(e) => setNewListType(e.target.value)}
              className="modal-select"
            >
              <option value="custom">Custom</option>
              <option value="reading">Reading Queue</option>
              <option value="research">Research Ideas</option>
              <option value="media">Media Gallery</option>
              <option value="transformation">Transformations</option>
            </select>
            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)} className="modal-cancel">
                Cancel
              </button>
              <button onClick={handleCreateList} className="modal-submit">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lists-container">
        {lists.length === 0 ? (
          <div className="empty-state">
            <p>📝 No lists yet</p>
            <small>Create a list to organize your interests</small>
          </div>
        ) : (
          lists.map((list) => (
            <div key={list.id} className="list-card">
              <button
                className={`list-header ${selectedListId === list.id ? 'expanded' : ''}`}
                onClick={() => handleSelectList(list.id)}
              >
                <div className="list-info">
                  <div className="list-name">{list.name}</div>
                  <div className="list-meta">
                    <span className="list-count">{list.item_count || 0} items</span>
                    {list.progress_pct !== undefined && list.progress_pct > 0 && (
                      <span className="list-progress">{list.progress_pct.toFixed(0)}%</span>
                    )}
                  </div>
                </div>
                <span className="expand-icon">
                  {selectedListId === list.id ? '▼' : '▶'}
                </span>
              </button>

              {selectedListId === list.id && (
                <div className="list-items">
                  {listItems.length === 0 ? (
                    <div className="empty-items">
                      <small>No items in this list</small>
                    </div>
                  ) : (
                    listItems.map((item) => (
                      <button
                        key={item.id}
                        className={`list-item status-${item.status}`}
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className="item-icon">
                          {item.item_type === 'message' && '💬'}
                          {item.item_type === 'conversation' && '🗨️'}
                          {item.item_type === 'media' && '🖼️'}
                          {item.item_type === 'transformation' && '✨'}
                          {!['message', 'conversation', 'media', 'transformation'].includes(
                            item.item_type
                          ) && '📄'}
                        </div>
                        <div className="item-content">
                          <div className="item-preview">
                            {item.item_metadata?.content_preview ||
                              item.item_metadata?.title ||
                              'Untitled'}
                          </div>
                          {item.notes && (
                            <div className="item-notes">{item.notes}</div>
                          )}
                        </div>
                        <div className="item-status">
                          {item.status === 'completed' && '✓'}
                          {item.status === 'current' && '▶'}
                          {item.status === 'skipped' && '⊘'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
