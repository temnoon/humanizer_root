# ChromaDB Production Database Operator

## Overview

Manage separate ChromaDB instances for production development vs historical debugging.

**Purpose**: Create a clean, production-focused memory database for completing the humanizer-agent publication pipeline, separate from the historical database containing debugging noise and abandoned experiments.

## The DEC Jupiter Lesson

*"One basket, one egg. Don't cancel the working architecture for the next shiny thing."*

The current humanizer-agent at `/Users/tem/humanizer-agent/` is the proven VAX. Don't abandon it for Cloudflare Workers (Jupiter). Extend what works.

## Database Strategy

### Production DB (`chroma_production_db`)
- **Purpose**: Notes focused on completing publication-ready features
- **Content**: Architecture decisions, refactoring targets, publication pipeline TODOs
- **Use**: Daily development, feature planning, production readiness
- **Tags**: publication, pipeline, refactoring, api, webgui, todo

### Historical DB (`chroma_test_db`)
- **Purpose**: All development history (547 memories of debugging, experiments, dead ends)
- **Content**: Everything that's ever been tried, including failures
- **Use**: Deep archaeological digs when stuck, learning from past mistakes
- **Tags**: debugging, experiment, archive, transformation

## Installation & Setup

### Option 1: Use humanizer-agent's Python environment (Recommended)

```bash
cd /Users/tem/humanizer_root
source /Users/tem/humanizer-agent/backend/venv/bin/activate
python production_chromadb_operator.py <command>
```

### Option 2: Install dependencies globally

```bash
pip install chromadb sentence-transformers
```

## Usage

### Create Production Database

```bash
python production_chromadb_operator.py create
```

Creates new production database at `/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db`

### Seed with Initial Project Knowledge

```bash
python production_chromadb_operator.py seed
```

Seeds 9 initial memories:
1. Project structure overview
2. Files needing refactoring (>500 lines)
3. Current capabilities
4. Missing publication pipeline components
5. DEC Jupiter architecture lesson
6. Development workflow best practices
7. Tech stack overview
8. Database schema
9. API endpoint map

### Check Database Status

```bash
python production_chromadb_operator.py status
```

Shows:
- Production DB: memory count, purpose
- Historical DB: memory count, purpose
- Current active database

### Query Production Database

```bash
python production_chromadb_operator.py query "publication pipeline"
python production_chromadb_operator.py query "files need refactoring"
python production_chromadb_operator.py query "LaTeX PDF generation"
```

Semantic search across production memories.

## Using with MCP Memory Service

The MCP ChromaDB memory server currently points to `chroma_test_db` (historical).

To switch MCP to use production database:

1. **Locate MCP config**: Usually at `~/.config/claude-code/mcp.json` or similar
2. **Find chromadb-memory server configuration**
3. **Change database path** from `chroma_test_db` to `chroma_production_db`

Example MCP config change:
```json
{
  "mcpServers": {
    "chromadb-memory": {
      "command": "node",
      "args": ["/path/to/mcp-memory-service/dist/index.js"],
      "env": {
        "CHROMA_PATH": "/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"
      }
    }
  }
}
```

**Workflow**:
- **Production work**: Point MCP → `chroma_production_db`
- **Deep research**: Point MCP → `chroma_test_db` (historical)
- **Ultra-think mode**: Query historical DB when stuck

## Production Database Phenomenology

### Target Application
- **Path**: `/Users/tem/humanizer-agent/`
- **Purpose**: Archive transformation → Publication-ready outputs
- **Outputs**: Academic Paper, Book, Picture Book with PDFs + cover images

### Cover Image Specification
Publication-ready covers include 5 parts:
1. Front outside
2. Front inside
3. Spine
4. Back inside
5. Back outside

### Current State (Oct 2025)
✅ Working: Transformation engine, PostgreSQL, embeddings, philosophical features
❌ Missing: LaTeX typesetting, PDF generation, cover creation, publication pipeline

### Large Files Needing Refactoring
- `madhyamaka_service.py` - 1003 lines ⚠️
- `routes.py` - 567 lines
- `chunk_models.py` - 558 lines
- `philosophical_routes.py` - 540 lines
- `library_routes.py` - 526 lines

**Target**: 200-300 lines per file, refactor when >500 lines

### Best Practice Principles
1. **Write when necessary** - Reuse until you really need new functionality
2. **Check ChromaDB first** - Before coding, query production memories
3. **Store after significant work** - Document decisions, next steps, learnings
4. **Tag appropriately** - Make memories findable (publication, refactoring, api, etc.)
5. **Refactor proactively** - Break up files >500 lines into focused modules

## Python API Usage

```python
from production_chromadb_operator import ChromaDBOperator

# Initialize
op = ChromaDBOperator()

# Switch to production
op.switch_to_production()

# Store a memory
op.store_memory(
    content="Implemented LaTeX template engine for academic papers...",
    tags=["publication", "latex", "feature"],
    metadata={"file": "services/latex_service.py", "lines": "245"}
)

# Query
results = op.query_memories("LaTeX templates", n_results=5)

# Switch to historical for deep research
op.switch_to_historical()
results = op.query_memories("archive import debugging", n_results=10)
```

## Workflow Integration

### Daily Development Session

1. **Start**: Check production DB for TODOs and recent notes
   ```bash
   python production_chromadb_operator.py query "todo next"
   ```

2. **During work**: Reference production memories via MCP (if configured)
   - Claude Code automatically uses MCP ChromaDB tools
   - `mcp__chromadb-memory__recall_memory` with production DB

3. **End of session**: Store what you accomplished
   ```python
   op.store_memory(
       content="Created PDF compositor service...",
       tags=["publication", "pdf", "completed"],
       metadata={"pr": "123"}
   )
   ```

### When Stuck (Ultra-Think Mode)

1. **Switch MCP to historical DB** (all 547 memories)
2. **Query broadly** across experiments and dead ends
3. **Learn from past attempts** - what failed, what worked
4. **Return to production DB** once you have insights

## Files in This Package

- `production_chromadb_operator.py` - Main operator script
- `CHROMADB_OPERATOR_README.md` - This file
- *(Future)* `mcp_config_helper.py` - Easy MCP database switching

## Next Steps

1. ✅ Create production database
2. ✅ Seed with project phenomenology
3. 🔲 Configure MCP to use production DB
4. 🔲 Start querying before each coding session
5. 🔲 Build publication pipeline features:
   - LaTeX template engine
   - PDF compositor
   - Cover image generator
   - Archive-to-structure converter
   - Bibliography generator

## Philosophy

This operator embodies:
- **Separation of concerns**: Production vs historical memories
- **Phenomenological awareness**: Document what IS, not what should be
- **Pragmatic architecture**: Extend working systems, don't rewrite
- **Memory as tool**: Future self needs context to maintain velocity
- **DEC's lesson**: Proven architecture > next shiny framework

---

*"The beginning of the end was the cancellation of Jupiter."*
Let's not make that mistake. Build on the VAX.
