# AUI Data Retrieval Guide: API vs Direct Database Access

**Last Updated:** October 11, 2025
**Context:** Combined Image Gallery Generation

---

## Executive Summary

The Humanizer AUI (Adaptive User Interface) supports **two data retrieval approaches**:

1. **Direct Database Access** - PostgreSQL queries via SQLAlchemy
2. **HTTP API Endpoints** - RESTful API with FastAPI

**This document explains when to use each approach and why.**

---

## Comparison Table

| Aspect | Direct Database Access | HTTP API Endpoints |
|--------|------------------------|-------------------|
| **Speed** | Fastest (no network/serialization overhead) | Moderate (HTTP + JSON overhead) |
| **Security** | Requires DB credentials | Token-based auth, rate limiting |
| **Complexity** | Write SQL, manage connections | Simple HTTP requests |
| **Separation of Concerns** | ❌ Tightly coupled | ✅ Clean architecture |
| **Caching** | Manual | Built-in (FastAPI cache) |
| **Validation** | Manual | Automatic (Pydantic schemas) |
| **Best For** | One-off scripts, bulk extraction | Production integrations, MCP server |
| **Access Control** | Database-level permissions | Endpoint-level permissions |

---

## Approach 1: Direct Database Access

### When to Use
- **One-time data extraction** (e.g., generating reports, galleries)
- **Bulk operations** (importing/exporting large datasets)
- **Performance-critical tasks** (no HTTP overhead)
- **Running on the same machine** as the database
- **Development/debugging** (direct access to raw data)

### Example: Combined Image Gallery Script

```python
from sqlalchemy import text
from humanizer.database.connection import get_session

async def extract_journal_images():
    """Extract images using direct psql query."""
    async for session in get_session():
        # Direct JSONB querying with PostgreSQL operators
        query = text("""
            SELECT DISTINCT
                c.uuid as conversation_uuid,
                c.title as conversation_title,
                m.content_text,
                media.file_path,
                media.mime_type
            FROM chatgpt_conversations c
            JOIN chatgpt_messages m ON m.conversation_uuid = c.uuid
            LEFT JOIN chatgpt_media media ON media.conversation_uuid = c.uuid
            WHERE
                c.custom_metadata->>'gizmo_id' = :gizmo_id  -- JSONB operator!
                AND media.file_path IS NOT NULL
                AND media.mime_type LIKE 'image/%'
            ORDER BY m.created_at
        """)

        result = await session.execute(query, {'gizmo_id': 'g-T7bW2qVzx'})
        return result.fetchall()
```

### Advantages
1. **JSONB Power:** Direct access to PostgreSQL JSONB operators:
   - `->` : Get JSON field as JSON
   - `->>` : Get JSON field as text
   - `@>` : Contains operator
   - `?` : Key exists operator

2. **Complex Joins:** Easy to write multi-table joins
3. **Performance:** No serialization overhead
4. **Flexibility:** Can use advanced SQL features (CTEs, window functions)

### Disadvantages
1. **No business logic:** Bypasses service layer validation
2. **Security risk:** Direct DB access if credentials leak
3. **No caching:** Must implement manually
4. **Tight coupling:** Changes to DB schema break queries

---

## Approach 2: HTTP API Endpoints

### When to Use
- **Production integrations** (MCP server, external tools)
- **Remote access** (not running on same machine as DB)
- **Need authentication/authorization**
- **Want caching and rate limiting**
- **Following clean architecture** principles
- **External developers** accessing the system

### Available Endpoints

```bash
# Search messages
POST /chatgpt/search
{
  "query": "quantum consciousness",
  "limit": 20,
  "author_role": "assistant"
}

# Get conversation details
GET /chatgpt/conversation/{uuid}

# Render conversation as markdown
POST /chatgpt/conversation/{uuid}/render
{
  "include_media": true,
  "pagination": false
}

# Export conversation
POST /chatgpt/conversation/{uuid}/export
{
  "format": "rendered_html",
  "include_media": true
}

# Get archive statistics
GET /chatgpt/stats
```

### Example: Using API from MCP Server

```python
import httpx

async def search_chatgpt_via_api(query: str, limit: int = 20):
    """Search ChatGPT archive using HTTP API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/chatgpt/search",
            json={
                "query": query,
                "limit": limit,
                "author_role": "assistant"
            },
            headers={"Authorization": f"Bearer {api_token}"}
        )

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"API error: {response.text}")
```

### Advantages
1. **Clean separation:** Business logic stays in services layer
2. **Authentication:** Token-based auth, user permissions
3. **Rate limiting:** Prevent abuse
4. **Caching:** FastAPI cache for common queries
5. **Validation:** Pydantic schemas ensure data integrity
6. **Versioning:** Can maintain API versions (v1, v2)
7. **Documentation:** Auto-generated OpenAPI docs

### Disadvantages
1. **HTTP overhead:** Network latency + JSON serialization
2. **Less flexible:** Limited to predefined endpoints
3. **Can't use advanced SQL:** No direct JSONB operators

---

## Implementation Architecture

### Database Layer
```
humanizer/models/chatgpt.py
├── ChatGPTConversation
│   ├── uuid (PK)
│   ├── title
│   ├── custom_metadata (JSONB) ← Contains gizmo_id!
│   └── relationships (messages, media)
├── ChatGPTMessage
│   ├── uuid (PK)
│   ├── conversation_uuid (FK)
│   ├── content_text
│   └── custom_metadata (JSONB)
└── ChatGPTMedia
    ├── file_id (PK)
    ├── file_path ← Absolute path to image file
    └── mime_type
```

### Service Layer
```
humanizer/services/chatgpt.py
├── ingest_archives() ← Import conversations.json
├── search_messages() ← Semantic search
├── get_conversation() ← Get by UUID
└── get_archive_stats() ← Statistics
```

### API Layer
```
humanizer/api/chatgpt.py
├── POST /chatgpt/ingest
├── GET /chatgpt/stats
├── GET /chatgpt/conversation/{uuid}
├── POST /chatgpt/search
├── POST /chatgpt/conversation/{uuid}/render
└── POST /chatgpt/conversation/{uuid}/export
```

---

## Custom GPT Identification

ChatGPT's `conversations.json` includes a `gizmo_id` field for custom GPTs:

```json
{
  "id": "6805bc7c-a06e-42d0-83c5-123456789abc",
  "title": "Notebook OCR Test",
  "gizmo_id": "g-T7bW2qVzx",  ← Custom GPT identifier!
  "mapping": { ... }
}
```

### Known Custom GPTs in Archive

| GPT Name | Gizmo ID | Purpose | Images |
|----------|----------|---------|--------|
| Journal Recognizer OCR | `g-T7bW2qVzx` | Transcribe handwritten notebooks | 14 |
| Image Name echo and bounce | `g-FmQp1Tm1G` | Generate image titles & descriptions | 66 |

### Querying by Custom GPT

**Direct SQL:**
```sql
SELECT * FROM chatgpt_conversations
WHERE custom_metadata->>'gizmo_id' = 'g-T7bW2qVzx';
```

**API (future endpoint):**
```bash
GET /chatgpt/conversations?gizmo_id=g-T7bW2qVzx
```

---

## Media File Resolution

Images are stored with evolving filename patterns:

### Archive Formats (2022-2025)
```
chat5/
├── files/                     # Optional subdirectory
│   └── file-abc123.png
├── file-def456-original.jpg   # Top-level user uploads
├── dalle-generations/         # Old DALL-E
│   └── file-ghi789-uuid.webp
└── user-xyz/                  # Sediment format (2025+)
    └── file_hash-uuid.png
```

### Resolution Process
1. Extract `file_id` from message content
2. Normalize ID: `file-abc` ↔ `file_abc`
3. Search locations:
   - `archive_path/files/`
   - `archive_path/` (top-level)
   - `archive_path/dalle-generations/`
   - `archive_path/user-*/`
4. Match using `startswith()` for flexibility
5. Store absolute path in `chatgpt_media.file_path`

---

## Combined Gallery Implementation

**File:** `create_combined_image_gallery.py`

### Data Flow

```
1. Direct DB Queries
   ↓
2. Extract images + metadata
   ├─ Journal Recognizer: 14 images
   │  └─ Parse transcriptions from code blocks
   └─ Image Echo Bounce: 66 images
      └─ Parse markdown tables (Title | Short | Long)
   ↓
3. Generate markdown
   └─ Embed images with <img> tags (400px width)
   ↓
4. Save to combined_image_gallery.md
```

### SQL Query Strategy

**Join Pattern:**
```sql
chatgpt_conversations c
  ↓ (1:N)
chatgpt_messages m
  ↓ (1:N, LEFT)
chatgpt_media media

WHERE c.custom_metadata->>'gizmo_id' = :gizmo_id
  AND media.file_path IS NOT NULL
  AND media.mime_type LIKE 'image/%'
```

**Why LEFT JOIN?**
- Some messages don't have media
- Want all messages to find transcriptions/descriptions
- Filter `media.file_path IS NOT NULL` at the end

---

## Best Practices

### ✅ Use Direct DB Access When:
- Running one-time scripts
- Need maximum performance (bulk extraction)
- Require complex SQL (CTEs, JSONB operators)
- Debugging data issues

### ✅ Use HTTP API When:
- Building production features
- Integrating external tools (MCP server)
- Need authentication/authorization
- Want clean architecture
- Remote access (not on DB machine)

### ❌ Don't:
- Use direct DB in production services (breaks separation)
- Use API for bulk data migration (too slow)
- Mix approaches without clear rationale
- Expose DB credentials to external tools

---

## Future Enhancements

### Database Layer
- [ ] Add `gizmo_id` index for faster custom GPT queries
- [ ] Create materialized view for image-with-metadata
- [ ] Add full-text search indexes on content_text

### API Layer
- [ ] Add `GET /chatgpt/conversations?gizmo_id=...` endpoint
- [ ] Implement streaming for large exports
- [ ] Add GraphQL endpoint for flexible queries
- [ ] Rate limiting per user

### Performance
- [ ] Implement Redis caching for common queries
- [ ] Add CDN for media files (S3 + CloudFront)
- [ ] Optimize JSONB queries with GIN indexes

---

## Summary: Combined Gallery Stats

**Generated:** October 11, 2025

| Metric | Value |
|--------|-------|
| **Total Images** | 80 |
| Journal Recognizer | 14 images with transcriptions |
| Image Echo Bounce | 66 images with titles/descriptions |
| **Database Queries** | 2 (one per custom GPT) |
| **Processing Time** | ~2 seconds |
| **Output File** | `combined_image_gallery.md` |
| **Data Retrieval** | Direct PostgreSQL via SQLAlchemy |

**Why Direct DB?**
- One-time gallery generation
- Need JSONB filtering by `gizmo_id`
- Performance matters (80 images)
- Running locally with DB access

**Alternative (API Approach):**
```bash
# Would require multiple requests
for uuid in $(get_all_journal_convs); do
  curl http://localhost:8000/chatgpt/conversation/$uuid
done
# ❌ Too slow (1659 conversations × network latency)
```

---

## References

- **Database Schema:** `humanizer/models/chatgpt.py`
- **Service Layer:** `humanizer/services/chatgpt.py`
- **API Endpoints:** `humanizer/api/chatgpt.py`
- **Gallery Script:** `create_combined_image_gallery.py`
- **Output:** `combined_image_gallery.md`

---

**Remember:** Choose the right tool for the job. Direct DB for bulk/scripts, API for production/integrations.
