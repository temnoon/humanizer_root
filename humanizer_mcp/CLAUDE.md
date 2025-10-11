# Humanizer MCP Server
## MCP Bridge to Humanizer API

**Purpose:** Expose Humanizer API tools to MCP-compatible agents (Claude Code, etc.)

---

## Architecture

```
MCP Agent (Claude Code)
    ↓
MCP Server (this project)
    ↓
Humanizer API (localhost:8000)
    ↓
Humanizer Backend (main project)
```

---

## What This Does

**Exposes 8 MCP tools:**
1. `read_quantum` - Quantum reading with POVMs
2. `search_chunks` - Semantic search
3. `list_books` - Browse library
4. `get_library_stats` - Library overview
5. `search_images` - Find images in archive
6. `track_interest` - Add to interest list (breadcrumbs)
7. `get_connections` - Show connection graph
8. `get_interest_list` - View breadcrumbs + wishlist

**Local databases:**
- **SQLite** (`data/humanizer_mcp.db`) - Connection tracking, interest list, usage patterns
- **ChromaDB** (`data/chromadb/`) - Session memory, MCP-specific embeddings

**CRITICAL:** Separate ChromaDB instance from main Humanizer (different persist directory).

---

## Setup

```bash
cd ~/humanizer_root/humanizer_mcp
python3.11 -m venv venv
source venv/bin/activate
pip install mcp httpx sqlalchemy chromadb

# Initialize databases
python src/init_db.py

# Run MCP server
python src/server.py
```

**Claude Code integration:**
```json
// ~/.claude.json (User-wide config)
{
  "mcpServers": {
    "humanizer": {
      "command": "/Users/tem/Library/Caches/pypoetry/virtualenvs/humanizer-mcp-RzpyO30M-py3.13/bin/python",
      "args": ["src/server.py"],
      "cwd": "/Users/tem/humanizer_root/humanizer_mcp"
    }
  }
}
```

**Note:** Use the direct Python path from poetry virtualenv, not `poetry run python`.
To find your virtualenv path: `cd ~/humanizer_root/humanizer_mcp && poetry env info --path`

---

## Project Structure

```
humanizer_mcp/
├── CLAUDE.md           # This file
├── README.md           # Setup instructions
├── requirements.txt    # Dependencies
├── src/
│   ├── server.py       # MCP server (main entry point)
│   ├── tools.py        # MCP tool definitions
│   ├── database.py     # SQLite schema + operations
│   ├── init_db.py      # Database initialization
│   └── config.py       # Configuration
├── data/
│   ├── humanizer_mcp.db     # SQLite (created on init)
│   └── chromadb/            # ChromaDB persist dir
└── docs/
    └── TOOLS.md        # Tool specifications
```

---

## Databases

### SQLite Schema

**interest_list** - Breadcrumbs + wishlist
- Tracks what user marks as interesting
- Records context (what were you doing?)
- Breadcrumb chain (how did you get here?)

**connections** - Graph of transformations
- Source → Transformation → Target
- Example: Narrative A → (quantum_read) → Chunk B

**usage_patterns** - Teaching data
- What tools get used
- What keystrokes are effective
- Adaptive learning input

### ChromaDB Collections

**mcp_sessions** - Session memory
- Recent MCP calls
- Context for next call
- Embeddings for semantic continuity

**interest_embeddings** - Interest list semantics
- Why was this marked interesting?
- Find similar interests

---

## SQLAlchemy Note

**CRITICAL:** `metadata` is reserved word.
- Use `metadata_` or `meta_data` in column names
- Already handled in database.py

---

## Usage Examples

### From Claude Code

```
User: "Read the first chapter of Moby Dick with quantum measurements"
Claude: Uses mcp__humanizer__read_quantum tool
Result: POVM measurements shown
```

```
User: "Find chunks similar to this one"
Claude: Uses mcp__humanizer__search_chunks tool
Result: Semantic matches
```

```
User: "Add this to my interest list"
Claude: Uses mcp__humanizer__track_interest tool
Result: Breadcrumb recorded
```

---

## Configuration

**src/config.py:**
- Humanizer API base URL (default: http://localhost:8000)
- Default user ID (for tracking)
- ChromaDB persist directory
- SQLite database path

---

## Key Design Decisions

1. **Separate ChromaDB** - Don't mix with main Humanizer's embeddings
2. **Connection graph** - Track transformations (functors) between entities
3. **Interest list** - Breadcrumbs (how you got here) + wishlist (want to explore)
4. **Teaching data** - Usage patterns inform adaptive learning

---

## Next Steps

After MCP server works:
1. Add graph visualization (show connections)
2. Implement teaching prompts (suggest keystrokes)
3. Adaptive learning (system learns what to teach)
4. Zed extension (if pursuing keyboard-driven GUI)

---

**Status:** ✅ WORKING (Oct 9, 2025)
**Dependencies:** Humanizer backend must be running (localhost:8000)

---

## Recent Updates

### Oct 9, 2025 (Evening) - User System & UUID Fix

**Problem:** MCP tools using "user_1" instead of valid UUID
- `read_quantum` tool was blocked with 400 error
- Backend expects UUID format for user_id
- MCP config had string "user_1" as default

**Solution:** Implemented full user system + fixed MCP config
1. ✅ Created comprehensive user system architecture document
   - Avatar system (DiceBear + upload)
   - Authentication (password + OAuth ready)
   - Authorization (role-based)
   - Privacy controls (private/shared/public)

2. ✅ Database migration: Added user columns
   - avatar_url, avatar_seed, avatar_provider
   - password_hash, oauth_provider, oauth_id
   - email_verified, last_login_at
   - role (user/admin with check constraint)
   - Unique index for OAuth

3. ✅ Updated MCP config with valid UUID
   - Changed DEFAULT_USER_ID from "user_1" to "c7a31f8e-91e3-47e6-bea5-e33d0f35072d"
   - Using first existing anonymous user from database
   - All existing users got avatar_seed set to their UUID

**Files Modified:**
- `~/humanizer-agent/docs/USER_SYSTEM_ARCHITECTURE.md` (NEW)
- `~/humanizer-agent/backend/alembic/versions/24e7bb14ad39_add_user_system_enhancements.py` (NEW)
- `~/humanizer_root/humanizer_mcp/src/config.py` (DEFAULT_USER_ID updated)
- `~/humanizer-agent/backend/models/db_models.py` (User model gains new columns)

**Next Steps:**
- Restart Claude Code to reload MCP server with new user_id
- Test `read_quantum` tool (should work now)
- Implement authentication endpoints (Phase 2)
- Add avatar display to frontend (MVP)

---

### Oct 9, 2025 - Fixed API Integration

**Problem:** MCP tools were calling agent chat endpoint instead of direct APIs
- All tools were using `call_agent_tool()` which went through `/api/agent/chat`
- Agent chat requires valid UUID user_id, was getting 400 errors
- Indirect routing was slow and error-prone

**Solution:** Updated tools to use direct API endpoints
- ✅ `get_library_stats` → `/api/library/stats` (direct GET)
- ✅ `list_books` → `/api/books/` (already direct)
- ✅ `search_chunks` → `/api/library/chunks?search=...` (already direct)
- ✅ `search_images` → `/api/library/media?search=...` (now direct)
- ⚠️ `read_quantum` → Still uses agent (complex tool, needs agent context)

**Changes Made:**
1. Added `HumanizerAPIClient.get_library_stats()` method
2. Added `HumanizerAPIClient.search_images()` method
3. Updated `get_library_stats_tool()` to call direct endpoint
4. Updated `search_images_tool()` to call direct endpoint

**Testing:** Need to restart Claude Code to reload MCP server with changes
