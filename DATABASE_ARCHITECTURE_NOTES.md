# Database Architecture: ChromaDB vs PostgreSQL

**Date**: October 12, 2025
**Context**: Discovery Engine Implementation

---

## 🎯 Two Database Systems, Two Purposes

### **ChromaDB** (via MCP)
**Purpose**: Agent memory and ephemeral tool usage
**Location**: Local ChromaDB instance
**Access**: Through MCP server (`humanizer_mcp`)
**Lifecycle**: Session-based, can be cleared/reset

**Use Cases**:
- Agent conversation memory
- Tool usage tracking during sessions
- Temporary semantic search results
- MCP tool state
- Adaptive learning patterns (session-specific)

**Characteristics**:
- Fast vector search
- No schema migrations
- Embedded in MCP server
- User-specific collections
- Can be ephemeral

**MCP Tools Using ChromaDB**:
```python
mcp__chromadb-memory__store_memory
mcp__chromadb-memory__recall_memory
mcp__chromadb-memory__retrieve_memory
mcp__chromadb-memory__search_by_tag
mcp__chromadb-memory__delete_memory
# ... etc (21 MCP tools total)
```

---

### **PostgreSQL** (Production Database)
**Purpose**: Persistent application data and user content
**Location**: PostgreSQL 16 with pgvector extension
**Access**: Through FastAPI backend (SQLAlchemy)
**Lifecycle**: Permanent, with migrations and backups

**Use Cases**:
- User accounts and authentication
- ChatGPT conversation archives (1,685 conversations, 193K messages)
- Interest tracking (stars, lists, attention flow)
- Transformations and their history
- Media files metadata
- Agent conversation persistence
- Reading sessions and TRM data
- POVM packs and quantum measurements

**Characteristics**:
- ACID compliance
- Schema with migrations
- Relational integrity (foreign keys)
- Full-text search (pg_trgm)
- Vector search (pgvector for embeddings)
- Persistent across sessions

**Key Tables** (32 total):
```sql
-- User & Authentication
users, avatars (future)

-- ChatGPT Archive
collections (conversations), messages, media, chunks

-- Interest Tracking (NEW - Oct 12, 2025)
interests, interest_tags, interest_lists,
interest_list_items, interest_list_branches

-- Transformations
transformations, transformation_jobs, transformation_lineage

-- Agent Conversations
agent_conversations

-- TRM & Reading
reading_sessions, reading_steps, reading_snapshots, reading_provenance

-- Library & Books
books, book_sections, book_content_links, chunk_relationships

-- System
povm_packs, system_metrics, sessions, artifacts, etc.
```

---

## 🔀 When to Use Which

### Use **ChromaDB** for:
- ✅ Agent working memory (current conversation context)
- ✅ MCP tool state (temporary data)
- ✅ Session-specific caching
- ✅ Quick vector similarity during agent operations
- ✅ Throwaway/experimental data

### Use **PostgreSQL** for:
- ✅ User-facing features (interests, lists, starred items)
- ✅ Historical data (conversation archives)
- ✅ Cross-session persistence (transformations, agent conversations)
- ✅ Relational data with integrity constraints
- ✅ Features requiring complex queries or aggregations

---

## 🏗️ Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  User actions: Search, Star, Create Lists, Transform     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (Python)                    │
│  - API routes: /interests, /interest_lists, /transform  │
│  - SQLAlchemy ORM models                                 │
│  - Business logic services                               │
└──────┬──────────────────────────────────────────┬───────┘
       │                                           │
       ▼                                           ▼
┌──────────────────┐                    ┌─────────────────┐
│   PostgreSQL     │                    │    ChromaDB     │
│  (Production DB) │                    │  (MCP Memory)   │
├──────────────────┤                    ├─────────────────┤
│ • interests      │                    │ • tool_usage    │
│ • interest_lists │                    │ • memories      │
│ • messages       │                    │ • tags          │
│ • agent_convos   │                    │ • embeddings    │
│ • transform...   │                    └─────────────────┘
└──────────────────┘
     PERSISTENT                              EPHEMERAL
```

---

## 📊 Discovery Engine: Which DB?

**Interest Tracking System** uses **PostgreSQL**:

| Feature | Database | Reason |
|---------|----------|--------|
| Star a message | PostgreSQL | Must persist across sessions |
| Interest lists | PostgreSQL | User-created collections need permanence |
| Interest trajectory | PostgreSQL | Historical attention flow |
| List items | PostgreSQL | Relational (list → items) |
| Tags on interests | PostgreSQL | Relational (interest → tags) |

**Why not ChromaDB?**
- Interests/lists are user-facing features, not agent memory
- Need relational integrity (lists must reference valid items)
- Require complex queries (get all lists, filter by tag, etc.)
- Must survive browser refresh and session changes
- Need proper indexing for performance at scale

---

## 🎓 Key Learning

**ChromaDB is not a replacement for PostgreSQL.**

- **ChromaDB**: Agent's working memory (like RAM)
- **PostgreSQL**: Application's permanent storage (like hard drive)

**Analogy**:
- ChromaDB = Notepad while you work (temporary notes)
- PostgreSQL = Filing cabinet (organized, permanent records)

Both are needed. ChromaDB enables fast agent operations with semantic search. PostgreSQL ensures data integrity and persistence for user-facing features.

---

## ⚠️ Common Pitfalls (Avoided)

### ❌ **Anti-pattern**: Store user lists in ChromaDB
**Problem**:
- User creates "Best Poems" list
- Browser refresh → List disappears (ChromaDB session lost)
- No way to share lists or enforce permissions
- Can't query "show me all my lists" efficiently

### ✅ **Correct pattern**: Store in PostgreSQL
**Benefits**:
- Lists persist forever
- Can query across all users (for future multi-user)
- Foreign key constraints prevent orphaned items
- Can efficiently filter, sort, paginate

---

## 🚀 Future Considerations

### Phase 1 (Current): Separate databases
- ChromaDB for MCP/agent memory
- PostgreSQL for all persistent data
- Clear separation of concerns

### Phase 2 (Future): Hybrid queries
If needed, could combine:
- Query PostgreSQL for list of starred message IDs
- Use ChromaDB to get semantic neighbors of those messages
- Combine results in application layer

### Phase 3 (Future): pgvector expansion
PostgreSQL with pgvector can do semantic search too:
- Already storing embeddings (47,698 messages with vectors)
- Could deprecate ChromaDB entirely
- OR keep ChromaDB for agent scratch space

---

## 📝 Decision Log

**Oct 12, 2025**: Discovery Engine Implementation
- **Decision**: Use PostgreSQL for interests/lists
- **Rationale**: User-facing feature requiring persistence
- **Alternative considered**: ChromaDB (rejected - not persistent enough)
- **Outcome**: 5 new tables in PostgreSQL, full CRUD operations

**Database chosen**: ✅ PostgreSQL
**Database NOT used**: ❌ ChromaDB
**Reason**: Features need to persist across sessions and support relational queries

---

## 🎯 Summary

| Aspect | ChromaDB | PostgreSQL |
|--------|----------|------------|
| **Purpose** | Agent memory | Application data |
| **Lifecycle** | Session/ephemeral | Permanent |
| **Access** | MCP tools | FastAPI ORM |
| **Best for** | Temporary, unstructured | Structured, relational |
| **Vector search** | Primary use case | Secondary (via pgvector) |
| **Transactions** | Limited | Full ACID |
| **Migrations** | None | Versioned SQL |
| **Use in Discovery** | Not used | Core feature |

**Rule of thumb**: If the user expects it to still be there tomorrow, use PostgreSQL.

---

**End of Architecture Notes**
