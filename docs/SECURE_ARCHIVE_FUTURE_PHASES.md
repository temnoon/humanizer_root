# Secure Archive - Future Phases (2-4)

**Last Updated**: November 12, 2025
**Status**: Planning - Phase 1 infrastructure complete

---

## Phase 2: Conversation Import (2-3 weeks)

### ChatGPT Export Parser (JavaScript Port)

**Goal**: Parse ChatGPT `.zip` exports in the browser, no Python required

**Implementation**:

1. **ZIP File Handling** (1-2 days)
   - Use `jszip` library
   - Extract `conversations.json` + attachments
   - Handle large files (streaming)

```typescript
import JSZip from 'jszip';

async function parseExport(zipFile: File): Promise<{
  conversations: Conversation[];
  attachments: Record<string, ArrayBuffer>;
}> {
  const zip = await JSZip.loadAsync(zipFile);
  const conversationsJson = await zip.file('conversations.json')?.async('string');
  if (!conversationsJson) throw new Error('Invalid export');

  const conversations = JSON.parse(conversationsJson);
  const attachments: Record<string, ArrayBuffer> = {};

  // Extract attachments
  for (const [path, file] of Object.entries(zip.files)) {
    if (path !== 'conversations.json' && !file.dir) {
      attachments[path] = await file.async('arraybuffer');
    }
  }

  return { conversations, attachments };
}
```

2. **Conversation Selection UI** (2-3 days)
   - List view with search/filter
   - Preview conversation
   - Multi-select for batch upload
   - Organize into folders

```typescript
interface Conversation {
  id: string;
  title: string;
  created_at: number;
  messages: Message[];
  attachments?: string[];
}

// UI Component
<ConversationSelector
  conversations={conversations}
  onSelect={(selected) => {
    // Encrypt and upload selected conversations
    for (const conv of selected) {
      await uploadConversation(conv, folder);
    }
  }}
/>
```

3. **Attachment Handling** (1-2 days)
   - Encrypt images/files separately
   - Store references in conversation JSON
   - Display inline when loading conversation

### Claude Export Support (1 week)

**Research needed**:
- Claude export format (likely similar to ChatGPT)
- API for programmatic export (if available)
- Differences in conversation structure

**Implementation**:
- Add Claude parser alongside ChatGPT parser
- Unified `Conversation` interface
- Auto-detect export type from file structure

---

## Phase 3: Content Discovery (1-2 weeks)

### Project Gutenberg Browser (3-4 days)

**Goal**: Search/browse 70,000+ public domain books

**API**: https://gutendex.com/

**Implementation**:

```typescript
// Search books
async function searchBooks(query: string): Promise<Book[]> {
  const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`);
  const data = await response.json();
  return data.results;
}

// Download book text
async function downloadBook(book: Book): Promise<string> {
  const textUrl = book.formats['text/plain; charset=utf-8'];
  const response = await fetch(textUrl);
  const text = await response.text();

  // Encrypt and upload to archive
  await uploadToArchive(text, `${book.title}.txt`, 'Project Gutenberg');
}
```

**UI**:
- Search bar
- Book list with metadata (author, title, language)
- "Add to Archive" button
- Auto-organize into "Project Gutenberg" folder

### Simple Web Scraper (2-3 days)

**Goal**: Extract text from web pages

**Implementation** (Worker proxy + Readability.js):

```typescript
// Backend (Worker)
app.post('/scrape', requireAuth(), async (c) => {
  const { url } = await c.req.json();

  // Fetch from Worker (bypasses CORS)
  const response = await fetch(url);
  const html = await response.text();

  // Extract article text
  const { Readability } = await import('@mozilla/readability');
  const { JSDOM } = await import('jsdom');

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  return c.json({
    title: article?.title || 'Untitled',
    text: article?.textContent || '',
    excerpt: article?.excerpt || ''
  });
});

// Frontend
async function scrapeUrl(url: string) {
  const { title, text } = await fetch('/scrape', {
    method: 'POST',
    body: JSON.stringify({ url })
  });

  // Encrypt and upload
  await uploadToArchive(text, `${title}.txt`, 'Web Scrapes');
}
```

**Limitations**:
- Won't work on paywall sites
- Sites with Cloudflare challenge may block
- Respect `robots.txt` and terms of service

---

## Phase 4: Browser Plugin Integration (2-4 weeks)

### Goal
One-click export from any AI chat interface

### Features

1. **Right-Click Context Menu**
   - "Export to Humanizer"
   - Captures conversation HTML
   - Encrypts locally
   - Uploads to Archive

2. **Auto-Sync**
   - Optionally sync all conversations
   - Incremental updates (only new messages)
   - Background sync

3. **Inline Export Button**
   - Inject button into ChatGPT/Claude UI
   - "Send to Humanizer" next to share button

### Technical Challenges

1. **Different DOM Structures**
   - ChatGPT: React components
   - Claude: Different structure
   - Need selectors for each platform

2. **Authentication**
   - Plugin needs Humanizer auth token
   - Secure storage in extension storage
   - OAuth flow for initial auth

3. **Encryption in Extension**
   - Same Web Crypto API
   - Key derivation from user's archive password
   - Securely store salt

### Development Plan

1. **Week 1-2**: Chrome extension scaffold
2. **Week 3**: ChatGPT integration
3. **Week 4**: Claude integration
4. **Testing**: Manual QA on both platforms

---

## Phase 5: Advanced Features (Future)

### Client-Side Search (Optional)

**Challenge**: Searching encrypted content without server access

**Approach**:
- Build inverted index client-side
- Encrypt index with same key
- Store encrypted index in R2
- Download + decrypt index on search

**Implementation** (using lunr.js):

```typescript
import lunr from 'lunr';

// Build index from all decrypted files
async function buildSearchIndex(): Promise<lunr.Index> {
  const files = await fetchAllFiles();
  const documents = [];

  for (const file of files) {
    const decrypted = await decryptFile(file);
    const text = uint8ArrayToText(decrypted);
    documents.push({ id: file.id, title: file.filename, content: text });
  }

  return lunr(function() {
    this.ref('id');
    this.field('title');
    this.field('content');

    documents.forEach(doc => this.add(doc));
  });
}

// Search
const results = index.search(query);
```

**Downside**: Slow for large archives (100+ files)

### Large File Streaming (Optional)

**For files >100MB**:
- Chunked encryption/upload
- R2 multipart upload
- Streaming decryption

**Not needed for Phase 1-3** (most conversation files <10MB)

---

## Priority Order

1. **Phase 2**: ChatGPT parser (highest value, users have archives)
2. **Phase 3**: Gutenberg browser (easy, great demo)
3. **Phase 3**: Web scraper (medium value, legal complexity)
4. **Phase 4**: Browser plugin (high value, significant effort)
5. **Phase 5**: Advanced features (nice-to-have, not essential)

---

## Development Estimates

| Phase | Features | Time | Complexity |
|-------|----------|------|------------|
| Phase 1 | Core upload/download | 1 week | ⭐⭐ Medium |
| Phase 2 | ChatGPT parser + Claude | 2-3 weeks | ⭐⭐⭐ Medium-High |
| Phase 3 | Gutenberg + Scraper | 1-2 weeks | ⭐⭐ Medium |
| Phase 4 | Browser plugin | 2-4 weeks | ⭐⭐⭐⭐ High |
| Phase 5 | Search, streaming | 2-3 weeks | ⭐⭐⭐⭐ High |

**Total**: 8-13 weeks for complete feature set

**Recommendation**: Ship Phase 1 → 2 → 3 incrementally
