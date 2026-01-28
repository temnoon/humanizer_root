# Buffer-Centric Architecture Plan

**Created**: January 28, 2026
**Status**: ✅ COMPLETE
**Completed**: January 28, 2026
**Priority**: CRITICAL - This is the foundation for GUI/AUI sync

---

## Executive Summary

The AUI Buffer System becomes the **single source of truth** for all content displayed in the Studio UI. No frontend storage - components subscribe to buffer state and reflect changes in real-time.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUI BUFFER SYSTEM (Backend)                      │
│  BufferManager in packages/core - versioned, branched, persistent    │
├─────────────────────────────────────────────────────────────────────┤
│                              ↕ API                                   │
├─────────────────────────────────────────────────────────────────────┤
│                   BufferSyncContext (Frontend)                       │
│  Subscribes to buffer state, provides reactive hooks                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐              │
│  │  Archive    │→ │   Workspace    │ ←│    Tools     │              │
│  │  (browse)   │  │ (display/edit) │  │ (transform)  │              │
│  └─────────────┘  └────────────────┘  └──────────────┘              │
│       │                   ↕                   │                      │
│       └────────→ READ/WRITE BUFFER ←──────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Core Principle

**Every piece of content on screen comes from a buffer.**

| Action | Buffer Operation |
|--------|------------------|
| User clicks Archive item | `setBufferContent("workspace", [item])` |
| User edits in workspace | `setBufferContent("workspace", [editedItem])` |
| Tool transforms content | `setBufferContent("workspace", [transformedItem])` |
| AUI executes command | Same buffer operations as GUI |
| Undo | `rollback("workspace", 1)` |

---

## 2. Implementation Phases

### Phase 1: BufferSyncContext (Core Integration)

Create the bridge between backend BufferManager and frontend React.

**File**: `packages/studio/src/contexts/BufferSyncContext.tsx`

```typescript
interface BufferSyncState {
  // Session
  sessionId: string | null;
  isConnected: boolean;

  // Active buffer
  activeBufferName: string;
  activeBuffer: VersionedBuffer | null;
  workingContent: unknown[];
  isDirty: boolean;

  // All buffers
  buffers: BufferSummary[];

  // History
  canUndo: boolean;
  canRedo: boolean;
}

interface BufferSyncActions {
  // Buffer management
  createBuffer: (name: string, content?: unknown[]) => Promise<void>;
  switchBuffer: (name: string) => Promise<void>;
  deleteBuffer: (name: string) => Promise<void>;

  // Content operations
  setContent: (content: unknown[]) => Promise<void>;
  appendContent: (items: unknown[]) => Promise<void>;
  clearContent: () => Promise<void>;

  // Version control
  commit: (message: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  checkout: (versionId: string) => Promise<void>;

  // Convenience
  importText: (text: string, metadata?: Record<string, unknown>) => Promise<void>;
  importArchiveNode: (node: ArchiveNode) => Promise<void>;
}
```

**Key Features**:
- Initializes session on mount
- Creates default "workspace" buffer
- Polls or subscribes for changes (enables AUI sync)
- All state changes flow through buffer API

### Phase 2: Wire Archive → Buffer

When user selects content in Archive, it goes to the workspace buffer.

**Modify**: Archive components to call `importArchiveNode(node)`

```typescript
// In ArchiveBrowser.tsx
const { importArchiveNode } = useBufferSync();

const handleNodeClick = (node: ArchiveNode) => {
  importArchiveNode(node);
};
```

**Flow**:
1. User clicks conversation/message in Archive
2. `importArchiveNode(node)` called
3. Node wrapped as ContentItem, added to workspace buffer
4. Workspace component (subscribed to buffer) re-renders with new content

### Phase 3: Wire Workspace ← Buffer

Workspace reads from buffer, never local state.

**Modify**: `MainWorkspace.tsx`

```typescript
function MainWorkspace() {
  const { workingContent, isDirty } = useBufferSync();

  // Content comes from buffer, not props
  const displayContent = useMemo(() => {
    return workingContent.map(item => formatForDisplay(item));
  }, [workingContent]);

  return (
    <div className="workspace">
      {displayContent.map(item => (
        <ContentRenderer key={item.id} content={item} />
      ))}
      {isDirty && <UnsavedIndicator />}
    </div>
  );
}
```

### Phase 4: Wire Tools → Buffer

Transformations write to buffer.

**Modify**: Tool components to use buffer

```typescript
// In TransformTool.tsx
const { workingContent, setContent, commit } = useBufferSync();

const handleTransform = async (transformType: string) => {
  const text = extractText(workingContent);
  const result = await api.transform(text, transformType);

  // Update buffer with transformed content
  await setContent([{
    type: 'transformed',
    text: result.text,
    metadata: {
      originalText: text,
      transformType,
      timestamp: Date.now(),
    }
  }]);

  // Auto-commit transformation
  await commit(`Transform: ${transformType}`);
};
```

### Phase 5: Sync AUI with Buffer State

AUI context subscribes to buffer changes.

**Modify**: `AUIContext` or create bridge

```typescript
// AUI can observe buffer state
const { workingContent, activeBufferName } = useBufferSync();

// Provide to AUI system prompt
const workspaceContext = {
  currentBuffer: activeBufferName,
  contentPreview: workingContent.slice(0, 3).map(summarize),
  itemCount: workingContent.length,
};
```

**AUI Tool Execution**:
When AUI executes `USE_TOOL(buffer_set, {...})`, the change flows:
1. AUI → API → BufferManager (backend)
2. BufferSyncContext polls/receives update
3. All subscribed components re-render
4. GUI reflects AUI's action

---

## 3. File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/contexts/BufferSyncContext.tsx` | Core buffer integration |
| `src/hooks/useBufferContent.ts` | Convenience hook for content access |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Wrap with `BufferSyncProvider` |
| `src/components/CornerAssistant.tsx` | Use buffer for search context |
| `src/components/workspace/MainWorkspace.tsx` | Read from buffer, not props |
| `src/components/archive/*.tsx` | Call `importArchiveNode` on selection |
| `src/components/tools/*.tsx` | Read/write through buffer |

---

## 4. Buffer Conventions

### Standard Buffers

| Buffer Name | Purpose |
|-------------|---------|
| `workspace` | Main editing area (default active) |
| `clipboard` | Copy/paste staging |
| `history` | Recently viewed items |
| `harvest` | Collected items for book creation |

### Content Item Schema

```typescript
interface ContentItem {
  id: string;
  type: 'text' | 'message' | 'conversation' | 'media' | 'transformed';
  text: string;
  metadata: {
    source?: {
      type: string;      // 'chatgpt', 'claude', 'facebook', etc.
      path: string[];    // Breadcrumb path
      nodeId?: string;   // Original archive node ID
    };
    author?: string;
    timestamp?: number;
    wordCount?: number;
    transformHistory?: TransformRecord[];
  };
}
```

---

## 5. Offline/Error Handling

```typescript
// BufferSyncContext handles connection state
const { isConnected, connectionError, retry } = useBufferSync();

// Components can show offline indicator
if (!isConnected) {
  return <OfflineIndicator onRetry={retry} />;
}

// Optimistic updates with rollback on error
try {
  await setContent(newContent);
} catch (error) {
  // Rollback handled by context
  showError('Failed to update content');
}
```

---

## 6. Testing Strategy

### Unit Tests
- BufferSyncContext state transitions
- Content item serialization
- Undo/redo stack

### Integration Tests
- Archive selection → buffer → workspace display
- Tool transformation → buffer update
- AUI command → buffer → GUI reflection

### E2E Tests
- Full flow: login → browse archive → select → transform → save

---

## 7. Migration Path

1. **Phase 1**: Add BufferSyncContext alongside existing state
2. **Phase 2**: Migrate Archive components one by one
3. **Phase 3**: Migrate Workspace to read from buffer
4. **Phase 4**: Migrate Tools to write to buffer
5. **Phase 5**: Remove old content state, clean up

---

## 8. Success Criteria

- [x] All displayed content comes from buffer
- [x] Archive selection populates buffer
- [x] Transformations update buffer
- [x] Undo/redo works via buffer history
- [x] AUI commands reflect in GUI immediately (via polling)
- [x] GUI actions reflect in AUI context
- [x] No content state in individual components

---

## 9. Appendix: API Endpoints Required

The ApiContext already has these (verified):

```typescript
listBuffers: (sessionId) => GET /sessions/{id}/buffers
createBuffer: (sessionId, name, content) => POST /sessions/{id}/buffers
getBuffer: (sessionId, name) => GET /sessions/{id}/buffers/{name}
setBufferContent: (sessionId, name, content) => PUT /sessions/{id}/buffers/{name}/content
appendToBuffer: (sessionId, name, items) => POST /sessions/{id}/buffers/{name}/append
commitBuffer: (sessionId, name, message) => POST /sessions/{id}/buffers/{name}/commit
getBufferHistory: (sessionId, name, limit) => GET /sessions/{id}/buffers/{name}/history
```

---

**End of Plan**
