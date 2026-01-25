# Content Excellence System Handoff - January 25, 2026

## Session Completed

### Implemented: 3 New Agents + Supporting Infrastructure

| Agent | File | Capabilities |
|-------|------|--------------|
| **Prospector** | `houses/prospector.ts` | Excellence scoring (5 dimensions), raw gem detection, quality clustering |
| **Refiner** | `houses/refiner.ts` | Insight extraction, expression polishing, preservation verification |
| **Archivist** | `houses/archivist.ts` | Expression indexing, canonical finding, deduplication |

### Files Created (3,437 lines)
```
packages/core/src/
├── config/
│   └── excellence-config.ts     # EXCELLENCE_CONFIG_KEYS, tier thresholds
├── houses/
│   ├── prospector.ts            # Excellence scoring agent
│   ├── refiner.ts               # Expression polishing agent
│   └── archivist.ts             # Expression indexing agent
└── storage/
    └── schema-excellence.ts     # PostgreSQL DDL (5 tables)
```

### Database Tables Created
1. `content_excellence` - Multi-dimensional scores per node
2. `expression_index` - Indexed expressions with embeddings
3. `expression_categories` - Category metadata with centroids
4. `expression_anchors` - Semantic navigation points
5. `refinement_history` - Tracks refinement operations

### Commit
`943e6d7` - feat(core): implement Content Excellence System with 3 new agents

---

## Next Session: Archive API Enhancement

### User's Vision

1. **Smart multi-level chunking** - Chunk with intermediate summary embeddings at L0/L1/Apex levels
2. **Paragraph/line hashing** - Detect copy-paste duplicates from prompts, multiple copies
3. **Image-text association** - Match images with archive descriptions, OCR text linking
4. **User vs pasted text detection** - Distinguish human-written from pasted content
5. **Batch operations at scale** - Process entire archive efficiently

### Embedding Architecture Clarification

**Production vectors**: PostgreSQL + pgvector ✅ (This is correct)
- `postgres-content-store.ts` - Main storage with vector(768) columns
- HNSW indexes for similarity search
- nomic-embed-text (768 dims) via Ollama

**ChromaDB**: ONLY used for Claude Code's MCP memory server (session context)
- This is a separate concern from production embeddings
- Acceptable for its purpose

---

## Archive API Audit Summary

### Current Capabilities ✅

| Capability | Status | Implementation |
|------------|--------|----------------|
| Smart chunking | ✅ | Cascade strategy in ChunkingService |
| Single-level embeddings | ✅ | vector(768) + HNSW in postgres-content-store |
| Vector search | ✅ | searchByEmbedding() with threshold |
| Keyword search | ✅ | tsvector with BM25 ranking |
| Hybrid search | ✅ | RRF fusion in HybridSearchService |
| Clustering | ✅ | HDBSCAN in ClusteringService |
| Duplicate detection | ✅ | SHA-256 hash at document level |
| Batch operations | ✅ | storeNodes(), storeEmbeddings() |
| Content links | ✅ | 9 link types |
| Provenance chains | ✅ | Transformation tracking |

### Missing Capabilities ❌

| Gap | Priority | Solution |
|-----|----------|----------|
| Multi-level embeddings (L0/L1/Apex) | HIGH | Integrate PyramidBuilder auto-storage |
| Paragraph/line hashing | HIGH | Fine-grained hash columns + fuzzy dedup |
| Image-OCR association | HIGH | New table + extraction service |
| User vs pasted text | MEDIUM | Pattern detection + similarity matching |
| Fuzzy near-duplicate | MEDIUM | Jaccard/MinHash similarity |
| Learned ranking | LOW | Train on feedback |
| Temporal decay | LOW | Age factor in scoring |

---

## Enhancement Plan

### Phase 1: Multi-Level Embedding Integration
- Auto-call PyramidBuilder during import
- Store L0 chunks, L1 summaries, Apex with hierarchy_level
- Cross-level unified search

### Phase 2: Fine-Grained Deduplication
- Add paragraph_hashes JSONB column
- Add line_hashes for copy-paste detection
- Track "first seen" provenance

### Phase 3: Image-Text Association
```sql
CREATE TABLE media_text_associations (
  id UUID PRIMARY KEY,
  media_id UUID REFERENCES ...,
  node_id UUID REFERENCES content_nodes,
  association_type TEXT, -- 'ocr', 'description', 'caption'
  text_span_start INTEGER,
  text_span_end INTEGER,
  extracted_text TEXT,
  confidence REAL,
  extraction_method TEXT
);
```

### Phase 4: Paste Detection
- Analyze message patterns for sudden length jumps
- Compare against known templates in expression index
- Flag "likely_pasted" sections

### Phase 5: Batch Pipeline
- Create ExcellencePipeline orchestrator
- Stages: Ingest → Chunk → Embed L0 → Summarize L1 → Apex → Score → Index
- Progress tracking, checkpoints, parallel processing

---

## Files to Modify

| File | Changes |
|------|---------|
| `postgres-content-store.ts` | Add paragraph_hashes, line_hashes; findDuplicateParagraphs() |
| `schema-postgres.ts` | Add media_text_associations, new columns |
| `embedding-service.ts` | Auto-trigger PyramidBuilder |
| `chunking/chunker.ts` | Hash per paragraph/line |
| NEW: `paste-detector.ts` | Pattern matching |
| NEW: `ocr-service.ts` | Image text extraction |
| NEW: `excellence-pipeline.ts` | Batch orchestration |

---

## Resume Commands

```bash
# ChromaDB memory lookup
mcp__chromadb-memory__search_by_tag tags:["excellence-system-handoff", "2026-01-25"]

# Full handoff retrieval
mcp__chromadb-memory__retrieve_memory query:"archive API enhancement multi-level embedding"
```

---

## Key Decisions Made

1. **Excellence scoring**: 5 dimensions (insight density, expressive power, emotional resonance, structural elegance, voice authenticity)
2. **Tier thresholds**: Excellence ≥80, Polished ≥60, Needs Refinement ≥40, Raw Gem (high insight gap)
3. **Raw gem detection**: quality_gap = insight_score - writing_score ≥ 0.3
4. **Expression indexing**: Category-based with canonical selection and similarity dedup
