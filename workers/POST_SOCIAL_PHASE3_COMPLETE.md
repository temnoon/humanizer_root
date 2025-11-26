# POST-SOCIAL CONFERENCING SYSTEM - PHASE 3 UPDATE
## November 24, 2025 - Curation Pipeline Implementation

---

# CURRENT STATUS

## ✅ Phase 3: Curation Queue - IMPLEMENTED

All service files are created and ready for deployment:

```
post-social-api/src/
├── config/
│   └── ai-models.ts          ✅ Full AI configuration (400+ lines)
├── middleware/
│   └── auth.ts               ✅ Updated with optionalAuth, role checks
├── routes/
│   ├── posts.ts              ✅ Updated with curation pipeline
│   ├── search.ts             ✅ NEW - Semantic search endpoints
│   └── admin.ts              ✅ NEW - Pipeline monitoring/management
├── services/
│   ├── index.ts              ✅ NEW - Barrel export
│   ├── safety-gate.ts        ✅ NEW - Llama Guard moderation
│   ├── curation.ts           ✅ NEW - Summarization, tagging, synthesis
│   ├── embeddings.ts         ✅ NEW - Vector generation, Vectorize ops
│   └── pipeline.ts           ✅ NEW - Orchestration layer
└── index.ts                  ✅ Updated with new bindings
```

---

# COMMANDS TO RUN LOCALLY

## Step 1: Apply Database Migration

```bash
cd ~/humanizer_root/workers/post-social-api
npx wrangler d1 execute post-social-db --remote --file=migrations/0002_curation_fields.sql
```

## Step 2: Create Vectorize Index (Optional but Recommended)

```bash
npx wrangler vectorize create post-social-posts --dimensions=768 --metric=cosine
```

After creating, uncomment the Vectorize binding in `wrangler.toml`:
```toml
[[vectorize]]
binding = "POST_VECTORS"
index_name = "post-social-posts"
```

## Step 3: Deploy

```bash
npx wrangler deploy
```

---

# API ENDPOINTS

## Posts API (Updated)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/posts` | POST | Required | Create post (runs curation pipeline) |
| `/api/posts` | GET | Required | List user's posts |
| `/api/posts/feed` | GET | Optional | Public feed of curated posts |
| `/api/posts/tags` | GET | None | List all tags with counts |
| `/api/posts/:id` | GET | Depends | Get post (auth for private) |
| `/api/posts/:id` | PUT | Required | Update post (triggers re-curation) |
| `/api/posts/:id` | DELETE | Required | Delete post |
| `/api/posts/:id/recurate` | POST | Required | Manually trigger re-curation |

## Search API (NEW)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/search` | POST | Optional | Semantic search |
| `/api/search/similar/:postId` | GET | Optional | Find similar posts |
| `/api/search/config` | GET | None | Get search configuration |

## Admin API (NEW)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/stats` | GET | Admin | Pipeline statistics |
| `/api/admin/config` | GET | Admin | Current AI configuration |
| `/api/admin/queue` | GET | Admin | List curation queue |
| `/api/admin/retry/:postId` | POST | Admin | Retry failed curation |
| `/api/admin/batch-retry` | POST | Admin | Retry all failed posts |
| `/api/admin/queue/clear` | DELETE | Admin | Clear completed queue |
| `/api/admin/posts/rejected` | GET | Admin | List rejected posts |
| `/api/admin/posts/:id/approve` | POST | Admin | Manually approve rejected post |

---

# CURATION PIPELINE FLOW

```
User Creates Post
       ↓
┌──────────────────┐
│   Safety Gate    │ ← Llama Guard 3 8B
│  (Llama Guard)   │
└────────┬─────────┘
         ↓
    ┌────┴────┐
    ↓         ↓
 SAFE      UNSAFE
    ↓         ↓
    ↓    [REJECTED]
    ↓
┌──────────────────┐
│    Curation      │
│ Summarize + Tag  │ ← Llama 3.1 8B
└────────┬─────────┘
         ↓
┌──────────────────┐
│   Embedding      │
│  (Vectorize)     │ ← BGE Base EN v1.5
└────────┬─────────┘
         ↓
   [CURATED] ✅
```

---

# AI MODELS CONFIGURATION

All models are configured in `/src/config/ai-models.ts`

## Active Configuration

```typescript
ACTIVE_CONFIG = {
  safety: {
    modelId: 'llama-guard-3-8b',
    promptId: 'content-check-v1',
    skipForRoles: ['admin', 'premium'],
  },
  curation: {
    modelId: 'llama-3.1-8b',       // Switch to 'llama-3.1-70b' for higher quality
    summarizePromptId: 'summarize-v1',
    tagPromptId: 'extract-tags-v1',
    curatorPromptId: 'curator-response-v1',
    synthesisPromptId: 'synthesis-v1',
    autoSynthesizeThreshold: 5,
  },
  embedding: {
    modelId: 'bge-base-en-v1.5',   // Switch to 'bge-large-en-v1.5' for better search
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
    documentPrefix: '',
  },
}
```

## To Change Models

1. Edit `ACTIVE_CONFIG` in `ai-models.ts`
2. Redeploy: `npx wrangler deploy`

---

# TESTING

## Test Post Creation with Curation

```bash
# Login first
TOKEN=$(curl -s -X POST https://npe-api.tem-527.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}' \
  | jq -r '.token')

# Create a post (will run through curation pipeline)
curl -X POST https://post-social-api.tem-527.workers.dev/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"The intersection of phenomenology and artificial intelligence raises fascinating questions about machine consciousness and the nature of understanding. Can a system truly comprehend meaning, or merely simulate comprehension?","visibility":"public"}'
```

Expected response includes:
- `status`: "curated"
- `summary`: AI-generated summary
- `tags`: ["phenomenology", "artificial-intelligence", "consciousness", ...]
- `curation.processingTimeMs`: ~2000-5000ms

## Test Semantic Search (after Vectorize is set up)

```bash
curl -X POST https://post-social-api.tem-527.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"consciousness and AI","limit":5}'
```

## Test Admin Stats

```bash
# Requires admin role
curl https://post-social-api.tem-527.workers.dev/api/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

# NEXT PHASES

## Phase 4: Semantic Search Enhancement
- [ ] Search result ranking (combine semantic + recency)
- [ ] Frontend search UI
- [ ] Tag autocomplete
- [ ] Search suggestions

## Phase 5: Synthesis Engine  
- [ ] Auto-synthesis after N comments (configured in ACTIVE_CONFIG)
- [ ] Post versioning with diff view
- [ ] Author approval workflow
- [ ] Synthesis history

## Phase 6: Curator Chat
- [ ] AI responses to comments
- [ ] Discussion facilitation
- [ ] Connection suggestions

---

# TROUBLESHOOTING

## Migration Fails

If migration fails with "column already exists", the migration may have partially run. Check table structure:

```bash
npx wrangler d1 execute post-social-db --remote \
  --command="SELECT sql FROM sqlite_master WHERE name='posts'"
```

## Curation Pipeline Errors

Check the curation queue for failed items:

```bash
npx wrangler d1 execute post-social-db --remote \
  --command="SELECT * FROM curation_queue WHERE status='failed'"
```

## Vectorize Not Working

1. Ensure index is created: `npx wrangler vectorize list`
2. Uncomment binding in wrangler.toml
3. Redeploy

---

**Document Updated**: November 24, 2025  
**Phase**: 3 - Implementation Complete, Ready for Deployment  
**Next**: Run migration, create Vectorize index, deploy, test
