# UX Fixes - Priority List
**Date**: October 18, 2025
**Full Report**: `UX_ISSUES_REPORT_OCT18.md`

---

## IMMEDIATE FIXES (45 minutes total)

### 1. Result Click Navigation (15 min) - HIGH PRIORITY
**File**: `frontend/src/components/search/SemanticSearch.tsx`
**Issue**: Clicking search results doesn't switch to appropriate view

**Fix**:
```typescript
// Add prop to interface (line 14)
interface SemanticSearchProps {
  // ... existing props
  onViewChange?: (view: SidebarView) => void;  // ADD THIS
}

// Update click handlers (lines 63-76)
const handleConversationClick = (result: SearchResult) => {
  if (onSelectConversation) {
    onSelectConversation(result.conversation_uuid);
  }
  if (onViewChange) {
    onViewChange('conversations');  // ADD THIS
  }
};

const handleDocumentClick = (result: DocumentSearchResult) => {
  if (onSelectDocument) {
    onSelectDocument(result.document_id);
  }
  if (onViewChange) {
    onViewChange('documents');  // ADD THIS
  }
};
```

**File**: `frontend/src/components/layout/Sidebar.tsx`
**Fix**:
```typescript
// Update SearchView (line 178)
function SearchView({
  onSelectConversation,
  onSelectDocument,
  onViewChange  // ADD THIS
}: {
  onSelectConversation?: (uuid: string) => void,
  onSelectDocument?: (documentId: string) => void,
  onViewChange?: (view: SidebarView) => void  // ADD THIS
}) {
  return (
    <SemanticSearch
      onSelectConversation={onSelectConversation}
      onSelectDocument={onSelectDocument}
      onViewChange={onViewChange}  // ADD THIS
    />
  );
}

// Update call site (line 141)
{currentView === 'search' && (
  <SearchView
    onSelectConversation={onSelectConversation}
    onSelectDocument={onSelectDocument}
    onViewChange={onViewChange}  // ADD THIS (already available from props)
  />
)}
```

---

### 2. Search Result Ordering (30 min) - HIGH PRIORITY
**File**: `frontend/src/components/search/SemanticSearch.tsx`
**Issue**: Documents with high scores appear below conversations with low scores

**Fix**:
```typescript
// 1. Add unified result type (after line 12)
type UnifiedSearchResult = {
  type: 'conversation' | 'document';
  score: number;
  data: SearchResult | DocumentSearchResult;
};

// 2. Replace separate state (line 26-27)
const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>([]);

// 3. Update handleSearch (lines 32-54)
const handleSearch = async () => {
  if (!query.trim()) return;

  setIsLoading(true);
  setError(null);
  setHasSearched(true);

  try {
    const [conversationResponse, documentResponse] = await Promise.all([
      api.semanticSearch(query, 20, 0.0),
      api.searchDocuments({ query, semantic: true, limit: 20 })
    ]);

    // Combine and sort by score
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

    const combined = [...conversationUnified, ...documentUnified]
      .sort((a, b) => b.score - a.score);

    setUnifiedResults(combined);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Search failed');
    console.error('Search error:', err);
  } finally {
    setIsLoading(false);
  }
};

// 4. Update render logic (replace lines 137-240)
{hasSearched && unifiedResults.length === 0 ? (
  <div className="search-empty">
    <span className="empty-icon">🔍</span>
    <p>No results found</p>
    <small>Try a different query</small>
  </div>
) : unifiedResults.length > 0 ? (
  <>
    <div className="results-header">
      <span className="results-count">{unifiedResults.length} results</span>
      <span className="results-query">"{query}"</span>
    </div>

    <div className="results-list">
      {unifiedResults.map((result, idx) => (
        result.type === 'conversation' ? (
          <div
            key={`conv-${(result.data as SearchResult).uuid}`}
            className="result-item"
            onClick={() => handleConversationClick(result.data as SearchResult)}
          >
            {/* Conversation result markup */}
            <div className="result-header">
              <span className="result-role">{(result.data as SearchResult).author_role}</span>
              <span
                className="result-similarity"
                style={{ color: getSimilarityColor(result.score) }}
              >
                {(result.score * 100).toFixed(0)}% <small>{getSimilarityLabel(result.score)}</small>
              </span>
            </div>
            <div className="result-content">
              {(result.data as SearchResult).content_text.length > 200
                ? (result.data as SearchResult).content_text.substring(0, 200) + '...'
                : (result.data as SearchResult).content_text}
            </div>
            <div className="result-footer">
              <small className="result-uuid">
                {(result.data as SearchResult).conversation_uuid.substring(0, 8)}
              </small>
              <small className="result-distance">
                Distance: {(result.data as SearchResult).distance.toFixed(3)}
              </small>
            </div>
          </div>
        ) : (
          <div
            key={`doc-${(result.data as DocumentSearchResult).document_id}-${idx}`}
            className="result-item document-result"
            onClick={() => handleDocumentClick(result.data as DocumentSearchResult)}
          >
            {/* Document result markup */}
            <div className="result-header">
              <span className="result-role">📄 {(result.data as DocumentSearchResult).document_title}</span>
              <span
                className="result-similarity"
                style={{ color: getSimilarityColor(result.score) }}
              >
                {(result.score * 100).toFixed(0)}% <small>{getSimilarityLabel(result.score)}</small>
              </span>
            </div>
            <div className="result-content">
              {(result.data as DocumentSearchResult).highlight ||
               ((result.data as DocumentSearchResult).chunk_text?.substring(0, 200) + '...' ||
                'No preview available')}
            </div>
            <div className="result-footer">
              <small className="result-uuid">
                {(result.data as DocumentSearchResult).document_filename}
              </small>
              {(result.data as DocumentSearchResult).page_number && (
                <small className="result-page">
                  Page {(result.data as DocumentSearchResult).page_number}
                </small>
              )}
              {(result.data as DocumentSearchResult).chunk_index !== undefined && (
                <small className="result-chunk">
                  Chunk {(result.data as DocumentSearchResult).chunk_index! + 1}
                </small>
              )}
            </div>
          </div>
        )
      ))}
    </div>
  </>
) : null}
```

---

## NEXT SPRINT FIXES (~2 hours total)

### 3. Document Viewer Header Layout (30-45 min) - MEDIUM PRIORITY
**File**: `frontend/src/components/documents/DocumentViewer.tsx`
**Issue**: Chunk navigation cramped in title row

**Fix**:
```typescript
// Replace lines 274-301
<div className="document-title-row">
  <span className="file-type-icon">{getFileTypeIcon(docData.file_type)}</span>
  <h1 className="document-title">{docData.title || docData.filename}</h1>
</div>

{/* Move chunk navigation to separate row */}
{viewMode === 'chunks' && chunks.length > 0 && (
  <div className="chunk-navigation-row">
    <div className="chunk-navigation">
      <button
        className="nav-button"
        onClick={goToPreviousChunk}
        disabled={currentChunkIndex === 0}
        title="Previous chunk"
      >
        ◀ Previous
      </button>
      <span className="chunk-position">
        {currentChunkIndex + 1} of {chunks.length}
      </span>
      <button
        className="nav-button"
        onClick={goToNextChunk}
        disabled={currentChunkIndex === chunks.length - 1}
        title="Next chunk"
      >
        Next ▶
      </button>
    </div>
  </div>
)}
```

**File**: `frontend/src/components/documents/DocumentViewer.css`
**Add** (after line 72):
```css
/* Chunk Navigation Row */
.chunk-navigation-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-md, 15px);
}
```

---

### 4. Search Persistence (30-45 min) - MEDIUM PRIORITY
**File**: `frontend/src/components/search/SemanticSearch.tsx`
**Issue**: Search query and results cleared when navigating away

**Fix** (Option 1 - sessionStorage):
```typescript
// Update state initialization (lines 25-30)
const [query, setQuery] = useState(() => {
  return sessionStorage.getItem('search-query') || '';
});

const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>(() => {
  const saved = sessionStorage.getItem('search-unified-results');
  return saved ? JSON.parse(saved) : [];
});

const [hasSearched, setHasSearched] = useState(() => {
  return sessionStorage.getItem('search-has-searched') === 'true';
});

// Add persistence effects
useEffect(() => {
  sessionStorage.setItem('search-query', query);
}, [query]);

useEffect(() => {
  sessionStorage.setItem('search-unified-results', JSON.stringify(unifiedResults));
}, [unifiedResults]);

useEffect(() => {
  sessionStorage.setItem('search-has-searched', hasSearched.toString());
}, [hasSearched]);
```

---

## BACKLOG (Future Enhancement)

### 5. Type Filters (1-2 hours) - LOW PRIORITY
**File**: `frontend/src/components/search/SemanticSearch.tsx`
**Issue**: Cannot filter results by type

**Fix**:
```typescript
// Add state
const [resultTypeFilter, setResultTypeFilter] = useState<'all' | 'conversations' | 'documents'>('all');

// Add UI after search input (after line 116)
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
        💬 Conversations
      </button>
      <button
        className={resultTypeFilter === 'documents' ? 'active' : ''}
        onClick={() => setResultTypeFilter('documents')}
      >
        📚 Documents
      </button>
    </div>
  </div>
</div>

// Filter results before rendering
const filteredResults = unifiedResults.filter(result => {
  if (resultTypeFilter === 'all') return true;
  return result.type === resultTypeFilter;
});
```

**File**: `frontend/src/components/search/SemanticSearch.css`
**Add**:
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

---

## Testing Checklist

After implementing fixes:

### Immediate Fixes
- [ ] Click conversation result → switches to Conversations view + opens conversation
- [ ] Click document result → switches to Documents view + opens DocumentViewer
- [ ] Search "quantum" → results sorted by score (mixed types, highest first)
- [ ] Verify document with 95% similarity appears before conversation with 60%

### Next Sprint Fixes
- [ ] Open document in chunks view → navigation appears in separate row (not cramped)
- [ ] Test document viewer header at 600px, 768px, 1024px, 1440px widths
- [ ] Enter search query → navigate to Conversations → back to Search → query still present
- [ ] Run search → navigate away → back to Search → results still displayed

### Backlog
- [ ] Toggle "All" / "Conversations" / "Documents" filter
- [ ] Verify filtered results match selected type
- [ ] Counts update correctly in filter buttons

---

**Total Immediate Fix Time**: ~45 minutes
**Total Next Sprint Time**: ~2 hours
**Total Backlog Time**: ~1-2 hours

**Priority**: Fix #1 and #2 immediately (high impact, low effort)
