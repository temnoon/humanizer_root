# Humanizer - Development Guide

**Updated**: Dec 8, 2025
**Status**: UI Stabilization | Pre-Launch Polish | Responsive Overhaul
**Active Branch**: `main`
**Signups**: 500+ waiting

---

## 🎯 CURRENT PRIORITY: Launch Readiness + Mobile

Stabilize interfaces across all three platforms:
1. **studio.humanizer.com** - Web Studio
2. **post-social.com** - Cloud nodes + AI curators
3. **Electron Local Studio** - Desktop app

### Active Work (Dec 8)
- 🔄 Responsive design overhaul (bottom sheet pattern for mobile)
- ✅ CSS color variables (all hardcoded colors now use var())
- ✅ Console.log cleanup (deployed)
- ✅ URL centralization (STORAGE_PATHS)
- ✅ AIAnalysisPane.tsx CSS compliance remediation
- ✅ CSS Compliance Guard added to CLAUDE.md

### Pending
- [ ] CSS pixel migration (782 values in studio.css)
- [ ] Inline style remediation (1,379 violations across 50+ files)
- [ ] Bottom sheet component implementation
- [ ] Mobile editor experience

---

## 📱 RESPONSIVE DESIGN STANDARDS (CRITICAL)

**These standards are MANDATORY for all CSS changes. Future development MUST follow these patterns.**

### Breakpoints (Mobile-First)

| Token | Width | Device | Usage |
|-------|-------|--------|-------|
| base | 0-319px | N/A | Not supported |
| `xs` | 320px+ | iPhone SE | Base mobile styles |
| `sm` | 480px+ | Large phones | Enhanced mobile |
| `md` | 768px+ | Tablets | 2-panel hybrid |
| `lg` | 1024px+ | Laptops | 3-panel desktop |
| `xl` | 1280px+ | Desktops | Full features |
| `2xl` | 1536px+ | Large monitors | Extended widths |

**Media Query Pattern** (mobile-first):
```css
/* Base styles for 320px+ */
.component { padding: var(--space-sm); }

@media (min-width: 480px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Spacing Variables (REQUIRED)

**NEVER use hardcoded pixel values for spacing. Use these variables:**

| Variable | Value | Usage |
|----------|-------|-------|
| `--space-xs` | 0.25rem (4px) | Icon gaps, tight spacing |
| `--space-sm` | 0.5rem (8px) | Small padding, gaps |
| `--space-md` | 1rem (16px) | Standard padding |
| `--space-lg` | 1.5rem (24px) | Large spacing |
| `--space-xl` | 2rem (32px) | Section spacing |
| `--space-2xl` | 3rem (48px) | Hero spacing |
| `--space-3xl` | 4rem (64px) | Major sections |

### Width/Height Patterns (REQUIRED)

```css
/* ❌ WRONG - hardcoded pixels */
width: 320px;
max-width: 700px;

/* ✅ CORRECT - fluid/clamped */
width: clamp(280px, 90vw, 400px);
max-width: min(700px, 95vw);
min-height: max(200px, 25vh);
```

### Color Variables (REQUIRED)

**NEVER use hardcoded hex colors. Use variables with fallbacks:**

```css
/* ❌ WRONG */
color: #dc2626;
background: rgba(239, 68, 68, 0.1);

/* ✅ CORRECT */
color: var(--color-error, #dc2626);
background: rgba(var(--color-error-rgb, 239, 68, 68), 0.1);
```

Available semantic colors:
- `--color-primary`, `--color-primary-hover`
- `--color-success`, `--color-success-hover`
- `--color-warning`, `--color-warning-hover`
- `--color-error`
- `--color-info`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`

### Border Radius (REQUIRED)

| Variable | Value | Usage |
|----------|-------|-------|
| `--radius-sm` | 0.25rem | Small controls |
| `--radius-md` | 0.5rem | Buttons, inputs |
| `--radius-lg` | 0.75rem | Cards |
| `--radius-xl` | 1rem | Modals |
| `--radius-full` | 9999px | Pills, avatars |

### Touch Targets (REQUIRED for interactive elements)

```css
/* Minimum 44px for touch targets */
.button, .link, .tap-target {
  min-height: var(--touch-target-min, 44px);
  min-width: var(--touch-target-min, 44px);
}
```

### Intentionally Fixed Values (OK to hardcode)

These values MAY remain as hardcoded pixels:
- **Borders**: 1px, 2px, 3px
- **Icon sizes**: 12px, 16px, 20px, 24px, 32px, 40px
- **Dividers**: 1px height
- **Focus rings**: 2px

### Mobile Panel Architecture

On mobile (<768px), side panels become **bottom sheets**:
- Collapsed state: 60px peek height
- Partial state: 40vh
- Expanded state: 100vh - header
- Gesture-driven open/close

### Accessibility Requirements

```css
/* Always include reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Reference Files

- **Variables**: `workers/post-social-ui/src/styles/variables.css`
- **Responsive Utils**: `workers/post-social-ui/src/styles/responsive.css`
- **Full Plan**: `/Users/tem/.claude/plans/composed-percolating-cat.md`
- **ChromaDB**: Query `responsive-design` or `mobile-first` tags

---

## 🚨 CSS COMPLIANCE GUARD (MANDATORY)

**CRITICAL: Before writing ANY frontend code, read this section. Violations waste context and development time.**

**APPLIES TO ALL PLATFORMS:**
- `studio.humanizer.com` (Cloud Web Studio)
- `post-social.com` (Cloud nodes + AI curators)
- Electron Local Studio (Desktop app)
- Any future humanizer frontend

### Theme System Architecture

The codebase uses a CSS variable-based theme system that MUST be respected:

```css
:root { /* Light theme - default */ }
[data-theme='dark'] { /* Dark theme overrides */ }
/* Future: [data-theme='sepia'], [data-theme='high-contrast'], etc. */
```

**WHY THIS MATTERS:** Hardcoded colors/values break theme switching. A single `color: #666` or `background: white` will render incorrectly in dark mode and any future themes.

### Inline Styles Are FORBIDDEN

**NEVER use `style={{}}` in React components with hardcoded values.** This is the single most common CSS violation.

```jsx
/* ❌ FORBIDDEN - hardcoded inline styles */
<div style={{ padding: '12px', color: '#666', backgroundColor: 'white' }}>

/* ✅ REQUIRED - use CSS classes */
<div className="my-component__container">

/* CSS file (index.css or component.css): */
.my-component__container {
  padding: var(--space-sm);
  color: var(--text-secondary);
  background-color: var(--bg-primary);
}
```

### Only Allowed Inline Styles

Inline styles are ONLY permitted for:
1. **Dynamic calculated values** - `style={{ width: \`${percent}%\` }}`
2. **Runtime transforms** - `style={{ transform: \`translateX(${x}px)\` }}`
3. **Grid/flex spans** - `style={{ gridColumn: \`span ${cols}\` }}`

**If it can be a CSS class, it MUST be a CSS class.**

### Theme-Aware Color Rules

**NEVER hardcode colors.** Always use CSS variables:

```jsx
/* ❌ BREAKS DARK MODE */
color: '#666'
color: 'white'
backgroundColor: 'rgba(0, 0, 0, 0.5)'

/* ✅ THEME-AWARE */
color: var(--text-secondary)
color: var(--text-inverse)
backgroundColor: var(--bg-tertiary)
```

Available semantic color variables:
| Purpose | Variable |
|---------|----------|
| Primary text | `--text-primary` |
| Secondary text | `--text-secondary` |
| Tertiary/muted | `--text-tertiary` |
| Inverted text | `--text-inverse` |
| Primary background | `--bg-primary` |
| Secondary background | `--bg-secondary` |
| Tertiary/hover | `--bg-tertiary` |
| Elevated surfaces | `--bg-elevated` |
| Panel backgrounds | `--bg-panel` |
| Borders | `--border-color`, `--border-strong` |
| Accent/brand | `--accent-primary`, `--accent-secondary` |
| Status | `--success`, `--warning`, `--error` |

### Pre-Development Checklist

Before adding ANY styles to a component:

| Step | Action |
|------|--------|
| 1 | Check if a class already exists in `index.css` |
| 2 | If not, create a new class using BEM naming: `.component__element--modifier` |
| 3 | Use ONLY CSS variables for values (spacing, colors, radii) |
| 4 | Place the class in `src/index.css` under the appropriate section |
| 5 | Never use hex colors, pixel values for spacing, or hardcoded font sizes |

### Current Technical Debt

As of Dec 8, 2025, there are **1,379 inline style violations** across 50+ files:

| File | Violations | Priority |
|------|------------|----------|
| `MainWorkspace.tsx` | 119 | High |
| `ArchivePanel.tsx` | 99 | High |
| `BooksView.tsx` | 89 | Medium |
| `ClusterBrowserView.tsx` | 69 | Medium |
| `ImportsView.tsx` | 65 | Medium |
| `FacebookFeedView.tsx` | 55 | Low |

When touching these files for other work, opportunistically refactor inline styles to CSS classes.

### How to Refactor Inline Styles

1. **Identify the style pattern** - Is it static or dynamic?
2. **Create a descriptive class** using BEM naming
3. **Add the class to index.css** with CSS variables
4. **Replace the inline style** with `className`
5. **For dynamic values only**, keep a minimal inline style

Example refactor:
```jsx
// Before
<div style={{
  padding: '16px',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: '#fff'
}}>

// After - index.css
.overlay-card {
  padding: var(--space-md);
  background-color: rgba(0, 0, 0, 0.5);
  color: var(--text-inverse);
}

// After - component.tsx
<div className="overlay-card">
```

---

## 🔗 SUBSYSTEM DOCUMENTATION (READ BEFORE MODIFYING)

**CRITICAL**: Before modifying any subsystem, READ the relevant documentation first.

| Subsystem | Documentation | Key Files |
|-----------|---------------|-----------|
| LLM/Transformations | `narrative-studio/docs/LLM_ARCHITECTURE.md` | `llm-models.ts`, `model-vetting/`, `llm-providers/` |
| Workspace Buffers | `narrative-studio/docs/WORKSPACE_BUFFERS.md` | `WorkspaceContext.tsx`, `useWorkspaceTools.ts` |
| AI Detection | `narrative-studio/docs/AI_DETECTION.md` | `ai-detection/`, `AIAnalysisPane.tsx` |
| Archive Import | `narrative-studio/docs/ARCHIVE_IMPORT.md` | `src/services/parser/` |

**Also query ChromaDB** for operational details: search tags like `llm-architecture`, `workspace-buffers`, `context-continuity`

### Documentation Hierarchy
1. **CLAUDE.md** (this file) - High-level principles, pointers to detail docs
2. **`/docs/*.md` files** - Full architectural documentation per subsystem
3. **ChromaDB** - Operational knowledge, session handoffs, debugging notes

### After Significant Changes
- UPDATE the relevant subsystem doc
- STORE handoff notes in ChromaDB with appropriate tags
- UPDATE this section if new subsystems are created

---

## 🔍 IMPLEMENTATION-FIRST PROTOCOL (MANDATORY)

**Before proposing or building ANY new feature, you MUST explore the existing codebase.**

This prevents parallel implementations and wasted effort. The "Passage System incident" (Dec 2025) produced 4,100 lines of redundant code because existing capabilities weren't discovered first.

### Required Exploration Checklist

Before writing new code, answer these questions:

| Question | How to Answer |
|----------|---------------|
| What contexts/providers exist? | `grep -r "createContext\|Provider" src/contexts/` |
| What services handle this domain? | `grep -r "export.*function\|export.*class" src/services/` |
| How does similar data flow today? | Trace a user action through the UI → context → service chain |
| What types are already defined? | Check `src/types/` for existing interfaces |

### Mandatory Steps

1. **Search before designing** - Use Grep/Glob to find related code
2. **Read before proposing** - Open and understand existing contexts and services
3. **Map capabilities** - Document what already exists for the proposed feature domain
4. **Identify gaps only** - Propose additions to existing systems, not replacements
5. **Ask if uncertain** - "Does X already handle this?" before building Y

### Red Flags (Stop and Explore)

- Creating a new Context when one might exist for that domain
- Building "extractors" or "parsers" without checking existing ones
- Proposing new type hierarchies without reviewing `src/types/`
- Any feature touching content, buffers, or transformations → check `UnifiedBufferContext` first

### Capability Registry

Key existing systems (check these before building):

| Domain | Existing System | Location |
|--------|-----------------|----------|
| Content/Buffers | `UnifiedBufferContext` | `src/contexts/UnifiedBufferContext.tsx` |
| Sessions/History | `SessionContext` | `src/contexts/SessionContext.tsx` |
| Auth | `AuthContext` | `src/contexts/AuthContext.tsx` |
| Embeddings/Search | `embeddingService` | `src/services/embeddingService.ts` |
| Transformations | `transformationService` | `src/services/transformationService.ts` |
| Archive Import | Parser module | `src/services/parser/` |

**Update this registry when adding new core systems.**

---

## 📋 Design Documents

| Document | Purpose |
|----------|---------|
| `narrative-studio/docs/BOOK_IMAGE_HANDLING.md` | Local vs cloud image architecture for books |

---

## 🎯 FUTURE: Explore Tab Enhancements

### Pending Features (User Requested)
1. **Click Navigation** - Click result → highlight text in message, scroll to position
2. **2D/3D Visualization** - t-SNE/UMAP projection with Three.js renderer
3. **Save Search Results** - Export query + hits to session buffer
4. **Async Jobs** - Background clustering with progress indicator

---

## ✅ Explore Tab UI (Phase 1 Complete)

**Added**: Nov 25, 2025

### Components Created
| File | Purpose |
|------|---------|
| `src/services/embeddingService.ts` | API wrapper |
| `src/contexts/ExploreContext.tsx` | Persistent state |
| `src/components/archive/ExploreView.tsx` | Tab container |
| `src/components/archive/SemanticSearchView.tsx` | Semantic search |
| `src/components/archive/ClusterBrowserView.tsx` | Cluster browser + params UI |
| `src/components/archive/AnchorManagerView.tsx` | Anchor management |

### Features Working
- Semantic search with 300ms debounce
- Similarity color-coding (green > 70%, yellow > 40%)
- Clustering with adjustable parameters
- State persistence across tab switches
- Pin results for anchor creation

---

## ✅ Archive Embedding System (Complete)

**Branch**: `feature/archive-import-parser`
**Status**: Backend Complete - 72K embeddings indexed
**Added**: Nov 25, 2025

### Stats
- Archive: `output_v13_final`
- Conversations: 1,720
- Messages: 36,255
- Embeddings: 72,510
- Clusters: 7 discovered

### Backend Files (`src/services/embeddings/`)

| File | Lines | Purpose |
|------|-------|---------|
| `EmbeddingDatabase.ts` | ~950 | SQLite + vec0 + CRUD |
| `ConversationWalker.ts` | ~200 | Extract from OpenAI tree |
| `EmbeddingGenerator.ts` | ~180 | transformers.js embeddings |
| `ArchiveIndexer.ts` | ~280 | Indexing orchestrator |
| `ClusteringService.ts` | ~320 | HDBSCAN + anchors (sampled) |

### API Endpoints (All Working)

```bash
# Embedding
POST /api/embeddings/build          # Start indexing
GET  /api/embeddings/status         # Check progress
POST /api/embeddings/search/messages  # Semantic search

# Clustering (use maxSampleSize: 1500 to avoid OOM)
POST /api/clustering/discover       # Run HDBSCAN
POST /api/anchors/create           # Create anchor
POST /api/anchors/between          # Find between anchors
```

### Earlier Handoffs
- `/tmp/HANDOFF_NOV25_EMBEDDINGS.md` - Embedding system details
- ChromaDB: `d9a70728...` (tag: `embeddings,clustering`)

---

## ✅ Archive Import Parser (Phase 6 Complete)

- ✅ TypeScript parser module - 9 files, ~1,800 lines
- ✅ 7-strategy media matching (hash, file-ID, filename+size, conv-dir, size+meta, size-only, filename-only)
- ✅ Audio file matching bug fixed
- ✅ Media folder creation bug fixed
- See: `/tmp/HANDOFF_NOV25_MEDIA_COMPLETE.md`

---

## 📁 OpenAI Export Media Structure

**Critical Knowledge** (documented in ChromaDB):

| Location | Pattern | Reference Format |
|----------|---------|------------------|
| Top-level | `file-{ID}_{name}.ext` | `file-service://file-{ID}` |
| `dalle-generations/` | `file-{ID}-{uuid}.webp` | `file-service://file-{ID}` |
| `user-{userID}/` | `file_{hash}-{uuid}.ext` | `sediment://file_{hash}` |
| `{uuid}/audio/` | `file_{hash}-{uuid}.wav` | Matched by conversation_dir |

---

## 🔧 QUICK COMMANDS

### Start Archive Server + Frontend
```bash
cd /Users/tem/humanizer_root/narrative-studio
npx tsx archive-server.js &  # Port 3002
npm run dev                   # Port 5173
```

### Import Archive via API
```bash
# Parse folder
curl -X POST http://localhost:3002/api/import/archive/folder \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/path/to/openai-export"}'

# Check status
curl http://localhost:3002/api/import/archive/status/{jobId}

# Apply to archive
curl -X POST http://localhost:3002/api/import/archive/apply/{jobId} \
  -H "Content-Type: application/json" \
  -d '{"archivePath": "/path/to/target/archive"}'
```

### Start Backend (Local with Ollama)
```bash
cd /Users/tem/humanizer_root/workers/npe-api
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler dev --local
```

---

## 📊 CURRENT STATE

**Working**:
- ✅ Archive server (port 3002)
- ✅ Frontend (localhost:5173)
- ✅ Import Archive flow (upload → parse → preview → apply)
- ✅ 7-strategy media matching
- ✅ Merge with existing archives
- ✅ Backend (wrangler dev --local on :8787)
- ✅ AI Detection, Persona, Style transformations

**Test Archives**:
- Nov 8 2025 export: `/Users/tem/Downloads/6b7599...`
- Target archive: `test_media_import_nov25`
- Reference: `/Users/tem/openai-export-parser/output_v13_final`

---

## 🎯 Studio-First Architecture

**Pattern**: The Studio is THE interface paradigm. 3-panel layout: Find | Focus | Transform.

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│  FIND           │  FOCUS                   │  TRANSFORM      │
│  (Left Panel)   │  (Center Panel)          │  (Right Panel)  │
└─────────────────┴──────────────────────────┴─────────────────┘
```

See `/workers/post-social-ui/` for reference implementation.

---

## ✅ COMPLETED FEATURES

- Session History & Buffer System (Phases 1-9)
- Markdown Preservation (Phase 1)
- AI Detection with highlights (Phase 2 backend)
- Post-Social Node System (Phases 1-3)

---

## 📝 ADMIN ACCOUNT

- Admin: dreegle@gmail.com (OAuth login)
- Test accounts can be provisioned via /admin/users/provision endpoint

**Note**: demo@humanizer.com is RETIRED (demoted to free tier, exposed password)

---

## 🚀 PRODUCTION

- API: https://npe-api.tem-527.workers.dev
- Frontend: https://humanizer.com
- Signups: 239 waiting

---

## ⚠️ CRITICAL RULES

1. **NO mock data** without explicit disclosure
2. **Node 22.21.1** (`nvm use 22`)
3. **Archive**: Always local (port 3002) for privacy
4. **Brand**: "humanizer.com" (with .com)

---

**End of Guide** | Next: Test with additional OpenAI exports
