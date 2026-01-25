# Humanizer AUI CLI Tutorial

A comprehensive guide to using the Humanizer CLI for content transformation, analysis, and book creation.

## Quick Start

```bash
cd packages/core

# Start the CLI
npx tsx src/cli/humanizer-cli.ts

# Or with a specific user ID
npx tsx src/cli/humanizer-cli.ts --user myuser
```

You'll see:

```
╔═══════════════════════════════════════════════════════════════╗
║                    HUMANIZER AUI CLI                           ║
╚═══════════════════════════════════════════════════════════════╝

Created session: abc12345-...
humanizer [abc12345] >
```

---

## Core Workflows

### 1. Pull Archive Content into a Buffer

The buffer is your workspace for content. Load content from your archive:

```
humanizer> load abc123def456
Loaded archive node abc123def456 into buffer
  Words: 1523

humanizer> buffer
Buffer: bf8a2c91...
  Content Hash: 7f3a8b2c1d...
  Words: 1523
  Format: text
  State: transient
  Origin: archive

--- Content Preview (first 500 chars) ---
I remember when I first started learning...
```

**Alternative: Create from text**
```
humanizer> create "This is my sample text that I want to analyze and transform."
Created buffer with 12 words
```

**Alternative: Search and load**
```
humanizer> search "machine learning tutorials"
Searching for: "machine learning tutorials"...
Loaded 5 results into buffer
```

---

### 2. Analyze Your Content

Run quality analysis on the active buffer:

```
humanizer> analyze
Quality Analysis:
  Overall Score: 72.5%
  Reading Level: Grade 10.2
  Avg Sentence Length: 18.3 words
  Formality: 65%
```

Run AI detection to see if content appears AI-generated:

```
humanizer> detect-ai
AI Detection Results:
  AI Probability: 23.5%
  Classification: Likely Human
  Patterns Found: none
```

---

### 3. Transform Your Content

**Apply a custom transformation:**
```
humanizer> transform "Make this more conversational"
Transformation applied: Make this more conversational
```

**Apply persona rewriting (requires configured persona):**
```
humanizer> persona my-persona-id my-style-id
Applying persona my-persona-id...
Persona rewriting complete
  New word count: 1456
```

**Split content:**
```
humanizer> split paragraphs
Split into 8 buffers
Active buffer: bf9c3d82 (215 words)
```

---

### 4. View Transformation History (Provenance)

Every transformation is tracked:

```
humanizer> history
Provenance Chain: pc-a1b2c3d4
  Root Buffer: bf8a2c91
  Branch: main (main)
  Transformations: 4

Operations:
  [10:23:15] create_manual: Created from text
  [10:24:02] analyze_quality: Quality analysis
  [10:25:33] transform_custom: Make this more conversational
  [10:26:45] rewrite_persona: Applied persona my-persona-id
```

Trace back to original source:

```
humanizer> trace
Origin Trace:
  Archive Nodes: abc123def456
  Total Transformations: 4
```

---

### 5. Save as Markdown

Export your transformed content:

```
humanizer> save output.md
Saved to: ./humanizer-output/output.md
```

The markdown includes metadata:

```markdown
# Buffer Export

**ID:** bf8a2c91...
**Created:** 1/25/2026, 10:23:15 AM
**Words:** 1456
**Format:** text

## Provenance

- Origin: archive
- Transformations: 4
- create_manual: Created from text
- analyze_quality: Quality analysis
- transform_custom: Make this more conversational
- rewrite_persona: Applied persona my-persona-id

---

## Content

I remember when I first started learning...
```

---

### 6. Export as PDF

Export your content directly to PDF with automatic LaTeX rendering:

```
humanizer> export-pdf
Generating PDF with LaTeX rendering...
Exported to: ./humanizer-output/buffer-bf8a2c91.pdf
  LaTeX equations rendered via KaTeX

humanizer> export-pdf my-document.pdf
Generating PDF...
Exported to: ./humanizer-output/my-document.pdf
```

The PDF includes:
- Buffer metadata (ID, date, word count)
- Full provenance chain
- Styled content with code highlighting
- **LaTeX equations** rendered via KaTeX (lazy-loaded only when math is detected)

LaTeX is automatically detected and rendered:
- Inline math: `$E = mc^2$` or `\(E = mc^2\)`
- Display math: `$$\int_0^\infty f(x) dx$$` or `\[\int_0^\infty f(x) dx\]`

---

### 6a. Book-Quality Export via Pandoc

For book-quality output with full LaTeX support, use the pandoc export:

```
humanizer> export-pandoc pdf my-book.pdf
Exporting via pandoc to pdf...
Exported to: ./humanizer-output/my-book.pdf
  LaTeX equations processed natively by pandoc

humanizer> export-pandoc epub my-book.epub
Exporting via pandoc to epub...
Exported to: ./humanizer-output/my-book.epub

humanizer> export-pandoc docx draft.docx
Exporting via pandoc to docx...
Exported to: ./humanizer-output/draft.docx
```

**Supported formats:**
- `pdf` - Publication-quality PDF (requires xelatex)
- `epub` - E-book format with table of contents
- `docx` - Microsoft Word document
- `html` - Standalone HTML
- `latex` - Raw LaTeX source
- `odt` - OpenDocument format

**Install pandoc:**
```bash
brew install pandoc           # macOS
apt install pandoc            # Ubuntu
# For PDF: also need LaTeX
brew install --cask mactex    # macOS
apt install texlive-xetex     # Ubuntu
```

---

### 7. Send to Book Project

**List existing books:**
```
humanizer> books
Books (3):
  bk-a1b2c3 - My AI Journey (5 chapters)
  bk-d4e5f6 - Tech Reflections (3 chapters)
  bk-g7h8i9 - Learning Notes (12 chapters)
```

**Commit buffer to a book chapter:**
```
humanizer> to-book bk-a1b2c3 chapter-6
Committed to book bk-a1b2c3, chapter chapter-6
```

**Create a new book from search:**
```
humanizer> new-book "AI Learning Guide" "artificial intelligence tutorials"
Creating book "AI Learning Guide" from query: artificial intelligence tutorials...
  Gathering passages...
  Generating narrative arc...
  Assembling book...
  Book created
Created book: bk-j0k1l2
  Title: AI Learning Guide
  Chapters: 4
```

**View book details:**
```
humanizer> book bk-j0k1l2
Book: AI Learning Guide
  ID: bk-j0k1l2
  Status: draft
  Chapters: 4
  Total Words: 8523
  Arc Type: thematic

Chapters:
  1. Introduction to AI (1823 words)
  2. Machine Learning Basics (2156 words)
  3. Neural Networks Explained (2234 words)
  4. Practical Applications (2310 words)
```

---

## Advanced Features

### Semantic Clustering

Discover thematic clusters in your archive:

```
humanizer> clusters discover
Discovering clusters...
Found 7 clusters
  cl-a1b2c3 - Personal Reflections (42 passages)
  cl-d4e5f6 - Technical Tutorials (38 passages)
  cl-g7h8i9 - Travel Memories (25 passages)
  ...
```

View cluster details:

```
humanizer> cluster cl-a1b2c3
Cluster: Personal Reflections
  ID: cl-a1b2c3
  Passages: 42
  Coherence: 78.5%
  Keywords: life, growth, journey, learning, experience
```

### Persona Harvesting

Start collecting samples for a new persona:

```
humanizer> harvest "My Writing Voice"
Started persona harvest: ph-x1y2z3
Add samples with archive search or manual text input.
```

---

## Command Reference

### Session Commands
| Command | Description |
|---------|-------------|
| `session` | Show current session info |
| `sessions` | List all sessions |
| `new-session [name]` | Create a new session |

### Buffer Commands
| Command | Description |
|---------|-------------|
| `buffer` | Show active buffer |
| `buffers` | List all buffers in session |
| `load <node-id>` | Load archive node into buffer |
| `create <text>` | Create buffer from text |
| `search <query>` | Search archive and load results |

### Transformation Commands
| Command | Description |
|---------|-------------|
| `analyze` | Analyze buffer quality |
| `detect-ai` | Run AI detection |
| `transform <desc>` | Apply custom transformation |
| `persona <id> [style]` | Apply persona rewriting |
| `split <strategy>` | Split buffer (sentences/paragraphs) |
| `merge <buffer-id>` | Merge with another buffer |

### Provenance Commands
| Command | Description |
|---------|-------------|
| `history` | Show transformation history |
| `trace` | Trace buffer to origin |

### Export Commands
| Command | Description |
|---------|-------------|
| `save [filename]` | Save buffer as markdown |
| `export-pdf [filename]` | Export as PDF with KaTeX LaTeX |
| `export-pandoc [format] [filename]` | Book-quality export (pdf/epub/docx/html/latex/odt) |

### Book Commands
| Command | Description |
|---------|-------------|
| `books` | List all books |
| `book <book-id>` | Show book details |
| `to-book <book> <chapter>` | Commit buffer to book chapter |
| `new-book <title> <query>` | Create book from search query |

### Cluster & Persona Commands
| Command | Description |
|---------|-------------|
| `clusters [discover]` | List or discover clusters |
| `cluster <id>` | Show cluster details |
| `personas` | List personas |
| `harvest <name>` | Start persona harvest |

### General Commands
| Command | Description |
|---------|-------------|
| `help [command]` | Show help |
| `status` | Show system status |
| `quit` | Exit the CLI |

---

## Full Pipeline Example

Here's a complete workflow from archive to book:

```bash
# Start the CLI
npx tsx src/cli/humanizer-cli.ts --user myuser

# Search for content
humanizer> search "productivity tips I've shared"
Loaded 12 results into buffer

# Analyze quality
humanizer> analyze
Quality Analysis:
  Overall Score: 68.2%

# Apply persona for consistent voice
humanizer> persona my-voice-persona
Persona rewriting complete
  New word count: 2845

# Check AI detection
humanizer> detect-ai
AI Detection Results:
  AI Probability: 15.2%
  Classification: Likely Human

# View the transformation history
humanizer> history
Provenance Chain: pc-x1y2z3
  Transformations: 3

# Save as markdown
humanizer> save productivity-guide.md
Saved to: ./humanizer-output/productivity-guide.md

# Create a book from it
humanizer> new-book "My Productivity System" "productivity habits workflow"
Created book: bk-p1q2r3
  Chapters: 5

# Or commit directly to existing book
humanizer> to-book bk-existing-id new-chapter
Committed to book bk-existing-id, chapter new-chapter

# Exit
humanizer> quit
```

---

## What Else Can You Do?

The AUI system provides many more capabilities accessible via the CLI or programmatically:

### Content Discovery
- **Semantic search** across your entire archive
- **Cluster discovery** to find themes in your content
- **Anchor-based refinement** to narrow search results

### Transformations
- **Persona rewriting** - Match any voice/style
- **AI detection** - Score content for AI patterns
- **Quality analysis** - Readability, formality, structure
- **Multi-pass rewriting** - Iterative improvement

### Book Creation
- **Narrative arc generation** - Chronological, thematic, dramatic, exploratory
- **Chapter composition** - From passages to coherent chapters
- **Persona integration** - Consistent voice throughout
- **Indexing** - Searchable book content

### Provenance Tracking
- **Full lineage** - Every transformation recorded
- **Branch support** - Experiment with variants
- **Origin tracing** - Find source archive nodes

### Export Options
- **Markdown** - With full metadata
- **HTML** - Formatted output
- **JSON** - Structured data
- **PDF** - Native export with styled formatting

---

## Tips

1. **Use quotes for multi-word arguments:**
   ```
   humanizer> create "This is a complete sentence."
   humanizer> new-book "My Title" "search query here"
   ```

2. **Check status anytime:**
   ```
   humanizer> status
   ```

3. **View command help:**
   ```
   humanizer> help transform
   ```

4. **Output goes to `./humanizer-output/`** - customize if needed

5. **Provenance is automatic** - Every operation is tracked

---

## Troubleshooting

**"No active buffer"**
- Run `load`, `create`, or `search` first

**"Store not available"**
- Some features require database connections
- Check `status` to see which stores are connected

**"Persona not found"**
- Create personas first via the persona harvest workflow
- Or use programmatic API to create personas

---

## Next Steps

- Explore the MCP CLI for programmatic tool access: `npx tsx src/mcp/cli.ts interactive`
- Check BQL (Buffer Query Language) for complex pipelines
- Connect to PostgreSQL for persistent sessions and books
