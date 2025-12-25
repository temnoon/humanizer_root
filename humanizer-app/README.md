# Humanizer

**Infrastructure for reclaiming subjective agency**

> "We are here to help people find their inner human. Through the ability to see words through every lens, and through that, find the subjective human inside myself. Through taking control of our social network and AI time and attention, reclaim our own words that have been bought and sold a thousand times since we set them to bits."

---

## Philosophy

This is not a text-cleaning service. This is not an AI detector. This is **Node Zero** of a post-social network—infrastructure for conscious navigation through a field of meaning.

The core insight: **The sentence is the atom of narrative.** Each sentence is a quantum of semantic exchange, collapsing potential into actuality. Your archive—scattered across ChatGPT exports, Facebook dumps, and forgotten notebooks—is your **density matrix**: the accumulated state of a lifetime's collapse into words.

The goal is to evoke from this lifetime of work the human who has been dying to speak.

---

## Architecture

```
humanizer-app/
├── packages/
│   ├── core/           # Density matrix, POVM, SIC analysis
│   ├── archive/        # Import & reclaim (ChatGPT, FB, notes)
│   ├── curator/        # AI epistemic regulators
│   ├── transform/      # Persona, style, allegorical
│   └── ui/             # The semifictional interface
│       └── styles/     # Token-based design system
└── apps/
    ├── cli/            # Terminal-native (humanizer command)
    └── web/            # humanizer.com
```

---

## Core Concepts

### Subjective Intentional Constraint (SIC)

LLM text is "slop" not because it's low quality—it's often grammatically perfect. It's slop because it lacks **traces of lived constraint**:

- **Irreversibility** - "I decided, and I can't undo it"
- **Temporal Pressure** - "Before I could think, I said..."
- **Epistemic Incompleteness** - "I was wrong"
- **Value Tradeoffs** - "I chose X at the cost of Y"
- **Scar Tissue** - "I still regret..."
- **Embodiment** - "My hands were shaking"

SIC analysis detects whether a mind seems to be **paying the cost of being itself**.

### The Curator

You are the curator of your own archive. Not an AI assistant—you, with AI as tool. The curator navigates the archive, applies measurements (POVMs), discovers patterns, and composes new understanding.

### Semifiction

The interface operates as a **third namespace**—neither factual nor fictional, but a designated space for conscious exploration. Here, you can think thoughts without believing them, explore alternative framings, and return to ordinary life with expanded possibility.

---

## Quick Start

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Run CLI
npm run cli -- --help

# Analyze text for SIC
npm run cli -- analyze "Your text here"
npm run cli -- analyze path/to/file.txt

# Import an archive
npm run cli -- import path/to/chatgpt-export

# Enter curation mode
npm run cli -- curate
```

---

## Design System

**ZERO TOLERANCE** for hardcoded styles. Every value flows from tokens.

See:
- `docs/STYLEGUIDE.md` - Design principles
- `docs/STYLE_AGENT.md` - Style agent protocol
- `packages/ui/styles/tokens.css` - All CSS custom properties

---

## Development

```bash
# Start dev mode
npm run dev

# Run tests
npm run test

# Check style compliance
npm run style:check
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@humanizer/core` | Sentence tokenization, SIC analysis, types |
| `@humanizer/archive` | Archive import and indexing |
| `@humanizer/curator` | Curation logic and AI integration |
| `@humanizer/transform` | Text transformation tools |
| `@humanizer/ui` | Shared UI components and styles |

---

## License

Private. Copyright © 2025 Tem Noon.

---

*"Balance is the sustained capacity to act without being diminished by action. It is the porosity that allows new meaning to enter without surrender of coherence."*
