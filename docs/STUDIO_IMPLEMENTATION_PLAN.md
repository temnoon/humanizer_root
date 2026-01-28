# Studio Implementation Plan

**Created**: January 28, 2026
**Status**: Approved by CodeGuard Council
**Scope**: Archive Pane, Tools Pane, Book Studio View, Media Gallery

---

## Executive Summary

This plan defines a unified 3-panel Studio interface supporting desktop and mobile with:
- Responsive Archive Pane (left) and Tools Pane (right)
- Media Gallery with transcription versioning
- Book Studio for manuscript editing
- Full accessibility compliance (WCAG 2.1 AA)

---

## 1. Architecture Overview

### 1.1 Component Hierarchy

```
StudioLayout (3-panel orchestrator)
├── ArchivePane (left) → BottomSheet on mobile
│   ├── ArchiveBrowser (tree view)
│   ├── SearchResults (semantic search)
│   ├── ClusterBrowser (discovered clusters)
│   └── ImportView (archive import wizard)
├── MainWorkspace (center)
│   ├── EditorView (text editing)
│   ├── MediaGallery (grid view)
│   └── BookStudioView (manuscript)
└── ToolsPane (right) → BottomSheet on mobile
    ├── SearchTool (agentic search)
    ├── TransformTool (AI transforms)
    ├── HarvestTool (content extraction)
    └── TranscribeTool (media transcription)
```

### 1.2 Import View Details

The Import View provides a multi-step wizard for importing archives from various sources:

**Import Steps:**
1. **Source Selection** - Choose import type (OpenAI export, local folder, cloud backup)
2. **Folder/File Selection** - Browse or drag-drop archive folder
3. **Parsing** - Real-time progress as conversations/media are parsed
4. **Preview** - Review conversations, media counts, warnings
5. **Apply** - Merge into existing or create new archive

**Import Sources (existing parser supports):**
- OpenAI ChatGPT exports (conversations.json + media folders)
- Future: Claude exports, local markdown archives

**UI Components:**
```
ImportView
├── ImportSourceSelector (step 1)
├── ImportFolderPicker (step 2)
├── ImportProgress (step 3)
│   ├── ProgressBar
│   └── ParseStats (conversations, media found)
├── ImportPreview (step 4)
│   ├── ConversationList
│   ├── MediaGalleryPreview
│   └── WarningsList
└── ImportActions (step 5)
    ├── MergeOptions
    └── ApplyButton
```

**Existing Backend (reuse):**
- `POST /api/import/archive/folder` - Start parsing
- `GET /api/import/archive/status/{jobId}` - Poll progress
- `POST /api/import/archive/apply/{jobId}` - Apply to archive

### 1.3 Route Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/studio` | StudioLayout | Default editor workspace |
| `/studio/media` | MediaGallery | Full-screen media browser |
| `/studio/books/:bookId` | BookStudioView | Manuscript editor |
| `/studio/books/:bookId/chapter/:chapterId` | ChapterEditor | Chapter focus mode |

### 1.3 New Contexts Required

#### PanelContext
Manages panel state across the application.

```typescript
// Location: src/contexts/PanelContext.tsx

interface PanelState {
  // Visibility
  archiveOpen: boolean;
  toolsOpen: boolean;

  // Active tabs within panels
  archiveTab: 'browser' | 'search' | 'clusters' | 'import';
  toolsTab: 'search' | 'transform' | 'harvest' | 'transcribe';

  // Mobile sheet state
  archiveSheetState: 'collapsed' | 'partial' | 'expanded';
  toolsSheetState: 'collapsed' | 'partial' | 'expanded';

  // Focus management
  focusedPanel: 'archive' | 'workspace' | 'tools' | null;
}

interface PanelActions {
  toggleArchive: () => void;
  toggleTools: () => void;
  setArchiveTab: (tab: PanelState['archiveTab']) => void;
  setToolsTab: (tab: PanelState['toolsTab']) => void;
  focusPanel: (panel: PanelState['focusedPanel']) => void;
  setSheetState: (panel: 'archive' | 'tools', state: SheetState) => void;
}
```

#### MediaContext
Manages media items and transcription state.

```typescript
// Location: src/contexts/MediaContext.tsx

interface MediaState {
  // Media items
  items: Map<string, MediaItem>;
  selectedIds: Set<string>;

  // Transcription state
  transcriptionJobs: Map<string, TranscriptionJob>;

  // Gallery state
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'name' | 'type' | 'size';
  filterType: 'all' | 'image' | 'audio' | 'video';

  // Player state
  activeMediaId: string | null;
  isPlaying: boolean;
}

interface MediaItem {
  id: string;
  type: 'image' | 'audio' | 'video';
  filename: string;
  mimeType: string;
  size: number;
  duration?: number; // seconds for audio/video
  dimensions?: { width: number; height: number };
  thumbnailUrl?: string;
  sourceUrl: string;

  // Transcription info
  transcriptionCount: number;
  preferredTranscriptionId?: string;
  latestTranscriptionAt?: Date;
}
```

---

## 2. CSS Architecture

### 2.1 New CSS Files

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/styles/panels.css` | 3-panel layout, resize handles, sheet states | ~300 |
| `src/styles/media-gallery.css` | Grid, thumbnails, selection, lightbox | ~250 |
| `src/styles/transcription.css` | Timestamps, model badges, version list | ~200 |
| `src/styles/book-studio.css` | Outline, chapter nav, editor chrome | ~200 |

### 2.2 New CSS Variables

Add to `src/styles/variables.css`:

```css
/* Panel widths */
--panel-archive-width: 280px;
--panel-archive-min: 200px;
--panel-archive-max: 400px;
--panel-tools-width: 320px;
--panel-tools-min: 280px;
--panel-tools-max: 480px;

/* Mobile sheet heights */
--sheet-peek-height: 60px;
--sheet-partial-height: 40vh;
--sheet-handle-height: 24px;

/* Media gallery */
--gallery-thumb-size: 120px;
--gallery-thumb-radius: var(--radius-md);
--gallery-gap: var(--space-sm);
--gallery-selection-color: var(--color-primary);

/* Transcription */
--transcript-timestamp-width: 60px;
--transcript-segment-gap: var(--space-xs);
--transcript-active-bg: rgba(var(--color-primary-rgb), 0.1);

/* Book studio */
--book-outline-width: 240px;
--book-chapter-max-width: 720px;

/* Z-index stack for sheets */
--z-sheet-archive: 998;
--z-sheet-tools: 999;
--z-sheet-book: 1000;
```

### 2.3 Desktop Layout (panels.css)

```css
.studio-layout {
  display: grid;
  grid-template-columns: var(--panel-archive-width) 1fr var(--panel-tools-width);
  grid-template-rows: 1fr;
  height: 100vh;
  overflow: hidden;
}

.studio-layout--archive-collapsed {
  grid-template-columns: 0 1fr var(--panel-tools-width);
}

.studio-layout--tools-collapsed {
  grid-template-columns: var(--panel-archive-width) 1fr 0;
}

.studio-layout--both-collapsed {
  grid-template-columns: 0 1fr 0;
}

/* Panels */
.panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-color: var(--border-color);
  overflow: hidden;
}

.panel--archive {
  border-right: 1px solid var(--border-color);
}

.panel--tools {
  border-left: 1px solid var(--border-color);
}

/* Resize handles */
.panel__resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 150ms ease;
}

.panel__resize-handle:hover,
.panel__resize-handle--dragging {
  background: var(--color-primary);
}

.panel--archive .panel__resize-handle {
  right: -2px;
}

.panel--tools .panel__resize-handle {
  left: -2px;
}
```

### 2.4 Mobile Layout (panels.css)

```css
@media (max-width: 767px) {
  .studio-layout {
    grid-template-columns: 1fr;
  }

  .panel--archive,
  .panel--tools {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    border: none;
    border-top: 1px solid var(--border-color);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(calc(100% - var(--sheet-peek-height)));
    transition: transform 300ms ease-out;
  }

  .panel--archive {
    z-index: var(--z-sheet-archive);
  }

  .panel--tools {
    z-index: var(--z-sheet-tools);
  }

  .panel--sheet-partial {
    transform: translateY(calc(100% - var(--sheet-partial-height)));
  }

  .panel--sheet-expanded {
    transform: translateY(0);
  }

  /* Sheet handle */
  .panel__sheet-handle {
    display: flex;
    justify-content: center;
    align-items: center;
    height: var(--sheet-handle-height);
    cursor: grab;
  }

  .panel__sheet-handle::after {
    content: '';
    width: 36px;
    height: 4px;
    background: var(--text-tertiary);
    border-radius: var(--radius-full);
  }
}

@media (min-width: 768px) {
  .panel__sheet-handle {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel--archive,
  .panel--tools {
    transition: none;
  }
}
```

### 2.5 Media Gallery (media-gallery.css)

```css
.media-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--gallery-thumb-size), 1fr));
  gap: var(--gallery-gap);
  padding: var(--space-md);
}

.media-gallery--list {
  grid-template-columns: 1fr;
}

/* Thumbnail */
.media-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--gallery-thumb-radius);
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-tertiary);
}

.media-thumb__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-thumb__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 150ms ease;
}

.media-thumb:hover .media-thumb__overlay,
.media-thumb:focus-visible .media-thumb__overlay {
  opacity: 1;
}

/* Selection */
.media-thumb--selected {
  outline: 3px solid var(--gallery-selection-color);
  outline-offset: 2px;
}

.media-thumb__checkbox {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  width: 24px;
  height: 24px;
}

/* Type badge */
.media-thumb__type-badge {
  position: absolute;
  bottom: var(--space-xs);
  right: var(--space-xs);
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: var(--radius-sm);
}

/* Duration badge for audio/video */
.media-thumb__duration {
  position: absolute;
  bottom: var(--space-xs);
  left: var(--space-xs);
  padding: 2px 6px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
}

/* Transcription indicator */
.media-thumb__transcript-badge {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-success);
  color: white;
  border-radius: var(--radius-full);
  font-size: 10px;
}
```

### 2.6 Transcription Panel (transcription.css)

```css
.transcription-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Version selector */
.transcription-versions {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.transcription-version-chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.transcription-version-chip--preferred {
  background: rgba(var(--color-primary-rgb), 0.1);
  border-color: var(--color-primary);
}

.transcription-version-chip__model {
  font-weight: 500;
}

.transcription-version-chip__date {
  color: var(--text-tertiary);
}

/* Segment list */
.transcription-segments {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm);
}

.transcription-segment {
  display: grid;
  grid-template-columns: var(--transcript-timestamp-width) 1fr;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.transcription-segment:hover {
  background: var(--bg-tertiary);
}

.transcription-segment--active {
  background: var(--transcript-active-bg);
}

.transcription-segment__timestamp {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary);
  font-weight: 500;
}

.transcription-segment__text {
  font-size: 14px;
  line-height: 1.5;
}

/* Model badge */
.model-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.model-badge__provider {
  color: var(--text-tertiary);
}

.model-badge__name {
  color: var(--text-primary);
}

.model-badge--ollama { border-color: #4CAF50; }
.model-badge--openai { border-color: #10A37F; }
.model-badge--anthropic { border-color: #C96442; }
.model-badge--google { border-color: #4285F4; }
.model-badge--cloudflare { border-color: #F6821F; }
```

---

## 3. Database Schema

### 3.1 New Table: aui_transcription_versions

```sql
-- Migration: 20260128_create_transcription_versions.sql

CREATE TABLE aui_transcription_versions (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL,
  archive_id UUID NOT NULL REFERENCES aui_archives(id) ON DELETE CASCADE,

  -- Transcription type
  type TEXT NOT NULL CHECK (type IN (
    'audio',       -- Audio transcription (Whisper, etc.)
    'ocr',         -- Image text extraction
    'caption',     -- Image/video description
    'description', -- Detailed content description
    'manual'       -- Human-entered transcription
  )),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Requested but not started
    'processing',  -- Currently transcribing
    'completed',   -- Successfully completed
    'failed',      -- Transcription failed
    'cancelled'    -- User cancelled
  )),

  -- Content
  text TEXT,                    -- Full transcription text
  segments JSONB,               -- Timestamped segments for audio/video
  error_message TEXT,           -- Error details if failed

  -- Model provenance (CRITICAL - never lose this data)
  model_id TEXT NOT NULL,       -- e.g., 'whisper-large-v3', 'llava:13b'
  model_provider TEXT NOT NULL, -- e.g., 'ollama', 'openai', 'google'
  model_version TEXT,           -- Specific version if known
  model_variant TEXT,           -- e.g., 'large-v3', 'turbo'

  -- Quality metrics
  confidence REAL,              -- Model confidence score (0-1)
  word_count INTEGER,           -- Word count for analytics
  segment_count INTEGER,        -- Number of segments
  language TEXT,                -- Detected language code

  -- Versioning (CRITICAL - immutable versions)
  version_number INTEGER NOT NULL,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  supersedes_version_id UUID REFERENCES aui_transcription_versions(id),

  -- Timing
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,

  -- Audit
  requested_by TEXT,            -- User who requested
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_version_per_media
    UNIQUE (media_id, archive_id, version_number)
);

-- Only one preferred version per media+type
CREATE UNIQUE INDEX idx_transcription_preferred
  ON aui_transcription_versions (media_id, archive_id, type)
  WHERE is_preferred = TRUE;

-- Fast lookups
CREATE INDEX idx_transcription_media ON aui_transcription_versions(media_id, archive_id);
CREATE INDEX idx_transcription_status ON aui_transcription_versions(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_transcription_model ON aui_transcription_versions(model_provider, model_id);

-- Auto-increment version number function
CREATE OR REPLACE FUNCTION set_transcription_version_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM aui_transcription_versions
  WHERE media_id = NEW.media_id
    AND archive_id = NEW.archive_id
    AND type = NEW.type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcription_version_number_trigger
  BEFORE INSERT ON aui_transcription_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_transcription_version_number();
```

### 3.2 Segment JSON Schema

```typescript
// Segment structure for JSONB column
interface TranscriptionSegment {
  id: number;                    // Sequential segment ID
  start: number;                 // Start time in seconds
  end: number;                   // End time in seconds
  text: string;                  // Segment text
  confidence?: number;           // Segment-level confidence
  speaker?: string;              // Speaker ID if diarized
  words?: Array<{                // Word-level timing (if available)
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
}
```

### 3.3 TypeScript Types

```typescript
// Location: packages/core/src/aui/types/transcription.ts

import { z } from 'zod';

// Transcription types
export type TranscriptionType =
  | 'audio'       // Audio transcription
  | 'ocr'         // Image text extraction
  | 'caption'     // Brief description
  | 'description' // Detailed description
  | 'manual';     // Human-entered

// Transcription status
export type TranscriptionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Model info
export interface TranscriptionModelInfo {
  id: string;
  provider: 'ollama' | 'openai' | 'anthropic' | 'google' | 'cloudflare' | 'local';
  version?: string;
  variant?: string;
}

// Segment
export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
  speaker?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
}

// Quality metrics
export interface TranscriptionQualityMetrics {
  confidence?: number;
  wordCount?: number;
  segmentCount?: number;
  language?: string;
}

// Full transcription version
export interface TranscriptionVersion {
  id: string;
  mediaId: string;
  archiveId: string;
  type: TranscriptionType;
  status: TranscriptionStatus;

  // Content
  text?: string;
  segments?: TranscriptionSegment[];
  errorMessage?: string;

  // Model provenance
  model: TranscriptionModelInfo;

  // Quality
  quality: TranscriptionQualityMetrics;

  // Versioning
  versionNumber: number;
  isPreferred: boolean;
  supersedesVersionId?: string;

  // Timing
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingDurationMs?: number;

  // Audit
  requestedBy?: string;
  createdAt: Date;
}

// Zod schemas for validation
export const TranscriptionSegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  confidence: z.number().optional(),
  speaker: z.string().optional(),
  words: z.array(z.object({
    word: z.string(),
    start: z.number(),
    end: z.number(),
    confidence: z.number().optional(),
  })).optional(),
});

export const CreateTranscriptionRequestSchema = z.object({
  mediaId: z.string(),
  archiveId: z.string(),
  type: z.enum(['audio', 'ocr', 'caption', 'description', 'manual']),
  modelId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
});

export type CreateTranscriptionRequest = z.infer<typeof CreateTranscriptionRequestSchema>;
```

---

## 4. Accessibility Requirements

### 4.1 Keyboard Navigation

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Cmd/Ctrl + 1` | Focus Archive Pane | Global |
| `Cmd/Ctrl + 2` | Focus Workspace | Global |
| `Cmd/Ctrl + 3` | Focus Tools Pane | Global |
| `Cmd/Ctrl + [` | Toggle Archive Pane | Global |
| `Cmd/Ctrl + ]` | Toggle Tools Pane | Global |
| `Arrow Up/Down` | Navigate list items | List focus |
| `Arrow Left/Right` | Navigate grid columns | Grid focus |
| `Enter` | Select/Open item | Any list |
| `Space` | Play/Pause media | Media player |
| `T` | Toggle transcript | Media viewer |
| `Escape` | Close modal/sheet | Modal/sheet open |

### 4.2 ARIA Roles

```tsx
// Archive Browser - Tree structure
<div role="tree" aria-label="Archive browser">
  <div role="treeitem" aria-expanded="true" aria-level="1">
    <div role="group">
      <div role="treeitem" aria-level="2" />
    </div>
  </div>
</div>

// Search Results - Listbox
<div role="listbox" aria-label="Search results">
  <div role="option" aria-selected="false" />
</div>

// Media Gallery - Grid
<div role="grid" aria-label="Media gallery">
  <div role="row">
    <div role="gridcell" tabIndex={0} />
  </div>
</div>

// Transcription - Synchronized with media
<div role="region" aria-label="Transcription" aria-live="polite">
  <button aria-current={isActive} onClick={seekTo}>
    <time>{timestamp}</time>
    <span>{text}</span>
  </button>
</div>
```

### 4.3 Focus Management Hooks

```typescript
// Location: src/hooks/useFocusManagement.ts

// Panel focus coordination
export function usePanelFocus() {
  const focusPanel = useCallback((panel: 'archive' | 'workspace' | 'tools') => {
    const selectors = {
      archive: '[data-panel="archive"] [tabindex="0"]',
      workspace: '[data-panel="workspace"] [tabindex="0"]',
      tools: '[data-panel="tools"] [tabindex="0"]',
    };
    const element = document.querySelector(selectors[panel]);
    (element as HTMLElement)?.focus();
  }, []);

  return { focusPanel };
}

// List navigation
export function useListNavigation<T>(
  items: T[],
  options?: {
    onSelect?: (item: T, index: number) => void;
    wrap?: boolean;
  }
) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i =>
          options?.wrap
            ? (i + 1) % items.length
            : Math.min(i + 1, items.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i =>
          options?.wrap
            ? (i - 1 + items.length) % items.length
            : Math.max(i - 1, 0)
        );
        break;
      case 'Enter':
        options?.onSelect?.(items[activeIndex], activeIndex);
        break;
    }
  }, [items, activeIndex, options]);

  return { activeIndex, setActiveIndex, handleKeyDown };
}

// Grid navigation (2D)
export function useGridNavigation(
  rows: number,
  cols: number,
  options?: {
    onSelect?: (row: number, col: number) => void;
  }
) {
  const [position, setPosition] = useState({ row: 0, col: 0 });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        setPosition(p => ({ ...p, col: Math.min(p.col + 1, cols - 1) }));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setPosition(p => ({ ...p, col: Math.max(p.col - 1, 0) }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPosition(p => ({ ...p, row: Math.min(p.row + 1, rows - 1) }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setPosition(p => ({ ...p, row: Math.max(p.row - 1, 0) }));
        break;
      case 'Enter':
        options?.onSelect?.(position.row, position.col);
        break;
    }
  }, [rows, cols, position, options]);

  return { position, setPosition, handleKeyDown };
}
```

### 4.4 Screen Reader Announcements

```typescript
// Location: src/hooks/useAnnounce.ts

export function useAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const region = document.getElementById(`aria-live-${priority}`);
    if (region) {
      region.textContent = '';
      // Small delay to ensure announcement
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    }
  }, []);

  return announce;
}

// Usage examples:
// announce('Search found 15 results');
// announce('Transcription started for audio.wav');
// announce('Version 3 set as preferred', 'assertive');
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Est. 5 files)

**Goal**: Core contexts and layout shell

| File | Type | Description |
|------|------|-------------|
| `src/contexts/PanelContext.tsx` | Context | Panel state management |
| `src/contexts/MediaContext.tsx` | Context | Media and transcription state |
| `src/components/studio/StudioLayout.tsx` | Component | 3-panel grid layout |
| `src/styles/panels.css` | CSS | Panel and sheet styles |
| `src/hooks/usePanelShortcuts.ts` | Hook | Keyboard shortcuts |

**Acceptance Criteria**:
- [ ] 3-panel layout renders on desktop
- [ ] Panels collapse/expand with animation
- [ ] Mobile sheets work with gesture drag
- [ ] Cmd+1/2/3 shortcuts work
- [ ] Reduced motion respected

### Phase 2: Archive Pane (Est. 7 files)

**Goal**: Functional archive browser with search and import

| File | Type | Description |
|------|------|-------------|
| `src/components/archive/ArchivePane.tsx` | Component | Pane container with tabs |
| `src/components/archive/ArchiveBrowser.tsx` | Component | Tree view browser |
| `src/components/archive/ArchiveSearch.tsx` | Component | Semantic search UI |
| `src/components/archive/ClusterBrowser.tsx` | Component | Cluster navigation |
| `src/components/archive/ImportView.tsx` | Component | Archive import wizard |
| `src/hooks/useArchiveTree.ts` | Hook | Tree data management |
| `src/styles/archive-pane.css` | CSS | Archive-specific styles |

**Acceptance Criteria**:
- [ ] Tree view shows archive hierarchy
- [ ] Keyboard navigation works (Arrow keys, Enter)
- [ ] Search debounces and shows results
- [ ] Clusters are browsable
- [ ] Import wizard supports folder selection, parsing, preview, apply
- [ ] Import progress shows in real-time
- [ ] role="tree" properly implemented

### Phase 3: Tools Pane (Est. 6 files)

**Goal**: Tool tabs with transcription trigger

| File | Type | Description |
|------|------|-------------|
| `src/components/tools/ToolsPane.tsx` | Component | Pane container with tabs |
| `src/components/tools/SearchTool.tsx` | Component | Agentic search interface |
| `src/components/tools/TransformTool.tsx` | Component | AI transformation UI |
| `src/components/tools/HarvestTool.tsx` | Component | Content extraction |
| `src/components/tools/TranscribeTool.tsx` | Component | Transcription launcher |
| `src/styles/tools-pane.css` | CSS | Tools-specific styles |

**Acceptance Criteria**:
- [ ] Tab switching works
- [ ] Search tool connects to existing semantic search
- [ ] Transform tool shows available transforms
- [ ] Transcribe tool can start jobs
- [ ] Focus management between tabs

### Phase 4: Transcription Schema (Est. 4 files)

**Goal**: Database schema and service layer

| File | Type | Description |
|------|------|-------------|
| `packages/core/src/aui/types/transcription.ts` | Types | TypeScript interfaces and Zod |
| `migrations/20260128_transcription_versions.sql` | SQL | Database migration |
| `packages/core/src/aui/service/transcription-service.ts` | Service | CRUD operations |
| `packages/core/src/aui/service/transcription-job-service.ts` | Service | Job queue management |

**Acceptance Criteria**:
- [ ] Migration runs successfully
- [ ] Version auto-increment works
- [ ] Only one preferred version per media+type
- [ ] Model provenance always captured
- [ ] Segments JSONB validates

### Phase 5: Media Gallery (Est. 6 files)

**Goal**: Grid view with viewer and transcriptions

| File | Type | Description |
|------|------|-------------|
| `src/components/media/MediaGallery.tsx` | Component | Grid/list view |
| `src/components/media/MediaThumbnail.tsx` | Component | Individual thumbnail |
| `src/components/media/MediaViewer.tsx` | Component | Lightbox viewer |
| `src/components/media/MediaPlayer.tsx` | Component | Audio/video player |
| `src/components/media/TranscriptionPanel.tsx` | Component | Version list + segments |
| `src/styles/media-gallery.css` | CSS | Gallery styles |

**Acceptance Criteria**:
- [ ] Grid shows thumbnails with type badges
- [ ] Multi-select works with checkboxes
- [ ] Viewer opens with arrow key navigation
- [ ] Player syncs with transcription
- [ ] All versions visible with model badges

### Phase 6: Book Studio (Est. 5 files)

**Goal**: Manuscript editor with outline

| File | Type | Description |
|------|------|-------------|
| `src/components/book/BookStudioView.tsx` | Component | Main studio layout |
| `src/components/book/BookOutline.tsx` | Component | Chapter tree |
| `src/components/book/ChapterEditor.tsx` | Component | Chapter content editor |
| `src/components/book/BookMetadata.tsx` | Component | Title, description, cover |
| `src/styles/book-studio.css` | CSS | Book editor styles |

**Acceptance Criteria**:
- [ ] Outline shows chapter hierarchy
- [ ] Drag-drop reordering works
- [ ] Editor saves to buffer
- [ ] Metadata panel editable
- [ ] Mobile shows outline as sheet

### Phase 7: Agentic Loop Tools (Est. 6 files)

**Goal**: Integrate drafting, media, search, and book tools into AgenticLoop

| File | Type | Description |
|------|------|-------------|
| `packages/core/src/aui/tool-registry.ts` | Service | Tool registry with auto-discovery |
| `packages/core/src/aui/tool-definitions.ts` | Types | JSON Schema tool definitions |
| `packages/core/src/aui/tools/drafting-tools.ts` | Tools | Drafting tool handlers |
| `packages/core/src/aui/tools/media-tools.ts` | Tools | Media/transcription tool handlers |
| `packages/core/src/aui/tools/search-tools.ts` | Tools | Search/archive tool handlers |
| `packages/core/src/aui/tools/book-tools.ts` | Tools | Book creation tool handlers |

**Acceptance Criteria**:
- [ ] All drafting methods accessible via tools
- [ ] Media listing and transcription tools work
- [ ] Search/cluster tools integrated
- [ ] Book tools integrated
- [ ] Tool definitions have proper JSON schemas for LLM
- [ ] Destructive tools require approval
- [ ] Tools return structured ToolResult

---

## 6. File Structure Summary

```
src/
├── contexts/
│   ├── PanelContext.tsx          # NEW - Panel state
│   └── MediaContext.tsx          # NEW - Media state
├── components/
│   ├── studio/
│   │   └── StudioLayout.tsx      # NEW - 3-panel layout
│   ├── archive/
│   │   ├── ArchivePane.tsx       # NEW - Container
│   │   ├── ArchiveBrowser.tsx    # NEW - Tree view
│   │   ├── ArchiveSearch.tsx     # NEW - Search
│   │   ├── ClusterBrowser.tsx    # EXISTS - Enhance
│   │   └── ImportView.tsx        # NEW - Import wizard
│   ├── tools/
│   │   ├── ToolsPane.tsx         # NEW - Container
│   │   ├── SearchTool.tsx        # NEW - Agentic search
│   │   ├── TransformTool.tsx     # NEW - Transforms
│   │   ├── HarvestTool.tsx       # NEW - Extraction
│   │   └── TranscribeTool.tsx    # NEW - Transcription
│   ├── media/
│   │   ├── MediaGallery.tsx      # NEW - Grid view
│   │   ├── MediaThumbnail.tsx    # NEW - Thumbnail
│   │   ├── MediaViewer.tsx       # NEW - Lightbox
│   │   ├── MediaPlayer.tsx       # NEW - Player
│   │   └── TranscriptionPanel.tsx # NEW - Versions
│   └── book/
│       ├── BookStudioView.tsx    # NEW - Studio
│       ├── BookOutline.tsx       # NEW - Tree
│       ├── ChapterEditor.tsx     # NEW - Editor
│       └── BookMetadata.tsx      # NEW - Metadata
├── hooks/
│   ├── usePanelShortcuts.ts      # NEW - Keyboard
│   ├── useFocusManagement.ts     # NEW - Focus
│   ├── useListNavigation.ts      # NEW - List nav
│   ├── useGridNavigation.ts      # NEW - Grid nav
│   └── useAnnounce.ts            # NEW - A11y
└── styles/
    ├── panels.css                # NEW - Layout
    ├── media-gallery.css         # NEW - Gallery
    ├── transcription.css         # NEW - Transcripts
    └── book-studio.css           # NEW - Book

packages/core/src/aui/
├── types/
│   └── transcription.ts          # NEW - Types
├── service/
│   ├── transcription-service.ts  # NEW - CRUD
│   └── transcription-job-service.ts # NEW - Jobs
├── tool-registry.ts              # NEW - Tool registry
├── tool-definitions.ts           # NEW - JSON schemas
└── tools/
    ├── drafting-tools.ts         # NEW - Draft handlers
    ├── media-tools.ts            # NEW - Media handlers
    ├── search-tools.ts           # NEW - Search handlers
    └── book-tools.ts             # NEW - Book handlers

migrations/
└── 20260128_transcription_versions.sql # NEW
```

---

## 7. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transcription versioning | Append-only | Never lose historical data; compare model outputs |
| Model tracking | Always required | Critical for debugging, A/B testing, compliance |
| Mobile panels | Bottom sheets | Consistent with existing BottomSheet pattern |
| State management | New contexts | Isolate concerns; avoid bloating existing contexts |
| CSS approach | Dedicated files | Maintainable; follows existing codebase pattern |
| Keyboard shortcuts | Cmd+1/2/3 | Familiar IDE pattern; discoverable |
| ARIA strategy | Semantic roles | Full screen reader support; WCAG 2.1 AA |

---

## 8. Dependencies

### External (No new additions needed)

- React 18+ (existing)
- Zod (existing)
- PostgreSQL (existing)

### Internal

- `UnifiedBufferContext` - Content management
- `AuthContext` - User/tier info
- `BottomSheet` component - Mobile sheets
- Model Registry - Transcription model selection

---

## 9. Testing Strategy

### Unit Tests

- PanelContext state transitions
- MediaContext CRUD operations
- Transcription Zod validation
- Navigation hook edge cases

### Integration Tests

- Panel collapse/expand flow
- Media selection → transcription start
- Transcription version switching
- Book chapter editing

### Accessibility Tests

- axe-core audit on all new components
- Keyboard-only navigation walkthrough
- Screen reader testing (VoiceOver, NVDA)
- Reduced motion verification

### E2E Tests

- Full transcription flow: upload → transcribe → view versions
- Book creation: new → outline → chapters → export
- Mobile gesture: sheet drag → expand → collapse

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lighthouse Accessibility | ≥ 95 | Automated CI |
| Mobile usability | No layout breaks | Manual testing 320-768px |
| Transcription p95 latency | < 30s for 5min audio | APM tracking |
| Version comparison usage | > 20% users try | Analytics |

---

## 11. Agentic Loop Tool Integration

The `AgenticLoop` (`packages/core/src/aui/agentic-loop.ts`) implements a ReAct pattern executor that currently only has buffer tools. It needs integration with the full tool ecosystem.

### 11.1 Current State

**Existing tools in AgenticLoop:**
- `buffer_list` - List all versioned buffers
- `buffer_get` - Get content from a buffer
- `buffer_create` - Create a new versioned buffer
- `buffer_commit` - Commit changes to buffer
- `buffer_history` - Get version history
- `buffer_branch_create` - Create a new branch
- `buffer_branch_switch` - Switch to a branch
- `bql` - Execute a BQL pipeline

**Architecture:**
```typescript
// ToolExecutor interface in agentic-loop.ts
interface ToolExecutor {
  listTools(): ToolDefinition[];
  getTool(name: string): ToolDefinition | undefined;
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  executeBql(pipeline: string): Promise<ToolResult>;
}

// Tools are registered in createToolExecutor()
// Custom handlers can be passed for additional tools
```

### 11.2 Tools to Add

#### Drafting Tools (from drafting.ts)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `draft_start` | Start a new drafting session | `title`, `sources[]`, `narratorPersona?` |
| `draft_gather` | Gather material from sources | `sessionId` |
| `draft_generate` | Generate initial draft | `sessionId`, `targetWordCount?`, `guidance?` |
| `draft_revise` | Revise draft with feedback | `sessionId`, `feedback` |
| `draft_finalize` | Export final draft | `sessionId`, `formats[]` |
| `draft_get` | Get drafting session | `sessionId` |
| `draft_version` | Get specific draft version | `sessionId`, `version` |

#### Search/Archive Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `search_archive` | Semantic search in AUI archive | `query`, `limit?`, `dateRange?` |
| `search_cluster` | Get passages from a cluster | `clusterId`, `limit?` |
| `cluster_discover` | Run clustering on archive | `minClusterSize?`, `maxClusters?` |
| `cluster_list` | List discovered clusters | - |

#### Book Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `book_harvest` | Harvest passages for a book | `query`, `minRelevance?`, `limit?` |
| `book_create` | Create a new book | `title`, `description?` |
| `book_add_chapter` | Add chapter to book | `bookId`, `title`, `content` |
| `book_get` | Get book details | `bookId` |

#### Media/Transcription Tools (new from this plan)

| Tool Name | Description | Parameters | Destructive |
|-----------|-------------|------------|-------------|
| `media_list` | List media items | `archiveId`, `type?`, `limit?` | No |
| `media_get` | Get media item details | `mediaId` | No |
| `transcribe_start` | Start transcription job | `mediaId`, `type`, `modelId?` | No |
| `transcribe_status` | Check transcription status | `jobId` | No |
| `transcription_list` | List versions for media | `mediaId` | No |
| `transcription_set_preferred` | Set preferred version | `versionId` | No |

### 11.3 Implementation Approach

**Option A: Extend createToolExecutor (Recommended)**

Add tools via the existing `customHandlers` parameter:

```typescript
// In a new file: packages/core/src/aui/tool-registry.ts

import { createToolExecutor } from './agentic-loop.js';
import { getDraftingMethods } from './service/drafting.js';
import type { ToolResult } from './types.js';

export function createFullToolExecutor(
  bqlExecutor: BqlExecutorFn,
  bufferManager: BufferManager,
  deps: ServiceDependencies
): ToolExecutor {
  const drafting = getDraftingMethods();
  const clustering = getClusteringMethods();
  const books = getBookMethods();
  const transcription = getTranscriptionMethods();

  const customHandlers: Record<string, ToolHandler> = {
    // Drafting tools
    draft_start: async (args) => {
      const session = await drafting.startDrafting({
        title: args.title as string,
        sources: args.sources as DraftSource[],
        narratorPersona: args.narratorPersona,
      });
      return { success: true, data: { sessionId: session.id } };
    },

    draft_gather: async (args) => {
      const result = await drafting.gatherMaterial(args.sessionId as string);
      return {
        success: true,
        data: {
          passageCount: result.passages.length,
          sourceStats: result.sourceStats,
        },
      };
    },

    draft_generate: async (args) => {
      const version = await drafting.generateDraft(
        args.sessionId as string,
        { targetWordCount: args.targetWordCount, guidance: args.guidance }
      );
      return {
        success: true,
        data: {
          version: version.version,
          wordCount: version.wordCount,
          content: version.content.substring(0, 500) + '...',
        },
      };
    },

    // ... more handlers
  };

  return createToolExecutor(bqlExecutor, bufferManager, customHandlers);
}
```

**Option B: Tool Registry Pattern**

Create a formal tool registry that auto-discovers tools:

```typescript
// packages/core/src/aui/tool-registry.ts

interface ToolRegistration {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();

  register(name: string, registration: ToolRegistration): void {
    this.tools.set(name, registration);
  }

  registerModule(module: ToolModule): void {
    for (const [name, registration] of Object.entries(module.tools)) {
      this.register(name, registration);
    }
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }
    return tool.handler(args);
  }
}
```

### 11.4 Tool Definitions File

Create tool definitions with JSON schemas for LLM:

```typescript
// packages/core/src/aui/tool-definitions.ts

export const DRAFTING_TOOLS: ToolDefinition[] = [
  {
    name: 'draft_start',
    description: 'Start a new drafting session to create content from multiple sources',
    parameters: {
      title: { type: 'string', description: 'Title for the draft', required: true },
      sources: {
        type: 'array',
        description: 'Array of source configurations',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['aui-archive', 'aui-cluster', 'file-path', 'url', 'direct-text'] },
            // ... source-specific properties
          },
        },
        required: true,
      },
    },
    required: ['title', 'sources'],
  },
  // ... more definitions
];

export const MEDIA_TOOLS: ToolDefinition[] = [
  {
    name: 'media_list',
    description: 'List media items in an archive (images, audio, video)',
    parameters: {
      archiveId: { type: 'string', description: 'Archive ID' },
      type: { type: 'string', enum: ['image', 'audio', 'video', 'all'], description: 'Filter by media type' },
      limit: { type: 'number', description: 'Maximum items to return' },
    },
    required: ['archiveId'],
  },
  {
    name: 'transcribe_start',
    description: 'Start a transcription job for a media item',
    parameters: {
      mediaId: { type: 'string', description: 'Media item ID' },
      type: { type: 'string', enum: ['audio', 'ocr', 'caption', 'description'], description: 'Transcription type' },
      modelId: { type: 'string', description: 'Optional model ID override' },
    },
    required: ['mediaId', 'type'],
  },
  // ... more definitions
];
```

### 11.5 Update DESTRUCTIVE_TOOLS

Add to `constants.ts`:

```typescript
export const DESTRUCTIVE_TOOLS = [
  // Existing
  'buffer_delete',
  'buffer_rollback',
  'buffer_branch_delete',
  'buffer_merge',
  'admin_config_set',
  'admin_tier_set',
  'admin_user_tier_set',
  'admin_prompt_set',
  // New
  'draft_delete',
  'transcription_delete',
  'media_delete',
  'book_delete',
  'chapter_delete',
] as const;
```

### 11.6 Phase 7: Tool Integration (New Phase)

| File | Type | Description |
|------|------|-------------|
| `packages/core/src/aui/tool-registry.ts` | Service | Tool registry with auto-discovery |
| `packages/core/src/aui/tool-definitions.ts` | Types | JSON Schema tool definitions |
| `packages/core/src/aui/tools/drafting-tools.ts` | Tools | Drafting tool handlers |
| `packages/core/src/aui/tools/media-tools.ts` | Tools | Media/transcription tool handlers |
| `packages/core/src/aui/tools/search-tools.ts` | Tools | Search/archive tool handlers |
| `packages/core/src/aui/tools/book-tools.ts` | Tools | Book creation tool handlers |

**Acceptance Criteria:**
- [ ] All drafting methods accessible via tools
- [ ] Media listing and transcription tools work
- [ ] Search/cluster tools integrated
- [ ] Book tools integrated
- [ ] Tool definitions have proper JSON schemas
- [ ] Destructive tools require approval
- [ ] Tools return structured ToolResult

---

## Appendix A: Migration Checklist

Before starting implementation:

- [ ] Read `CLAUDE.md` CSS Compliance Guard section
- [ ] Review existing `BottomSheet` component
- [ ] Check `UnifiedBufferContext` for overlap
- [ ] Verify model registry has vision models
- [ ] Confirm PostgreSQL migration process

---

**End of Plan**

*Approved by CodeGuard Council: Architect, Stylist, Accessibility, Data*
