# Humanizer MCP Server

MCP server exposing Humanizer API to MCP-compatible agents (Claude Code, etc.)

## Quick Start

```bash
cd ~/humanizer_root/humanizer_mcp

# Install Poetry (if not already installed)
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Initialize databases
poetry run python src/init_db.py

# Test the server
poetry run python src/server.py
```

## Claude Code Integration

Add to `~/.config/claude-code/mcp.json`:

```json
{
  "mcpServers": {
    "humanizer": {
      "command": "poetry",
      "args": [
        "run",
        "python",
        "src/server.py"
      ],
      "cwd": "/Users/tem/humanizer_root/humanizer_mcp"
    }
  }
}
```

Then restart Claude Code.

## Development

```bash
# Activate poetry shell
poetry shell

# Run server (with auto-reload during development)
python src/server.py

# Run tests (when we add them)
poetry run pytest

# Format code
poetry run black src/
poetry run ruff check src/
```

## Available Tools

See [CLAUDE.md](./CLAUDE.md) for complete documentation.

**8 MCP tools:**
- `read_quantum` - Quantum reading with POVMs
- `search_chunks` - Semantic search
- `list_books` - Browse library
- `get_library_stats` - Library overview
- `search_images` - Find images
- `track_interest` - Add to interest list
- `get_connections` - View connection graph
- `get_interest_list` - View breadcrumbs + wishlist

## Architecture

**Pydantic Models** (`src/models.py`):
- Type-safe request/response validation
- All tools use Pydantic for data integrity
- Enums for item types, axes types

**Databases**:
- **SQLite** (`data/humanizer_mcp.db`) - Connection tracking
- **ChromaDB** (`data/chromadb/`) - Session memory

**Note:** SQLAlchemy `metadata` reserved word handled (uses `metadata_` in columns).

## Requirements

- **Humanizer backend** must be running on `localhost:8000`
- Python 3.11+
- Poetry

## Troubleshooting

**Server won't start:**
```bash
# Check Humanizer backend
curl http://localhost:8000/api/books

# Check Python version
poetry run python --version  # Should be 3.11+

# Reinstall dependencies
poetry install --no-cache
```

**Claude Code not showing tools:**
- Restart Claude Code after updating `mcp.json`
- Check logs: `~/.config/claude-code/logs/`
- Verify path in `cwd` field

**Database errors:**
```bash
# Re-initialize
poetry run python src/init_db.py

# Check permissions
ls -la data/
```

## Usage from Claude Code

Once configured:

```
"Read the first chapter with quantum measurements"
→ Uses read_quantum tool

"Find chunks about consciousness"
→ Uses search_chunks tool

"Add this to my interest list"
→ Uses track_interest tool

"Show me how I got here"
→ Uses get_connections tool
```

## Project Structure

```
humanizer_mcp/
├── pyproject.toml      # Poetry config
├── CLAUDE.md           # Succinct docs
├── README.md           # This file
├── src/
│   ├── server.py       # MCP server (entry point)
│   ├── tools.py        # Tool implementations
│   ├── models.py       # Pydantic models
│   ├── database.py     # SQLite schema + ops
│   ├── config.py       # Configuration
│   └── init_db.py      # Database initialization
└── data/
    ├── humanizer_mcp.db      # SQLite
    └── chromadb/             # ChromaDB persist dir
```
