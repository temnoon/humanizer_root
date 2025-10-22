# Advanced Features Implementation Plan
**Date**: October 16, 2025
**Status**: Design Phase - Ready for Implementation

---

## Overview

This document outlines three major UX enhancements emerging from real usage patterns:

1. **Context-Aware Conversation Lists** - Interest list conversations should populate the conversation list sidebar
2. **Multi-View Tabs System** - Allow multiple tabs to switch between different contexts
3. **Ephemeral Interest Lists** - Auto-create temporary lists that can be saved on demand

---

## Feature 1: Context-Aware Conversation Lists

### User Story
> "When I click a conversation from an Interest List, I want the sidebar to show THAT list's conversations, not all conversations. I'm working within a specific context."

### Current Behavior
1. User creates interest list "Quantum Conversations" with 50 items
2. User clicks conversation #5 in the list
3. Sidebar switches to 'conversations' view
4. Shows ALL 1,686 conversations (not the filtered 50)
5. User loses context of which set they're exploring

### Desired Behavior
1. User creates interest list "Quantum Conversations" with 50 items
2. User clicks conversation #5
3. Sidebar switches to 'conversations' view
4. Shows ONLY the 50 conversations from "Quantum Conversations"
5. Maintains position/context within the list
6. Header shows: "Conversations (from: Quantum Conversations)"

### Architecture Design

#### New Concept: Conversation List Context
```typescript
interface ConversationListContext {
  type: 'all' | 'interest_list' | 'search_results' | 'tag_filter';
  sourceId?: string;  // Interest list ID, search query hash, etc.
  sourceName: string;  // "All Conversations", "Quantum Conversations", etc.
  conversationIds: string[];  // Ordered list of UUIDs
  totalCount: number;
}
```

#### State Management
```typescript
// In App.tsx
const [conversationContext, setConversationContext] = useState<ConversationListContext>({
  type: 'all',
  sourceName: 'All Conversations',
  conversationIds: [],
  totalCount: 0,
});
```

#### Updated Components

**1. ConversationList.tsx**
```typescript
interface ConversationListProps {
  context: ConversationListContext;  // New prop
  selectedConversation?: string | null;
  onSelect?: (uuid: string) => void;
}

// If context.type !== 'all', only fetch/display context.conversationIds
```

**2. Sidebar.tsx - ListsView**
```typescript
const handleSelectItem = (itemType: string, itemUuid: string, listId: string, listName: string) => {
  if (itemType === 'conversation' && onSelectConversation) {
    // Get all conversation IDs from this list
    const conversationIds = await api.getInterestListConversations(listId);

    // Set context
    setConversationContext({
      type: 'interest_list',
      sourceId: listId,
      sourceName: listName,
      conversationIds,
      totalCount: conversationIds.length,
    });

    // Select the conversation
    onSelectConversation(itemUuid);

    // Switch view
    onViewChange('conversations');
  }
};
```

**3. New Backend Endpoint**
```python
# humanizer/api/interest_list.py
@router.get("/{list_id}/conversations")
async def get_interest_list_conversations(
    list_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    """Get ordered list of conversation UUIDs from an interest list."""
    service = InterestListService()
    items = await service.get_list_items(session, list_id, item_type="conversation")
    return [str(item.item_uuid) for item in items]
```

#### UI Affordances
- **Context Header**: Show "Viewing: 50 conversations from 'Quantum Conversations'"
- **Clear Context Button**: "⊗ Show All Conversations" to reset context
- **Context Indicator**: Purple highlight on conversation list when context is active
- **Breadcrumb**: "Lists > Quantum Conversations > [Current Conversation]"

### Implementation Steps

**Phase 1: Backend (1-2 hours)**
1. Add GET `/api/interest-lists/{id}/conversations` endpoint
2. Add GET `/api/interest-lists/{id}/items/conversations` for full metadata
3. Test with curl

**Phase 2: Frontend State (2-3 hours)**
4. Add ConversationListContext type to types/sidebar.ts
5. Add conversationContext state to App.tsx
6. Update ConversationList to accept context prop
7. Modify list fetching to respect context

**Phase 3: Integration (1-2 hours)**
8. Update ListsView to create context on item click
9. Update Sidebar to pass context to ConversationList
10. Add context header UI to ConversationList

**Phase 4: Polish (1 hour)**
11. Add "Clear Context" button
12. Add visual indicators (highlight, breadcrumb)
13. Test with multiple lists

**Total Estimate**: 5-8 hours

---

## Feature 2: Multi-View Tabs System

### User Story
> "I'm comparing transformations, looking at conversations, and checking lists. I need to tab between these contexts without losing my place."

### Use Cases
1. **Transformation Workflow**: Open 3 tabs with different transformation attempts
2. **Research Mode**: Tab 1 = conversation, Tab 2 = related conversations, Tab 3 = search results
3. **Curation**: Tab 1 = list editing, Tab 2 = conversation reading, Tab 3 = media gallery

### Architecture Design

#### Tab Data Structure
```typescript
interface AppTab {
  id: string;  // UUID
  title: string;  // "Quantum Discussion" or "Transformation #3"
  icon: string;  // Emoji

  // Sidebar state
  sidebarView: SidebarView;
  sidebarCollapsed: boolean;
  conversationContext?: ConversationListContext;
  selectedConversation?: string | null;

  // Main pane state
  mainContent: {
    type: 'conversation' | 'transformation' | 'media' | 'search';
    data: any;  // Content-specific data
  };

  // Tool panel state
  toolPanelCollapsed: boolean;
  selectedContent?: any;
  transformationResult?: any;

  // Metadata
  createdAt: Date;
  lastAccessedAt: Date;
  isPinned: boolean;
}

interface TabManagerState {
  tabs: AppTab[];
  activeTabId: string;
  maxTabs: number;  // Default: 10, configurable in settings
}
```

#### Tab Manager Component
```typescript
// frontend/src/components/layout/TabBar.tsx
interface TabBarProps {
  tabs: AppTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCreate: () => void;
  onTabPin: (tabId: string) => void;
}

export default function TabBar({ tabs, activeTabId, onTabChange, ... }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isPinned ? 'pinned' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-title">{tab.title}</span>
            {tab.isPinned && <span className="pin-indicator">📌</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              ×
            </button>
          </button>
        ))}
      </div>
      <button className="tab-new" onClick={onTabCreate} title="New Tab (Cmd+T)">
        +
      </button>
    </div>
  );
}
```

#### State Management Approach

**Option A: Lift All State to App.tsx**
```typescript
// App.tsx becomes tab manager
const [tabs, setTabs] = useState<AppTab[]>([createDefaultTab()]);
const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

const activeTab = tabs.find(t => t.id === activeTabId);

// All state updates modify activeTab, then update tabs array
const updateActiveTab = (updates: Partial<AppTab>) => {
  setTabs(prev => prev.map(tab =>
    tab.id === activeTabId ? { ...tab, ...updates } : tab
  ));
};
```

**Option B: Zustand/Jotai Store** (Recommended)
```typescript
// frontend/src/store/tabs.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface TabStore {
  tabs: AppTab[];
  activeTabId: string;

  // Actions
  createTab: (template?: Partial<AppTab>) => string;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<AppTab>) => void;
  pinTab: (tabId: string) => void;

  // Selectors
  getActiveTab: () => AppTab | undefined;
}

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [createDefaultTab()],
      activeTabId: '',

      createTab: (template) => {
        const newTab = {
          id: generateUUID(),
          title: 'New Tab',
          icon: '📄',
          ...createDefaultTabState(),
          ...template,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
        };
        set(state => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
      },

      closeTab: (tabId) => {
        set(state => {
          const remainingTabs = state.tabs.filter(t => t.id !== tabId);
          if (remainingTabs.length === 0) {
            remainingTabs.push(createDefaultTab());
          }
          return {
            tabs: remainingTabs,
            activeTabId: state.activeTabId === tabId
              ? remainingTabs[0].id
              : state.activeTabId,
          };
        });
      },

      switchTab: (tabId) => {
        set({ activeTabId: tabId });
        // Update lastAccessedAt
        get().updateTab(tabId, { lastAccessedAt: new Date() });
      },

      updateTab: (tabId, updates) => {
        set(state => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, ...updates } : tab
          ),
        }));
      },

      pinTab: (tabId) => {
        set(state => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, isPinned: !tab.isPinned } : tab
          ),
        }));
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find(t => t.id === activeTabId);
      },
    }),
    {
      name: 'humanizer-tabs',
      version: 1,
    }
  )
);
```

#### Keyboard Shortcuts
- **Cmd+T**: New tab
- **Cmd+W**: Close current tab
- **Cmd+[1-9]**: Switch to tab N
- **Cmd+Shift+[**: Previous tab
- **Cmd+Shift+]**: Next tab

#### Persistence Strategy
- **Session Storage**: Tabs persist across refresh (using Zustand persist)
- **IndexedDB**: Optional long-term storage for important tabs
- **Export/Import**: JSON export of tab configuration

### Implementation Steps

**Phase 1: Data Layer (2-3 hours)**
1. Create AppTab type definition
2. Set up Zustand store with persistence
3. Create tab utility functions (createTab, serializeTab, etc.)

**Phase 2: UI Components (3-4 hours)**
4. Build TabBar component
5. Build TabContent wrapper
6. Add CSS for tab styling
7. Test tab creation/switching/closing

**Phase 3: State Integration (4-5 hours)**
8. Refactor App.tsx to use tab store
9. Connect all sidebar state to active tab
10. Connect main pane state to active tab
11. Test state isolation between tabs

**Phase 4: Keyboard & Polish (2-3 hours)**
12. Add keyboard shortcuts
13. Add tab context menu (right-click)
14. Add tab drag-and-drop reordering
15. Add "Close all but this" and "Close to the right"

**Total Estimate**: 11-15 hours

---

## Feature 3: Ephemeral Interest Lists

### User Story
> "As soon as I start exploring, I want a temporary list capturing what I'm doing. I can save it later if it's useful."

### Concept: "Working Memory"

Every session automatically creates a "Working Memory" list that:
- Captures conversations opened
- Records searches performed
- Tracks media viewed
- Saves transformations attempted
- **Auto-discards on next session** (unless saved)

### Architecture Design

#### Ephemeral List Structure
```typescript
interface EphemeralList {
  id: string;  // Session-specific ID
  sessionId: string;  // Browser session ID
  startedAt: Date;
  items: Array<{
    type: 'conversation' | 'search' | 'media' | 'transformation';
    uuid: string;
    timestamp: Date;
    metadata: any;
  }>;
  isSaved: boolean;  // false until user clicks "Save"
  autoSaveEnabled: boolean;  // From user settings
}
```

#### Automatic Tracking
```typescript
// frontend/src/hooks/useActivityTracker.ts
export function useActivityTracker() {
  const ephemeralList = useEphemeralListStore();

  // Track conversation views
  useEffect(() => {
    if (selectedConversation) {
      ephemeralList.addItem({
        type: 'conversation',
        uuid: selectedConversation,
        timestamp: new Date(),
        metadata: { title: conversationTitle },
      });
    }
  }, [selectedConversation]);

  // Track searches
  useEffect(() => {
    if (lastSearchQuery) {
      ephemeralList.addItem({
        type: 'search',
        uuid: generateSearchId(lastSearchQuery),
        timestamp: new Date(),
        metadata: { query: lastSearchQuery, resultCount },
      });
    }
  }, [lastSearchQuery]);

  // Track transformations
  useEffect(() => {
    if (transformationResult) {
      ephemeralList.addItem({
        type: 'transformation',
        uuid: transformationResult.transformation_id,
        timestamp: new Date(),
        metadata: { method: transformationResult.method },
      });
    }
  }, [transformationResult]);
}
```

#### UI Components

**1. Floating "Working Memory" Widget**
```typescript
// frontend/src/components/ephemeral/WorkingMemoryWidget.tsx
export default function WorkingMemoryWidget() {
  const ephemeral = useEphemeralListStore();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="working-memory-widget">
      <button
        className="widget-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        🧠 Working Memory ({ephemeral.items.length})
      </button>

      {isExpanded && (
        <div className="widget-content">
          <div className="widget-header">
            <h4>This Session</h4>
            <button onClick={ephemeral.clear}>Clear</button>
            <button onClick={ephemeral.save}>Save as List</button>
          </div>

          <div className="widget-items">
            {ephemeral.items.slice(-10).reverse().map(item => (
              <div key={item.uuid} className="widget-item">
                <span className="item-icon">{getItemIcon(item.type)}</span>
                <span className="item-title">{item.metadata.title}</span>
                <span className="item-time">{formatRelativeTime(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**2. Settings Panel Integration**
```typescript
// frontend/src/components/settings/SettingsPanel.tsx
interface WorkingMemorySettings {
  enabled: boolean;
  autoSave: boolean;
  maxItems: number;
  trackConversations: boolean;
  trackSearches: boolean;
  trackMedia: boolean;
  trackTransformations: boolean;
}

// Settings UI
<div className="settings-section">
  <h3>Working Memory</h3>

  <label>
    <input
      type="checkbox"
      checked={settings.workingMemory.enabled}
      onChange={...}
    />
    Enable automatic activity tracking
  </label>

  <label>
    <input
      type="checkbox"
      checked={settings.workingMemory.autoSave}
      onChange={...}
    />
    Auto-save on session end
  </label>

  <label>
    Max items to track:
    <input
      type="number"
      value={settings.workingMemory.maxItems}
      onChange={...}
      min="10"
      max="1000"
    />
  </label>
</div>
```

#### Persistence & Cleanup

**Session Storage (Temporary)**
```typescript
// Store in sessionStorage (clears on browser close)
sessionStorage.setItem('ephemeral-list', JSON.stringify(ephemeralList));

// On app mount, check for existing ephemeral list
const savedEphemeral = sessionStorage.getItem('ephemeral-list');
if (savedEphemeral) {
  const list = JSON.parse(savedEphemeral);
  // Show "Restore previous session?" dialog
  if (confirm('Restore previous session?')) {
    loadEphemeralList(list);
  }
}
```

**Conversion to Permanent List**
```typescript
async function saveEphemeralList(name: string, description: string) {
  const ephemeral = getEphemeralList();

  // Create interest list
  const newList = await api.createInterestList({
    name: name || `Session ${new Date().toISOString()}`,
    description: description || `Captured from session on ${formatDate(new Date())}`,
    listType: 'working_memory',
  });

  // Add all items
  for (const item of ephemeral.items) {
    if (item.type === 'conversation') {
      await api.addToInterestList(newList.id, {
        itemType: 'conversation',
        itemUuid: item.uuid,
        itemMetadata: item.metadata,
      });
    }
    // Handle other types...
  }

  // Mark as saved
  ephemeral.isSaved = true;

  return newList;
}
```

### Implementation Steps

**Phase 1: Store & Tracking (2-3 hours)**
1. Create EphemeralList type
2. Create Zustand store for ephemeral list
3. Create useActivityTracker hook
4. Test automatic tracking

**Phase 2: UI Widget (2-3 hours)**
5. Build WorkingMemoryWidget component
6. Add floating position/toggle
7. Add item list display
8. Style widget

**Phase 3: Save/Restore (2-3 hours)**
9. Implement save to permanent list
10. Add session restore dialog
11. Add clear/discard functionality
12. Test persistence

**Phase 4: Settings Integration (2 hours)**
13. Add working memory settings panel
14. Add enable/disable toggle
15. Add auto-save option
16. Add item type filters

**Total Estimate**: 8-11 hours

---

## Settings System Design

Since Feature 3 requires settings, here's the settings architecture:

### Settings Schema
```typescript
interface UserSettings {
  // General
  theme: 'light' | 'dark' | 'auto';
  language: 'en';

  // Working Memory
  workingMemory: {
    enabled: boolean;
    autoSave: boolean;
    maxItems: number;
    trackConversations: boolean;
    trackSearches: boolean;
    trackMedia: boolean;
    trackTransformations: boolean;
  };

  // Tabs
  tabs: {
    maxTabs: number;
    persistTabs: boolean;
    showTabBar: boolean;
    tabPosition: 'top' | 'bottom';
  };

  // Interest Lists
  lists: {
    defaultView: 'compact' | 'detailed';
    autoExpandOnSelect: boolean;
    confirmDelete: boolean;
  };

  // AUI
  aui: {
    enabled: boolean;
    autoCloseModal: boolean;
    keyboardShortcut: string;  // Default: "Cmd+K"
  };

  // Performance
  performance: {
    lazyLoadConversations: boolean;
    virtualScrolling: boolean;
    imagePreloading: boolean;
  };
}
```

### Settings Storage
```typescript
// frontend/src/store/settings.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: getDefaultSettings(),

      updateSettings: (updates: Partial<UserSettings>) => {
        set(state => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      resetSettings: () => {
        set({ settings: getDefaultSettings() });
      },

      exportSettings: () => {
        return JSON.stringify(get().settings, null, 2);
      },

      importSettings: (json: string) => {
        try {
          const imported = JSON.parse(json);
          set({ settings: { ...getDefaultSettings(), ...imported } });
        } catch (err) {
          console.error('Failed to import settings:', err);
        }
      },
    }),
    {
      name: 'humanizer-settings',
      version: 1,
    }
  )
);
```

---

## Implementation Priority & Timeline

### Phase 1: Foundation (Week 1)
**Days 1-2**: Feature 3 - Ephemeral Lists (8-11 hours)
- Simplest feature, provides immediate value
- Introduces settings system needed for others
- Low risk, high reward

**Days 3-4**: Settings System (4-6 hours)
- Build settings panel UI
- Implement settings storage
- Add import/export

### Phase 2: Core Enhancement (Week 2)
**Days 5-7**: Feature 1 - Context-Aware Lists (5-8 hours)
- Addresses immediate UX pain point
- Foundation for Feature 2
- Moderate complexity

### Phase 3: Advanced (Week 3)
**Days 8-12**: Feature 2 - Multi-View Tabs (11-15 hours)
- Most complex feature
- Requires careful state management
- High payoff for power users

### Total Estimate: 28-40 hours (3-4 weeks)

---

## Testing Strategy

### Unit Tests
- Tab store operations
- Ephemeral list tracking
- Context switching logic

### Integration Tests
- Tab state isolation
- Ephemeral list save/restore
- Context-aware navigation

### E2E Tests (Playwright)
```typescript
test('Context-aware conversation list', async ({ page }) => {
  // Create interest list with 5 conversations
  await createInterestList(page, 'Test List', 5);

  // Click conversation #3
  await page.click('[data-conversation="3"]');

  // Verify sidebar shows only 5 conversations
  const count = await page.locator('.conversation-item').count();
  expect(count).toBe(5);

  // Verify context header
  await expect(page.locator('.context-header')).toContainText('Test List');
});

test('Tab state isolation', async ({ page }) => {
  // Open Tab 1 with conversation A
  await openConversation(page, 'conversation-a');

  // Create Tab 2
  await page.keyboard.press('Meta+T');

  // Open conversation B in Tab 2
  await openConversation(page, 'conversation-b');

  // Switch back to Tab 1
  await page.click('[data-tab-id="1"]');

  // Verify conversation A is still shown
  await expect(page.locator('.conversation-viewer')).toContainText('Conversation A');
});
```

---

## Migration & Backwards Compatibility

### Data Migration
No database schema changes required - all features use existing tables.

### API Changes
All new endpoints are additive (no breaking changes):
- GET `/api/interest-lists/{id}/conversations` (new)
- GET `/api/settings` (new)
- PUT `/api/settings` (new)

### Frontend Compatibility
- Tabs: graceful fallback to single-tab mode if store fails
- Ephemeral: disabled if sessionStorage unavailable
- Context: falls back to 'all' context if list not found

---

## Documentation Requirements

### User Documentation
1. **User Guide**: "Working with Tabs and Contexts"
2. **Tutorial**: "Creating and Managing Interest Lists"
3. **Settings Reference**: Complete settings documentation
4. **Keyboard Shortcuts**: Cheat sheet

### Developer Documentation
1. **Architecture**: State management patterns
2. **Tab System**: How to add tab-aware features
3. **Activity Tracking**: How to track new item types
4. **Settings**: How to add new settings

---

## Success Metrics

### Feature 1: Context-Aware Lists
- Users spend 50%+ less time scrolling to find conversations
- Reduced "Back to list" button clicks
- Increased interest list usage

### Feature 2: Multi-View Tabs
- Average tabs per session: 2-5
- Users complete complex workflows faster
- Reduced "lost my place" support requests

### Feature 3: Ephemeral Lists
- 80% of sessions tracked
- 30% of ephemeral lists saved as permanent
- Increased list creation rate

---

**End of Implementation Plan**
