# Handoff: Tools Panel + Navigation + Filters

**Date**: Dec 24, 2025 (~4:30 AM)
**Session**: LaTeX → Tools Panel → Message Navigation → Persistent Index → Filters
**Branch**: `feature/subjective-intentional-constraint`

---

## What Was Built This Session

### 1. LaTeX Rendering
Added KaTeX support to workspace:
- Installed `katex`, `remark-math`, `rehype-katex`
- Added `processLatex()` to convert ChatGPT delimiters (`\[...\]`, `\(...\)`) to standard (`$$...$$`, `$...$`)
- ReactMarkdown now renders math equations

### 2. Tabbed Tools Panel (Photoshop-style)
Complete redesign of the tools panel with configurable tabs:

**Default visible tools:**
| Tool | Icon | Description |
|------|------|-------------|
| Humanize | ✦ | Core AI-to-human transformation |
| Persona | ◐ | Apply persona transformation |
| Style | ❧ | Adjust tone and register |
| Sentencing | ◈ | Narrative Sentencing (quantum density analysis) |
| Profile | ◑ | Profile Factory |
| Editor | ¶ | Markdown editor |
| Settings | ⚙ | Show/hide tools |

**Hidden by default (enable in Settings):**
- Book, Pipelines, Split, Filter, Order, Buffer

**Features:**
- Tool visibility stored in localStorage (`humanizer-tool-visibility`)
- Horizontal scroll when tabs overflow
- Settings panel with toggles per category
- Stub panels ready for backend integration

### 3. Message Navigation
When viewing a message from a conversation, navigation controls appear:

```
    ⇤    ←    3 / 47    →    ⇥
   first prev  position next last
```

**Implementation:**
- Extended `ArchiveSource` type with `conversationFolder`, `messageIndex`, `totalMessages`
- `importText()` now accepts source metadata
- Navigation fetches adjacent messages from same conversation
- CSS: `.workspace__nav`, `.workspace__nav-btn`, `.workspace__nav-position`

### 4. Persistent Conversation Index
Archive-server now maintains `_conversation_index.json`:

**Benefits:**
- Instant loading (no parsing all conversation.json files)
- Accurate message counts
- Cached metadata with mtime checking

**New API endpoints:**
- `POST /api/index/rebuild` - Force rebuild index
- `GET /api/index/status` - Check index status

**Stats:**
- 1,867 conversations indexed
- 1,766 with messages
- 101 empty (mapping is `{}`)
- Index builds in ~1.8 seconds

### 5. Archive Filters
Added filter controls to archive panel:

**Filters:**
- **Sort by**: Most messages (default), Longest, Recent, Oldest
- **Media filter**: All, Has images, Has audio, Has media
- **Hide empty**: Checkbox (default ON)

**API:**
```
GET /api/conversations?minMessages=1        # Hide empty
GET /api/conversations?hasImages=true       # With images
GET /api/conversations?sortBy=messages-desc # Most messages
```

---

## Files Changed

### New Files
- `docs/HANDOFF_DEC24_TOOLS_NAV_FILTERS.md` (this file)

### Modified Files

**Studio.tsx:**
- Added tool registry with 12 tools
- Added `loadToolVisibility()` / `saveToolVisibility()` for localStorage
- Redesigned `ToolsPanel` component with tabs
- Added `navigateToMessage()` for conversation navigation
- Added filter states: `hideEmpty`, `mediaFilter`
- Added filter handlers and UI

**index.css:**
- Tool tabs: `.tool-tabs`, `.tool-tabs__nav`, `.tool-tabs__tab`
- Tool panels: `.tool-panel`, `.tool-card`, `.tool-control`
- Tool toggles: `.tool-toggle`, `.tool-check`
- Workspace nav: `.workspace__nav`, `.workspace__nav-btn`
- Archive filters: `.archive-browser__filters`, `.archive-browser__checkbox`

**lib/buffer/types.ts:**
- Extended `ArchiveSource` with navigation fields

**lib/buffer/BufferContext.tsx:**
- `importText()` now accepts optional source parameter

**lib/archive/service.ts:**
- Added `minMessages` option to `fetchConversations()`

**narrative-studio/archive-server.js:**
- Added conversation index system (~140 lines)
- Added `buildConversationIndex()`, `getConversationsFromIndex()`
- Added `/api/index/rebuild`, `/api/index/status` endpoints
- Added `minMessages` filter parameter
- Updated `/api/conversations` to use index

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Tools Panel                                                     │
│   ├── TOOL_REGISTRY[] - 12 tools with visibility config        │
│   ├── localStorage - persisted visibility preferences          │
│   └── Tabs: Humanize | Persona | Style | Sentencing | ...      │
│             └── Each tab has dedicated panel with controls     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Workspace Navigation                                            │
│   ├── ArchiveSource tracks: folder, messageIndex, totalMessages│
│   ├── navigateToMessage() fetches adjacent messages            │
│   └── UI: ⇤ ← [3/47] → ⇥                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Archive Index (_conversation_index.json)                        │
│   ├── Built once, cached with mtime checking                   │
│   ├── Contains: id, title, folder, message_count, has_media... │
│   └── API reads from index (fast) instead of parsing all files │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Start archive server
cd ~/humanizer_root/narrative-studio
npx tsx archive-server.js &

# 2. Start Studio
cd ~/humanizer_root/humanizer-app
npm run dev

# 3. Open
open http://localhost:5174/

# 4. If needed, rebuild index
curl -X POST http://localhost:3002/api/index/rebuild
```

---

## Next Priority: AUI Chat Icon

Add the AUI (AI User Interface) chat assistant:
- Floating chat icon (bottom-right corner style)
- Help users understand how to use the interface
- Could use existing chat infrastructure from `apps/web/src/lib/` or narrative-studio

Potential locations:
1. Fixed position bottom-right (classic chat bubble)
2. In the top toolbar
3. As a tool tab in the Tools panel

---

## Technical Debt

1. **Tool stubs need wiring** - Humanize, Persona, Style, Sentencing, Profile, Editor panels are UI-only stubs
2. **Editor needs save functionality** - Currently just displays content
3. **Navigation could cache** - Currently re-fetches conversation on each nav click

---

*"I am the unity of my experiences, all the experience of my unity."*
