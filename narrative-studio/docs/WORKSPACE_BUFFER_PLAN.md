# Workspace Buffer System - Implementation Plan

**Created**: Dec 8, 2025
**Status**: Ready for Implementation
**Branch**: `feature/workspace-buffers` (created from `architecture-remediation-dec06`)

---

## Overview

Replace the broken "session" system with a **Workspace** model that:
- Persists transformation chains as buffer trees
- Allows branching (multiple transformation paths from any buffer)
- Integrates with Archive Panel for discoverability
- Works across platforms (web, mobile, Electron)
- Enables interrupted workflows ("work on train, finish later")

---

## Data Model

### Workspace

```typescript
// src/types/workspace.ts

export interface Workspace {
  id: string;                      // UUID
  name: string;                    // User-editable, e.g., "Heart Sutra Humanization"
  createdAt: number;               // Unix timestamp
  updatedAt: number;               // Auto-updated on any change

  // Where the original content came from
  source: WorkspaceSource;

  // Buffer tree
  rootBufferId: string;            // The original content buffer
  buffers: Record<string, Buffer>; // All buffers keyed by ID
  activeBufferId: string;          // Currently selected for operations
  compareBufferId?: string;        // Optional: buffer shown in left pane for comparison

  // User organization
  starredBufferIds: string[];      // Favorites for quick access
  archived: boolean;               // Hide from main list without deleting
}

export interface WorkspaceSource {
  type: 'archive-message' | 'book-passage' | 'paste' | 'import' | 'blank';

  // Archive message source
  archiveName?: string;
  conversationId?: string;
  conversationTitle?: string;
  messageIndex?: number;

  // Book passage source
  bookId?: string;
  bookTitle?: string;
  chapterId?: string;
  passageId?: string;

  // Import source
  fileName?: string;
  importedAt?: number;
}

export interface Buffer {
  id: string;                      // UUID
  parentId: string | null;         // null for root buffer
  childIds: string[];              // Buffers derived from this one

  // Content
  content: string;                 // The actual text
  contentHash?: string;            // For deduplication/change detection

  // Creation metadata
  createdAt: number;

  // How this buffer was created (null for root/original)
  transform?: BufferTransform;

  // Cached analysis (populated by AI Analysis tool)
  analysis?: BufferAnalysis;

  // User annotations
  displayName?: string;            // Auto-generated or user-edited
  starred: boolean;
  note?: string;                   // User's notes, e.g., "This version worked best"
  color?: string;                  // Optional color tag for visual organization
}

export interface BufferTransform {
  type: 'humanizer' | 'persona' | 'style' | 'round-trip' | 'ai-analysis' | 'manual-edit';

  // Tool-specific parameters
  parameters: {
    // Humanizer
    intensity?: 'light' | 'moderate' | 'aggressive';
    useLLM?: boolean;

    // Persona
    personaId?: string;
    personaName?: string;

    // Style
    styleId?: string;
    styleName?: string;

    // Round-trip
    intermediateLanguage?: string;

    // Manual edit
    editDescription?: string;
  };

  timestamp: number;

  // Metrics from transformation
  metrics?: {
    processingTimeMs?: number;
    modelUsed?: string;
    provider?: string;
  };
}

export interface BufferAnalysis {
  // AI Detection results
  aiScore?: number;                // 0-100
  aiVerdict?: 'human' | 'mixed' | 'ai';
  confidence?: 'low' | 'medium' | 'high';

  // Tell-words found
  tellWords?: Array<{
    word: string;
    count: number;
    category: string;
  }>;

  // Highlight ranges (for rendering)
  highlights?: Array<{
    start: number;
    end: number;
    type: 'tellword' | 'suspect' | 'gptzero';
    reason: string;
  }>;

  // GPTZero results (if available)
  gptzeroScore?: number;
  gptzeroSentences?: number;

  // Burstiness and other metrics
  burstiness?: number;

  // When analysis was performed
  analyzedAt: number;
}

// Helper type for buffer tree operations
export interface BufferNode extends Buffer {
  children: BufferNode[];
  depth: number;
  isActive: boolean;
  isCompare: boolean;
}
```

### Workspace List (for Archive Panel)

```typescript
export interface WorkspaceSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: WorkspaceSource;
  bufferCount: number;
  starredCount: number;
  archived: boolean;

  // Preview
  previewText?: string;            // First 100 chars of root buffer
  bestAiScore?: number;            // Lowest AI score among analyzed buffers
}
```

---

## Phase 1: Data Model & Persistence

### Tasks

1. **Create type definitions**
   - [ ] Create `src/types/workspace.ts` with interfaces above
   - [ ] Export from `src/types/index.ts`

2. **Create WorkspaceContext**
   - [ ] Create `src/contexts/WorkspaceContext.tsx`
   - [ ] State: `workspaces: Workspace[]`, `activeWorkspaceId: string | null`
   - [ ] Actions:
     - `createWorkspace(source, initialContent)` → creates workspace + root buffer
     - `loadWorkspace(id)` → sets active workspace
     - `saveWorkspace()` → persists to storage
     - `deleteWorkspace(id)`
     - `renameWorkspace(id, name)`
     - `archiveWorkspace(id)`

3. **Buffer operations in WorkspaceContext**
   - [ ] `createBuffer(parentId, transform, content)` → adds child buffer
   - [ ] `setActiveBuffer(bufferId)`
   - [ ] `setCompareBuffer(bufferId)`
   - [ ] `updateBufferAnalysis(bufferId, analysis)`
   - [ ] `toggleBufferStar(bufferId)`
   - [ ] `setBufferNote(bufferId, note)`
   - [ ] `getBufferTree()` → returns nested BufferNode[] for tree UI

4. **Persistence layer**
   - [ ] Create `src/services/workspaceStorage.ts`
   - [ ] `saveWorkspace(workspace)` → localStorage initially
   - [ ] `loadWorkspace(id)` → from localStorage
   - [ ] `listWorkspaces()` → returns WorkspaceSummary[]
   - [ ] `deleteWorkspace(id)`
   - [ ] Key format: `humanizer-workspace-{id}`
   - [ ] Index key: `humanizer-workspace-index` (list of IDs + summaries)

5. **Migration from SessionContext**
   - [ ] Check for existing sessions in localStorage
   - [ ] Convert to workspace format
   - [ ] Mark old session keys for cleanup

### Files to Create
- `src/types/workspace.ts`
- `src/contexts/WorkspaceContext.tsx`
- `src/services/workspaceStorage.ts`

### Files to Modify
- `src/types/index.ts` (export new types)
- `src/App.tsx` (add WorkspaceProvider)

---

## Phase 2: Wire TabbedToolsPanel to Workspaces

### Tasks

1. **Remove isolated tool state for results**
   - [ ] Remove `lastResult` from ToolTabContext tool states
   - [ ] Keep tool *settings* (intensity, persona selection, etc.)
   - [ ] Results now live in workspace buffers

2. **Connect TabbedToolsPanel to WorkspaceContext**
   - [ ] Import `useWorkspace` hook
   - [ ] Get active buffer content from workspace
   - [ ] Remove `content` prop dependency (or use as fallback when no workspace)

3. **Update tool panes to create buffers**
   - [ ] HumanizerPane: on success, call `createBuffer(activeBufferId, transform, result)`
   - [ ] PersonaPane: same pattern
   - [ ] StylePane: same pattern
   - [ ] RoundTripPane: same pattern
   - [ ] AIAnalysisPane: call `updateBufferAnalysis(activeBufferId, analysis)`

4. **Replace Source dropdown with buffer selector**
   - [ ] Remove old `transformSource` state
   - [ ] Show buffer tree dropdown
   - [ ] Selecting buffer calls `setActiveBuffer(id)`

5. **Auto-create workspace when needed**
   - [ ] If no active workspace when tool is used, create one
   - [ ] Use current narrative/message as source
   - [ ] Name auto-generated from source title

### Files to Modify
- `src/contexts/ToolTabContext.tsx` (remove lastResult from states)
- `src/components/tools/TabbedToolsPanel.tsx` (wire to WorkspaceContext)
- `src/components/tools/ToolPanes.tsx` (all tool panes)
- `src/components/tools/AIAnalysisPane.tsx`

---

## Phase 3: Archive Panel - Workspaces Tab

### Tasks

1. **Add Workspaces tab icon**
   - [ ] Add to tab bar in ArchivePanel
   - [ ] Icon: 💾 or similar
   - [ ] Position after Books, before Explore

2. **Create WorkspacesView component**
   - [ ] List workspaces with cards showing:
     - Name (editable)
     - Source (e.g., "Message #9 from Heart Sutra...")
     - Buffer count, starred count
     - Last modified time
     - Preview text snippet
     - Best AI score badge (if analyzed)
   - [ ] Sort by last modified (default) or created date
   - [ ] Filter: All / Starred / Archived

3. **Workspace actions**
   - [ ] Click card → load workspace into main pane
   - [ ] Rename (inline edit)
   - [ ] Star/unstar
   - [ ] Archive (soft delete)
   - [ ] Delete (with confirmation)
   - [ ] Duplicate workspace

4. **Create workspace flow**
   - [ ] "New Workspace" button
   - [ ] Options: Blank, From current content, From clipboard
   - [ ] Auto-create when sending content from archive message

5. **Send to Workspace action**
   - [ ] Add to message context menu in ConversationsView
   - [ ] Add to passage context menu in BooksView
   - [ ] Creates new workspace with that content as source

### Files to Create
- `src/components/archive/WorkspacesView.tsx`
- `src/components/archive/WorkspaceCard.tsx`

### Files to Modify
- `src/components/panels/ArchivePanel.tsx` (add tab)
- `src/components/archive/ConversationsView.tsx` (add "Send to Workspace")
- `src/components/archive/BooksView.tsx` (add "Send to Workspace")

---

## Phase 4: Buffer Tree UI in Tools Panel

### Tasks

1. **Create BufferTreeView component**
   - [ ] Collapsible tree showing buffer hierarchy
   - [ ] Each node shows:
     - Transform type icon (🤖 humanizer, 👤 persona, etc.)
     - Short name (auto or user-set)
     - AI score badge if analyzed
     - Star indicator
   - [ ] Visual indicators:
     - Active buffer (highlighted)
     - Compare buffer (different highlight)
     - Has children (expand arrow)

2. **Tree interactions**
   - [ ] Click node → set as active buffer
   - [ ] Shift+click → set as compare buffer
   - [ ] Right-click → context menu (star, rename, add note, delete branch)
   - [ ] Drag branch to reorder? (future)

3. **Integrate into TabbedToolsPanel**
   - [ ] Show tree above tool controls
   - [ ] Collapsible to save space
   - [ ] Show current buffer name in header

4. **Buffer quick actions**
   - [ ] Star/unstar button
   - [ ] Copy content button
   - [ ] View/edit note button

### Files to Create
- `src/components/tools/BufferTreeView.tsx`
- `src/components/tools/BufferNode.tsx`

### Files to Modify
- `src/components/tools/TabbedToolsPanel.tsx`

---

## Phase 5: Main Workspace Buffer Comparison

### Tasks

1. **Update MainWorkspace for workspace mode**
   - [ ] Detect when workspace is active
   - [ ] Left pane: compare buffer (selectable)
   - [ ] Right pane: active buffer
   - [ ] Header shows buffer names

2. **Buffer selector in pane headers**
   - [ ] Dropdown to select which buffer to display
   - [ ] Shows tree structure in dropdown
   - [ ] Quick switch between buffers

3. **Comparison features**
   - [ ] Sync scroll toggle
   - [ ] Show word count delta
   - [ ] Show AI score delta (if both analyzed)

4. **Highlight integration**
   - [ ] AI analysis highlights work on active buffer
   - [ ] Can highlight compare buffer too

5. **Single pane mode option**
   - [ ] Toggle to show only active buffer (more reading space)
   - [ ] Especially useful on mobile

### Files to Modify
- `src/components/workspace/MainWorkspace.tsx`
- `src/components/workspace/BufferTabs.tsx` (repurpose or replace)
- `src/components/workspace/ViewModeToggle.tsx`

---

## Phase 6: Export Pane

### Tasks

1. **Create ExportPane component**
   - [ ] Add to TOOL_REGISTRY in ToolTabContext
   - [ ] Icon: 💾 or 📤
   - [ ] Show current buffer name and word count

2. **Copy to clipboard**
   - [ ] Plain text button
   - [ ] Markdown button
   - [ ] HTML button (for pasting into rich editors)

3. **Download file**
   - [ ] Format selector radio buttons
   - [ ] Filename input (auto-populated from buffer/workspace name)
   - [ ] Download button

4. **Format implementations**
   - [ ] .txt - trivial (plain text)
   - [ ] .md - content as-is (already markdown)
   - [ ] .rtf - convert markdown to RTF
   - [ ] .pdf - use browser print or jspdf library
   - [ ] .docx - use docx library (npm: docx)
   - [ ] .odt - consider for later (less common)

5. **Add to Book integration**
   - [ ] "Add to Book" section in Export pane
   - [ ] Or keep as separate tool tab
   - [ ] Book/chapter/section selector

6. **Workspace save controls**
   - [ ] Save workspace button (manual save)
   - [ ] Rename workspace
   - [ ] Auto-save indicator

### Files to Create
- `src/components/tools/ExportPane.tsx`
- `src/services/documentExport.ts` (format conversion)

### Files to Modify
- `src/contexts/ToolTabContext.tsx` (add to registry)
- `src/components/tools/TabbedToolsPanel.tsx` (render ExportPane)

### Dependencies to Add
- `docx` (npm package for .docx generation)
- `jspdf` (npm package for PDF generation, optional)

---

## Phase 7: Cleanup & Polish

### Tasks

1. **Remove old session system**
   - [ ] Delete `src/contexts/SessionContext.tsx`
   - [ ] Remove SessionProvider from App.tsx
   - [ ] Remove session-related UI components
   - [ ] Clean up session localStorage keys (after migration period)

2. **Update buffer-related code**
   - [ ] Remove `src/contexts/UnifiedBufferContext.tsx` if fully replaced
   - [ ] Or keep for specific use cases and document

3. **Error handling**
   - [ ] Handle storage quota exceeded
   - [ ] Handle corrupted workspace data
   - [ ] Graceful fallback when workspace load fails

4. **Performance optimization**
   - [ ] Lazy load workspace content (only load buffers when needed)
   - [ ] Virtualize long buffer trees
   - [ ] Debounce auto-save

5. **Mobile responsiveness**
   - [ ] Buffer tree works on narrow screens
   - [ ] Touch-friendly interactions
   - [ ] Bottom sheet for buffer selection on mobile

6. **Documentation**
   - [ ] Update CLAUDE.md with workspace architecture
   - [ ] Add inline code comments
   - [ ] Update README if needed

7. **Testing**
   - [ ] Manual test: create workspace from archive message
   - [ ] Manual test: multiple transformation branches
   - [ ] Manual test: export all formats
   - [ ] Manual test: workspace persistence across reload
   - [ ] Manual test: mobile layout

### Files to Delete
- `src/contexts/SessionContext.tsx`
- Session-related components (identify during cleanup)

### Files to Modify
- `src/App.tsx` (remove SessionProvider)
- `CLAUDE.md` (update architecture docs)

---

## Implementation Order

```
Week 1: Foundation
├── Phase 1: Data Model & Persistence (Day 1-2)
│   └── Types, WorkspaceContext, storage
│
└── Phase 2: Wire Tools (Day 3-5)
    └── Connect TabbedToolsPanel, update tool panes

Week 2: UI
├── Phase 3: Archive Panel Tab (Day 1-2)
│   └── WorkspacesView, workspace cards
│
├── Phase 4: Buffer Tree UI (Day 2-3)
│   └── BufferTreeView in Tools Panel
│
└── Phase 5: Main Workspace (Day 4-5)
    └── Comparison view, buffer selectors

Week 3: Export & Cleanup
├── Phase 6: Export Pane (Day 1-2)
│   └── All export formats
│
└── Phase 7: Cleanup (Day 3-5)
    └── Remove old code, polish, test
```

---

## Success Criteria

- [ ] User can send archive message to new workspace
- [ ] User can run multiple transformations, creating buffer tree
- [ ] User can branch from any buffer (not just latest)
- [ ] User can compare any two buffers side by side
- [ ] User can run AI analysis on any buffer and see highlights
- [ ] User can star favorite buffers
- [ ] User can export any buffer to multiple formats
- [ ] Workspaces persist across sessions/reloads
- [ ] Workspaces appear in Archive Panel for easy access
- [ ] Mobile layout works for core functionality
- [ ] Old session code is removed

---

## Future Enhancements (Out of Scope)

- Diff view between two buffers (word-level changes)
- Collaborative workspaces (multi-user)
- Cloud sync for workspaces (archive-server storage)
- Workspace templates
- Undo/redo within buffer (edit history)
- Voice notes attached to buffers
- Image attachments preserved through transformations
