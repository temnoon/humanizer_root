/**
 * Archive Panel - Content Source Browser
 * 
 * Browse and select content from:
 * - Personal archive (uploaded conversations)
 * - Node narratives (for reference)
 * - Bookmarked passages
 */

import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { authStore } from '@/stores/auth';

interface ArchiveItem {
  id: string;
  title: string;
  type: 'conversation' | 'narrative' | 'bookmark' | 'note';
  preview: string;
  date: string;
  tags?: string[];
}

interface ArchivePanelProps {
  onSelect?: (item: ArchiveItem) => void;
  onInsert?: (content: string) => void;
}

// Mock data for now - will connect to archive API
const mockArchiveItems: ArchiveItem[] = [
  {
    id: '1',
    title: 'Husserl on Time-Consciousness',
    type: 'conversation',
    preview: 'The phenomenology of internal time-consciousness reveals...',
    date: '2024-11-20',
    tags: ['husserl', 'time', 'phenomenology']
  },
  {
    id: '2', 
    title: 'Merleau-Ponty Notes',
    type: 'note',
    preview: 'Body-subject as the primordial site of intentionality...',
    date: '2024-11-18',
    tags: ['merleau-ponty', 'embodiment']
  },
  {
    id: '3',
    title: 'Derrida on Différance',
    type: 'bookmark',
    preview: 'The movement of différance is not something that happens...',
    date: '2024-11-15',
    tags: ['derrida', 'deconstruction']
  }
];

export const ArchivePanel: Component<ArchivePanelProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeFilter, setActiveFilter] = createSignal<string | null>(null);
  const [selectedItem, setSelectedItem] = createSignal<ArchiveItem | null>(null);
  
  // Filter items based on search and type filter
  const filteredItems = () => {
    let items = mockArchiveItems;
    
    const query = searchQuery().toLowerCase();
    if (query) {
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    const filter = activeFilter();
    if (filter) {
      items = items.filter(item => item.type === filter);
    }
    
    return items;
  };
  
  const handleSelect = (item: ArchiveItem) => {
    setSelectedItem(item);
    props.onSelect?.(item);
  };
  
  const handleInsert = (item: ArchiveItem) => {
    props.onInsert?.(item.preview);
  };
  
  const typeIcon = (type: string) => {
    switch (type) {
      case 'conversation': return '💬';
      case 'narrative': return '📜';
      case 'bookmark': return '🔖';
      case 'note': return '📝';
      default: return '📄';
    }
  };
  
  return (
    <div class="archive-panel">
      {/* Search */}
      <div class="archive-search">
        <input
          type="text"
          placeholder="Search archive..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          class="archive-search-input"
        />
      </div>
      
      {/* Type Filters */}
      <div class="archive-filters">
        <button 
          class={`filter-btn ${activeFilter() === null ? 'active' : ''}`}
          onClick={() => setActiveFilter(null)}
        >
          All
        </button>
        <button 
          class={`filter-btn ${activeFilter() === 'conversation' ? 'active' : ''}`}
          onClick={() => setActiveFilter('conversation')}
        >
          💬
        </button>
        <button 
          class={`filter-btn ${activeFilter() === 'note' ? 'active' : ''}`}
          onClick={() => setActiveFilter('note')}
        >
          📝
        </button>
        <button 
          class={`filter-btn ${activeFilter() === 'bookmark' ? 'active' : ''}`}
          onClick={() => setActiveFilter('bookmark')}
        >
          🔖
        </button>
      </div>
      
      {/* Items List */}
      <div class="archive-items">
        <Show
          when={filteredItems().length}
          fallback={
            <div class="archive-empty">
              No items match your search
            </div>
          }
        >
          <For each={filteredItems()}>
            {(item) => (
              <div 
                class={`archive-item ${selectedItem()?.id === item.id ? 'selected' : ''}`}
                onClick={() => handleSelect(item)}
              >
                <div class="item-header">
                  <span class="item-icon">{typeIcon(item.type)}</span>
                  <span class="item-title">{item.title}</span>
                </div>
                <div class="item-preview">{item.preview}</div>
                <div class="item-meta">
                  <span class="item-date">{item.date}</span>
                  <Show when={item.tags?.length}>
                    <div class="item-tags">
                      <For each={item.tags?.slice(0, 2)}>
                        {(tag) => <span class="item-tag">{tag}</span>}
                      </For>
                    </div>
                  </Show>
                </div>
                <div class="item-actions">
                  <button 
                    class="action-btn"
                    onClick={(e) => { e.stopPropagation(); handleInsert(item); }}
                    title="Insert into editor"
                  >
                    ↳ Insert
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
      
      {/* Quick Actions */}
      <div class="archive-actions">
        <button class="archive-action-btn">
          + Upload Archive
        </button>
        <button class="archive-action-btn">
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};
