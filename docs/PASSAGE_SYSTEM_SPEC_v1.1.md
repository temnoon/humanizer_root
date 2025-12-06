# Unified Passage System Specification v1.1

**Version**: 1.1
**Date**: December 5, 2025
**Status**: Approved
**ChromaDB ID**: `f5466a6c1f8d89db6b01faf3fdc5695adcb89cd3d9498a73a6289ce5730af856`

---

## Executive Summary

The Passage System is the universal content conduit for Humanizer. All content—regardless of source format—flows through this system to be worked on, transformed, and exported. This specification defines the architecture for handling content from diverse sources (AI conversation archives, Facebook exports, files, web scraping) with a unified interface.

**Key Innovation**: Semantic search and "Find Similar" across years of personal content that original platforms (OpenAI, Facebook) don't offer.

---

## 1. Core Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PASSAGE SYSTEM FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCES              EXTRACTION         WORK AREA         OUTPUT            │
│  ───────              ──────────         ─────────         ──────            │
│                                                                              │
│  Local Archives  ─┐                    ┌─────────────┐                       │
│  (OpenAI, Claude) │                    │             │   → Save to Archive   │
│                   │   ┌───────────┐    │   CENTER    │   → Export (MD, TXT)  │
│  Facebook Export ─┼──▶│  PASSAGE  │───▶│   PANE      │──▶→ Add to Book       │
│                   │   │ EXTRACTOR │    │             │   → Send to Tools     │
│  File Import     ─┤   └───────────┘    │  (Edit,     │   → Upload to Cloud   │
│  (PDF,TXT,MD,RTF) │         │          │   Preview,  │                       │
│                   │         ▼          │   Select)   │                       │
│  Web Scraping    ─┤   ┌───────────┐    │             │   ┌─────────────┐     │
│  (Substack,       │   │ PASSAGES  │    └─────────────┘   │   TOOLS     │     │
│   Medium,         │   │ (chunks)  │          │           │   PANEL     │     │
│   WordPress)     ─┘   └───────────┘          ▼           │  (Right)    │     │
│                            │           ┌───────────┐     ├─────────────┤     │
│  Paste Text      ─────────▶│           │ Selected  │────▶│ Transform   │     │
│  (Web Studio)              │           │ Passage(s)│     │ Analyze     │     │
│                            ▼           └───────────┘     │ Detect AI   │     │
│                       Metadata                           │ Style       │     │
│                       preserved                          │ Persona     │     │
│                                                          └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Decisions

### 2.1 Storage Architecture: Unified Index (Option C)

```
Archive (READ-ONLY)           Index (SQLite/IndexedDB)
├── sources/                  ├── passages[] (extracted once)
│   ├── openai-export/        │   ├── content (cached)
│   └── facebook-export/      │   ├── sourceRef
└── imported-files/           │   └── status (original|edited)
                              ├── edits[] (overlay)
                              └── embeddings[] (semantic search)
```

**Key Principles**:
- **IndexedDB** for web, **SQLite** for Electron (same schema)
- **Extract once** on first access, cache in index
- **Source reference** always points to original (Lightroom catalog model)
- **Edits as overlay** - never modify cached content, store diffs
- **"Refresh from source"** button to re-extract if needed

### 2.2 Embeddings: Core Differentiator

**Value Proposition**: No other product offers semantic search across OpenAI/Facebook archives. Original platforms have terrible search for old content.

| Feature | Description |
|---------|-------------|
| **Semantic Search** | Query text → find similar passages across all archives |
| **Find Similar** | Select any passage → discover related content (KILLER FEATURE) |
| **Clustering** | Automatic grouping by semantic similarity |
| **Anchors** | User-defined semantic waypoints |
| **Cross-Archive** | Single search spans OpenAI + Facebook + files |

**User Education**: Show power of "Find Similar" from long content vs typing keywords.

**Pricing**: Embedding generation is a paid feature (Pro tier).

### 2.3 Formatting Preservation: Visible Block Markers

```
[BLOCK:h2]Heading Text[/BLOCK]

[BLOCK:p]First paragraph content here.[/BLOCK]

[BLOCK:p]Second paragraph with content.[/BLOCK]

[BLOCK:ul]
[BLOCK:li]First item[/BLOCK]
[BLOCK:li]Second item[/BLOCK]
[/BLOCK]
```

**Rationale**:
- Debuggable - visible in raw text
- Obvious when buggy (not silently broken)
- No special tools needed to inspect
- **MUST strip before display**

**Priority**: Paragraph preservation is P0. Inline formatting (bold, italic) is P2.

### 2.4 Index Scope: User Choice

| Mode | Use Case | Storage |
|------|----------|---------|
| **Archive-local** | Temporary import, one-off analysis | Per-archive IndexedDB/SQLite |
| **Global** | Cross-archive search, permanent collection | Shared index database |

**UI**: Import wizard asks "Add to global index?" with checkbox.

---

## 3. Passage Tier Limits

| Tier | Passage Limit | Behavior |
|------|---------------|----------|
| Free | 5,000 chars | Must trim, shown message |
| Pro | 50,000 chars | Auto-chunking transparent |
| Admin | Unlimited | Whole books, auto-chunking |

**Behind the scenes**: All content auto-chunked for API limits. User doesn't see chunking unless free tier hits limit.

---

## 4. Content Sources

### 4.1 Local Archives (Electron Only - Privacy)

| Source | Format | Status |
|--------|--------|--------|
| OpenAI/ChatGPT Export | JSON tree + media | ✅ Implemented |
| Claude Export | JSON | ✅ Implemented |
| Facebook Export | JSON + HTML | ✅ Implemented |
| Apple Messages | SQLite | Future |
| WhatsApp | ZIP/TXT | Future |
| Slack | JSON | Future |

### 4.2 File Import (Both Surfaces)

| Format | Extension | Priority |
|--------|-----------|----------|
| Plain Text | .txt | P0 |
| Markdown | .md | P0 |
| HTML | .html | P0 |
| PDF | .pdf | P1 |
| Rich Text | .rtf | P2 |
| EPUB | .epub | P2 |
| DOCX | .docx | P2 |

### 4.3 Web Scraping (Both Surfaces)

| Platform | Method | Notes |
|----------|--------|-------|
| Substack | RSS + Article fetch | Blog import |
| Medium | Article URL | Handle paywall gracefully |
| WordPress | RSS + WP API | Blog post content |
| Generic URL | Readability algorithm | Best-effort extraction |

**Use Case**: Web studio users without local archives can import their own writing from blogs.

---

## 5. Data Model

### 5.1 Passage Interface

```typescript
interface Passage {
  // Identity
  id: string;

  // Content
  content: string;
  contentType: 'text' | 'markdown' | 'html';

  // Source tracking
  source: {
    type: 'archive' | 'file' | 'web' | 'paste' | 'cloud';
    name: string;
    path?: string;
    extractedAt: Date;
  };

  // Position in source (for navigation back)
  position?: {
    messageId?: string;
    pageNumber?: number;
    chapterIndex?: number;
    paragraphIndex?: number;
    characterOffset?: number;
  };

  // Metadata
  metadata: {
    title?: string;
    author?: string;
    date?: Date;
    tags?: string[];
    wordCount: number;
    estimatedReadTime: number;
  };

  // Transformation history
  history: TransformationRecord[];

  // UI state (not persisted)
  isSelected?: boolean;
  isExpanded?: boolean;
}
```

### 5.2 Index Schema (SQLite/IndexedDB)

```sql
-- Sources
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'openai' | 'facebook' | 'file' | 'web'
  name TEXT NOT NULL,
  path TEXT,
  indexed_at INTEGER,
  scope TEXT DEFAULT 'local'  -- 'local' | 'global'
);

-- Passages
CREATE TABLE passages (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  position_type TEXT,
  position_id TEXT,
  position_index INTEGER,
  title TEXT,
  author TEXT,
  created_at INTEGER,
  word_count INTEGER,
  extracted_at INTEGER NOT NULL,
  embedding_id TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- Edits (overlay, never modify original)
CREATE TABLE edits (
  id TEXT PRIMARY KEY,
  passage_id TEXT NOT NULL,
  edit_type TEXT NOT NULL,
  original_hash TEXT,
  diff TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (passage_id) REFERENCES passages(id)
);

-- Transformations
CREATE TABLE transformations (
  id TEXT PRIMARY KEY,
  passage_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  input_hash TEXT,
  output TEXT NOT NULL,
  settings TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (passage_id) REFERENCES passages(id)
);

-- Embeddings (vec0 extension)
CREATE VIRTUAL TABLE passage_embeddings USING vec0 (
  passage_id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);
```

---

## 6. Formatting Pipeline

```
INPUT: "## Introduction\n\nThis is the **first** paragraph.\n\nThis is the second."

STEP 1: Parse Structure
───────────────────────
{
  blocks: [
    { type: 'h2', content: 'Introduction' },
    { type: 'p', content: 'This is the **first** paragraph.',
      inlineMarks: [{pos:12, type:'bold', len:7}] },
    { type: 'p', content: 'This is the second.' }
  ]
}

STEP 2: Create Marked Text (for LLM)
────────────────────────────────────
[BLOCK:h2]Introduction[/BLOCK]

[BLOCK:p]This is the first paragraph.[/BLOCK]

[BLOCK:p]This is the second.[/BLOCK]

(Note: inline formatting stripped, structure preserved)

STEP 3: LLM Transformation
──────────────────────────
LLM instructed: "Preserve [BLOCK:*] markers exactly. Transform text inside."

STEP 4: Restore Structure
─────────────────────────
- Parse blocks back
- Restore markdown syntax (## for h2, \n\n between p)
- Inline formatting: best-effort OR dropped

OUTPUT: "## Overview\n\nHere begins the initial section.\n\nHere continues."
```

---

## 7. MVP Scope (January 2026)

### In Scope
- Text extraction from TXT, MD, HTML, PDF
- Passage creation, editing, selection
- Tool integration (transform, analyze)
- Export to markdown, book, cloud
- Web scraping for blogs (Substack, Medium, WordPress)
- Embedding-based semantic search (paid)
- "Find Similar" feature

### Out of Scope (Post-Launch)
- Image extraction/handling
- Video/audio transcription
- OCR for scanned PDFs
- Media embedding in passages

**Rationale**: Text-first reduces moderation complexity, emphasizes narrative focus, accelerates launch.

---

## 8. Related Documents

- **Tool Inventory**: ChromaDB ID `2faf31f1...`
- **Phase 6 Testing Report**: ChromaDB ID `c25c6407...`
- **Cross-Codebase Planning**: ChromaDB ID `b7639fe0...`
- **Buffer System Handoff (Dec 3)**: `/tmp/HANDOFF_DEC03_BUFFER_SYSTEM.md`

---

## Appendix: "Find Similar" UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Selected Passage                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  "The phenomenological method requires bracketing our        │
│   natural assumptions about the world. This epoché allows    │
│   us to examine experience as it presents itself..."         │
│                                                              │
│  [Transform ▼]  [Analyze]  [🔍 Find Similar]  [Add to Book]  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Similar Passages (across all indexed archives)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📁 OpenAI Archive • 94% similar                             │
│  "Husserl's phenomenological reduction involves..."          │
│  Conversation: Philosophy Discussion (2024-03-15)            │
│                                                              │
│  📘 Facebook • 87% similar                                   │
│  "I've been reading about bracketing in phenomenology..."    │
│  Post: Q2 2019                                               │
│                                                              │
│  📄 Imported PDF • 82% similar                               │
│  "The methodological device of epoché suspends..."           │
│  File: husserl-ideas-ch2.pdf                                 │
└─────────────────────────────────────────────────────────────┘
```

---

**End of Specification**
