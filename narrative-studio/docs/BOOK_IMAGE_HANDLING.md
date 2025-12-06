# Book Image Handling: Local vs Cloud Architecture

**Created**: December 3, 2025
**Status**: Design Document
**Priority**: Future Feature (post-launch)

---

## Overview

Books in Narrative Studio can contain images from various sources (Facebook archives, OpenAI exports, local files). These images are currently referenced via localhost URLs, which works for local workflows but requires transformation for cloud/shared contexts.

---

## Current Implementation

### Image Flow (Local Studio)

```
Facebook Archive → loadFacebookItem() → Markdown Content → Book Page
                         ↓
              ![Image 1](http://localhost:3002/api/facebook/image?path=base64EncodedPath)
```

### URL Patterns

| Source | URL Pattern | Accessible From |
|--------|-------------|-----------------|
| Facebook | `localhost:3002/api/facebook/image?path=...` | Local only |
| OpenAI Archive | `localhost:3002/api/archive/media/...` | Local only |
| DALL-E generations | `localhost:3002/api/archive/media/...` | Local only |

---

## Two Operational Contexts

### 1. Local Studio (Works Today)

- Archive server runs on `localhost:3002`
- All image URLs resolve correctly
- PDF generation for print works (renderer has localhost access)
- Self-contained workflow, no external dependencies

**Use Cases**:
- Personal book creation
- Print-ready PDF export (with bleed, crop marks)
- Local archival and viewing

### 2. Cloud/Post-Social (Future)

When books need to be:
- Shared with others
- Used with AI curators on post-social nodes
- Viewed on different devices
- Stored in cloud for backup

**localhost URLs will NOT work** - images need cloud-accessible references.

---

## Proposed Solution: Book Export/Sync Process

When publishing a book to cloud (post-social, shared link, etc.):

```
┌─────────────────┐
│ Book (local)    │
│ - Markdown text │
│ - localhost URLs│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Export Process                      │
│ 1. Parse markdown for image refs    │
│ 2. Resolve localhost URLs to files  │
│ 3. Upload images to cloud storage   │
│ 4. Rewrite URLs in markdown         │
│ 5. Package book with new references │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Book (cloud)    │
│ - Markdown text │
│ - Cloud URLs    │
│   (R2, S3, etc) │
└─────────────────┘
```

### Implementation Options

#### Option A: Upload to Cloud Storage (Recommended)

```typescript
// During book sync/publish
async function resolveBookImages(bookContent: string): Promise<string> {
  const imageRegex = /!\[([^\]]*)\]\(http:\/\/localhost:3002\/api\/([^)]+)\)/g;

  for (const match of bookContent.matchAll(imageRegex)) {
    const localUrl = match[0];
    const apiPath = match[2];

    // Fetch image from local server
    const imageBlob = await fetch(`http://localhost:3002/api/${apiPath}`).then(r => r.blob());

    // Upload to R2/S3
    const cloudUrl = await uploadToCloudStorage(imageBlob, generateFilename(apiPath));

    // Replace in content
    bookContent = bookContent.replace(localUrl, `![${match[1]}](${cloudUrl})`);
  }

  return bookContent;
}
```

**Pros**: Images persist, work offline, fast loading
**Cons**: Storage costs, duplicate images

#### Option B: Embed as Base64 Data URIs

```typescript
async function embedBookImages(bookContent: string): Promise<string> {
  // Convert localhost URLs to base64 data URIs
  // ![Image](data:image/jpeg;base64,/9j/4AAQ...)
}
```

**Pros**: Fully self-contained, no external dependencies
**Cons**: Large file sizes, slow parsing

#### Option C: Hybrid (Recommended for Large Books)

- Small images (< 100KB): Embed as base64
- Large images: Upload to cloud storage
- Preserves portability while managing size

---

## Storage Considerations

### Cloudflare R2 (Current Infrastructure)

- Already using R2 for archive cloud sync
- Can create `book-assets` bucket
- URL pattern: `https://assets.humanizer.com/books/{bookId}/{imageHash}.{ext}`

### Deduplication

- Hash images before upload
- Same image in multiple books → single storage
- Reference counting for cleanup

---

## API Endpoints (Future)

```
POST /api/books/{id}/publish
  - Triggers image resolution and cloud sync
  - Returns cloud-ready book

GET /api/books/{id}/export
  - Returns self-contained book package
  - Option for format (markdown, PDF, EPUB)

POST /api/books/{id}/images/resolve
  - Resolves all localhost URLs to cloud URLs
  - Idempotent (safe to call multiple times)
```

---

## Priority & Timeline

**Current Priority**: LOW (post-launch feature)

**Dependencies**:
- Stable local book creation workflow
- Cloud book storage API
- R2 bucket for book assets

**When to Implement**:
- Before "Share Book" feature
- Before post-social book integration
- Before multi-device sync

---

## Related Files

- `src/components/panels/ArchivePanel.tsx` - `loadFacebookItem()` creates markdown images
- `src/contexts/ActiveBookContext.tsx` - `addToBook()` stores content
- `archive-server.js` - `/api/facebook/image` endpoint
- `src/services/booksService.ts` - Book CRUD operations

---

## Notes

- Local workflow is complete and functional
- This document captures architecture for future cloud sync
- No code changes needed until cloud publishing feature is built
