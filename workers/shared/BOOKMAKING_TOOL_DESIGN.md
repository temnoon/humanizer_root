# Bookmaking Tool - Design Document

**Version**: 1.0
**Date**: December 2, 2025
**Status**: Design Phase

---

## Vision

The Bookmaking Tool is the **culmination of the humanizer platform** - a personal workspace where users collect, transform, annotate, and synthesize content from any source into meaningful personal artifacts. It bridges the gap between consumption and creation, turning passive reading and conversation into active self-improvement.

### Core Philosophy

> "A book is not just pages - it's a conversation across time between the author, the reader, and the ideas themselves."

The tool enables users to:
1. **Collect** - Gather content from AI conversations, classics, personal notes, social posts
2. **Converse** - Engage with content through the AI Curator's Socratic dialogue
3. **Transform** - Apply persona, style, and allegorical shifts to deepen understanding
4. **Annotate** - Add marginalia, highlights, questions, and cross-references
5. **Synthesize** - Combine insights into new narratives
6. **Publish** - Export as personal notebooks or shareable books

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BOOKMAKING TOOL                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   SOURCES   │    │    BOOK     │    │   OUTPUT    │             │
│  │             │───▶│   EDITOR    │───▶│             │             │
│  │ • Archives  │    │             │    │ • PDF       │             │
│  │ • Gutenberg │    │ • Chapters  │    │ • EPUB      │             │
│  │ • Notes     │    │ • Sections  │    │ • Markdown  │             │
│  │ • Folders   │    │ • Pages     │    │ • Post-Node │             │
│  │ • URLs      │    │ • Annots    │    │             │             │
│  └─────────────┘    └──────┬──────┘    └─────────────┘             │
│                            │                                        │
│         ┌──────────────────┼──────────────────┐                    │
│         ▼                  ▼                  ▼                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │  CURATOR    │    │   TOOLS     │    │  SYNTHESIS  │            │
│  │             │    │             │    │             │            │
│  │ • Q&A       │    │ • Transform │    │ • Combine   │            │
│  │ • Analysis  │    │ • Detect    │    │ • Summarize │            │
│  │ • Insights  │    │ • Extract   │    │ • Generate  │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Book

```typescript
interface Book {
  id: string;                    // UUID
  title: string;
  subtitle?: string;
  author: string;                // User or "Compiled by [user]"
  description?: string;
  coverImage?: string;           // URL or base64

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  visibility: 'private' | 'unlisted' | 'public';

  // Structure
  chapters: Chapter[];

  // Settings
  settings: BookSettings;

  // Stats
  stats: {
    wordCount: number;
    pageCount: number;
    sourceCount: number;
    annotationCount: number;
    curatorConversations: number;
  };
}

interface BookSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'serif' | 'sans' | 'mono';
  showProvenance: boolean;       // Show source attribution
  showAnnotations: boolean;      // Show marginalia
  enableCurator: boolean;        // Allow curator conversations
}
```

### Chapter

```typescript
interface Chapter {
  id: string;
  bookId: string;
  title: string;
  order: number;

  // Content
  sections: Section[];

  // Chapter-level annotations
  epigraph?: string;             // Opening quote
  summary?: string;              // AI-generated or user-written

  // Navigation
  previousChapterId?: string;
  nextChapterId?: string;
}
```

### Section

```typescript
interface Section {
  id: string;
  chapterId: string;
  title?: string;
  order: number;

  // Content blocks
  pages: Page[];
}
```

### Page (Core Content Unit)

```typescript
interface Page {
  id: string;
  sectionId: string;
  order: number;

  // The actual content
  content: string;               // Markdown/HTML
  contentType: 'text' | 'conversation' | 'image' | 'embed';

  // Provenance - where did this come from?
  source: PageSource;

  // Annotations on this page
  annotations: Annotation[];

  // Curator conversations about this page
  curatorThreadId?: string;

  // Transformations applied
  transformations: TransformationRecord[];

  // Original content (if transformed)
  originalContent?: string;
}

interface PageSource {
  type: 'archive' | 'gutenberg' | 'notes' | 'folder' | 'url' | 'manual' | 'synthesis';

  // For archive sources (OpenAI, Claude, Facebook)
  archiveName?: string;
  conversationId?: string;
  messageId?: string;

  // For Gutenberg
  gutenbergId?: number;
  gutenbergTitle?: string;
  gutenbergAuthor?: string;
  gutenbergChapter?: string;

  // For Apple Notes
  noteId?: string;
  notePath?: string;

  // For local folders
  filePath?: string;
  fileName?: string;

  // For web content (URLs)
  url?: string;
  finalUrl?: string;             // After redirects
  siteName?: string;
  siteAuthor?: string;
  publishedAt?: Date;
  fetchedAt?: Date;
  robotsTxtCompliant?: boolean;  // Confirms we respected robots.txt

  // Common
  importedAt: Date;
  originalWordCount: number;

  // Attribution (always shown to give credit)
  attribution?: {
    title: string;
    author?: string;
    source: string;              // Site name or "Project Gutenberg", etc.
    url?: string;
    license?: string;            // "Public Domain", "CC-BY", etc.
  };
}
```

### Annotation (Marginalia)

```typescript
interface Annotation {
  id: string;
  pageId: string;

  // Position in content
  startOffset: number;
  endOffset: number;
  selectedText: string;

  // The annotation itself
  type: 'highlight' | 'note' | 'question' | 'link' | 'definition';
  content: string;

  // For questions - curator response
  curatorResponse?: string;

  // For links - cross-reference
  linkedPageId?: string;
  linkedUrl?: string;

  // Metadata
  createdAt: Date;
  color?: string;                // For highlights
}
```

### Transformation Record

```typescript
interface TransformationRecord {
  id: string;
  pageId: string;

  // What tool was applied
  toolId: string;                // 'humanizer', 'translation', 'persona', etc.
  toolName: string;

  // Parameters used
  parameters: Record<string, unknown>;

  // Before/after
  inputContent: string;
  outputContent: string;

  // Metadata
  appliedAt: Date;
  appliedBy: string;             // User ID

  // For analysis tools - results
  analysisResult?: Record<string, unknown>;
}
```

---

## Source Importers

### 1. Archive Importer (Existing)

```typescript
interface ArchiveImporter {
  // Already implemented
  listArchives(): Promise<Archive[]>;
  getConversations(archiveName: string): Promise<Conversation[]>;
  getMessages(archiveName: string, conversationId: string): Promise<Message[]>;

  // New: Import to book
  importToBook(params: {
    bookId: string;
    chapterId: string;
    archiveName: string;
    conversationId: string;
    messageIds?: string[];       // Specific messages, or all if omitted
    includeMedia: boolean;
  }): Promise<Page[]>;
}
```

### 2. Gutenberg Importer (New)

```typescript
interface GutenbergImporter {
  // Search for books
  search(query: string, options?: {
    author?: string;
    language?: string;
    subject?: string;
    limit?: number;
  }): Promise<GutenbergBook[]>;

  // Get book metadata
  getBook(gutenbergId: number): Promise<GutenbergBook>;

  // Get book content with chapter detection
  getContent(gutenbergId: number): Promise<{
    chapters: GutenbergChapter[];
    fullText: string;
  }>;

  // Import chapters to book
  importToBook(params: {
    bookId: string;
    gutenbergId: number;
    chapterMapping: {
      gutenbergChapter: string;
      targetChapterId: string;
    }[];
  }): Promise<Page[]>;
}

interface GutenbergBook {
  id: number;
  title: string;
  authors: string[];
  subjects: string[];
  languages: string[];
  downloadCount: number;
  formats: Record<string, string>; // format -> URL
}

interface GutenbergChapter {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
}
```

### 3. Notes Importer (New)

```typescript
interface NotesImporter {
  // For Apple Notes - requires user to export or grant access

  // Option A: Import from exported HTML/PDF
  importFromExport(params: {
    bookId: string;
    chapterId: string;
    filePath: string;            // Path to exported notes
    format: 'html' | 'pdf';
  }): Promise<Page[]>;

  // Option B: For Electron - AppleScript integration (macOS)
  listNotes(): Promise<Note[]>;

  importNote(params: {
    bookId: string;
    chapterId: string;
    noteId: string;
  }): Promise<Page>;
}

interface Note {
  id: string;
  title: string;
  folder: string;
  createdAt: Date;
  modifiedAt: Date;
  snippet: string;               // First 100 chars
}
```

### 4. Folder Scanner (New)

```typescript
interface FolderImporter {
  // Scan a directory for importable files
  scan(folderPath: string, options?: {
    recursive: boolean;
    extensions: string[];        // ['.md', '.txt', '.html']
    maxDepth?: number;
  }): Promise<FolderFile[]>;

  // Import files to book
  importToBook(params: {
    bookId: string;
    chapterId: string;
    filePaths: string[];
    preserveStructure: boolean;  // Create sections from folder structure
  }): Promise<Page[]>;
}

interface FolderFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: Date;
  parentFolder: string;
}
```

### 5. Web Content Importer (New)

Fetches content from arbitrary URLs across the internet while respecting site restrictions.

```typescript
interface WebContentImporter {
  // Check if URL can be fetched (robots.txt, paywall, etc.)
  checkAccess(url: string): Promise<AccessCheckResult>;

  // Fetch and extract content from URL
  fetch(url: string, options?: FetchOptions): Promise<WebContentResult>;

  // Import to book (only if access allowed)
  importToBook(params: {
    bookId: string;
    chapterId: string;
    url: string;
    extractMode: 'article' | 'full' | 'selection';
    selection?: string;          // CSS selector for specific content
    includeImages: boolean;
  }): Promise<Page | ImportError>;
}

interface AccessCheckResult {
  url: string;
  allowed: boolean;

  // If not allowed, explain why
  restriction?: {
    type: 'robots_txt' | 'paywall' | 'login_required' | 'geo_blocked' |
          'rate_limited' | 'blocked' | 'timeout' | 'not_found' | 'server_error';
    message: string;

    // For robots.txt
    robotsTxtUrl?: string;
    disallowedBy?: string;       // The specific rule that blocked access

    // For paywalls
    subscriptionRequired?: boolean;

    // Suggestions
    alternatives?: string[];     // Alternative URLs or sources
  };

  // Metadata we could gather without fetching full content
  contentType?: string;
  estimatedSize?: number;
}

interface FetchOptions {
  // Respect robots.txt (default: true, cannot be overridden to false)
  respectRobotsTxt: true;

  // User agent to identify ourselves
  userAgent: 'HumanizerBot/1.0 (+https://humanizer.com/bot)';

  // Rate limiting
  maxRequestsPerDomain: number;  // Default: 1 per second

  // Content extraction
  extractMode: 'article' | 'full' | 'selection';
  selector?: string;

  // Media handling
  includeImages: boolean;
  maxImageSize?: number;         // Skip images larger than this (bytes)

  // Caching
  useCache: boolean;
  cacheMaxAge?: number;          // Seconds
}

interface WebContentResult {
  success: boolean;
  url: string;
  finalUrl: string;              // After redirects

  // If successful
  content?: {
    title: string;
    author?: string;
    siteName?: string;
    publishedAt?: Date;
    modifiedAt?: Date;

    // Main content (cleaned HTML or Markdown)
    body: string;
    bodyFormat: 'html' | 'markdown';

    // Plain text version
    plainText: string;
    wordCount: number;

    // Excerpt for preview
    excerpt: string;

    // Media
    images: WebImage[];
    videos: WebVideo[];

    // Metadata
    description?: string;
    keywords?: string[];
    language?: string;

    // Original page info
    canonicalUrl?: string;
    ogImage?: string;
  };

  // If failed
  error?: {
    type: AccessCheckResult['restriction']['type'];
    message: string;
    userFriendlyMessage: string;  // For display to user
  };

  // Always included
  fetchedAt: Date;
  fromCache: boolean;
  robotsTxtChecked: boolean;
}

interface WebImage {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  localPath?: string;            // If downloaded locally
}

interface WebVideo {
  src: string;
  type: 'youtube' | 'vimeo' | 'direct' | 'other';
  embedUrl?: string;
  thumbnail?: string;
}

interface ImportError {
  success: false;
  error: {
    type: string;
    message: string;
    userFriendlyMessage: string;
  };
}
```

#### Robots.txt Compliance

The importer **always** respects robots.txt:

```typescript
class RobotsTxtChecker {
  private cache: Map<string, RobotsTxtRules> = new Map();

  async isAllowed(url: string): Promise<{
    allowed: boolean;
    rule?: string;
    robotsTxtUrl?: string;
  }> {
    const origin = new URL(url).origin;
    const robotsTxtUrl = `${origin}/robots.txt`;

    // Fetch and cache robots.txt
    let rules = this.cache.get(origin);
    if (!rules) {
      rules = await this.fetchAndParse(robotsTxtUrl);
      this.cache.set(origin, rules);
    }

    // Check against our user agent
    const path = new URL(url).pathname;
    const result = rules.isAllowed('HumanizerBot', path);

    return {
      allowed: result.allowed,
      rule: result.matchedRule,
      robotsTxtUrl
    };
  }
}
```

#### User-Facing Error Messages

| Restriction Type | User Message |
|-----------------|--------------|
| `robots_txt` | "This website doesn't allow automated access to this page. You can visit it manually and copy the content." |
| `paywall` | "This content requires a subscription. If you have access, you can copy the content manually." |
| `login_required` | "This page requires login. Please log in and copy the content manually." |
| `geo_blocked` | "This content is not available in your region." |
| `rate_limited` | "We've made too many requests to this site. Please try again in a few minutes." |
| `blocked` | "This website has blocked our access. You can copy the content manually." |
| `timeout` | "The website took too long to respond. Please try again later." |
| `not_found` | "This page doesn't exist or has been removed." |
| `server_error` | "The website is experiencing issues. Please try again later." |

#### Supported Content Types

| Type | Extraction Method |
|------|-------------------|
| HTML pages | Readability algorithm (like Pocket/Instapaper) |
| PDF documents | PDF.js text extraction |
| Plain text | Direct import |
| Markdown | Direct import |
| RSS/Atom feeds | Parse and list entries for selection |
| YouTube | Transcript extraction (if available) |
| Twitter/X | oEmbed + thread unrolling |
| Medium | Article extraction (respects paywall) |
| Substack | Article extraction (respects paywall) |
| Wikipedia | Clean article extraction |
| News sites | Article extraction with attribution |

---

## Tool Integration

### Transformation Pipeline

When a user applies a tool to a page:

```typescript
interface TransformationPipeline {
  // Apply a single tool
  applyTool(params: {
    pageId: string;
    toolId: string;
    parameters: Record<string, unknown>;
    replaceOriginal: boolean;    // true = replace, false = create new version
  }): Promise<{
    transformedContent: string;
    record: TransformationRecord;
  }>;

  // Apply multiple tools in sequence
  applyPipeline(params: {
    pageId: string;
    tools: {
      toolId: string;
      parameters: Record<string, unknown>;
    }[];
  }): Promise<{
    finalContent: string;
    records: TransformationRecord[];
  }>;

  // Revert to original or previous version
  revert(pageId: string, toVersion?: string): Promise<Page>;

  // View transformation history
  getHistory(pageId: string): Promise<TransformationRecord[]>;
}
```

### Available Tools for Books

| Tool | Use Case in Bookmaking |
|------|------------------------|
| **Humanizer** | Polish AI-generated content before publishing |
| **Translation** | Create multilingual study guides |
| **Persona Transform** | Rewrite content in a specific voice |
| **Style Transform** | Match the style of the book's theme |
| **Namespace Transform** | Shift conceptual frameworks |
| **Allegorical Projection** | Deep transformation for creative works |
| **AI Detection** | Verify originality of compiled content |
| **Extract Persona** | Extract the voice of an author to use elsewhere |
| **Extract Style** | Extract stylistic patterns for learning |
| **Quantum Reading** | Deep analysis of a page's meaning |
| **Voice Discovery** | Find your own voice through the text |

---

## Curator Integration

### Page-Level Curator

Every page can have a curator conversation:

```typescript
interface PageCurator {
  // Start a conversation about a page
  startConversation(params: {
    pageId: string;
    initialQuestion?: string;
  }): Promise<CuratorThread>;

  // Continue conversation
  sendMessage(params: {
    threadId: string;
    message: string;
  }): Promise<CuratorResponse>;

  // Get all conversations for a page
  getThreads(pageId: string): Promise<CuratorThread[]>;

  // Save a curator insight as an annotation
  saveAsAnnotation(params: {
    threadId: string;
    messageId: string;
    annotationType: 'note' | 'insight';
  }): Promise<Annotation>;
}

interface CuratorThread {
  id: string;
  pageId: string;
  messages: CuratorMessage[];
  createdAt: Date;
  lastMessageAt: Date;
}

interface CuratorMessage {
  id: string;
  role: 'user' | 'curator';
  content: string;
  timestamp: Date;

  // For curator messages
  suggestions?: string[];
  relatedPages?: string[];       // Cross-references
}
```

### Book-Level Synthesis

```typescript
interface BookSynthesis {
  // Generate chapter summary
  summarizeChapter(chapterId: string): Promise<string>;

  // Generate book summary
  summarizeBook(bookId: string): Promise<string>;

  // Find themes across the book
  discoverThemes(bookId: string): Promise<Theme[]>;

  // Generate study questions
  generateStudyQuestions(params: {
    bookId: string;
    chapterIds?: string[];
    questionTypes: ('comprehension' | 'analysis' | 'synthesis' | 'evaluation')[];
    count: number;
  }): Promise<StudyQuestion[]>;

  // Create a synthesis page from multiple sources
  synthesize(params: {
    bookId: string;
    targetChapterId: string;
    sourcePageIds: string[];
    prompt?: string;             // Optional guidance
  }): Promise<Page>;
}

interface Theme {
  name: string;
  description: string;
  relevantPageIds: string[];
  strength: number;              // 0-1 confidence
}

interface StudyQuestion {
  question: string;
  type: string;
  sourcePageIds: string[];
  suggestedAnswer?: string;
}
```

---

## User Interface

### Book Editor Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Book Title]                                    [Export] [Settings] │
├────────────────┬─────────────────────────────────┬───────────────────┤
│                │                                 │                   │
│  STRUCTURE     │         PAGE EDITOR             │   CURATOR/TOOLS   │
│                │                                 │                   │
│  📖 Chapter 1  │  ┌─────────────────────────┐   │  💬 Curator Chat  │
│    ├─ Section  │  │                         │   │                   │
│    │  ├─ Page  │  │  Page content here...   │   │  Ask about this   │
│    │  ├─ Page  │  │                         │   │  page or select   │
│    │  └─ Page  │  │  [Highlighted text]     │◀──│  text to discuss  │
│    └─ Section  │  │        ├── Note         │   │                   │
│  📖 Chapter 2  │  │        └── Question     │   │  ─────────────── │
│    ├─ Section  │  │                         │   │                   │
│    └─ Section  │  │  More content...        │   │  🔧 Tools         │
│                │  │                         │   │                   │
│  [+ Chapter]   │  └─────────────────────────┘   │  • Humanize       │
│  [+ Import]    │                                 │  • Translate      │
│                │  Source: OpenAI • Imported...   │  • Transform      │
│                │                                 │  • Analyze        │
└────────────────┴─────────────────────────────────┴───────────────────┘
```

### Key Interactions

1. **Import Flow**
   - Click [+ Import] → Choose source type
   - Browse/search content → Select items
   - Choose target chapter/section → Import

2. **Annotation Flow**
   - Select text in page → Annotation toolbar appears
   - Choose annotation type → Add content
   - For questions → Curator responds automatically

3. **Transformation Flow**
   - Select page or text → Open Tools panel
   - Choose tool → Configure parameters
   - Preview result → Apply or cancel

4. **Export Flow**
   - Click [Export] → Choose format
   - Configure options (include annotations, provenance, etc.)
   - Generate → Download or publish to post-social

---

## API Design

### Books API

```
# Book CRUD
POST   /api/books                    Create book
GET    /api/books                    List user's books
GET    /api/books/:id                Get book with structure
PUT    /api/books/:id                Update book metadata
DELETE /api/books/:id                Delete book

# Structure Management
POST   /api/books/:id/chapters       Create chapter
PUT    /api/books/:id/chapters/:cid  Update chapter
DELETE /api/books/:id/chapters/:cid  Delete chapter
POST   /api/books/:id/chapters/reorder  Reorder chapters

POST   /api/books/:id/chapters/:cid/sections       Create section
PUT    /api/books/:id/sections/:sid                Update section
DELETE /api/books/:id/sections/:sid                Delete section

# Page Management
POST   /api/books/:id/sections/:sid/pages  Create page
GET    /api/books/:id/pages/:pid           Get page with annotations
PUT    /api/books/:id/pages/:pid           Update page
DELETE /api/books/:id/pages/:pid           Delete page
POST   /api/books/:id/pages/reorder        Reorder pages

# Annotations
POST   /api/books/:id/pages/:pid/annotations     Add annotation
PUT    /api/books/:id/annotations/:aid           Update annotation
DELETE /api/books/:id/annotations/:aid           Delete annotation

# Import
POST   /api/books/:id/import/archive     Import from archive
POST   /api/books/:id/import/gutenberg   Import from Gutenberg
POST   /api/books/:id/import/notes       Import from Notes
POST   /api/books/:id/import/folder      Import from folder
POST   /api/books/:id/import/url         Import from URL

# Transformation
POST   /api/books/:id/pages/:pid/transform  Apply tool to page
GET    /api/books/:id/pages/:pid/history    Get transformation history
POST   /api/books/:id/pages/:pid/revert     Revert to previous version

# Curator
POST   /api/books/:id/pages/:pid/curator/start    Start curator thread
POST   /api/books/:id/curator/:tid/message        Send message
GET    /api/books/:id/pages/:pid/curator/threads  List page threads

# Synthesis
POST   /api/books/:id/chapters/:cid/summarize     Summarize chapter
POST   /api/books/:id/summarize                   Summarize book
POST   /api/books/:id/themes                      Discover themes
POST   /api/books/:id/study-questions             Generate questions
POST   /api/books/:id/synthesize                  Synthesize pages

# Export
POST   /api/books/:id/export/pdf       Export as PDF
POST   /api/books/:id/export/epub      Export as EPUB
POST   /api/books/:id/export/markdown  Export as Markdown
POST   /api/books/:id/export/node      Publish to post-social
```

---

## Integration with Existing Systems

### Archive Server (Local)

The archive server gains new endpoints:

```javascript
// New routes for bookmaking
app.post('/api/books', createBook);
app.get('/api/books', listBooks);
app.get('/api/books/:id', getBook);
// ... full CRUD

// Gutenberg integration
app.get('/api/gutenberg/search', searchGutenberg);
app.get('/api/gutenberg/:id', getGutenbergBook);
app.get('/api/gutenberg/:id/content', getGutenbergContent);

// Notes integration (Electron only)
app.get('/api/notes', listNotes);
app.get('/api/notes/:id', getNote);

// Folder scanning
app.post('/api/folders/scan', scanFolder);
app.get('/api/folders/file', readFile);

// URL fetching
app.post('/api/url/fetch', fetchUrl);
```

### NPE-API (Cloud)

For cloud deployment, the same API runs on npe-api:

```typescript
// New routes
app.route('/books', booksRouter);
app.route('/gutenberg', gutenbergRouter);
app.route('/url', urlRouter);

// Storage: D1 for metadata, R2 for content
```

### Post-Social Integration

Books can be published as nodes:

```typescript
// Export a chapter as a node
POST /api/books/:id/export/node
{
  "chapterId": "...",
  "visibility": "public",
  "enableComments": true
}

// This creates a node in post-social with:
// - The chapter content
// - Attribution to sources
// - Link back to the book (if public)
```

---

## Storage Architecture

### Local (Electron/Archive Server)

```
~/.humanizer/
├── books/
│   ├── {book-id}/
│   │   ├── book.json           # Book metadata & structure
│   │   ├── pages/
│   │   │   ├── {page-id}.md    # Page content
│   │   │   └── {page-id}.json  # Page metadata & annotations
│   │   ├── curator/
│   │   │   └── {thread-id}.json
│   │   ├── exports/
│   │   │   └── {timestamp}/
│   │   └── media/
│   │       └── {media-id}.{ext}
│   └── index.json              # Book list index
├── gutenberg-cache/
│   └── {gutenberg-id}/
│       ├── metadata.json
│       └── content.txt
└── url-cache/
    └── {url-hash}.json
```

### Cloud (D1 + R2)

```sql
-- D1 Schema
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata JSON,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT REFERENCES books(id),
  title TEXT,
  order_index INTEGER,
  metadata JSON
);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  chapter_id TEXT REFERENCES chapters(id),
  title TEXT,
  order_index INTEGER
);

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  section_id TEXT REFERENCES sections(id),
  content_key TEXT,  -- R2 key for content
  source JSON,
  order_index INTEGER,
  created_at DATETIME
);

CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES pages(id),
  type TEXT,
  content TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  metadata JSON
);

CREATE TABLE transformations (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES pages(id),
  tool_id TEXT,
  parameters JSON,
  input_key TEXT,   -- R2 key
  output_key TEXT,  -- R2 key
  applied_at DATETIME
);

CREATE TABLE curator_threads (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES pages(id),
  messages JSON,
  created_at DATETIME
);
```

```
-- R2 Bucket: humanizer-books
books/{user_id}/{book_id}/pages/{page_id}/content.md
books/{user_id}/{book_id}/pages/{page_id}/original.md
books/{user_id}/{book_id}/exports/{export_id}.pdf
books/{user_id}/{book_id}/media/{media_id}.{ext}
```

---

## Implementation Phases

### Phase 1: Core Book Structure (Week 1-2)
- [ ] Book, Chapter, Section, Page data models
- [ ] CRUD API endpoints
- [ ] Basic editor UI (structure tree + page editor)
- [ ] Archive importer integration

### Phase 2: Annotations & Curator (Week 3-4)
- [ ] Annotation system (highlight, note, question)
- [ ] Curator integration per page
- [ ] Cross-reference links between pages

### Phase 3: Source Importers (Week 5-6)
- [ ] Gutenberg importer with chapter detection
- [ ] Folder scanner
- [ ] URL fetcher with article extraction
- [ ] Notes importer (Electron only)

### Phase 4: Tool Integration (Week 7-8)
- [ ] Transformation pipeline
- [ ] Version history
- [ ] Batch transformations

### Phase 5: Synthesis & Export (Week 9-10)
- [ ] Chapter/book summarization
- [ ] Theme discovery
- [ ] Study question generation
- [ ] PDF/EPUB/Markdown export
- [ ] Post-social node publishing

---

## Success Metrics

1. **Engagement**: Time spent in book editor per session
2. **Collection**: Pages imported per book (target: 20+)
3. **Annotation**: Annotations per page (target: 3+)
4. **Transformation**: Tools applied per book (target: 5+)
5. **Completion**: Books with 3+ chapters (target: 50% of started books)
6. **Export**: Books exported or published (target: 30%)

---

## Example Use Cases

### 1. Studying Marcus Aurelius

```
Book: "My Meditations Study Guide"
├── Chapter 1: Selected Passages
│   ├── Section: On Virtue
│   │   ├── Page: Book II, 1-5 (from Gutenberg)
│   │   │   └── Annotations: 3 highlights, 2 questions
│   │   └── Page: My reflections (manual)
│   └── Section: On Death
│       ├── Page: Book IV, 3 (from Gutenberg)
│       │   └── Curator thread: "What does Marcus mean by..."
│       └── Page: Curator's explanation (from curator)
├── Chapter 2: Modern Applications
│   ├── Page: Article on Stoicism (from URL)
│   └── Page: My daily practice notes (from Notes)
└── Chapter 3: Synthesis
    └── Page: [Synthesized from all sources]
```

### 2. Personal AI Conversation Journal

```
Book: "Conversations That Changed My Thinking"
├── Chapter 1: On Creativity
│   ├── Page: Discussion about writing blocks (from OpenAI archive)
│   │   └── Transformation: Humanized, persona shift
│   └── Page: Follow-up insights (from Claude archive)
├── Chapter 2: On Career
│   ├── Page: Career advice conversation (from OpenAI)
│   └── Page: My action items (manual)
└── Chapter 3: Key Insights
    └── Page: [Synthesized from all conversations]
```

### 3. Research Notebook

```
Book: "Understanding Quantum Computing"
├── Chapter 1: Fundamentals
│   ├── Page: Wikipedia article excerpt (from URL)
│   ├── Page: Textbook chapter (from folder - PDF)
│   └── Page: My notes (from Apple Notes)
├── Chapter 2: Conversations with AI
│   ├── Page: Explaining qubits (from Claude)
│   │   └── Curator Q&A: 5 follow-up questions
│   └── Page: Shor's algorithm discussion (from OpenAI)
└── Chapter 3: Summary
    └── Page: [Auto-generated study guide]
```

---

## File Format Support

### Import Capabilities

| Format | Extension | Library | Support Level |
|--------|-----------|---------|---------------|
| PDF | `.pdf` | pdf.js | Full - text & images |
| EPUB | `.epub` | epub.js | Full - structure |
| Markdown | `.md` | Native | Full |
| HTML | `.html` | Native | Full |
| DOCX | `.docx` | mammoth.js | Full |
| Plain Text | `.txt` | Native | Full |
| IDML | `.idml` | @imgly/idml-importer | Structure - InDesign interchange |
| ICML | `.icml` | XML parsing | Text - InCopy stories |
| Scribus | `.sla` | XML parsing | Structure - open format |
| XPress Tags | `.xtg` | Text parsing | Text - QuarkXPress interchange |
| MOBI/AZW | `.mobi`, `.azw` | Calibre (Electron) | Convert to EPUB |

### Export Capabilities

| Format | Extension | Library | Notes |
|--------|-----------|---------|-------|
| PDF | `.pdf` | pdfmake / Puppeteer | High quality, print-ready |
| EPUB | `.epub` | epub-gen | Industry standard |
| MOBI | `.mobi` | Calibre (Electron) | Kindle format |
| Markdown | `.md` | Native | Lossless |
| HTML | `.html` | Native | Web-ready |
| DOCX | `.docx` | docx.js | Word editable |

### Unsupported Formats (Proprietary Binary)

| Format | Extension | Alternative |
|--------|-----------|-------------|
| InDesign | `.indd` | Export as IDML from InDesign |
| QuarkXPress | `.qxd`, `.qxp` | Export as XPress Tags from Quark |
| Publisher | `.pub` | Export as PDF or DOCX |

### Import Flow

```
User selects file
       │
       ▼
┌─────────────────────────────────────────────┐
│ Detect format by extension & magic bytes    │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Format supported?                           │
│   Yes → Parse with appropriate library      │
│   No  → Show "Export as X" instructions     │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Extract:                                    │
│   • Text content (chapters, sections)       │
│   • Structure (TOC, headings)               │
│   • Media (images, embedded files)          │
│   • Metadata (title, author, ISBN)          │
│   • Styles (for IDML/SLA)                   │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Present preview for user confirmation       │
│   • Show detected chapters                  │
│   • Allow chapter mapping                   │
│   • Select what to import                   │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Create pages in target book/chapter         │
│   • Preserve source attribution             │
│   • Link to original file                   │
└─────────────────────────────────────────────┘
```

---

## Print Format Specifications

### Standard Book Sizes

| Name | Dimensions (inches) | Dimensions (mm) | Use Case |
|------|---------------------|-----------------|----------|
| **Mass Market Paperback** | 4.25 × 6.87 | 108 × 175 | Fiction, romance, mystery |
| **Trade Paperback (Small)** | 5.5 × 8.5 | 140 × 216 | General fiction, memoirs |
| **Trade Paperback (Large)** | 6 × 9 | 152 × 229 | Non-fiction, business |
| **US Letter** | 8.5 × 11 | 216 × 279 | Workbooks, manuals |
| **Digest** | 5.5 × 8.5 | 140 × 216 | Magazines, journals |
| **A4** | 8.27 × 11.69 | 210 × 297 | International standard |
| **A5** | 5.83 × 8.27 | 148 × 210 | Compact books, journals |
| **Square (Small)** | 7.5 × 7.5 | 190 × 190 | Photo books, art |
| **Square (Large)** | 8.5 × 8.5 | 216 × 216 | Coffee table books |
| **Pocket** | 4.25 × 6.87 | 108 × 175 | Travel guides, field guides |
| **Children's** | 8.5 × 8.5 | 216 × 216 | Picture books |
| **Comic/Manga** | 5.5 × 8.5 | 140 × 216 | Graphic novels |

### Bleed Settings

```typescript
interface PrintSettings {
  // Page size
  format: 'mass_market' | 'trade_small' | 'trade_large' | 'letter' |
          'digest' | 'a4' | 'a5' | 'square_small' | 'square_large' |
          'pocket' | 'children' | 'comic' | 'custom';

  // Custom dimensions (when format = 'custom')
  customWidth?: number;          // in points (1/72 inch)
  customHeight?: number;

  // Bleed (extra area that gets trimmed)
  bleed: {
    enabled: boolean;
    top: number;                 // Default: 0.125" (9pt)
    bottom: number;
    inside: number;              // Spine side
    outside: number;
  };

  // Margins (safe area inside trim)
  margins: {
    top: number;                 // Default: 0.5" (36pt)
    bottom: number;
    inside: number;              // Larger for binding
    outside: number;
  };

  // Binding
  binding: 'perfect' | 'saddle_stitch' | 'spiral' | 'hardcover';
  spineWidth?: number;           // Calculated from page count

  // Color
  colorMode: 'cmyk' | 'rgb' | 'grayscale';

  // Resolution
  dpi: 300 | 600;                // Print standard
}

// Preset configurations
const PRINT_PRESETS: Record<string, PrintSettings> = {
  'amazon_kdp_paperback': {
    format: 'trade_small',
    bleed: { enabled: true, top: 0.125, bottom: 0.125, inside: 0.125, outside: 0.125 },
    margins: { top: 0.5, bottom: 0.5, inside: 0.75, outside: 0.5 },
    binding: 'perfect',
    colorMode: 'cmyk',
    dpi: 300
  },
  'ingram_spark': {
    format: 'trade_large',
    bleed: { enabled: true, top: 0.125, bottom: 0.125, inside: 0, outside: 0.125 },
    margins: { top: 0.5, bottom: 0.5, inside: 0.875, outside: 0.5 },
    binding: 'perfect',
    colorMode: 'cmyk',
    dpi: 300
  },
  'lulu_hardcover': {
    format: 'trade_large',
    bleed: { enabled: true, top: 0.125, bottom: 0.125, inside: 0.125, outside: 0.125 },
    margins: { top: 0.75, bottom: 0.75, inside: 1, outside: 0.75 },
    binding: 'hardcover',
    colorMode: 'cmyk',
    dpi: 300
  },
  'personal_notebook': {
    format: 'a5',
    bleed: { enabled: false, top: 0, bottom: 0, inside: 0, outside: 0 },
    margins: { top: 0.5, bottom: 0.5, inside: 0.5, outside: 0.5 },
    binding: 'spiral',
    colorMode: 'grayscale',
    dpi: 300
  }
};
```

### PDF Export with Bleed

```typescript
interface PDFExportOptions {
  // Print settings
  print: PrintSettings;

  // Crop marks (for professional printing)
  cropMarks: boolean;
  registrationMarks: boolean;
  colorBars: boolean;

  // Spreads vs single pages
  spreads: boolean;              // Show facing pages together

  // Cover
  includeCover: boolean;
  coverSpread: boolean;          // Front + spine + back as one image

  // Fonts
  embedFonts: boolean;           // Always true for print
  subsetFonts: boolean;          // Reduce file size

  // Images
  imageCompression: 'none' | 'jpeg' | 'zip';
  imageQuality: number;          // 1-100 for JPEG

  // PDF standard
  pdfVersion: '1.4' | '1.5' | '1.6' | '1.7' | 'pdf-x-1a' | 'pdf-x-3' | 'pdf-x-4';
}
```

### Visual Representation

```
┌─────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← Bleed area (gets trimmed)
│░┌─────────────────────────────────────────┐░│
│░│                                         │░│ ← Trim line
│░│   ┌───────────────────────────────┐     │░│
│░│   │                               │     │░│ ← Margin (safe area)
│░│   │                               │     │░│
│░│   │       Content Area            │     │░│
│░│   │                               │     │░│
│░│   │                               │     │░│
│░│   └───────────────────────────────┘     │░│
│░│         ↑ Inside margin (binding)       │░│
│░└─────────────────────────────────────────┘░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────────┘
```

---

**End of Design Document**

Next Steps:
1. Review and refine data models
2. Prioritize Phase 1 implementation
3. Create database migrations
4. Build API endpoints
5. Design React/Solid components
