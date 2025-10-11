#!/bin/bash
# ChromaDB Production Operator Runner
# Uses MCP memory service's Python environment

MCP_VENV="/Users/tem/archive/mcp-memory/mcp-memory-service/venv"
OPERATOR_SCRIPT="/Users/tem/humanizer_root/production_chromadb_operator.py"

# Activate MCP venv and run operator
source "$MCP_VENV/bin/activate"
python "$OPERATOR_SCRIPT" "$@"
