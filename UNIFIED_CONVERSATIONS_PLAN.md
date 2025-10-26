# Unified Conversations Integration Plan

**Created**: October 25, 2025
**Status**: 🟡 Planned - Ready for Implementation
**Priority**: High - Blocks user from accessing Claude conversations

---

## 🎯 Objective

Integrate Claude and ChatGPT conversations into a unified browsing, search, and discovery system.

**Current Problem:**
- Claude conversations (357) imported successfully into separate tables
- Frontend only shows ChatGPT conversations
- Claude conversations are isolated and inaccessible to users
- Search doesn't include Claude messages
- No embeddings generated for Claude content

---

## 📊 Current State

### Database Tables

**ChatGPT**:
- `chatgpt_conversations` (1,659 conversations)
- `chatgpt_messages` (46,355 messages with embeddings)
- `chatgpt_media` (811 media files)
- `chatgpt_provenance`

**Claude**:
- `claude_conversations` (357 conversations) ✅ IMPORTED
- `claude_messages` (4,710 messages) ✅ IMPORTED
- `claude_media` (1,230 media refs)
- `claude_projects` (10 projects)
- `claude_provenance`

### API Endpoints

**Current**:
- `GET /api/chatgpt/conversations` - ChatGPT only
- `GET /api/claude/conversations` - Claude only (separate)

**Needed**:
- `GET /api/conversations` - **UNIFIED** endpoint

---

## 🏗️ Implementation Plan

### Phase 1: Unified Conversation List (2-3 hours)

#### 1.1 Create Unified API Endpoint

**File**: `humanizer/api/conversations.py` (new file)

```python
"""
Unified Conversations API
Combines ChatGPT and Claude conversations into single browsable interface
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from humanizer.database import get_session

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

@router.get("/", response_model=UnifiedConversationListResponse)
async def get_unified_conversations(
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    source: str | None = None,  # 'chatgpt', 'claude', or None for all
    sort_by: str = "created_at",
    sort_desc: bool = True,
    session: AsyncSession = Depends(get_session),
):
    """
    Get unified list of conversations from all sources.

    Strategy:
    1. Query both chatgpt_conversations and claude_conversations
    2. Add 'source' field to each record
    3. Merge results
    4. Sort by specified field
    5. Paginate
    """
    pass
```

**Key Schema**:
```python
class UnifiedConversationResponse(BaseModel):
    uuid: UUID
    title: str | None  # ChatGPT has title, Claude has name
    created_at: datetime
    updated_at: datetime
    source: str  # 'chatgpt' or 'claude'
    message_count: int
    media_count: int

    # Source-specific metadata
    chatgpt_metadata: dict | None = None
    claude_metadata: dict | None = None
```

#### 1.2 Implement Unified Query Service

**File**: `humanizer/services/unified_conversations.py` (new file)

```python
async def get_unified_conversations(
    session: AsyncSession,
    page: int,
    page_size: int,
    search: str | None,
    source: str | None,
    sort_by: str,
    sort_desc: bool,
):
    """
    Query and merge conversations from multiple sources.

    Implementation:
    1. Build queries for each source
    2. Execute in parallel using asyncio.gather()
    3. Merge results with source tags
    4. Sort and paginate
    """

    # Query ChatGPT conversations
    chatgpt_query = select(ChatGPTConversation)...

    # Query Claude conversations
    claude_query = select(ClaudeConversation)...

    # Execute in parallel
    chatgpt_results, claude_results = await asyncio.gather(
        session.execute(chatgpt_query),
        session.execute(claude_query)
    )

    # Merge and normalize
    unified = []
    for conv in chatgpt_results:
        unified.append({
            'uuid': conv.uuid,
            'title': conv.title,
            'source': 'chatgpt',
            ...
        })

    for conv in claude_results:
        unified.append({
            'uuid': conv.uuid,
            'title': conv.name,  # Claude uses 'name'
            'source': 'claude',
            ...
        })

    # Sort and paginate
    unified.sort(key=lambda x: x[sort_by], reverse=sort_desc)
    start = (page - 1) * page_size
    end = start + page_size

    return unified[start:end], len(unified)
```

#### 1.3 Update Main App to Register Unified Router

**File**: `humanizer/main.py`

```python
from humanizer.api.conversations import router as conversations_router

app.include_router(conversations_router)
```

---

### Phase 2: Unified Conversation Viewer (1-2 hours)

#### 2.1 Create Unified Conversation Detail Endpoint

**File**: `humanizer/api/conversations.py`

```python
@router.get("/{conversation_id}", response_model=UnifiedConversationDetailResponse)
async def get_conversation_detail(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get conversation details from any source.

    Strategy:
    1. Try to find in chatgpt_conversations
    2. If not found, try claude_conversations
    3. Return with source tag
    """
    # Try ChatGPT first
    chatgpt_conv = await session.execute(
        select(ChatGPTConversation).where(...)
    )

    if chatgpt_conv:
        return normalize_chatgpt_conversation(chatgpt_conv)

    # Try Claude
    claude_conv = await session.execute(
        select(ClaudeConversation).where(...)
    )

    if claude_conv:
        return normalize_claude_conversation(claude_conv)

    raise HTTPException(404, "Conversation not found")
```

#### 2.2 Update Frontend to Use Unified Endpoint

**File**: `frontend/src/lib/api-client.ts`

```typescript
// Add new method
async getUnifiedConversations(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: 'chatgpt' | 'claude' | null;
  sortBy?: string;
  sortDesc?: boolean;
}): Promise<UnifiedConversationListResponse> {
  const response = await fetch(`${this.baseUrl}/conversations?${new URLSearchParams(params)}`);
  return response.json();
}
```

**File**: `frontend/src/components/conversations/ConversationList.tsx`

```typescript
// Update to use unified endpoint
const { conversations, total } = await apiClient.getUnifiedConversations({
  page,
  pageSize,
  search,
});

// Display with source badges
{conversations.map(conv => (
  <div className="conversation-item" key={conv.uuid}>
    <span className={`source-badge ${conv.source}`}>
      {conv.source === 'chatgpt' ? '💬' : '🤖'} {conv.source}
    </span>
    <h3>{conv.title}</h3>
    <span>{conv.message_count} messages</span>
  </div>
))}
```

---

### Phase 3: Embedding Generation (2-3 hours)

#### 3.1 Generate Embeddings for Claude Messages

**File**: `humanizer/services/claude.py`

```python
async def generate_claude_embeddings(
    session: AsyncSession,
    batch_size: int = 100,
):
    """
    Generate embeddings for all Claude messages without embeddings.

    Uses same embedding service as ChatGPT for consistency.
    """
    from humanizer.services.sentence_embedding import SentenceEmbeddingService

    embedding_service = SentenceEmbeddingService()

    # Get messages without embeddings
    stmt = select(ClaudeMessage).where(
        ClaudeMessage.embedding.is_(None)
    ).limit(batch_size)

    result = await session.execute(stmt)
    messages = result.scalars().all()

    for msg in messages:
        if msg.text:
            embedding = embedding_service.embed(msg.text)
            msg.embedding = embedding

    await session.commit()

    return len(messages)
```

#### 3.2 Create Background Task Endpoint

**File**: `humanizer/api/claude.py`

```python
@router.post("/generate-embeddings")
async def trigger_claude_embeddings(
    batch_size: int = 1000,
    session: AsyncSession = Depends(get_session),
):
    """
    Trigger embedding generation for Claude messages.

    Can be called multiple times - only processes messages without embeddings.
    """
    processed = await generate_claude_embeddings(session, batch_size)

    # Get remaining count
    remaining = await session.execute(
        select(func.count()).select_from(ClaudeMessage).where(
            ClaudeMessage.embedding.is_(None)
        )
    )

    return {
        "processed": processed,
        "remaining": remaining.scalar()
    }
```

#### 3.3 Run Embedding Generation

```bash
# One-time script or multiple API calls
curl -X POST http://localhost:8000/api/claude/generate-embeddings?batch_size=500

# Repeat until remaining = 0
```

---

### Phase 4: Unified Search (2-3 hours)

#### 4.1 Create Unified Search Endpoint

**File**: `humanizer/api/conversations.py`

```python
@router.post("/search", response_model=UnifiedSearchResponse)
async def search_conversations(
    request: UnifiedSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Search across all conversation messages.

    Supports:
    - Full-text search
    - Semantic search (if embeddings available)
    - Filters by source, date range, etc.
    """

    # Search ChatGPT messages
    chatgpt_results = await session.execute(
        select(ChatGPTMessage).where(
            ChatGPTMessage.text.contains(request.query)
        ).limit(request.limit)
    )

    # Search Claude messages
    claude_results = await session.execute(
        select(ClaudeMessage).where(
            ClaudeMessage.text.contains(request.query)
        ).limit(request.limit)
    )

    # Merge, sort by relevance, return
    ...
```

---

## 📝 Database Schema Compatibility

### Mapping Between Tables

| Field | ChatGPT | Claude | Unified |
|-------|---------|--------|---------|
| ID | uuid | uuid | uuid |
| Name | title | name | title |
| Created | created_at | created_at | created_at |
| Updated | updated_at | updated_at | updated_at |
| Archive | source_archive | source_archive | source_archive |
| Metadata | custom_metadata | custom_metadata | {source}_metadata |

### Message Schema Compatibility

Both tables have:
- `uuid`: UUID
- `conversation_uuid`: UUID (FK)
- `sender`: str ('human'/'assistant')
- `text`: str (extracted content)
- `created_at`: datetime
- `embedding`: vector(384) or vector(1024)

**Difference**:
- ChatGPT: `content` (JSONB with parts structure)
- Claude: `content_blocks` (JSONB with blocks structure)

---

## 🧪 Testing Plan

### 4.1 Unit Tests

```python
# tests/test_unified_conversations.py

async def test_unified_conversation_list():
    """Test querying conversations from both sources"""
    response = await client.get("/api/conversations")
    assert response.status_code == 200

    data = response.json()
    assert 'conversations' in data
    assert 'total' in data

    # Should have both sources
    sources = {c['source'] for c in data['conversations']}
    assert 'chatgpt' in sources
    assert 'claude' in sources

async def test_search_across_sources():
    """Test searching messages from all sources"""
    response = await client.post("/api/conversations/search", json={
        "query": "emptiness",
        "limit": 20
    })

    assert response.status_code == 200
    results = response.json()

    # Should find matches in both
    sources = {r['source'] for r in results['messages']}
    # At least one source should have matches
    assert len(sources) > 0
```

### 4.2 Integration Tests

1. **Browse unified list**: Verify both sources appear
2. **Search**: Verify results from both sources
3. **View conversation**: Verify both types can be viewed
4. **Pagination**: Verify works across merged results
5. **Filtering**: Verify source filter works

---

## 🚀 Deployment Steps

### One-Time Setup

1. **Generate Claude embeddings** (will take ~2-5 minutes for 4,710 messages):
   ```bash
   curl -X POST http://localhost:8000/api/claude/generate-embeddings?batch_size=500
   # Repeat 10 times until all messages have embeddings
   ```

2. **Verify embedding coverage**:
   ```sql
   -- Check ChatGPT
   SELECT COUNT(*) as total,
          COUNT(embedding) as with_embeddings
   FROM chatgpt_messages;

   -- Check Claude
   SELECT COUNT(*) as total,
          COUNT(embedding) as with_embeddings
   FROM claude_messages;
   ```

3. **Update frontend** to use new endpoint

4. **Test search** across both sources

---

## 📈 Performance Considerations

### Query Optimization

**Current Approach** (simple merge):
- Query both tables separately
- Merge in Python
- Sort and paginate

**Optimization Opportunities**:
1. **Database VIEW**: Create a unified view at DB level
   ```sql
   CREATE VIEW unified_conversations AS
   SELECT uuid, title, created_at, updated_at, 'chatgpt' as source
   FROM chatgpt_conversations
   UNION ALL
   SELECT uuid, name as title, created_at, updated_at, 'claude' as source
   FROM claude_conversations;
   ```

2. **Materialized View**: For better performance
   ```sql
   CREATE MATERIALIZED VIEW unified_conversations_mv AS ...
   CREATE INDEX ON unified_conversations_mv(created_at DESC);
   ```

3. **Caching**: Cache conversation counts and recent conversations

### Expected Performance

- **Conversation list**: <100ms (2 queries + merge)
- **Search**: <200ms (2 full-text searches + merge)
- **Embedding generation**: ~5 minutes total (4,710 messages × 0.06s/msg)

---

## 🔄 Migration Strategy

### Phase 1: Add Unified Endpoints (Keep Old)
- Add `/api/conversations` (unified)
- Keep `/api/chatgpt/conversations`
- Keep `/api/claude/conversations`
- Frontend uses new unified endpoint

### Phase 2: Deprecate Separate Endpoints
- Mark old endpoints as deprecated
- Add warnings to API docs
- Monitor usage

### Phase 3: Remove (Future)
- After confirmed unused, remove old endpoints

---

## 📚 Files to Create/Modify

### New Files (4):
1. `humanizer/api/conversations.py` (~300 lines)
2. `humanizer/services/unified_conversations.py` (~200 lines)
3. `tests/test_unified_conversations.py` (~150 lines)
4. `UNIFIED_CONVERSATIONS_PLAN.md` (this file)

### Modified Files (6):
1. `humanizer/main.py` (add router)
2. `humanizer/api/claude.py` (add embeddings endpoint)
3. `humanizer/services/claude.py` (add embedding generation)
4. `frontend/src/lib/api-client.ts` (add unified methods)
5. `frontend/src/components/conversations/ConversationList.tsx` (use unified endpoint)
6. `frontend/src/types/conversations.ts` (add unified types)

---

## ⏱️ Time Estimate

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1 | Unified conversation list API | 2-3h | High |
| 2 | Unified conversation viewer | 1-2h | High |
| 3 | Generate Claude embeddings | 2-3h | High |
| 4 | Unified search | 2-3h | Medium |
| 5 | Testing & refinement | 1-2h | High |

**Total: 8-13 hours** (1-2 days of focused work)

---

## ✅ Success Criteria

- [ ] Unified `/api/conversations` endpoint returns both sources
- [ ] Frontend shows all 2,016 conversations (1,659 ChatGPT + 357 Claude)
- [ ] All 4,710 Claude messages have embeddings
- [ ] Search finds results from both sources
- [ ] Conversation viewer works for both types
- [ ] Source badges visible in UI
- [ ] Performance <200ms for list queries
- [ ] All tests passing

---

## 🎯 Next Steps

**Immediate** (start here):
1. Create `humanizer/api/conversations.py`
2. Implement unified list endpoint
3. Test with curl
4. Update frontend to use it

**Then**:
5. Generate Claude embeddings
6. Implement unified search
7. Update UI with source badges
8. Full integration testing

---

**Ready to implement!** 🚀
