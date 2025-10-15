# Pipeline Implementation Plan

**Based on**: ~/humanizer-agent/ successful patterns
**Target**: humanizer_root with 1,685 conversations, 46,355 messages

---

## Overview

Implement batch processing pipelines for:
1. **Embedding generation** - Generate embeddings for all messages/chunks
2. **Transformation operations** - Batch transform content
3. **Analysis operations** - POVM measurements, clustering
4. **Export operations** - Generate reports, visualizations

---

## Architecture from humanizer-agent

### Key Components

1. **Archive Jobs Table** - Track batch operations
   ```sql
   CREATE TABLE pipeline_jobs (
       id UUID PRIMARY KEY,
       user_id UUID NOT NULL,
       job_type VARCHAR(50),  -- 'embedding', 'transformation', 'analysis'
       status VARCHAR(50),     -- 'pending', 'running', 'completed', 'failed'
       total_items INTEGER,
       processed_items INTEGER,
       failed_items INTEGER,
       result_summary JSONB,
       error_log TEXT[]
   );
   ```

2. **Job Execution Service** - Process jobs asynchronously
   - Background workers (asyncio tasks)
   - Progress tracking
   - Error handling & retry
   - Cancellation support

3. **Frontend Pipeline UI**
   - Object selection (checkboxes on conversations/messages)
   - Operation chooser (embed, transform, analyze)
   - Progress visualization
   - Result display

---

## Current State (humanizer_root)

### What We Have
- ✅ 1,685 conversations imported
- ✅ 46,355 messages stored
- ✅ 811 media files
- ✅ PostgreSQL + pgvector installed
- ✅ Ollama running (mistral:7b)
- ✅ Transformation tools (TRM + LLM)

### What's Missing
- ❌ No embeddings generated yet
- ❌ No batch operations
- ❌ No job tracking
- ❌ No pipeline UI
- ❌ No progress monitoring

---

## Phase 1: Embedding Pipeline (Priority 1)

### Backend

1. **Add embedding column to messages**
   ```sql
   ALTER TABLE chatgpt_messages
   ADD COLUMN embedding vector(384);  -- mxbai-embed-large

   CREATE INDEX idx_messages_embedding
   ON chatgpt_messages
   USING hnsw (embedding vector_cosine_ops);
   ```

2. **Embedding Service** (`humanizer/services/embedding.py`)
   ```python
   class EmbeddingService:
       def __init__(self, model="mxbai-embed-large"):
           self.model = model

       async def embed_text(self, text: str) -> List[float]:
           # Use Ollama

       async def embed_batch(self, texts: List[str]) -> List[List[float]]:
           # Batch process for efficiency

       async def embed_message(self, message_id: UUID):
           # Embed single message

       async def embed_messages_batch(self, message_ids: List[UUID]):
           # Embed multiple messages with progress
   ```

3. **Pipeline Jobs Table** (Alembic migration)
   ```python
   class PipelineJob(Base):
       __tablename__ = "pipeline_jobs"

       id: UUID
       user_id: UUID
       job_type: str  # 'embedding', 'transformation', 'analysis'
       status: str
       total_items: int
       processed_items: int
       config: dict  # JSONB
       result: dict   # JSONB
   ```

4. **Job Execution Service** (`humanizer/services/pipeline.py`)
   ```python
   class PipelineExecutor:
       async def create_embedding_job(
           self,
           message_ids: List[UUID],
           model: str = "mxbai-embed-large"
       ) -> UUID:
           # Create job
           # Start background task
           # Return job_id

       async def execute_job(self, job_id: UUID):
           # Load job
           # Process items in batches
           # Update progress
           # Handle errors
   ```

5. **API Endpoints** (`humanizer/api/pipeline.py`)
   ```python
   POST /api/pipeline/jobs/embedding
   - body: {message_ids: [...], model: "mxbai-embed-large"}
   - returns: {job_id: "...", status: "pending"}

   GET /api/pipeline/jobs/{job_id}
   - returns: {status, progress, results}

   GET /api/pipeline/jobs
   - returns: [list of all jobs]

   POST /api/pipeline/jobs/{job_id}/cancel
   - cancels running job
   ```

### Frontend

1. **Pipeline Settings Panel** (`frontend/src/components/pipeline/SettingsPanel.tsx`)
   - Embedding model selection
   - Batch size configuration
   - LLM settings

2. **Object Selection UI** (enhance ConversationList)
   - Add checkboxes to conversation list
   - "Select All" / "Clear" buttons
   - Selection counter

3. **Pipeline Actions Panel** (`frontend/src/components/pipeline/ActionsPanel.tsx`)
   - Dropdown: Choose operation (Embed, Transform, Analyze)
   - Configure operation parameters
   - "Run Pipeline" button

4. **Job Monitor** (`frontend/src/components/pipeline/JobMonitor.tsx`)
   - List of running/completed jobs
   - Progress bars
   - Real-time updates (polling or WebSocket)
   - Results display

---

## Phase 2: Batch Transformation (Priority 2)

Similar pattern to embedding:

```python
# Backend
POST /api/pipeline/jobs/transform
- body: {
    message_ids: [...],
    method: "trm",
    povm_pack: "tone",
    target_stance: {...}
  }

# Frontend
<TransformationPipeline
  selectedMessages={selectedIds}
  onComplete={(results) => { ... }}
/>
```

---

## Phase 3: Analysis Pipeline (Priority 3)

```python
POST /api/pipeline/jobs/analyze
- body: {
    message_ids: [...],
    povm_packs: ["tetralemma", "tone"],
    export_format: "csv"
  }

# Returns: Aggregate statistics, CSV export
```

---

## Implementation Order

### Week 1: Embedding Infrastructure
1. ✅ Database migration (add embedding column)
2. ✅ Embedding service (Ollama integration)
3. ✅ Pipeline jobs table
4. ✅ Basic job executor
5. ✅ API endpoints
6. ⏸ Test with 100 messages

### Week 2: Frontend Pipeline UI
1. ✅ Settings panel
2. ✅ Object selection (checkboxes)
3. ✅ Actions panel
4. ✅ Job monitor
5. ⏸ Test full workflow

### Week 3: Batch Operations
1. ✅ Transformation pipeline
2. ✅ Analysis pipeline
3. ✅ Export functionality
4. ⏸ Performance optimization

### Week 4: Polish & Scale
1. ⏸ WebSocket for real-time updates
2. ⏸ Better error handling
3. ⏸ Embed ALL 46,355 messages
4. ⏸ Performance benchmarks

---

## Embedding Strategy

### Model Choice
**mxbai-embed-large** (384 dims)
- Local via Ollama
- Good quality
- Fast enough for 46K messages

### Batch Processing
```python
# Process in batches of 50
batch_size = 50
for i in range(0, len(message_ids), batch_size):
    batch = message_ids[i:i+batch_size]

    # Get message texts
    texts = await get_message_texts(batch)

    # Generate embeddings
    embeddings = await embed_batch(texts)

    # Update database
    await update_embeddings(batch, embeddings)

    # Update job progress
    await update_job(job_id, processed=i+len(batch))
```

### Estimated Time
- 46,355 messages
- ~100ms per embedding
- Batch of 50: ~5 seconds
- Total batches: ~930
- **Total time: ~77 minutes**

Could optimize with parallel requests (5-10 simultaneous)

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│ Conversations                              [⚙️ Pipeline] │
├─────────────────────────────────────────────────────────┤
│ [✓] All (0 selected)                          [Clear]   │
│                                                          │
│ [ ] Quantum Consciousness Discussion                    │
│ [✓] Hilbert space evaluation                           │
│ [✓] TRM vs LLM comparison                              │
│ [ ] Personifier training                                │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Pipeline Actions            [2 conversations]       │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Operation: [Embed ▼]                                │ │
│ │ Model: [mxbai-embed-large ▼]                       │ │
│ │                                                      │ │
│ │ Estimate: ~200 messages, ~2 minutes                 │ │
│ │                                                      │ │
│ │ [▶️ Run Pipeline]                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Active Jobs                                         │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Embedding Job #42                     [⏸️ Pause]    │ │
│ │ ████████████░░░░░░░░  150/200 (75%)                │ │
│ │ Est. remaining: 30s                                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Can select conversations via checkboxes
- ✅ Can click "Embed" and start job
- ✅ Progress bar shows real-time updates
- ✅ Job completes successfully
- ✅ Messages now have embeddings in DB
- ✅ Can search by semantic similarity

### Phase 2 Complete When:
- ✅ Can batch transform 10+ conversations
- ✅ See transformation results
- ✅ Export to CSV/JSON

### Phase 3 Complete When:
- ✅ All 46,355 messages embedded
- ✅ Semantic search works across full corpus
- ✅ Can analyze patterns across conversations

---

## Next Steps

1. Create migration for `pipeline_jobs` table
2. Implement `EmbeddingService`
3. Create pipeline API endpoints
4. Build frontend selection UI
5. Test with 100 messages
6. Scale to full corpus

Ready to implement?
