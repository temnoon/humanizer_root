# UX Issues Report - Unified Search & Document Viewer
**Date**: October 18, 2025
**Status**: Code Analysis Complete (Chrome DevTools unavailable)
**Scope**: Document Viewer Header Layout, Search Result Ordering, Navigation, Persistence, Filters

---

## Investigation Summary

This report documents 5 UX issues identified through code analysis of the unified search and document viewer implementations. While visual screenshots could not be captured due to Chrome DevTools session issues, the analysis is based on comprehensive review of TypeScript components and CSS files.

---

## Issue #1: Document Viewer Header Layout - Potential Overflow

### Observed Behavior (Code Analysis)
**File**: `/Users/tem/humanizer_root/frontend/src/components/documents/DocumentViewer.tsx` (lines 272-421)

The document header contains multiple elements stacked vertically:
1. **Title Row** (line 274-301): Icon + Title + Chunk Navigation (flex layout)
2. **Metadata Row** (line 304-318): 6-7 metadata items with flex-wrap
3. **View Mode Toggle** (line 321-348): 4 buttons (Content, Chunks, Media, JSON)
4. **Width Toggle** (line 351-375): 3 buttons (Narrow, Medium, Wide)
5. **Actions Row** (line 378-420): Star, Add to List, Use in Tools buttons

**Potential Issues**:
- **Title row** (line 50-55 in CSS): `display: flex` with `gap: var(--space-base, 24px)`
  - Title uses `flex: 1` which could cause cramping when chunk navigation is present
  - Chunk navigation has 3 elements (Previous button + position + Next button)
  - On narrow screens, title may be squeezed between icon and navigation

- **Chunk navigation placement** (line 279-301): Shows conditionally in title row
  - This adds 3 interactive elements to the title row
  - Could push title text into awkward wrapping on medium-width screens

- **Metadata row** (line 115-122 in CSS): `flex-wrap: wrap` with `gap: 15px`
  - 6-7 items could wrap unpredictably depending on filename length
  - `filename-meta` uses monospace font (line 131-134) which is wider

- **Mobile breakpoint** (line 791-799 in CSS): At 600px, switches to `flex-direction: column`
  - Desktop/tablet behavior at 601-900px range may show awkward wrapping

### Expected Behavior
- Clean, professional header with proper spacing
- Title should never be cramped or overflow
- Metadata should wrap gracefully without jarring breaks
- Chunk navigation should not interfere with title readability

### Root Cause Analysis
**File**: `DocumentViewer.css` lines 50-55, 115-122

The issue is the **title row flex layout with conditional chunk navigation**:
```typescript
// Line 274-301 in DocumentViewer.tsx
<div className="document-title-row">
  <span className="file-type-icon">{getFileTypeIcon(docData.file_type)}</span>
  <h1 className="document-title">{docData.title || docData.filename}</h1>

  {/* Chunk Navigation - conditionally added to same row */}
  {viewMode === 'chunks' && chunks.length > 0 && (
    <div className="chunk-navigation">
      {/* 3 elements here */}
    </div>
  )}
</div>
```

CSS for `.document-title-row`:
```css
.document-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-base, 24px);
  margin-bottom: var(--space-md, 15px);
}

.document-title {
  flex: 1;  /* ← This is the issue */
  /* ... */
}
```

When chunk navigation appears, the title competes for space with 3 navigation elements, potentially creating cramped layout.

### Severity
**Medium** - Affects readability but not blocking functionality

### Fix Complexity
**Easy** - CSS restructuring (30-45 minutes)

### Recommendation

**Option 1: Move chunk navigation to separate row** (Recommended)
```tsx
<div className="document-title-row">
  <span className="file-type-icon">{getFileTypeIcon(docData.file_type)}</span>
  <h1 className="document-title">{docData.title || docData.filename}</h1>
</div>

{/* Separate row for chunk navigation */}
{viewMode === 'chunks' && chunks.length > 0 && (
  <div className="chunk-navigation-row">
    <div className="chunk-navigation">
      {/* Navigation controls */}
    </div>
  </div>
)}
```

Add CSS:
```css
.chunk-navigation-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-md, 15px);
}
```

**Option 2: Use absolute positioning for chunk navigation**
Position chunk navigation absolutely in top-right corner to avoid flex layout conflicts.

**Option 3: Use grid layout instead of flex**
```css
.document-title-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-base, 24px);
  align-items: center;
}
```

---

## Issue #2: Search Result Ordering - Grouped by Type Instead of Score

### Observed Behavior (Code Analysis)
**File**: `/Users/tem/humanizer_root/frontend/src/components/search/SemanticSearch.tsx` (lines 137-240)

Results are **explicitly grouped by type**, not sorted by similarity score:

```tsx
{/* Lines 147-188: Conversation Results Section */}
{conversationResults.length > 0 && (
  <div className="results-section">
    <div className="results-section-header">
      <span className="section-icon">💬</span>
      <span className="section-title">Conversations</span>
      <span className="section-count">{conversationResults.length}</span>
    </div>
    {/* All conversation results */}
  </div>
)}

{/* Lines 191-239: Document Results Section */}
{documentResults.length > 0 && (
  <div className="results-section">
    <div className="results-section-header">
      <span className="section-icon">📚</span>
      <span className="section-title">Documents</span>
      <span className="section-count">{documentResults.length}</span>
    </div>
    {/* All document results */}
  </div>
)}
```

**Problem**: Documents with 95% similarity will appear BELOW conversations with 40% similarity, because the component renders:
1. ALL conversation results first (lines 147-188)
2. Then ALL document results (lines 191-239)

There is **no interleaving or unified sorting** by score.

### Expected Behavior
Results should be **sorted by relevance (similarity score)** across both types, not grouped by type. A document with 95% similarity should appear before a conversation with 60% similarity.

### Root Cause Analysis
**File**: `SemanticSearch.tsx` lines 25-47

The component maintains **separate state arrays**:
```typescript
const [conversationResults, setConversationResults] = useState<SearchResult[]>([]);
const [documentResults, setDocumentResults] = useState<DocumentSearchResult[]>([]);
```

Search logic (lines 40-47):
```typescript
const [conversationResponse, documentResponse] = await Promise.all([
  api.semanticSearch(query, 20, 0.0),
  api.searchDocuments({ query, semantic: true, limit: 20 })
]);

setConversationResults(conversationResponse.results);
setDocumentResults(documentResponse.results);
```

The rendering logic (lines 137-240) renders them in **fixed order** (conversations first, then documents), not by unified score.

### Severity
**High** - Significantly impacts search usability, users may miss most relevant results

### Fix Complexity
**Easy** - Data transformation (30 minutes)

### Recommendation

**Create unified result type and sort by score:**

```typescript
// 1. Create unified result type
type UnifiedSearchResult = {
  type: 'conversation' | 'document';
  score: number;
  data: SearchResult | DocumentSearchResult;
};

// 2. After fetching both result sets, combine and sort
const handleSearch = async () => {
  // ... fetch logic ...

  // Combine results
  const conversationUnified: UnifiedSearchResult[] = conversationResponse.results.map(r => ({
    type: 'conversation' as const,
    score: r.similarity,
    data: r
  }));

  const documentUnified: UnifiedSearchResult[] = documentResponse.results.map(r => ({
    type: 'document' as const,
    score: r.score,
    data: r
  }));

  // Sort by score (highest first)
  const allResults = [...conversationUnified, ...documentUnified]
    .sort((a, b) => b.score - a.score);

  setUnifiedResults(allResults);
};

// 3. Render single sorted list
{unifiedResults.map((result) => (
  result.type === 'conversation'
    ? <ConversationResultItem data={result.data as SearchResult} />
    : <DocumentResultItem data={result.data as DocumentSearchResult} />
))}
```

**Alternative**: Add toggle to switch between "Grouped" and "Unified" view, default to Unified.

---

## Issue #3: Result Click Navigation - Missing View Auto-Switch

### Observed Behavior (Code Analysis)
**File**: `SemanticSearch.tsx` lines 63-76

When clicking search results, the handlers only call the selection callbacks:

```typescript
const handleConversationClick = (result: SearchResult) => {
  if (onSelectResult) {
    onSelectResult(result);
  }
  if (onSelectConversation) {
    onSelectConversation(result.conversation_uuid);  // Only sets selection
  }
};

const handleDocumentClick = (result: DocumentSearchResult) => {
  if (onSelectDocument) {
    onSelectDocument(result.document_id);  // Only sets selection
  }
};
```

**Problem**: There is **no view change** triggered.

Looking at `Sidebar.tsx` lines 178-184:
```typescript
function SearchView({ onSelectConversation, onSelectDocument }: {...}) {
  return (
    <SemanticSearch
      onSelectConversation={onSelectConversation}
      onSelectDocument={onSelectDocument}
    />
  );
}
```

The SearchView component **does not receive or pass `onViewChange`** prop, so it cannot trigger view switches.

### Expected Behavior
- Clicking conversation result → Switch to `conversations` view + open conversation in MainPane
- Clicking document result → Switch to `documents` view + open DocumentViewer in MainPane

**Reference implementation** (InterestListPanel - correct pattern):
```typescript
// From Sidebar.tsx lines 187-204
function ListsView({ onSelectConversation, onSelectDocument, onViewChange }: {...}) {
  const handleSelectItem = (itemType: string, itemUuid: string) => {
    if (itemType === 'conversation' && onSelectConversation) {
      onSelectConversation(itemUuid);
      if (onViewChange) {
        onViewChange('conversations');  // ✅ Switches view!
      }
    } else if (itemType === 'document' && onSelectDocument) {
      onSelectDocument(itemUuid);
      if (onViewChange) {
        onViewChange('documents');  // ✅ Switches view!
      }
    }
  };
  return <InterestListPanel onSelectItem={handleSelectItem} />;
}
```

### Root Cause Analysis
The `SemanticSearch` component and `SearchView` wrapper lack the `onViewChange` prop.

**Missing prop flow**:
1. `App.tsx` → `Sidebar` (passes `onViewChange`)
2. `Sidebar` → `SearchView` (does NOT pass `onViewChange`) ❌
3. `SearchView` → `SemanticSearch` (cannot pass what it doesn't receive) ❌

### Severity
**High** - Major usability issue, breaks expected navigation flow

### Fix Complexity
**Trivial** - Prop threading (15 minutes)

### Recommendation

**1. Update SemanticSearch props:**
```typescript
// SemanticSearch.tsx
interface SemanticSearchProps {
  onSelectResult?: (result: SearchResult) => void;
  onSelectConversation?: (conversationId: string) => void;
  onSelectDocument?: (documentId: string) => void;
  onViewChange?: (view: SidebarView) => void;  // ✅ Add this
}

const handleConversationClick = (result: SearchResult) => {
  if (onSelectConversation) {
    onSelectConversation(result.conversation_uuid);
  }
  if (onViewChange) {
    onViewChange('conversations');  // ✅ Switch to conversations view
  }
};

const handleDocumentClick = (result: DocumentSearchResult) => {
  if (onSelectDocument) {
    onSelectDocument(result.document_id);
  }
  if (onViewChange) {
    onViewChange('documents');  // ✅ Switch to documents view
  }
};
```

**2. Update SearchView wrapper:**
```typescript
// Sidebar.tsx line 178
function SearchView({
  onSelectConversation,
  onSelectDocument,
  onViewChange  // ✅ Add this
}: {
  onSelectConversation?: (uuid: string) => void,
  onSelectDocument?: (documentId: string) => void,
  onViewChange?: (view: SidebarView) => void  // ✅ Add this
}) {
  return (
    <SemanticSearch
      onSelectConversation={onSelectConversation}
      onSelectDocument={onSelectDocument}
      onViewChange={onViewChange}  // ✅ Pass it through
    />
  );
}
```

**3. Update Sidebar.tsx call site:**
```typescript
// Sidebar.tsx line 141
{currentView === 'search' && (
  <SearchView
    onSelectConversation={onSelectConversation}
    onSelectDocument={onSelectDocument}
    onViewChange={onViewChange}  // ✅ Already available from props
  />
)}
```

---

## Issue #4: Search Persistence - State Cleared on View Change

### Observed Behavior (Code Analysis)
**File**: `SemanticSearch.tsx` lines 25-30

Search state is managed with **local useState**:
```typescript
const [query, setQuery] = useState('');
const [conversationResults, setConversationResults] = useState<SearchResult[]>([]);
const [documentResults, setDocumentResults] = useState<DocumentSearchResult[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [hasSearched, setHasSearched] = useState(false);
```

**Problem**: When user navigates away from Search view (e.g., to Conversations), the `SemanticSearch` component **unmounts**. When they navigate back, it **remounts with fresh state** → all previous search state is lost.

**React behavior**:
- Navigate to Search view → `SemanticSearch` mounts with empty `useState` values
- Enter query "quantum", click search → state populated
- Navigate to Conversations view → `SemanticSearch` unmounts → **state destroyed**
- Navigate back to Search view → `SemanticSearch` remounts → **state reset to empty**

User must re-enter query and re-run search.

### Expected Behavior
Search query and results should **persist** when navigating away and back. User should see their previous search results without re-searching.

### Root Cause Analysis
The component uses **ephemeral component state** (useState) which is tied to component lifecycle. There is **no persistent storage** (localStorage, sessionStorage, or global state store).

**Contrast with tabs system** (which DOES persist):
```typescript
// store/tabs.ts - Uses Zustand with localStorage persistence
const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      // State persists across remounts
    }),
    {
      name: 'humanizer-tabs',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### Severity
**Medium** - Annoying UX friction, but not blocking core functionality

### Fix Complexity
**Easy** - Add sessionStorage persistence (30-45 minutes)

### Recommendation

**Option 1: Use sessionStorage for search state** (Recommended for tab-scoped persistence)
```typescript
// SemanticSearch.tsx
const [query, setQuery] = useState(() => {
  return sessionStorage.getItem('search-query') || '';
});

const [conversationResults, setConversationResults] = useState<SearchResult[]>(() => {
  const saved = sessionStorage.getItem('search-conversation-results');
  return saved ? JSON.parse(saved) : [];
});

const [documentResults, setDocumentResults] = useState<DocumentSearchResult[]>(() => {
  const saved = sessionStorage.getItem('search-document-results');
  return saved ? JSON.parse(saved) : [];
});

// Save to sessionStorage on state change
useEffect(() => {
  sessionStorage.setItem('search-query', query);
}, [query]);

useEffect(() => {
  sessionStorage.setItem('search-conversation-results', JSON.stringify(conversationResults));
}, [conversationResults]);

useEffect(() => {
  sessionStorage.setItem('search-document-results', JSON.stringify(documentResults));
}, [documentResults]);
```

**Option 2: Create Zustand search store** (Better for multi-tab persistence)
```typescript
// store/search.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SearchStore {
  query: string;
  conversationResults: SearchResult[];
  documentResults: DocumentSearchResult[];
  setQuery: (query: string) => void;
  setResults: (conversations: SearchResult[], documents: DocumentSearchResult[]) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      query: '',
      conversationResults: [],
      documentResults: [],
      setQuery: (query) => set({ query }),
      setResults: (conversations, documents) => set({
        conversationResults: conversations,
        documentResults: documents
      }),
      clearResults: () => set({ conversationResults: [], documentResults: [] })
    }),
    {
      name: 'humanizer-search',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**Option 3: Integrate with tab state** (Most robust, aligns with existing architecture)
```typescript
// types/tabs.ts - Add search state to TabState
export interface TabState {
  // ... existing fields ...
  search?: {
    query: string;
    conversationResults: SearchResult[];
    documentResults: DocumentSearchResult[];
    hasSearched: boolean;
  };
}
```

Then use the existing tab sync mechanism in `App.tsx` to persist/restore search state when switching tabs.

---

## Issue #5: Missing Type Filters in Search UI

### Observed Behavior (Code Analysis)
**File**: `SemanticSearch.tsx` lines 92-243

The search UI contains:
1. Search header (lines 94-97)
2. Search input + button (lines 99-116)
3. Error display (lines 118-123)
4. Results display (lines 125-243)

**There are NO filter controls** for result types.

Looking at the CSS (`SemanticSearch.css`), there are no classes defined for filters/toggles beyond the basic search input and results sections.

### Expected Behavior
Users should be able to filter search results by type:
- **All** (default) - Show both conversations and documents
- **Conversations only** - Hide document results
- **Documents only** - Hide conversation results

Optional advanced filters:
- Date range (conversation date, document ingestion date)
- File type (for documents: PDF, MD, TXT, Image)
- Similarity threshold slider

### Root Cause Analysis
The feature was **not implemented**. The component structure shows it was designed to display both types of results, but without user controls to filter them.

**Current filter capability**: None. Users see all results from both searches.

**Backend support**: The API calls already support filtering:
```typescript
// Line 42-43
api.semanticSearch(query, 20, 0.0),  // limit=20
api.searchDocuments({ query, semantic: true, limit: 20 })  // Can add file_types filter
```

The `searchDocuments` API likely supports `file_types` parameter (common pattern), but the UI doesn't expose it.

### Severity
**Low** - Nice-to-have feature, not blocking core search functionality

### Fix Complexity
**Medium** - UI + state logic (1-2 hours)

### Recommendation

**Phase 1: Simple type filter** (Quick win)
```typescript
// Add state
const [resultTypeFilter, setResultTypeFilter] = useState<'all' | 'conversations' | 'documents'>('all');

// Add UI (after search input)
<div className="search-filters">
  <div className="filter-group">
    <label>Show:</label>
    <div className="filter-buttons">
      <button
        className={resultTypeFilter === 'all' ? 'active' : ''}
        onClick={() => setResultTypeFilter('all')}
      >
        All
      </button>
      <button
        className={resultTypeFilter === 'conversations' ? 'active' : ''}
        onClick={() => setResultTypeFilter('conversations')}
      >
        💬 Conversations ({conversationResults.length})
      </button>
      <button
        className={resultTypeFilter === 'documents' ? 'active' : ''}
        onClick={() => setResultTypeFilter('documents')}
      >
        📚 Documents ({documentResults.length})
      </button>
    </div>
  </div>
</div>

// Filter results in render
const filteredConversationResults = resultTypeFilter === 'documents' ? [] : conversationResults;
const filteredDocumentResults = resultTypeFilter === 'conversations' ? [] : documentResults;
```

Add CSS:
```css
.search-filters {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.filter-buttons {
  display: flex;
  gap: 6px;
}

.filter-buttons button {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.filter-buttons button.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  font-weight: 500;
}

.filter-buttons button:hover:not(.active) {
  background: var(--color-surface);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
```

**Phase 2: Advanced filters** (Future enhancement)
- Similarity threshold slider (show only results > X%)
- Date range picker
- Document file type filter (PDF, MD, TXT, Images)

---

## Overall Assessment

### Blockers (Critical - Must Fix Before Release)
**None** - All issues are usability/UX improvements, not functional blockers

### High Priority (Major UX Impact)
1. **Issue #2: Search Result Ordering** - Users may miss most relevant results
   - Impact: High (affects core search value proposition)
   - Effort: Easy (30 min)
   - **Recommendation: Fix immediately**

2. **Issue #3: Result Click Navigation** - Broken navigation flow
   - Impact: High (confusing UX, breaks expected behavior)
   - Effort: Trivial (15 min)
   - **Recommendation: Fix immediately**

### Medium Priority (Noticeable UX Friction)
3. **Issue #1: Document Viewer Header Layout** - Potential cramping/overflow
   - Impact: Medium (affects readability, especially on tablets)
   - Effort: Easy (30-45 min)
   - **Recommendation: Fix before next release**

4. **Issue #4: Search Persistence** - Must re-enter queries
   - Impact: Medium (annoying but not blocking)
   - Effort: Easy (30-45 min)
   - **Recommendation: Fix before next release**

### Low Priority (Nice-to-Have)
5. **Issue #5: Missing Type Filters** - Cannot filter by result type
   - Impact: Low (workaround: scroll past unwanted results)
   - Effort: Medium (1-2 hours for Phase 1)
   - **Recommendation: Add to backlog for next iteration**

---

## Quick Wins (< 30 minutes each)

### Immediate Fixes (Total: ~45 minutes)
1. **Issue #3: Result Click Navigation** (15 min)
   - Add `onViewChange` prop to `SemanticSearch`
   - Thread through `SearchView` wrapper
   - Call in click handlers

2. **Issue #2: Search Result Ordering** (30 min)
   - Create `UnifiedSearchResult` type
   - Combine and sort by score
   - Render single sorted list

### Next Sprint (Total: ~2 hours)
3. **Issue #1: Document Viewer Header** (30-45 min)
   - Move chunk navigation to separate row
   - Test on multiple screen widths

4. **Issue #4: Search Persistence** (30-45 min)
   - Add sessionStorage for query/results
   - Or integrate with tab state

5. **Issue #5: Type Filters Phase 1** (1-2 hours)
   - Add filter buttons UI
   - Filter results in render logic

---

## Design Considerations

### Search Result Display Strategy
**Current**: Grouped by type (Conversations, then Documents)
**Proposed**: Unified list sorted by score

**Question for design**: Should we offer both views?
- **Option A**: Default to unified (sorted by score), add toggle to switch to grouped view
- **Option B**: Always unified, remove sections entirely
- **Option C**: Keep grouped, but sort within each section, and reorder sections (highest-scoring section first)

**Recommendation**: Option A - unified default with optional grouped toggle

### Search Persistence Scope
**Question**: Should search state persist across:
- **Session only** (sessionStorage) - Clears when browser tab closes
- **Browser** (localStorage) - Persists across browser restarts
- **Per-tab** (integrated with tab store) - Each tab has independent search state

**Recommendation**: Per-tab persistence (aligns with existing multi-tab architecture)

### Document Viewer Header Density
**Current**: 5 separate rows in header (title, metadata, view modes, width, actions)
**Alternative**: Consolidate some rows to reduce vertical space

**Question**: Is the header too tall? Should some controls move to a toolbar or sidebar?

**Recommendation**: Keep current structure but move chunk navigation to separate row to fix cramping issue. Monitor user feedback on header density.

---

## Priority Ranking (by Impact × Effort)

1. **Issue #3: Result Click Navigation** - High impact, trivial effort → **Fix NOW**
2. **Issue #2: Search Result Ordering** - High impact, easy effort → **Fix NOW**
3. **Issue #4: Search Persistence** - Medium impact, easy effort → **Fix this sprint**
4. **Issue #1: Document Viewer Header** - Medium impact, easy effort → **Fix this sprint**
5. **Issue #5: Type Filters** - Low impact, medium effort → **Backlog**

---

## Testing Notes

**Unable to perform visual testing** due to Chrome DevTools MCP session issues ("detached Frame" error).

**Recommendation**: After implementing fixes, conduct manual testing:
1. Test document viewer header on screens: 600px, 768px, 1024px, 1440px
2. Test unified search results with queries returning mixed types
3. Test result click navigation flows (both conversation and document)
4. Test search persistence (navigate away and back)
5. Test type filters with various filter combinations

**Automated testing**: Consider adding Playwright tests for these user flows to prevent regression.

---

## Code Files Modified (Proposed)

### High Priority Fixes
1. `/Users/tem/humanizer_root/frontend/src/components/search/SemanticSearch.tsx`
   - Add `onViewChange` prop
   - Implement unified result sorting
   - Add search persistence

2. `/Users/tem/humanizer_root/frontend/src/components/layout/Sidebar.tsx`
   - Update `SearchView` to pass `onViewChange`

3. `/Users/tem/humanizer_root/frontend/src/components/documents/DocumentViewer.tsx`
   - Restructure header layout (move chunk navigation)

4. `/Users/tem/humanizer_root/frontend/src/components/documents/DocumentViewer.css`
   - Add `.chunk-navigation-row` styles

### Future Enhancements
5. `/Users/tem/humanizer_root/frontend/src/components/search/SemanticSearch.css`
   - Add filter UI styles

6. `/Users/tem/humanizer_root/frontend/src/store/search.ts` (NEW)
   - Optional: Create Zustand search store

---

**End of Report**
