# Future Enhancements - Humanizer

**Last Updated**: October 16, 2025
**Status**: Planning Document

---

## 🚀 Planned Features

### 1. Ephemeral Lists - Phase 2

#### A. Transformation Tracking (2-3 hours)
**Priority**: High
**Status**: Designed, ready to implement

**Goal**: Track transformations in Working Memory widget

**Implementation**:
- Add `transformationResult` to `useActivityTracker`
- Track transformation ID, method, excerpt (50 chars)
- Display with 🔄 icon in widget
- Include source conversation reference

**User Story**: "As a user, when I create a transformation, I want it tracked in my working memory so I can save it to an interest list."

**Metadata Structure**:
```typescript
{
  type: 'transformation',
  uuid: transformation_id,
  metadata: {
    method: 'TRM' | 'AI Rewrite' | etc.,
    title: 'TRM transformation',
    excerpt: 'First 50 chars...',
    convergenceScore?: number,
    sourceConversationId?: string,
    sourceMessageId?: string
  }
}
```

**Files to Modify**:
- `frontend/src/hooks/useActivityTracker.ts` - Add transformation tracking
- `frontend/src/App.tsx` - Pass transformationResult to hook
- `frontend/src/components/ephemeral/WorkingMemoryWidget.tsx` - Display logic (already has 🔄 icon!)

**Options Considered**:
1. Minimal (ID only) - Too little context
2. With excerpts - Good balance ✅ **RECOMMENDED**
3. Full context - SessionStorage limits
4. Hybrid link - Best but requires click-to-navigate

**Decision**: Option 2 (excerpts) for now, Option 4 (hybrid) when click-to-navigate is implemented

---

#### B. Click-to-Navigate (1-2 hours)
**Priority**: Medium
**Status**: Planned

**Goal**: Click items in widget to navigate to them

**Implementation**:
- Add onClick handler to widget items
- Route to appropriate view:
  - Conversation → open in main pane
  - Transformation → show transformation result
  - Search → run search again
  - Media → open media viewer

**User Story**: "As a user, I want to click an item in the working memory widget to open it."

**Files to Modify**:
- `frontend/src/components/ephemeral/WorkingMemoryWidget.tsx` - Add onClick
- May need to lift state to App.tsx or use callback props

---

#### C. Settings Panel (4-6 hours)
**Priority**: Medium
**Status**: Planned

**Goal**: Persistent user preferences for ephemeral lists

**Features**:
- Auto-save on/off (persistent across sessions)
- Max items setting (10, 25, 50, 100)
- Auto-clear on save (yes/no)
- Exclude list (conversations/media to not track)
- Default list type when saving

**Storage**: LocalStorage (persistent) instead of SessionStorage

**User Story**: "As a user, I want my tracking preferences to persist across sessions."

**Files to Create**:
- `frontend/src/types/settings.ts` - Settings types
- `frontend/src/store/settings.ts` - Zustand store with localStorage
- `frontend/src/components/settings/SettingsPanel.tsx` - Settings UI

**Files to Modify**:
- `frontend/src/store/ephemeral.ts` - Read from settings store
- `frontend/src/App.tsx` - Add settings panel route/modal

---

#### D. Search & Media Tracking (2-3 hours each)
**Priority**: Low-Medium
**Status**: Planned

**Goal**: Track search queries and media views

**Search Tracking**:
```typescript
{
  type: 'search',
  uuid: uuidv4(),
  metadata: {
    query: 'search query text',
    resultCount: 42,
    timestamp: Date
  }
}
```

**Media Tracking**:
```typescript
{
  type: 'media',
  uuid: file_id,
  metadata: {
    filename: 'image.png',
    conversationTitle: 'Source conversation',
    conversationId: 'conv-uuid'
  }
}
```

---

### 2. Mobile Responsiveness (20-30 hours)

#### Priority: Medium
**Status**: Not Started
**Reported**: October 16, 2025 (user testing)

**Current Issues**:
- Layout breaks on narrow screens
- Widget overlaps content
- Sidebar doesn't collapse properly
- Navigation difficult on mobile
- Touch targets too small

**Goals**:
1. **Responsive Layout** - Work on all screen sizes (320px - 2560px)
2. **Touch-Friendly** - Larger buttons, easier navigation
3. **Mobile-First** - Optimized for small screens
4. **Progressive Enhancement** - Desktop features when space available

**Breakpoints** (suggested):
- Mobile: 320px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+
- Wide: 1440px+

**Key Changes Needed**:

#### A. Layout (8-10 hours)
- Convert fixed widths to flexible (%, vw, fr)
- CSS Grid/Flexbox for responsive layouts
- Collapsible sidebar with hamburger menu
- Stack components vertically on mobile

#### B. Navigation (4-6 hours)
- Bottom navigation bar for mobile
- Hamburger menu for sidebar
- Swipe gestures for panel transitions
- Touch-friendly icon sizes (44px min)

#### C. Working Memory Widget (3-4 hours)
- Position adjustment on mobile (bottom sheet?)
- Smaller on mobile, expandable
- Full-screen mode option
- Swipe down to dismiss

#### D. Typography & Spacing (2-3 hours)
- Responsive font sizes (clamp())
- Adequate touch targets (44px × 44px)
- Proper spacing for readability
- Accessible color contrast

#### E. Components (3-5 hours)
- Conversation list: cards on mobile
- Media gallery: grid → list on mobile
- Transformation panel: full-screen on mobile
- Settings: drawer instead of panel

**Testing Required**:
- iPhone SE (375px)
- iPhone 14 Pro (393px)
- iPad (768px)
- Galaxy S21 (360px)
- Desktop (1920px)

**Files to Create**:
- `frontend/src/styles/breakpoints.css` - Media query variables
- `frontend/src/hooks/useBreakpoint.ts` - Detect screen size
- `frontend/src/components/mobile/` - Mobile-specific components

**Files to Modify**:
- All component CSS files - Add responsive rules
- `frontend/src/index.css` - Mobile base styles
- Layout components - Responsive grid/flex

---

### 3. Context-Aware Lists (5-8 hours)
**Priority**: Medium
**Status**: Designed (see ADVANCED_FEATURES_PLAN.md)

**Goal**: Show interest list conversations in sidebar

When user clicks an interest list, the conversation list should filter to show only items from that list.

---

### 4. Multi-View Tabs (11-15 hours)
**Priority**: Low-Medium
**Status**: Designed (see ADVANCED_FEATURES_PLAN.md)

**Goal**: Work with multiple contexts simultaneously

Tab system allowing users to have multiple conversation views, search results, or interest lists open at once.

---

### 5. Bulk Operations (2-3 hours)

#### A. Bulk Item API (Backend)
**Priority**: Medium
**Status**: Optimization opportunity

**Goal**: Add multiple items to interest list in one API call

**Current**: Sequential POST requests
```
POST /api/interest-lists/{id}/items (item 1)
POST /api/interest-lists/{id}/items (item 2)
POST /api/interest-lists/{id}/items (item 3)
```

**Proposed**:
```
POST /api/interest-lists/{id}/items/bulk
{
  "items": [
    { "item_type": "conversation", "item_uuid": "...", ... },
    { "item_type": "conversation", "item_uuid": "...", ... },
    { "item_type": "transformation", "item_uuid": "...", ... }
  ]
}
```

**Benefits**:
- Faster (1 request vs N requests)
- Atomic (all succeed or all fail)
- Better error handling

**Files to Create**:
- `humanizer/api/interest_list.py` - Add bulk endpoint

**Files to Modify**:
- `frontend/src/lib/api-client.ts` - Add bulkAddToInterestList()
- `frontend/src/store/ephemeral.ts` - Use bulk endpoint in save()

---

### 6. Session History (8-12 hours)
**Priority**: Low
**Status**: Idea stage

**Goal**: View past ephemeral list sessions

**Features**:
- List of past sessions (from saved interest lists with type='ephemeral')
- View items from old sessions
- Restore session to working memory
- Delete old sessions

**Storage**: Interest lists table (already has `list_type='ephemeral'`)

**User Story**: "As a user, I want to review what I tracked in past sessions."

---

### 7. Export/Import (5-7 hours)
**Priority**: Low
**Status**: Idea stage

**Features**:
- Export interest list as JSON
- Export as Markdown
- Import list from JSON
- Share lists with others

---

### 8. Advanced Search (15-20 hours)
**Priority**: Medium
**Status**: Planned

**Features**:
- Search within interest lists
- Filter by item type
- Sort by date, relevance
- Saved searches
- Search history

---

### 9. Collaboration (40+ hours)
**Priority**: Low
**Status**: Idea stage

**Features**:
- Share interest lists
- Collaborative lists
- Comments on items
- User permissions

**Technical**: Requires user authentication, database schema changes

---

## 📝 Notes

### Design Principles
1. **Progressive Enhancement** - Core features work everywhere, enhancements for capable devices
2. **Performance First** - Optimize for speed, minimize bundle size
3. **Accessibility** - WCAG 2.1 AA compliance minimum
4. **User Control** - Always give users options, sensible defaults

### Development Order
1. ✅ Ephemeral Lists Core (COMPLETE)
2. 🔄 Transformation Tracking (NEXT - 2-3 hours)
3. 🔄 Click-to-Navigate (NEXT - 1-2 hours)
4. 📱 Mobile Responsiveness (HIGH PRIORITY - 20-30 hours)
5. ⚙️ Settings Panel (4-6 hours)
6. 📋 Context-Aware Lists (5-8 hours)
7. 🔍 Search & Media Tracking (4-6 hours)
8. 📑 Multi-View Tabs (11-15 hours)

### Time Estimates (Total)
- **Short Term** (1-2 weeks): ~10 hours
  - Transformation tracking
  - Click-to-navigate
  - Settings panel basics

- **Medium Term** (1 month): ~50 hours
  - Mobile responsiveness
  - Context-aware lists
  - Search/media tracking
  - Bulk operations

- **Long Term** (2-3 months): ~80+ hours
  - Multi-view tabs
  - Session history
  - Export/import
  - Advanced search

---

**Last Updated**: October 16, 2025
**Next Review**: When starting new feature
