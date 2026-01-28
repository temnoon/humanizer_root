/**
 * HarvestTool - Content Extraction Interface
 *
 * Enables harvesting content from the archive for drafting:
 * - Collect passages from search results
 * - Organize harvested content
 * - Export to drafting workflow
 * - Manage harvest baskets
 *
 * @module @humanizer/studio/components/tools/HarvestTool
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { HarvestedItem } from './ToolsPane';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface HarvestToolProps {
  /** Archive ID for context */
  archiveId?: string;
  /** Currently selected content IDs */
  selectedContentIds?: string[];
  /** Called when content is harvested */
  onContentHarvested?: (items: HarvestedItem[]) => void;
  /** Optional class name */
  className?: string;
}

interface HarvestBasket {
  id: string;
  name: string;
  items: HarvestedItem[];
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'humanizer-harvest-baskets';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function HarvestTool({
  archiveId,
  selectedContentIds = [],
  onContentHarvested,
  className = '',
}: HarvestToolProps): React.ReactElement {
  // State
  const [baskets, setBaskets] = useState<HarvestBasket[]>([]);
  const [activeBasketId, setActiveBasketId] = useState<string | null>(null);
  const [newBasketName, setNewBasketName] = useState('');
  const [isCreatingBasket, setIsCreatingBasket] = useState(false);

  // Get active basket
  const activeBasket = useMemo(
    () => baskets.find((b) => b.id === activeBasketId) ?? null,
    [baskets, activeBasketId]
  );

  // Check if content is selected
  const hasSelection = selectedContentIds.length > 0;

  // Create new basket
  const handleCreateBasket = useCallback(() => {
    if (!newBasketName.trim()) return;

    const basket: HarvestBasket = {
      id: crypto.randomUUID(),
      name: newBasketName.trim(),
      items: [],
      createdAt: new Date(),
    };

    setBaskets((prev) => [...prev, basket]);
    setActiveBasketId(basket.id);
    setNewBasketName('');
    setIsCreatingBasket(false);
  }, [newBasketName]);

  // Add selected content to basket
  const handleAddToBasket = useCallback(async () => {
    if (!activeBasket || !hasSelection) return;

    // TODO: Fetch actual content for selected IDs
    // For now, create placeholder items
    const newItems: HarvestedItem[] = selectedContentIds.map((id) => ({
      id,
      content: `[Content from ${id}]`,
      source: archiveId ?? 'unknown',
      addedAt: new Date(),
    }));

    setBaskets((prev) =>
      prev.map((b) =>
        b.id === activeBasket.id
          ? { ...b, items: [...b.items, ...newItems] }
          : b
      )
    );

    onContentHarvested?.(newItems);
  }, [activeBasket, hasSelection, selectedContentIds, archiveId, onContentHarvested]);

  // Remove item from basket
  const handleRemoveItem = useCallback((itemId: string) => {
    if (!activeBasket) return;

    setBaskets((prev) =>
      prev.map((b) =>
        b.id === activeBasket.id
          ? { ...b, items: b.items.filter((i) => i.id !== itemId) }
          : b
      )
    );
  }, [activeBasket]);

  // Delete basket
  const handleDeleteBasket = useCallback((basketId: string) => {
    setBaskets((prev) => prev.filter((b) => b.id !== basketId));
    if (activeBasketId === basketId) {
      setActiveBasketId(null);
    }
  }, [activeBasketId]);

  // Export basket to drafting
  const handleExportToDraft = useCallback(() => {
    if (!activeBasket || activeBasket.items.length === 0) return;

    // TODO: Wire to drafting service
    // For now, just log
    console.log('Export to draft:', activeBasket);
  }, [activeBasket]);

  // Clear basket
  const handleClearBasket = useCallback(() => {
    if (!activeBasket) return;

    setBaskets((prev) =>
      prev.map((b) =>
        b.id === activeBasket.id ? { ...b, items: [] } : b
      )
    );
  }, [activeBasket]);

  return (
    <div className={`harvest-tool ${className}`}>
      {/* Basket Selector */}
      <div className="harvest-tool__baskets">
        <div className="harvest-tool__baskets-header">
          <span>Harvest Baskets</span>
          <button
            className="harvest-tool__add-basket"
            onClick={() => setIsCreatingBasket(true)}
            aria-label="Create new basket"
          >
            +
          </button>
        </div>

        {/* Create Basket Form */}
        {isCreatingBasket && (
          <div className="harvest-tool__create-basket">
            <input
              type="text"
              className="harvest-tool__basket-input"
              placeholder="Basket name..."
              value={newBasketName}
              onChange={(e) => setNewBasketName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBasket();
                if (e.key === 'Escape') setIsCreatingBasket(false);
              }}
              autoFocus
            />
            <button
              className="harvest-tool__btn harvest-tool__btn--small"
              onClick={handleCreateBasket}
              disabled={!newBasketName.trim()}
            >
              Create
            </button>
            <button
              className="harvest-tool__btn harvest-tool__btn--small harvest-tool__btn--secondary"
              onClick={() => setIsCreatingBasket(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Basket List */}
        <div className="harvest-tool__basket-list" role="listbox" aria-label="Harvest baskets">
          {baskets.length === 0 && !isCreatingBasket ? (
            <div className="harvest-tool__empty-baskets">
              No baskets yet. Create one to start harvesting.
            </div>
          ) : (
            baskets.map((basket) => (
              <div
                key={basket.id}
                className={`harvest-basket ${activeBasketId === basket.id ? 'harvest-basket--active' : ''}`}
                role="option"
                aria-selected={activeBasketId === basket.id}
                onClick={() => setActiveBasketId(basket.id)}
              >
                <span className="harvest-basket__icon" aria-hidden="true">🧺</span>
                <span className="harvest-basket__name">{basket.name}</span>
                <span className="harvest-basket__count">{basket.items.length}</span>
                <button
                  className="harvest-basket__delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBasket(basket.id);
                  }}
                  aria-label={`Delete ${basket.name}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Basket Content */}
      {activeBasket && (
        <div className="harvest-tool__content">
          <div className="harvest-tool__content-header">
            <h3 className="harvest-tool__content-title">{activeBasket.name}</h3>
            <span className="harvest-tool__content-count">
              {activeBasket.items.length} item{activeBasket.items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Add Selection Button */}
          {hasSelection && (
            <button
              className="harvest-tool__btn harvest-tool__btn--add"
              onClick={handleAddToBasket}
            >
              <span aria-hidden="true">+</span>
              Add {selectedContentIds.length} selected
            </button>
          )}

          {/* Item List */}
          <div className="harvest-tool__items">
            {activeBasket.items.length === 0 ? (
              <div className="harvest-tool__empty-items">
                <span aria-hidden="true">🌾</span>
                <p>Basket is empty</p>
                <p className="harvest-tool__empty-hint">
                  Select content and click "Add" to harvest
                </p>
              </div>
            ) : (
              activeBasket.items.map((item) => (
                <div key={item.id} className="harvest-item">
                  <div className="harvest-item__content">
                    {item.content.length > 100
                      ? `${item.content.substring(0, 100)}...`
                      : item.content}
                  </div>
                  <div className="harvest-item__meta">
                    <span className="harvest-item__source">{item.source}</span>
                    <button
                      className="harvest-item__remove"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label="Remove from basket"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Basket Actions */}
          {activeBasket.items.length > 0 && (
            <div className="harvest-tool__actions">
              <button
                className="harvest-tool__btn harvest-tool__btn--secondary"
                onClick={handleClearBasket}
              >
                Clear
              </button>
              <button
                className="harvest-tool__btn harvest-tool__btn--primary"
                onClick={handleExportToDraft}
              >
                Export to Draft
              </button>
            </div>
          )}
        </div>
      )}

      {/* Placeholder when no basket selected */}
      {!activeBasket && baskets.length > 0 && (
        <div className="harvest-tool__placeholder">
          <span aria-hidden="true">🧺</span>
          <p>Select a basket</p>
          <p className="harvest-tool__placeholder-hint">
            Choose a basket to view and manage harvested content
          </p>
        </div>
      )}

      {/* Initial State */}
      {baskets.length === 0 && !isCreatingBasket && (
        <div className="harvest-tool__placeholder">
          <span aria-hidden="true">🌾</span>
          <p>Start harvesting content</p>
          <p className="harvest-tool__placeholder-hint">
            Create a basket to collect content for your drafts
          </p>
        </div>
      )}
    </div>
  );
}

export default HarvestTool;
