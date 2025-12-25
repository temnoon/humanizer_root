# Handoff: Node Zero Complete

**Date**: Dec 24, 2025
**Session**: Built humanizer-app from scratch

---

## What We Built

Fresh monorepo at `~/humanizer_root/humanizer-app/`:

```
humanizer-app/
├── packages/
│   ├── core/        ✅ SIC analysis, sentence tokenizer, types
│   ├── archive/     ✅ ChatGPT + Facebook parsers
│   ├── book/        ✅ Harvest → Cluster → Order → Compose
│   └── ui/          ✅ HSL design system, tokens, utilities
└── apps/
    ├── cli/         ✅ Terminal interface (in PATH as `humanizer`)
    └── web/         ✅ React app at localhost:5174
```

---

## Key Commands

```bash
# CLI is in PATH
humanizer analyze "text"
humanizer import ~/chatgpt-export -o ./my-archive
humanizer curate -a ./my-archive

# In curate mode:
stats | find <query> | search <query> | read <id> | analyze <text>

# Web dev
cd humanizer-app/apps/web && npm run dev
```

---

## Imported Archive

`humanizer-app/my-archive/` contains:
- 593 conversations
- 13,700 messages (5,342 yours)
- 2.7M words
- Dec 2022 → Nov 2023

---

## @humanizer/book Module

**Pipeline**: Harvest → Cluster → Order → Compose → Export

Key files:
- `src/harvester/` - Extract passages by query
- `src/clusterer/` - Group by theme (PHENOMENOLOGY_CONCEPTS)
- `src/orderer/` - Topological sort by concept dependencies
- `src/composer/` - Generate chapters, marginalia, export MD

**Concept Dependencies**: Built-in phenomenology DAG for ordering:
- consciousness → intentionality → epoché → lifeworld → crisis
- Your framework: subjective world → field of agency → density matrix

---

## Next Steps

1. **Add book CLI commands**: `humanizer book harvest "lifeworld"`, `humanizer book compose`
2. **Test lifeworld book**: Run full pipeline on your archive
3. **@humanizer/transform**: Persona, style, SIC enhancement
4. **Embeddings**: Replace keyword clustering with semantic embeddings

---

## Design System

**ZERO hardcoded values**. All styles use tokens:
- `packages/ui/styles/tokens.css` - HSL palettes, spacing, all vars
- `docs/STYLEGUIDE.md` - Complete guide
- `docs/STYLE_AGENT.md` - Protocol for AUI to request elements

---

## Philosophy Encoded

- **Sentence as atom** of semantic exchange
- **SIC scoring** detects lived constraint traces
- **Concept dependencies** order ideas (epoché before lifeworld)
- **Archive as density matrix** - your accumulated state

---

**The human inside is now audible through 2.7 million words.**
