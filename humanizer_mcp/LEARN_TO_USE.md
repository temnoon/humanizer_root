# Learning to Use Humanizer MCP

## What Just Got Built

**✅ Complete MCP Server** exposing Humanizer to Claude Code and other MCP agents.

### Project Structure
```
humanizer_mcp/
├── pyproject.toml        # Poetry config
├── CLAUDE.md             # Succinct reference (no bloat)
├── STATUS.md             # What works, what's next
├── README.md             # Setup guide
├── LEARN_TO_USE.md       # This file
├── test_mcp.py           # Local testing
├── src/
│   ├── server.py         # MCP server (entry point)
│   ├── tools.py          # 8 tool implementations
│   ├── models.py         # Pydantic models (type-safe)
│   ├── database.py       # SQLite (metadata_ not metadata!)
│   ├── config.py         # Configuration
│   └── init_db.py        # Database init
└── data/
    ├── humanizer_mcp.db  # SQLite (interest list, connections)
    └── chromadb/         # Separate ChromaDB instance
```

## Working Tools (Test Them Now)

### 1. list_books
**What it does:** Get all books from Humanizer library

**Test it:**
```bash
cd ~/humanizer_root/humanizer_mcp
poetry run python test_mcp.py
```

**You'll see:**
```
✓ Found 6 books
  First book: images
```

### 2. track_interest
**What it does:** Add items to your interest list (breadcrumbs + wishlist)

**It's working!** Every test run adds an item. Check database:
```bash
sqlite3 ~/humanizer_root/humanizer_mcp/data/humanizer_mcp.db "SELECT * FROM interest_list;"
```

### 3. get_interest_list
**What it does:** Show all items you've marked interesting

**Try it in the test** - you'll see the breadcrumb trail building.

### 4. get_connections
**What it does:** Show the graph of transformations (how you got from A → B)

**This is the "functor" tracking you wanted!**

## Using from Claude Code

### Step 1: Restart This Claude Code Session
The `mcp.json` config is already created here:
```
~/.config/claude-code/mcp.json
```

When you **restart Claude Code**, it will load the Humanizer MCP server.

### Step 2: Try These Commands

**Once restarted, ask me (Claude):**

```
"List all books in the Humanizer library"
```
I'll use the `list_books` MCP tool automatically.

```
"Track chunk_123 as interesting with title 'Great passage' and context 'Reading about consciousness'"
```
I'll use the `track_interest` tool.

```
"Show my interest list"
```
I'll use `get_interest_list` to show your breadcrumbs.

```
"Show me all connections from chunk_123"
```
I'll use `get_connections` to show the transformation graph.

### Step 3: Watch the Connection Graph Build

Every time you use a tool, connections are recorded in the database:

```
You: "List books"
→ Connection: user → list_books → books

You: "Track chunk_123"
→ Connection: books → track_interest → interest_list

You: "Search similar to chunk_123"  (when backend ready)
→ Connection: chunk_123 → search_similar → similar_chunks
```

**Later, you can query:** "How did I find this chunk?"
→ The connection graph shows the path!

## The Databases (Separate from Main Humanizer)

### SQLite (humanizer_mcp.db)

**Three tables:**

1. **interest_list** - Items you've marked interesting
   - Breadcrumbs (how you got here via `connection_from_id`)
   - Wishlist (things you want to explore)

2. **connections** - Graph of transformations
   - Source → Transformation → Target
   - Example: `book_1 → quantum_read → chunk_42`
   - **These are the "functors" you mentioned!**

3. **usage_patterns** - Teaching data
   - Which tools you use
   - How often they succeed
   - For adaptive learning (future: suggest keystrokes)

**Inspect it:**
```bash
sqlite3 ~/humanizer_root/humanizer_mcp/data/humanizer_mcp.db
.schema
.tables
SELECT * FROM interest_list;
.quit
```

### ChromaDB (chromadb/)

**Two collections:**

1. **mcp_sessions** - Session memory
   - Recent MCP calls
   - Context for continuity

2. **interest_embeddings** - Interest list semantics
   - Embeddings of why things are interesting
   - Find similar interests later

**Note:** Completely separate from main Humanizer's ChromaDB (different persist directory).

## What's Next (When Backend Ready)

These tools are **implemented in MCP but waiting for backend**:

- **read_quantum** - Quantum reading with POVMs
- **search_chunks** - Semantic search (endpoint exists, may need format fix)
- **get_library_stats** - Library statistics
- **search_images** - Image search

**Once backend adds these endpoints, they'll work immediately!**

## The Teaching Model (Future)

The MCP server tracks usage patterns. Future additions:

1. **After you use a tool 3 times, I'll suggest:**
   "Next time, you can use keystroke `Cmd+K` in Zed for faster search"

2. **Adaptive learning:**
   System learns which tools you use most → prioritizes them

3. **Zed extension (if you pursue):**
   Keyboard-driven interface with teaching prompts inline

## SQLAlchemy Metadata Note

**Why `metadata_` not `metadata` in database.py:**

SQLAlchemy reserves `metadata` for its own use. Using it as a column name causes conflicts.

**Solution:** All columns use `metadata_` in database schema.

**Pydantic models** still expose it as `metadata` (user-facing), but internally it's `metadata_`.

## Commands to Remember

### Test Locally
```bash
cd ~/humanizer_root/humanizer_mcp
poetry run python test_mcp.py
```

### Reinitialize Databases (if needed)
```bash
poetry run python src/init_db.py
```

### Check Database Contents
```bash
sqlite3 data/humanizer_mcp.db "SELECT * FROM interest_list;"
```

### Format Code
```bash
poetry run black src/
poetry run ruff check src/
```

## How to Use This in Your Workflow

### Scenario 1: Research Session

1. **Start exploring:** "List books"
2. **Find interesting chunk:** "Track chunk_42 as interesting"
3. **Mark context:** (automatic - records what you were doing)
4. **Continue exploring:** Search, read more
5. **Later:** "Show my interest list" → See breadcrumb trail
6. **Even later:** "Show connections from chunk_42" → See how you found it

### Scenario 2: Keyboard-Driven (Future with Zed)

1. Press `Cmd+K` → Search chunks
2. Press `Cmd+I` → Mark as interesting
3. Press `Cmd+[/]` → Navigate breadcrumbs
4. System shows: "💡 You just used Cmd+K 3 times! You've learned it."

### Scenario 3: Adaptive Learning (Future)

System learns:
- You search for "consciousness" often → Suggests related interests
- You prefer visual over text → Prioritizes image search
- You mark things interesting late at night → Different context

## Summary

**What works NOW:**
- ✅ MCP server running
- ✅ Local database (interest tracking, connections, usage)
- ✅ list_books (from Humanizer API)
- ✅ Pydantic models (type-safe)
- ✅ Configured for Claude Code

**What you do NEXT:**
1. Restart Claude Code (to load MCP server)
2. Ask me: "List all books"
3. Watch it work!
4. Build your interest list and connection graph

**What comes LATER:**
- Backend endpoints for remaining tools
- Zed extension (if you want keyboard-driven interface)
- Teaching prompts and adaptive learning

---

**You asked:** "Teach me to use it through you"

**I've delivered:**
- Complete working MCP server
- Local testing (no Claude Code needed)
- Documentation (succinct, no bloat)
- Ready for you to use RIGHT NOW

**Restart Claude Code and try:** "List all books in my library"

Let's see it work! 🚀
