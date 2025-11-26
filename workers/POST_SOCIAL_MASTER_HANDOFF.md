# POST-SOCIAL CONFERENCING SYSTEM - COMPREHENSIVE HANDOFF
## November 24, 2025

---

# PART 1: PROJECT VISION

## What is Post-Social?

**Post-Social Network**: A conferencing system for authentic discourse that moves beyond performative identity and engagement metrics.

**Philosophy**: "Synthesis over engagement. Understanding over virality."

**Inspiration**: VAX Notes + The WELL + Usenet — topic-focused spaces where ideas flow and identities blur.

**Core Innovation**: Posts → AI Curation → Semantic Discovery → Synthesis (Git for ideas)

**Relationship to Humanizer**:
- **Humanizer.com** = Individual consciousness work (narrative transformation)
- **Post-Social** = Collective consciousness work (discourse synthesis)
- Both share authentication via npe-api

---

# PART 2: CURRENT STATUS

## ✅ Completed Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0: Foundation | ✅ Complete | Database, config, workers |
| 1: OAuth Design | ✅ Complete | Architecture documented |
| 2: OAuth Implementation | ✅ Complete | GitHub working, Google ready |
| 3: Curation Queue | ✅ Complete | AI safety, summarization, tagging, embeddings |

## 🎯 Next Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 4: Search UI | 🎯 Next | Frontend search interface, tag browsing |
| 5: Synthesis Engine | Pending | Post evolution, versioning, Git for ideas |
| 6: Curator Chat | Pending | AI responds to comments, facilitates discussion |
| 7: Conferences | Pending | Topic-focused spaces/rooms |

---

# PART 3: ARCHITECTURE

```
humanizer_root/workers/
├── npe-api/                    # Auth Authority (production)
│   ├── JWT generation          ✅ Working
│   ├── Email/password login    ✅ Working
│   ├── OAuth (GitHub, Google)  ✅ Working
│   └── D1: npe-production-db
│
├── post-social-api/            # Content + AI Service (production)
│   ├── JWT validation          ✅ Working
│   ├── Posts CRUD              ✅ Working
│   ├── Safety Gate (Llama Guard) ✅ Working
│   ├── AI Curation (Llama 3.1) ✅ Working
│   ├── Embeddings (BGE)        ✅ Working
│   ├── Semantic Search         ✅ Working
│   ├── D1: post-social-db
│   └── Vectorize: post-social-posts
│
├── post-social-frontend/       # Web UI (production)
│   ├── Landing page            ✅ Working
│   ├── OAuth login             ✅ Working
│   ├── Dashboard               ✅ Working
│   └── Custom domain           ✅ post-social.humanizer.com
│
└── Documentation
    ├── POST_SOCIAL_HANDOFF.md
    └── POST_SOCIAL_PHASE3_COMPLETE.md
```

## Live URLs

| Service | Workers.dev URL | Custom Domain |
|---------|-----------------|---------------|
| Auth API | https://npe-api.tem-527.workers.dev | — |
| Content API | https://post-social-api.tem-527.workers.dev | — |
| Frontend | https://post-social-frontend.tem-527.workers.dev | https://post-social.humanizer.com ✅ |

---

# PART 4: FILE STRUCTURE

## post-social-api (Main Service)

```
/Users/tem/humanizer_root/workers/post-social-api/
├── src/
│   ├── index.ts                    # Main Hono app with bindings
│   ├── config/
│   │   └── ai-models.ts            # All AI model configs (400+ lines)
│   ├── middleware/
│   │   └── auth.ts                 # JWT validation, role checks
│   ├── routes/
│   │   ├── posts.ts                # Posts CRUD + curation pipeline
│   │   ├── search.ts               # Semantic search endpoints
│   │   └── admin.ts                # Pipeline monitoring
│   └── services/
│       ├── index.ts                # Barrel export
│       ├── safety-gate.ts          # Llama Guard moderation
│       ├── curation.ts             # Summarization, tagging
│       ├── embeddings.ts           # Vector generation, Vectorize
│       └── pipeline.ts             # Orchestration layer
├── migrations/
│   ├── 0001_initial_schema.sql     # posts, reactions, comments
│   └── 0002_curation_fields.sql    # AI curation fields, tags, versions
├── wrangler.toml                   # D1, AI, Vectorize bindings
├── package.json
└── .dev.vars.example
```

## npe-api (Authentication)

```
/Users/tem/humanizer_root/workers/npe-api/
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── llm-models.ts
│   │   └── oauth-providers.ts
│   ├── middleware/
│   │   └── auth.ts                 # JWT generation
│   ├── routes/
│   │   ├── auth.ts                 # /auth/login, /auth/register
│   │   └── oauth.ts                # /auth/oauth/:provider/*
│   └── services/
│       └── oauth.ts
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0020_oauth_accounts.sql
├── wrangler.toml
└── .dev.vars
```

## post-social-frontend (UI)

```
/Users/tem/humanizer_root/workers/post-social-frontend/
├── src/
│   └── index.ts                    # Hono app serving HTML
├── wrangler.toml
└── package.json
```

---

# PART 5: DATABASE SCHEMAS

## npe-production-db (Auth)

```sql
-- Core users table
users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,      -- 'OAUTH_ONLY' for OAuth users
    role TEXT DEFAULT 'free',         -- admin, premium, pro, member, free
    auth_method TEXT DEFAULT 'password',
    created_at INTEGER,
    last_login INTEGER,
    monthly_transformations INTEGER,
    monthly_tokens_used INTEGER,
    last_reset_date INTEGER
)

-- OAuth linked accounts
oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,           -- google, github
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_username TEXT,
    provider_avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(provider, provider_user_id)
)
```

## post-social-db (Content)

```sql
-- Posts with AI curation fields
posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    visibility TEXT DEFAULT 'public',  -- public, friends, private
    status TEXT DEFAULT 'pending',     -- pending, approved, rejected, curated
    safety_check TEXT,                 -- JSON: {safe, category, reason}
    summary TEXT,                      -- AI-generated summary (280 chars)
    tags TEXT,                         -- JSON array of tags
    embedding_id TEXT,                 -- Reference to Vectorize
    curation_model TEXT,               -- Model used for curation
    curated_at INTEGER,
    version INTEGER DEFAULT 1,
    parent_version_id TEXT,
    created_at INTEGER,
    updated_at INTEGER
)

-- Tags for browsing
tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    post_count INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
)

-- Post-tag relationship
post_tags (
    post_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (post_id, tag_id)
)

-- Curation queue tracking
curation_queue (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'queued',      -- queued, processing, completed, failed
    stage TEXT,                        -- safety, summarize, tags, embed
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    queued_at INTEGER,
    started_at INTEGER,
    completed_at INTEGER
)

-- Post synthesis history
post_versions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT,
    synthesis_model TEXT,
    comment_count_at_synthesis INTEGER,
    author_approved INTEGER DEFAULT 0,
    created_at INTEGER,
    UNIQUE(post_id, version)
)

-- Curator AI responses
curator_responses (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    comment_id TEXT,
    response_content TEXT NOT NULL,
    model_used TEXT NOT NULL,
    prompt_id TEXT NOT NULL,
    tokens_used INTEGER,
    created_at INTEGER
)

-- Reactions and comments (from 0001)
reactions (...)
comments (...)
```

---

# PART 6: API ENDPOINTS

## Posts API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/posts` | POST | Required | Create post (runs curation pipeline) |
| `/api/posts` | GET | Required | List user's posts (with filters) |
| `/api/posts/feed` | GET | Optional | Public feed of curated posts |
| `/api/posts/tags` | GET | None | List all tags with counts |
| `/api/posts/:id` | GET | Depends | Get post (auth for private) |
| `/api/posts/:id` | PUT | Required | Update post (triggers re-curation) |
| `/api/posts/:id` | DELETE | Required | Delete post |
| `/api/posts/:id/recurate` | POST | Required | Manually trigger re-curation |

## Search API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/search` | POST | Optional | Semantic search for posts |
| `/api/search/similar/:postId` | GET | Optional | Find similar posts |
| `/api/search/config` | GET | None | Get search configuration |

## Admin API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/stats` | GET | Admin | Pipeline statistics |
| `/api/admin/config` | GET | Admin | Current AI configuration |
| `/api/admin/queue` | GET | Admin | List curation queue |
| `/api/admin/retry/:postId` | POST | Admin | Retry failed curation |
| `/api/admin/batch-retry` | POST | Admin | Retry all failed posts |
| `/api/admin/queue/clear` | DELETE | Admin | Clear completed queue |
| `/api/admin/posts/rejected` | GET | Admin | List rejected posts |
| `/api/admin/posts/:id/approve` | POST | Admin | Manually approve rejected |

---

# PART 7: AI CURATION PIPELINE

## Flow Diagram

```
User Creates Post
       ↓
┌──────────────────┐
│   Safety Gate    │ ← Llama Guard 3 8B
│  (Llama Guard)   │   Skipped for admin/premium
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
│ Summarize + Tag  │ ← Llama 3.1 8B (parallel)
└────────┬─────────┘
         ↓
┌──────────────────┐
│   Embedding      │
│  (Vectorize)     │ ← BGE Base EN v1.5 (768 dims)
└────────┬─────────┘
         ↓
   [CURATED] ✅
   ~2-3 seconds total
```

## AI Configuration

All models configured in `/src/config/ai-models.ts`:

```typescript
ACTIVE_CONFIG = {
  safety: {
    modelId: 'llama-guard-3-8b',
    promptId: 'content-check-v1',
    skipForRoles: ['admin', 'premium'],
  },
  curation: {
    modelId: 'llama-3.1-8b',       // or 'llama-3.1-70b' for quality
    summarizePromptId: 'summarize-v1',
    tagPromptId: 'extract-tags-v1',
    curatorPromptId: 'curator-response-v1',
    synthesisPromptId: 'synthesis-v1',
    autoSynthesizeThreshold: 5,
  },
  embedding: {
    modelId: 'bge-base-en-v1.5',   // 768 dimensions
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
    documentPrefix: '',
  },
}
```

To change models: Edit `ACTIVE_CONFIG` and redeploy.

---

# PART 8: AUTHENTICATION

## JWT Flow

1. User logs in via npe-api (password or OAuth)
2. npe-api generates JWT signed with `JWT_SECRET`
3. Frontend stores token in localStorage
4. post-social-api validates token with same `JWT_SECRET`

## Critical: Both workers MUST have identical JWT_SECRET

```bash
# Set on both workers
cd ~/humanizer_root/workers/npe-api
npx wrangler secret put JWT_SECRET

cd ~/humanizer_root/workers/post-social-api
npx wrangler secret put JWT_SECRET
# Use the SAME value!
```

## Test User (Admin)

- Email: dreegle@gmail.com
- Role: admin
- Login: GitHub OAuth

---

# PART 9: DEVELOPMENT COMMANDS

## Starting Fresh Session

```bash
# 1. Read this handoff
cat ~/humanizer_root/workers/POST_SOCIAL_MASTER_HANDOFF.md

# 2. Check git status
cd ~/humanizer_root && git status

# 3. Start local development
cd ~/humanizer_root/workers/npe-api && npx wrangler dev &
cd ~/humanizer_root/workers/post-social-api && npx wrangler dev &
cd ~/humanizer_root/workers/post-social-frontend && npx wrangler dev &
```

## Deployment

```bash
# Deploy all workers
cd ~/humanizer_root/workers/npe-api && npx wrangler deploy
cd ~/humanizer_root/workers/post-social-api && npx wrangler deploy
cd ~/humanizer_root/workers/post-social-frontend && npx wrangler deploy
```

## Database Operations

```bash
# Apply migration
cd ~/humanizer_root/workers/post-social-api
npx wrangler d1 execute post-social-db --remote --file=migrations/XXXX.sql

# Query database
npx wrangler d1 execute post-social-db --remote --command="SELECT * FROM posts LIMIT 5"

# Check tables
npx wrangler d1 execute post-social-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Vectorize Operations

```bash
# List indexes
npx wrangler vectorize list

# Create index (already done)
npx wrangler vectorize create post-social-posts --dimensions=768 --metric=cosine

# Delete index (careful!)
npx wrangler vectorize delete post-social-posts
```

---

# PART 10: TESTING EXAMPLES

## Get Auth Token

```bash
# Login via browser at https://post-social.humanizer.com
# Then in browser console:
localStorage.getItem('token')
```

## Create Post with Curation

```bash
TOKEN="your-jwt-token"

curl -X POST https://post-social-api.tem-527.workers.dev/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "content": "Your post content here...",
    "visibility": "public"
  }'
```

Expected response:
```json
{
  "id": "uuid",
  "status": "curated",
  "summary": "AI-generated summary...",
  "tags": ["tag1", "tag2", "tag3"],
  "curation": {
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "processingTimeMs": 2500,
    "embeddingIndexed": true
  }
}
```

## Semantic Search

```bash
# Anonymous search
curl -X POST https://post-social-api.tem-527.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "phenomenology consciousness", "limit": 5}'

# Authenticated search (includes private)
curl -X POST https://post-social-api.tem-527.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "phenomenology consciousness", "limit": 5, "includePrivate": true}'
```

## Admin Stats

```bash
curl https://post-social-api.tem-527.workers.dev/api/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

## Public Feed

```bash
curl https://post-social-api.tem-527.workers.dev/api/posts/feed
```

## Tags List

```bash
curl https://post-social-api.tem-527.workers.dev/api/posts/tags
```

---

# PART 11: CURRENT DATA

## Posts in System (3)

1. **Phenomenology/Husserl Post**
   - Tags: `artificial-intelligence`, `phenomenology`, `machine-consciousness`, `embodied-cognition`, `human-flourishing`
   - Relevance: High for AI/consciousness queries

2. **Nāgārjuna/Quantum Post**
   - Tags: `buddhism`, `quantum-mechanics`, `artificial-intelligence`, `relational-ontology`, `philosophy-of-science`
   - Relevance: High for Buddhism/quantum queries

3. **Test Post**
   - Tags: `self-improvement`, `personal-growth`, `motivation`
   - Content: "This is a new post. My favorite post of all time!!"

## Tags Index (8 unique tags)

All tags have `post_count: 1` currently.

---

# PART 12: NEXT STEPS

## Phase 4: Search UI Enhancement

- [ ] Frontend search interface with input field
- [ ] Display search results with summaries and tags
- [ ] Tag cloud/browser component
- [ ] Filter by tag
- [ ] Search suggestions/autocomplete
- [ ] "Similar posts" section on post detail view

## Phase 5: Synthesis Engine

- [ ] Auto-trigger synthesis after N comments (configurable)
- [ ] Create new post version with synthesized content
- [ ] Diff view showing changes between versions
- [ ] Author approval workflow for synthesized versions
- [ ] Version history UI

## Phase 6: Curator Chat

- [ ] AI responses to comments using `curator-response-v1` prompt
- [ ] Store responses in `curator_responses` table
- [ ] Display curator responses in comment thread
- [ ] Configurable response frequency

## Phase 7: Conferences

- [ ] Conference/room schema
- [ ] Topic-focused spaces
- [ ] Cross-post synthesis within conference
- [ ] Conference-level semantic search

---

# PART 13: WRANGLER CONFIGURATION

## post-social-api/wrangler.toml

```toml
name = "post-social-api"
main = "src/index.ts"
compatibility_date = "2025-11-23"
compatibility_flags = ["nodejs_compat"]

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "post-social-db"
database_id = "f8211afc-1d62-4d39-b133-48855d7fa2e0"

# Workers AI
[ai]
binding = "AI"

# Vectorize for semantic search
[[vectorize]]
binding = "POST_VECTORS"
index_name = "post-social-posts"

# Environment variables
[vars]
ENVIRONMENT = "production"
```

## Environment Bindings (TypeScript)

```typescript
type Bindings = {
  DB: D1Database;
  KV?: KVNamespace;
  AI: Ai;
  POST_VECTORS?: VectorizeIndex;
  CURATION_QUEUE?: Queue;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
};
```

---

# PART 14: TROUBLESHOOTING

## Token Validation Fails

1. Ensure JWT_SECRET is identical on both npe-api and post-social-api
2. After changing secret, redeploy BOTH workers
3. User must log out and log back in for new token

```bash
# Check secrets are set
cd ~/humanizer_root/workers/npe-api && npx wrangler secret list
cd ~/humanizer_root/workers/post-social-api && npx wrangler secret list
```

## Curation Pipeline Fails

Check queue for errors:
```bash
npx wrangler d1 execute post-social-db --remote \
  --command="SELECT * FROM curation_queue WHERE status='failed'"
```

Retry failed posts via admin API or:
```bash
curl -X POST https://post-social-api.tem-527.workers.dev/api/admin/batch-retry \
  -H "Authorization: Bearer $TOKEN"
```

## Search Returns No Results

1. Verify posts are status='curated'
2. Check Vectorize index exists: `npx wrangler vectorize list`
3. Verify embeddings indexed: check `embedding_id` in posts table

## Migration Errors

If "column already exists":
```bash
# Check current schema
npx wrangler d1 execute post-social-db --remote \
  --command="SELECT sql FROM sqlite_master WHERE name='posts'"
```

---

# PART 15: KEY DESIGN DECISIONS

1. **No hardcoded LLMs** - All models in `ai-models.ts`, change `ACTIVE_CONFIG` to switch
2. **Visibility filtering in SQL** - More reliable than Vectorize metadata filtering
3. **Safety skip for trusted roles** - Admin/premium bypass Llama Guard (configurable)
4. **Parallel curation** - Summary and tags generated simultaneously
5. **Fail-open safety** - On AI errors, posts approved (better UX, logs errors)
6. **Combined embedding text** - Summary + content for richer semantic vectors

---

# PART 16: PROJECT PHILOSOPHY

From Edward's vision:

> "Post-social" means moving beyond the performative nature of social media. Instead of optimizing for engagement, we optimize for understanding. Instead of viral spread, we seek synthesis.

> The platform should feel like the best of early internet discourse - thoughtful, topic-focused, identity-light - enhanced with AI that serves authentic connection rather than addiction.

> Comments don't just react; they contribute to an evolving understanding. Posts aren't static; they synthesize community wisdom. Identity isn't performed; it's dissolved into collective insight.

Key philosophical influences:
- Husserl's phenomenology (intentionality)
- Merleau-Ponty's embodied cognition
- Nāgārjuna's śūnyatā (emptiness/relationality)
- Alan Watts on authentic Being vs. social personas

---

**Document Created**: November 24, 2025
**Last Updated**: November 24, 2025
**Phase**: 3 Complete, Phase 4 Ready
**Author**: Claude (with Edward)
