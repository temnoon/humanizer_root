# Implementation Tasks

## Order

| Priority | Task | Est. Hours |
|----------|------|------------|
| 1 | ChromaDB Setup | 2-3 |
| 2 | Gutenberg Preprocessor | 3-4 |
| 3 | Semantic Chunker | 3-4 |
| 4 | Pyramid Builder | 4-5 |
| 5 | Search Tool | 2-3 |
| 6 | Discourse Engine | 4-5 |

## Task 1: ChromaDB Setup

**File**: `workers/post-social-api/src/db/chroma_setup.py`

Create collections: node_chunks, node_summaries, node_apexes, philosophy_corpus, curator_synthesis, discourse_artifacts

Helpers: `get_or_create_collection()`, `add_with_tags()`, `query_by_tags()`

## Task 2: Gutenberg Preprocessor

**File**: `workers/post-social-api/src/pipeline/gutenberg_preprocessor.py`

- `strip_gutenberg_header_footer()`
- `detect_structure()` - find chapter/part markers
- `normalize_paragraphs()`
- `split_by_structure()` → List[StructuralUnit]

Test with: Moby Dick, Pride & Prejudice, War & Peace

## Task 3: Semantic Chunker

**File**: `workers/post-social-api/src/pipeline/semantic_chunker.py`

- Target ~1000 tokens/chunk, max 1200
- Never split mid-sentence
- Classify: narration/dialogue/exposition/etc
- Extract dialogue speakers
- Assign structural position

## Task 4: Pyramid Builder

**File**: `workers/post-social-api/src/pipeline/pyramid_builder.py`

- `build_pyramid(level_0_chunks, node_metadata) → Pyramid`
- Branching factor: 4
- Summarization prompt preserves events/themes/tone
- Apex enrichment: themes, voice, question, arc, hooks

## Task 5: Search Tool

**File**: `workers/post-social-api/src/curator/search_tool.py`

```python
async def search_corpus(
    node_id: str,
    query: str,
    max_results: int = 5,
    level: int | str = 0
) -> List[QuotablePassage]
```

Returns quotable text with chapter citation.

## Task 6: Discourse Engine

**File**: `workers/post-social-api/src/discourse/curator_discourse.py`

- `initiate_visit(visitor_id, host_id, discourse_type)`
- `find_visitation_candidates(node_id)`
- Generate: transcript, synthesis (both), cross-reference

## LLM Configuration

**Model**: Llama 70B via Cloudflare Workers AI
**Embedding**: all-MiniLM-L6-v2

## First Proof-of-Concept

1. Single node: Moby Dick
2. Build pyramid
3. Test curator interaction with search tool
4. Verify quotation with citation
