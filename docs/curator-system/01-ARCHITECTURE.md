# Curator System Architecture

## Overview

Two-agent system for Post-Social Network:
- **Curator**: Phenomenological guide to ONE text (node)
- **AUI**: Site consultant, cross-node discovery, teaches paradigm shift

## Node Lifecycle

```
DORMANT → AWAKENED → ACTIVE → MATURE → CANONICAL
```

- **DORMANT**: 70k texts, metadata only, zero cost
- **AWAKENED**: User visits → pyramid built, curator instantiated
- **ACTIVE**: Has interactions, synthesis growing
- **MATURE**: Substantial synthesis, cross-references mapped
- **CANONICAL**: Community-validated, reference point

## LLM Choice

**Llama 70B on Cloudflare Workers AI** - native, cost-effective starting point.

## Key Principle

Curators know their text via:
1. **Apex summary** (~500 words) - working consciousness
2. **Embedding retrieval** - zoom to specific passages for quotation

## File Locations

- Frontend: `~/humanizer_root/workers/post-social-ui/`
- Backend: `~/humanizer_root/workers/post-social-api/`
- Docs: `~/humanizer_root/docs/curator-system/`

## Related Docs

- `02-PROMPTS.md` - System prompts for Curator and AUI
- `03-CHUNK-PYRAMID.md` - Text chunking and summarization
- `04-INTER-CURATOR.md` - Autonomous discourse system
- `05-CHROMADB-SCHEMA.md` - Database collections
- `06-IMPLEMENTATION-TASKS.md` - Claude Code handoff tasks
