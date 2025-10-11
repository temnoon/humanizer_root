# MCP Database Switching Guide

## Overview

Switch Claude Code's ChromaDB memory access between **production** and **historical** databases for different development contexts.

## Database Purposes

### Production Database (`chroma_production_db`)
- **Focus**: Publication pipeline completion
- **Content**: Clean, actionable development notes
- **Memories**: 9+ focused on completing humanizer-agent
- **Use When**: Daily development, feature planning, production work

### Historical Database (`chroma_test_db`)
- **Focus**: Complete development history
- **Content**: 547 memories (debugging, experiments, dead ends)
- **Use When**: Stuck on a problem, researching past attempts, ultra-think mode

## Database Locations

```
/Users/tem/archive/mcp-memory/mcp-memory-service/
├── chroma_production_db/    ← Production (clean)
└── chroma_test_db/           ← Historical (complete archive)
```

## Method 1: Environment Variable (Quick Switch)

The MCP memory service reads `CHROMA_DB_PATH` environment variable.

### Switch to Production

```bash
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"
# Restart Claude Code to use production DB
```

### Switch to Historical

```bash
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db"
# Restart Claude Code to use historical DB
```

### Make Permanent (Add to .zshrc or .bashrc)

```bash
# For production-focused work (default)
echo 'export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"' >> ~/.zshrc

# OR for historical deep-dives
echo 'export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db"' >> ~/.zshrc
```

## Method 2: MCP Configuration File

Locate and edit your MCP configuration file (usually `~/.config/claude-code/config.json` or similar).

### Find MCP Config

```bash
# Search for MCP config
find ~ -name "*mcp*.json" -o -name "config.json" 2>/dev/null | grep -i claude
```

Common locations:
- `~/.config/claude-code/mcp.json`
- `~/.config/claude-code/config.json`
- `~/Library/Application Support/Claude Code/mcp.json`

### Edit Configuration

Find the `chromadb-memory` server entry and update the database path:

```json
{
  "mcpServers": {
    "chromadb-memory": {
      "command": "python",
      "args": [
        "/Users/tem/archive/mcp-memory/mcp-memory-service/start_memory_service.py"
      ],
      "env": {
        "CHROMA_DB_PATH": "/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"
      }
    }
  }
}
```

**To switch databases**: Change `CHROMA_DB_PATH` value and restart Claude Code.

## Method 3: MCP Service Modification

Edit the MCP memory service startup script directly.

### Edit start_memory_service.py

```bash
nano /Users/tem/archive/mcp-memory/mcp-memory-service/start_memory_service.py
```

Find the database path configuration and change it:

```python
# Change this line:
DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_test_db")

# To use production:
DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_production_db")
```

Restart Claude Code after changing.

## Verification

### Check Which Database Claude Code Is Using

In a Claude Code session, ask:

```
Query the ChromaDB and tell me how many memories are stored.
```

**Production**: Should show ~9 memories
**Historical**: Should show ~547 memories

### Or Use MCP Tool Directly

```
Use mcp__chromadb-memory__check_database_health
```

Look at `total_memories` count.

## Recommended Workflow

### Daily Development (Use Production DB)

1. **Morning**: Start with production DB
   ```bash
   export CHROMA_DB_PATH=".../chroma_production_db"
   ```

2. **Check TODOs**:
   ```
   Claude, recall what we were working on regarding publication pipeline
   ```

3. **Store Progress**: At end of session
   ```
   Claude, store a note about what we accomplished today
   ```

### Deep Research (Use Historical DB)

1. **When Stuck**: Switch to historical
   ```bash
   export CHROMA_DB_PATH=".../chroma_test_db"
   ```

2. **Query Broadly**:
   ```
   Claude, search historical memories for attempts at PDF generation
   ```

3. **Extract Insights**: Find what failed, what worked

4. **Return to Production**: Switch back
   ```bash
   export CHROMA_DB_PATH=".../chroma_production_db"
   ```

## Database Management Tools

### Using the Operator Script

```bash
cd /Users/tem/humanizer_root

# Query production DB directly (without MCP)
./run_operator.sh query "LaTeX templates"

# Query historical DB
# (Edit operator script to switch databases, or use Python API)
```

### Python API for Advanced Usage

```python
from production_chromadb_operator import ChromaDBOperator

op = ChromaDBOperator()

# Work with production
op.switch_to_production()
results = op.query_memories("publication pipeline", n_results=5)

# Switch to historical for deep dive
op.switch_to_historical()
past_attempts = op.query_memories("PDF generation debugging", n_results=20)

# Store new insight back in production
op.switch_to_production()
op.store_memory(
    content="Found that past PDF attempts failed due to...",
    tags=["publication", "research", "pdf"],
    metadata={"learned_from": "historical_db"}
)
```

## Troubleshooting

### MCP Not Recognizing Database Change

1. **Restart Claude Code** (full quit and reopen)
2. **Check environment variable**: `echo $CHROMA_DB_PATH`
3. **Verify MCP config**: Check JSON syntax is valid
4. **Check MCP service logs**: Look for database initialization messages

### Wrong Memory Count

If Claude Code reports unexpected memory counts:

1. **Verify path**: Check `CHROMA_DB_PATH` is set correctly
2. **Database exists**: `ls -la /Users/tem/archive/mcp-memory/mcp-memory-service/chroma_*_db/`
3. **Permissions**: Ensure read/write access to database directory

### Database Corruption

If a database becomes corrupted:

**Production**: Regenerate from operator script
```bash
./run_operator.sh create
./run_operator.sh seed
```

**Historical**: Restore from backup
```bash
cp -r /Users/tem/archive/mcp-memory/mcp-memory-service/backups/chroma_test_db_YYYY-MM-DD \
      /Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db
```

## Best Practices

### When to Use Each Database

| Task | Database | Reason |
|------|----------|--------|
| Daily feature work | Production | Clean, focused notes |
| Planning next steps | Production | Actionable TODOs |
| Learning codebase | Production | Structured overview |
| Debugging old issue | Historical | See past attempts |
| Understanding dead ends | Historical | Learn what failed |
| Researching experiments | Historical | Full context |
| Ultra-think deep dive | Historical | All 547 memories |

### Hybrid Approach

1. **Start in production** (default)
2. **If stuck**: Switch to historical for 15-30 minutes
3. **Extract insights** from historical research
4. **Switch back to production**
5. **Store what you learned** as new production memory

### Memory Hygiene

**Production Database**:
- Keep focused on current goals
- Delete obsolete memories
- Refactor when >50 memories to maintain clarity
- Tag consistently: `publication`, `api`, `webgui`, `refactoring`, `todo`

**Historical Database**:
- Never delete (it's the archive)
- Accept noise and redundancy
- Use specific queries to filter
- Tag broadly for discoverability

## Quick Reference Card

```bash
# Switch to Production
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"

# Switch to Historical
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db"

# Verify Current Database
echo $CHROMA_DB_PATH

# Query Production (without MCP)
./run_operator.sh query "your search"

# Restart Claude Code
# (Quit completely and reopen)
```

## Future Enhancements

Potential improvements to database switching:

1. **Quick-switch command**: `./run_operator.sh use production|historical`
2. **MCP proxy**: Runtime database switching without restart
3. **Hybrid queries**: Search both databases, merge results
4. **Auto-tagging**: Claude automatically tags production vs historical context
5. **Migration tool**: Move specific memories from historical → production

---

*Remember: Production DB is your daily driver. Historical DB is your archaeological site.*
*Use production for building. Use historical for learning.*
