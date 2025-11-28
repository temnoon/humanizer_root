# Hierarchical Chunk Summary Pyramid

## Purpose

Transform 100k+ word texts into multi-resolution semantic structure:
- Curator awareness via apex summary
- Precise passage retrieval via embeddings
- Exact quotation with citations

## Structure

```
                APEX (~500 words)
                    │
         ┌──────────┼──────────┐
         L2        L2         L2  (~250 words each)
         │          │          │
    ┌────┴────┐ ┌───┴───┐ ┌───┴───┐
    L1   L1   L1  L1  L1  L1  L1  L1  (~250 words each)
    │    │    │   │   │   │   │   │
   L0   L0  L0  L0  L0  L0  L0  L0  (~1000 tokens each)
```

## Construction

### Level 0: Base Chunking
- Target: ~1000 tokens per chunk
- Never split mid-sentence
- Prefer paragraph boundaries
- Tag with: chapter, position, type (narration/dialogue/etc)

### Level N → Level N+1
- Branching factor: 4 (4 chunks → 1 summary)
- Each summary: ~250 words
- Preserve: events, characters, themes, tone

### Apex Requirements
- Narrative arc (beginning-middle-end)
- Core themes (3-5)
- Character essences
- Voice characteristics
- "The question" - what text asks of readers

## Metrics (100k word novel)

| Level | Chunks | Words Each | Total |
|-------|--------|------------|-------|
| L0    | ~130   | ~770       | 100k  |
| L1    | ~33    | ~250       | 8k    |
| L2    | ~9     | ~250       | 2k    |
| L3    | ~3     | ~350       | 1k    |
| Apex  | 1      | ~500       | 500   |

**Embeddings per book**: ~180
**Summarization calls**: ~46
**Est. cost**: $0.15-0.30 (Llama 3.1)

## Retrieval Algorithm

```python
def retrieve_context(node_id, query, token_budget=2000):
    query_embedding = embed(query)

    # Get candidates from all levels
    candidates = search_by_similarity(query_embedding, node_id)

    # Select: high relevance + level diversity
    selected = []
    for chunk in candidates:
        if fits_budget and adds_level_diversity:
            selected.append(chunk)

    return sorted(selected, by=position)
```

## Chunk Classification

Types: `narration`, `dialogue`, `exposition`, `description`, `action`, `interior`, `mixed`

Position: `opening`, `early`, `middle`, `late`, `closing` (based on % through chapter)
