# Session History & Buffer System - Implementation Plan

**Branch**: `feature/session-history-and-buffers`
**Created**: Nov 22, 2025
**Status**: Planning Phase

---

## Overview

Add session history and buffer management system to enable:
- Auto-save transformation/analysis results
- Chain operations (original → transform → analyze → transform again)
- Toggle between Archive and Sessions in left panel
- Multiple buffers with tab navigation
- Single/split pane view modes
- Preserve user edits in buffers

---

## Design Decisions (Finalized)

1. **Left Panel**: Toggle between [Archive] [Sessions] tabs
2. **Session Creation**: Auto-create on first operation, explicit "New Session" button
3. **Buffer Tabs**: Tool names ("Original", "Persona: Holmes", "AI Detection: Lite")
4. **Chaining**: Default transforms ORIGINAL, new "Transform Result" button to chain
5. **Session Naming**: Auto timestamp, user can rename

---

## Data Structures

### Session Schema
```typescript
interface Session {
  sessionId: string;
  name: string; // "Session 2025-11-22 15:30" (user can rename)
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
  sourceArchive: string; // "main-archive"
  sourceMessageId?: string; // if started from archive message

  buffers: Buffer[];
  activeBufferId: string; // currently displayed buffer
  viewMode: 'split' | 'single-original' | 'single-transformed';
}

interface Buffer {
  bufferId: string;
  type: 'original' | 'transformation' | 'analysis' | 'edited';
  displayName: string; // "Original", "Persona: Holmes", etc.

  // Source tracking
  sourceBufferId?: string; // which buffer this came from
  sourceRef?: string; // "archive:main:msg-uuid" for originals
  sourceSelection?: { start: number; end: number };

  // Tool info (for transformations/analysis)
  tool?: string; // "persona", "ai-detection-lite"
  settings?: Record<string, any>; // tool parameters

  // Content
  text?: string; // full text (null for archive refs)
  resultText?: string; // transformation result
  analysisResult?: any; // analysis output
  metadata?: Record<string, any>;

  // User modifications
  userEdits?: Edit[];
  isEdited: boolean;

  // Timestamps
  created: string;
}

interface Edit {
  timestamp: string;
  type: 'replace' | 'insert' | 'delete';
  position: { start: number; end: number };
  oldText: string;
  newText: string;
}
```

### Storage Locations
```
Local Mode:
  /Users/tem/.humanizer/sessions/
    session-uuid-1.json
    session-uuid-2.json

Cloud Mode:
  Cloudflare D1 Database:
    sessions table
    session_buffers table
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Backend)
**Goal**: Session storage and retrieval

**Tasks**:
1. Create session storage service
   - `narrative-studio/src/services/sessionStorage.ts`
   - Local: Archive server endpoints
   - Cloud: D1 database schema + API routes

2. Archive server endpoints (local only)
   - `POST /sessions` - Create session
   - `GET /sessions` - List sessions
   - `GET /sessions/:id` - Get session
   - `PUT /sessions/:id` - Update session
   - `DELETE /sessions/:id` - Delete session
   - `PUT /sessions/:id/rename` - Rename session

3. Cloud endpoints (workers/npe-api)
   - Same as above, using D1 database
   - Zero-trust encryption for session data

**Files to Create**:
- `narrative-studio/src/services/sessionStorage.ts`
- `narrative-studio/archive-server.js` (update with session endpoints)
- `workers/npe-api/src/routes/sessions.ts`
- `workers/npe-api/src/services/session-storage.ts`

**Estimated Time**: 4-6 hours

---

### Phase 2: Buffer Management System
**Goal**: Track buffers, handle edits, chain operations

**Tasks**:
1. Create buffer manager hook
   - `narrative-studio/src/hooks/useBufferManager.ts`
   - Create buffer from transformation/analysis
   - Track active buffer
   - Handle user edits
   - Chain operations (source buffer selection)

2. Create session manager hook
   - `narrative-studio/src/hooks/useSessionManager.ts`
   - Auto-create session on first operation
   - Create new session explicitly
   - Save session periodically (debounced)
   - Load session from history

3. Update App state
   - `narrative-studio/src/App.tsx`
   - Add session context
   - Add buffer state
   - Wire up session/buffer managers

**Files to Create**:
- `narrative-studio/src/hooks/useBufferManager.ts`
- `narrative-studio/src/hooks/useSessionManager.ts`
- `narrative-studio/src/contexts/SessionContext.tsx`

**Files to Modify**:
- `narrative-studio/src/App.tsx`

**Estimated Time**: 6-8 hours

---

### Phase 3: UI Components - Left Panel
**Goal**: Toggle between Archive/Sessions, display session list

**Tasks**:
1. Update ArchivePanel component
   - Add tab toggle [Archive] [Sessions]
   - Split into ArchiveView and SessionsView
   - Session list UI (name, timestamp, delete button)
   - Click session → load into workspace
   - Rename session inline

2. Create SessionsView component
   - `narrative-studio/src/components/archive/SessionsView.tsx`
   - List sessions (sorted by updated timestamp)
   - Session item (name, date, buffers count)
   - Delete confirmation
   - Rename UI

**Files to Create**:
- `narrative-studio/src/components/archive/SessionsView.tsx`
- `narrative-studio/src/components/archive/SessionListItem.tsx`

**Files to Modify**:
- `narrative-studio/src/components/archive/ArchivePanel.tsx`

**Estimated Time**: 4-6 hours

---

### Phase 4: UI Components - Buffer Tabs & View Modes
**Goal**: Tab navigation, split/single pane toggle

**Tasks**:
1. Create BufferTabs component
   - `narrative-studio/src/components/workspace/BufferTabs.tsx`
   - Display buffer tabs horizontally
   - Active tab highlight
   - Click to switch buffer
   - Tab close button (if not original)

2. Add view mode toggle
   - Update MainWorkspace header
   - Buttons: [Split View] [Original Only] [Result Only]
   - In single mode, show tab to switch back
   - Preserve split state when toggling

3. Update MainWorkspace for buffers
   - Display active buffer content
   - Handle buffer switching
   - Preserve scroll position per buffer
   - Show buffer metadata (tool, settings)

**Files to Create**:
- `narrative-studio/src/components/workspace/BufferTabs.tsx`
- `narrative-studio/src/components/workspace/ViewModeToggle.tsx`

**Files to Modify**:
- `narrative-studio/src/components/workspace/MainWorkspace.tsx`

**Estimated Time**: 6-8 hours

---

### Phase 5: Chaining & "Transform Result" Feature
**Goal**: Enable explicit chaining from transformed buffer

**Tasks**:
1. Add "Transform Result" button
   - In ToolsPanel, conditional button
   - Only show if active buffer is transformation/edited
   - Label: "Transform This Result" or similar
   - Sets source buffer for next operation

2. Update transformation flow
   - Default: Always use original (buffer-0)
   - If "Transform Result" clicked: Use active buffer
   - Clear "Transform Result" mode after operation
   - Create new buffer with correct source reference

3. Update selection handling
   - Selection from transformed text
   - Creates new buffer referencing source buffer + selection range
   - Works with "Transform Result" mode

**Files to Modify**:
- `narrative-studio/src/components/panels/ToolsPanel.tsx`
- `narrative-studio/src/hooks/useBufferManager.ts`

**Estimated Time**: 4-6 hours

---

### Phase 6: Edit Tracking
**Goal**: Preserve user edits in buffers

**Tasks**:
1. Track edits in buffer
   - Intercept textarea onChange
   - Create Edit records
   - Mark buffer as edited
   - Display edit indicator in tab

2. Handle edited text in operations
   - If buffer is edited, use edited text
   - Create buffer-X-edited intermediate buffer
   - Link properly in source chain

**Files to Modify**:
- `narrative-studio/src/components/workspace/MainWorkspace.tsx`
- `narrative-studio/src/hooks/useBufferManager.ts`

**Estimated Time**: 3-4 hours

---

### Phase 7: Session Persistence & Auto-Save
**Goal**: Auto-save session changes, handle context switches

**Tasks**:
1. Auto-save logic
   - Debounced save on buffer changes (5 seconds)
   - Save on buffer creation
   - Save on session rename
   - Save on view mode change

2. Context switch handling
   - Detect navigation to different message
   - Save current session before switch
   - Clear workspace state
   - Option to resume session later

3. Session loading
   - Load session from SessionsView
   - Restore all buffers
   - Restore active buffer
   - Restore view mode

**Files to Modify**:
- `narrative-studio/src/hooks/useSessionManager.ts`
- `narrative-studio/src/App.tsx`

**Estimated Time**: 4-6 hours

---

### Phase 8: Session Export & Import
**Goal**: Allow users to export/import sessions as JSON/ZIP

**Tasks**:
1. Export functionality
   - Export session as JSON
   - Optional ZIP compression (use JSZip library)
   - Download to user's device
   - Include full metadata and buffers

2. Import functionality (future)
   - Upload JSON/ZIP file
   - Validate structure
   - Import as new session

**Files to Modify**:
- `narrative-studio/src/components/archive/SessionListItem.tsx` (add export button)
- `narrative-studio/src/hooks/useSessionManager.ts` (add export methods)

**Dependencies**:
- Add `jszip` package for compression

**Estimated Time**: 3-4 hours

---

### Phase 9: Configuration System
**Goal**: Centralize all configuration, eliminate hard-coded values

**Tasks**:
1. Create configuration files
   - `config/session-limits.ts` - Tier-based limits
   - `config/storage-paths.ts` - Local storage paths
   - `config/app-config.ts` - Global app settings

2. Update components to use config
   - Import from config files
   - Remove any hard-coded numbers
   - Add config validation on startup

**Files to Create**:
- `narrative-studio/src/config/session-limits.ts`
- `narrative-studio/src/config/storage-paths.ts`
- `narrative-studio/src/config/app-config.ts`

**Estimated Time**: 2-3 hours

---

### Phase 10: Testing & Polish
**Goal**: Ensure everything works together

**Tasks**:
1. Test session creation flow
2. Test buffer chaining (original → transform → analyze)
3. Test "Transform Result" mode
4. Test edit tracking
5. Test session save/load
6. Test Archive/Sessions toggle
7. Test view mode toggles
8. Test session rename/delete
9. Test tier-based limits (Free/Pro/Premium)
10. Test session export (JSON + ZIP)
11. Fix bugs and edge cases
12. Update CLAUDE.md

**Estimated Time**: 6-8 hours

---

## Total Estimated Time: 42-59 hours

**Recommended Approach**: Implement in phases, test each phase before moving on

---

## Configuration Requirements

**CRITICAL**: NO HARD-CODED LIMITS OR NUMBERS ANYWHERE. All values must be configurable.

### Tier-Based Limits (Configuration File)
```typescript
// config/session-limits.ts
export const SESSION_LIMITS = {
  free: { sessions: 10, buffersPerSession: 10 },
  pro: { sessions: 100, buffersPerSession: 100 },
  premium: { sessions: 1000, buffersPerSession: 1000 }
};
```

### Resolved Decisions

1. **Session limit**: Tier-based (Free: 10, Pro: 100, Premium: 1000) - CONFIGURABLE
2. **Buffer limit**: Tier-based (Free: 10, Pro: 100, Premium: 1000) - CONFIGURABLE
3. **Local storage**: `~/.humanizer/sessions/` (or configurable path)
4. **Cloud encryption**: Web Crypto API (SubtleCrypto) - same pattern as secure-archive.ts
5. **Session export**: JSON export + optional ZIP compression for download

---

## Files to Create (Summary)

**Backend**:
- `workers/npe-api/src/routes/sessions.ts`
- `workers/npe-api/src/services/session-storage.ts`
- `workers/npe-api/src/services/session-encryption.ts` (Web Crypto API wrapper)

**Frontend Configuration** (CRITICAL - No hard-coded values):
- `narrative-studio/src/config/session-limits.ts`
- `narrative-studio/src/config/storage-paths.ts`
- `narrative-studio/src/config/app-config.ts`

**Frontend Services**:
- `narrative-studio/src/services/sessionStorage.ts`
- `narrative-studio/src/services/sessionExport.ts` (JSON/ZIP export)
- `narrative-studio/src/hooks/useBufferManager.ts`
- `narrative-studio/src/hooks/useSessionManager.ts`
- `narrative-studio/src/contexts/SessionContext.tsx`

**Frontend Components**:
- `narrative-studio/src/components/archive/SessionsView.tsx`
- `narrative-studio/src/components/archive/SessionListItem.tsx`
- `narrative-studio/src/components/workspace/BufferTabs.tsx`
- `narrative-studio/src/components/workspace/ViewModeToggle.tsx`

**Updated**:
- `narrative-studio/archive-server.js` (add session endpoints)
- `narrative-studio/src/App.tsx` (add session context)
- `narrative-studio/src/components/archive/ArchivePanel.tsx` (add Sessions toggle)
- `narrative-studio/src/components/panels/ToolsPanel.tsx` (add "Transform Result" button)
- `narrative-studio/src/components/workspace/MainWorkspace.tsx` (buffer support)

---

## Next Steps

1. Review plan with user
2. Begin Phase 1 (Core Infrastructure)
3. Iterative development with testing between phases
