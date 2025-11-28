# ChromaDB Schema

## Collections

| Collection | Purpose |
|------------|---------|
| `node_chunks` | Level 0 text chunks (quotable) |
| `node_summaries` | Level 1+ summaries |
| `node_apexes` | Apex summaries (cross-node search) |
| `philosophy_corpus` | AUI site philosophy |
| `curator_synthesis` | Generated synthesis statements |
| `discourse_artifacts` | Inter-curator conversation outputs |

## Tag Taxonomy

### Universal
- `lifecycle`: dormant, awakened, active, mature, canonical
- `content_domain`: literature, philosophy, science, history, site_meta

### Chunks
- `pyramid_level`: L0, L1, L2, L3, apex
- `chunk_type`: narration, dialogue, exposition, description, action, interior, mixed
- `structural_position`: opening, early, middle, late, closing

### Operations
- `curator_op`: implicit_retrieval, explicit_search, quotation_source, synthesis_input
- `discourse_role`: visitor_opening, host_response, visitor_synthesis, host_synthesis
- `synthesis_source`: user_interaction, inter_curator, editorial

## Key Metadata Fields

### node_chunks (L0)
```
chunk_id, node_id, gutenberg_id
pyramid_level, chunk_index, token_count
chapter_number, chapter_title, part_number
structural_position, chunk_type
contains_dialogue, dialogue_speakers
char_start, char_end
```

### node_apexes
```
node_id, gutenberg_id, title, author
core_themes, voice_characteristics
the_question, narrative_arc
resonance_hooks (for matching)
lifecycle_state, tier
```

### curator_synthesis
```
synthesis_id, node_id
theme, synthesis_source
source_interaction_ids
version, status (draft/integrated/superseded)
```

### discourse_artifacts
```
artifact_id, conversation_id
visitor_node_id, host_node_id
discourse_role, discourse_type
reference_type, reference_strength
discovery_hook
```

## Embedding Model

`sentence-transformers/all-MiniLM-L6-v2`
