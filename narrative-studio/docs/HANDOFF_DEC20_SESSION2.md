# Session Handoff - December 20, 2025 (Session 2)

**Branch:** `feature/subjective-intentional-constraint`
**Status:** Tool Hiding Complete, CSS Progress, Archive Plan Ready
**Dev Server:** `npm run dev` in `narrative-studio/`

---

## COMMITS THIS SESSION (4 total, all pushed)

| Commit | Description |
|--------|-------------|
| `b34cf1a` | feat(tools): Add tool hiding and favorites mechanism |
| `6a04748` | refactor(css): Add utility classes, reduce MainWorkspace inline styles |
| `d3c78f1` | refactor(css): Add more utility classes, fix ArchivePanel styles |

---

## WHAT WAS BUILT

### 1. Tool Hiding/Favorites System

**Files Created:**
- `src/components/tools/ToolSettingsModal.tsx` - Modal UI for managing tools
- `src/components/tools/ToolSettingsModal.css` - Modal styles

**Files Modified:**
- `src/contexts/ToolTabContext.tsx` - Added state: `hiddenToolIds`, `favoriteToolIds`, helpers
- `src/App.tsx` - Added `<ToolTabProvider>` at app level
- `src/components/pages/ToolPage.tsx` - Added settings button, modal integration
- `src/index.css` - Added `.tool-page__nav-settings`, `.tool-page__nav-item--favorite`

**Features:**
- Star tools as favorites (appear first in nav)
- Hide tools you don't use
- Settings button (⚙️) in tool page nav bar
- Persists to localStorage

**To Test:**
```bash
# Navigate to full-page tool view
http://localhost:5173/tool/v3-analysis

# Click ⚙️ button to open settings modal
# Star tools → they move to front
# Hide tools → they disappear from nav
```

### 2. CSS Compliance Progress

**New Utility Classes in `index.css`:**
```css
/* Layout */
.u-min-h-0, .u-w-full, .u-overflow-hidden
.u-border-r, .u-border-l, .u-border-t, .u-border-b
.pane, .pane--primary, .pane--secondary, .pane__scroll

/* Components */
.card, .card--elevated
.section-header, .scroll-container
.icon-btn, .icon-btn--sm

/* Typography */
.u-opacity-90, .u-opacity-75, .u-opacity-70, .u-opacity-50
.u-font-semibold, .u-font-medium
```

**Inline Style Reduction:**
- Total: 1417 → 1384 (33 fixed, ~2.3%)
- MainWorkspace.tsx: 105 → 75 (30 fixed, ~29%)
- ArchivePanel.tsx: 89 → 86 (3 fixed)

---

## ARCHIVE DECOMPOSITION PLAN

A detailed plan was written to: `/Users/tem/.claude/plans/splendid-scribbling-iverson.md`

### User Decisions
1. **Keep SQLite + sqlite-vec** for vectors (no ChromaDB)
2. **Add MySQL** for ALL imported content
3. **Auto-generate pyramid summaries** for content >5000 words only

### Key Architecture Changes

**Phase 1: MySQL Database Layer**
- New schema: `imports`, `content_threads`, `content_messages`, `media_files`
- Pyramid tables: `pyramid_chunks`, `pyramid_summaries`, `pyramid_apex`
- New service: `MySQLDatabase.ts`

**Phase 2: Archive Panel Decomposition**
- Extract from 2,068-line `ArchivePanel.tsx`:
  - `ConversationsListView.tsx` (~300 lines)
  - `MessageListView.tsx` (~250 lines)
  - `GalleryGridView.tsx` (~200 lines)
  - `ArchiveNavigationTabs.tsx` (~100 lines)
- New services: `contentService.ts`, `filterService.ts`
- New hook: `useArchiveState.ts`
- Result: ArchivePanel → ~400 lines

**Phase 3: Consolidate Imports**
- Merge `ImportsView.tsx` + `PasteImportView.tsx` → `UnifiedImportView.tsx`

**Phase 4: Pyramid Integration**
- Port from `workers/post-social-api/src/services/`:
  - `pyramid-builder.ts`
  - `semantic-chunker.ts`
- Auto-trigger on import for content >5000 words
- New UI: `PyramidPane.tsx`

---

## EXISTING INFRASTRUCTURE (DON'T REBUILD)

### Embeddings (SQLite + vec0)
- `src/services/embeddings/EmbeddingDatabase.ts` (1,575 lines)
- `src/services/embeddings/ClusteringService.ts` (484 lines)
- `src/services/embeddings/EmbeddingGenerator.ts`
- Archive server endpoints on port 3002

### Pyramid Builder (to port)
- `workers/post-social-api/src/services/pyramid-builder.ts`
- `workers/post-social-api/src/services/semantic-chunker.ts`
- 5-level hierarchy: L0 chunks → L1-N summaries → apex

---

## FILES TO READ NEXT SESSION

**Critical for Archive Work:**
1. `/Users/tem/.claude/plans/splendid-scribbling-iverson.md` - Full implementation plan
2. `narrative-studio/src/components/panels/ArchivePanel.tsx` - 2,068 lines to decompose
3. `workers/post-social-api/src/services/pyramid-builder.ts` - Reference for pyramid port

**Context Files:**
- `narrative-studio/docs/HANDOFF_DEC20_ROUTING.md` - Previous session handoff
- `CLAUDE.md` - Project guidelines, CSS standards

---

## TESTING CHECKLIST

### Tool Hiding/Favorites
```bash
1. npm run dev
2. Navigate to http://localhost:5173/tool/v3-analysis
3. Click ⚙️ settings button
4. Star a tool → verify it moves to front of nav
5. Hide a tool → verify it disappears from nav
6. Refresh → verify state persists
```

### CSS Utilities
The new utility classes are available for use:
```jsx
<div className="pane pane--secondary">  // flex column with bg
<div className="pane__scroll">           // scrollable content
<div className="card">                   // styled card
<div className="u-opacity-75">           // opacity utility
```

---

## NEXT STEPS (PRIORITY ORDER)

1. **Start Archive Decomposition** (Week 1)
   - Create MySQL schema
   - Implement MySQLDatabase service
   - Begin extracting ConversationsListView from ArchivePanel

2. **Continue CSS Compliance** (Ongoing)
   - Use new utility classes to replace inline styles
   - Target: BooksView.tsx (89), ClusterBrowserView.tsx (69)

3. **Port Pyramid Builder** (Week 4)
   - After MySQL + decomposition foundation is solid

---

## QUICK COMMANDS

```bash
# Start dev server
cd /Users/tem/humanizer_root/narrative-studio
npm run dev

# Check inline style count
cd src && grep -rc "style={{" --include="*.tsx" | awk -F: '{sum+=$2} END {print sum}'

# TypeScript check
npx tsc --noEmit

# Git status
git status
```

---

## CHROMADB MEMORY

Store this handoff with:
```
tags: session-handoff, archive-decomposition, tool-hiding, css-compliance, dec-20-2025
```
