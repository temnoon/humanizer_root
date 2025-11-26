# POST-SOCIAL CONFERENCING SYSTEM - MASTER HANDOFF
## November 24, 2025

---

# PART 1: PROJECT OVERVIEW

## Vision

**Post-Social Network**: A conferencing system for authentic discourse, moving beyond performative identity.

**Philosophy**: "Synthesis over engagement. Understanding over virality."

**Inspiration**: VAX Notes + The WELL + Usenet — topic-focused spaces where ideas flow and identities blur.

**Core Innovation**: Comments → AI Curation → Synthesis (Git for ideas)

**Relationship to Humanizer**: 
- Humanizer.com = Individual consciousness work (narrative transformation)
- Post-Social = Collective consciousness work (discourse synthesis)
- Both share authentication via npe-api

---

# PART 2: CURRENT ARCHITECTURE

```
humanizer_root/workers/
├── npe-api/                    # Auth Authority (port 8787)
│   ├── JWT generation          # Shared across all workers
│   ├── Email/password login    ✅ Working
│   ├── OAuth (GitHub)          ✅ Working
│   └── D1: npe-production-db
│
├── post-social-api/            # Content Service (port 8788)
│   ├── JWT validation          ✅ Working
│   ├── Posts CRUD              ✅ Working
│   └── D1: post-social-db
│
├── post-social-frontend/       # Web UI (port 8790)
│   ├── Landing page            ✅ Working
│   ├── GitHub OAuth login      ✅ Working
│   ├── Email/password login    ✅ Working
│   ├── Dashboard               ✅ Working
│   └── Custom domain: post-social.humanizer.com ✅
│
└── shared/
    └── types.ts                # Shared TypeScript types
```

## Live URLs

| Service | Workers.dev URL | Custom Domain |
|---------|-----------------|---------------|
| Auth API | https://npe-api.tem-527.workers.dev | (pending) npe-api.humanizer.com |
| Content API | https://post-social-api.tem-527.workers.dev | (pending) |
| Frontend | https://post-social-frontend.tem-527.workers.dev | https://post-social.humanizer.com ✅ |

---

# PART 3: FILE LOCATIONS

## npe-api (Authentication)

```
/Users/tem/humanizer_root/workers/npe-api/
├── src/
│   ├── index.ts                    # Main Hono app
│   ├── config/
│   │   ├── llm-models.ts           # LLM configurations
│   │   └── oauth-providers.ts      # OAuth provider configs
│   ├── middleware/
│   │   └── auth.ts                 # JWT generation/validation
│   ├── routes/
│   │   ├── auth.ts                 # /auth/login, /auth/register
│   │   ├── oauth.ts                # /auth/oauth/:provider/*
│   │   └── [other routes...]
│   └── services/
│       └── oauth.ts                # OAuth business logic
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0020_oauth_accounts.sql     # OAuth tables
│   └── [0002-0019...]
├── wrangler.toml
├── package.json
└── .dev.vars                       # Local secrets (JWT_SECRET, OAuth creds)
```

## post-social-api (Content)

```
/Users/tem/humanizer_root/workers/post-social-api/
├── src/
│   ├── index.ts                    # Main Hono app
│   ├── middleware/
│   │   └── auth.ts                 # JWT validation (no generation)
│   └── routes/
│       └── posts.ts                # /api/posts CRUD
├── migrations/
│   └── 0001_initial_schema.sql     # posts, reactions, comments
├── wrangler.toml
├── package.json
└── .dev.vars.example
```

## post-social-frontend (UI)

```
/Users/tem/humanizer_root/workers/post-social-frontend/
├── src/
│   └── index.ts                    # Hono app serving HTML
├── wrangler.toml
└── package.json
```

## Documentation

```
/Users/tem/humanizer_root/workers/
├── POST_SOCIAL_QUICK_REF.md        # Quick commands
├── POST_SOCIAL_SESSION_COMPLETE.md # Session notes
├── UNIFIED_AUTH_ARCHITECTURE.md    # Auth flow docs
├── OAUTH_IMPLEMENTATION.md         # OAuth docs
└── SESSION_SUMMARY.md
```

---

# PART 4: DATABASE SCHEMAS

## npe-production-db (Auth)

```sql
-- Core users table
users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,      -- 'OAUTH_ONLY' for OAuth users
    role TEXT DEFAULT 'free',         -- admin, premium, pro, member, free
    auth_method TEXT DEFAULT 'password', -- password, oauth, webauthn, mixed
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
    provider TEXT NOT NULL,           -- google, github, discord, facebook, apple
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

-- OAuth CSRF protection
oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    redirect_uri TEXT,
    created_at INTEGER,
    expires_at INTEGER
)
```

## post-social-db (Content)

```sql
-- Posts
posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    visibility TEXT DEFAULT 'public',  -- public, friends, private
    created_at INTEGER,
    updated_at INTEGER
)

-- Reactions
reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,               -- like, love, laugh, sad, angry
    created_at INTEGER,
    UNIQUE(post_id, user_id, type)
)

-- Comments
comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
)
```

---

# PART 5: PHASE STATUS

| Phase | Status | Description |
|-------|--------|-------------|
| 0: Foundation | ✅ Complete | Database, config, docs |
| 0.1: Safety Gate | ❌ Not started | Llama Guard moderation |
| 1: OAuth Design | ✅ Complete | Architecture documented |
| 2: OAuth Implementation | ✅ Complete | GitHub working, others ready |
| 3: Curation Queue | 🎯 NEXT | AI summarization, tagging, embeddings |
| 4: Semantic Search | ❌ Pending | Vectorize query |
| 5: Synthesis Engine | ❌ Pending | Post evolution, Git for ideas |
| 6: Personal Notebooks | ❌ Pending | Save insights, chat with notes |
| 7: Conferences | ❌ Pending | Topic-focused spaces |

---

# PART 6: NEXT PHASE - CURATION QUEUE

## Overview

The Curation Queue processes posts through AI:
1. **Safety Gate** - Llama Guard checks for harmful content
2. **Summarization** - Llama-3 creates concise summary
3. **Tagging** - Extract topic tags
4. **Embedding** - Generate vectors for semantic search
5. **Curator Response** - AI responds to comments

## Architecture

```
User Post → Safety Gate → Approved? 
                              ↓ Yes
                         Curation Queue
                              ↓
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
         Summarize         Tag           Embed
              ↓               ↓               ↓
              └───────────────┼───────────────┘
                              ↓
                    Store in Database
                              ↓
                    Index in Vectorize
```

## Required Files to Create

```
post-social-api/
├── src/
│   ├── config/
│   │   └── ai-models.ts            # 🆕 LLM configuration (NO HARDCODING)
│   ├── services/
│   │   ├── safety-gate.ts          # 🆕 Llama Guard moderation
│   │   ├── curation.ts             # 🆕 Summarization, tagging
│   │   ├── embeddings.ts           # 🆕 Vector generation
│   │   └── curator-chat.ts         # 🆕 AI comment responses
│   └── routes/
│       ├── posts.ts                # Update to use curation
│       └── search.ts               # 🆕 Semantic search
├── migrations/
│   ├── 0002_curation_fields.sql    # 🆕 Add summary, tags, status
│   └── 0003_curator_responses.sql  # 🆕 AI responses table
└── wrangler.toml                   # Add Vectorize, Queue bindings
```

---

# PART 7: AI MODEL CONFIGURATION

## CRITICAL: No Hardcoded Models

All AI models, prompts, and parameters MUST be in configuration files.

### Create: `/post-social-api/src/config/ai-models.ts`

```typescript
// AI Model Configuration
// All models, prompts, and parameters are configurable here
// NO HARDCODED MODEL NAMES OR PROMPTS IN SERVICE FILES

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'cloudflare' | 'openai' | 'anthropic' | 'ollama';
  model: string;
  maxTokens: number;
  temperature: number;
  // Provider-specific options
  options?: Record<string, unknown>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;  // Use {{variable}} for interpolation
  // Expected output format
  outputFormat?: 'text' | 'json';
  outputSchema?: Record<string, unknown>;
}

export interface EmbeddingConfig {
  id: string;
  name: string;
  provider: 'cloudflare' | 'openai';
  model: string;
  dimensions: number;
}

// ============================================
// SAFETY GATE CONFIGURATION
// ============================================

export const SAFETY_MODELS: Record<string, ModelConfig> = {
  default: {
    id: 'safety-default',
    name: 'Llama Guard 3 8B',
    provider: 'cloudflare',
    model: '@cf/meta/llama-guard-3-8b',
    maxTokens: 100,
    temperature: 0,
  },
  // Add alternative safety models here
  // llamaGuard11B: { ... }
};

export const SAFETY_PROMPTS: Record<string, PromptTemplate> = {
  default: {
    id: 'safety-check',
    name: 'Content Safety Check',
    description: 'Check if content violates safety guidelines',
    systemPrompt: `You are a content safety classifier. Analyze the following content and determine if it violates any safety guidelines.

Categories to check:
- S1: Violence and Threats
- S2: Hate Speech and Discrimination  
- S3: Sexual Content
- S4: Self-Harm
- S5: Illegal Activities
- S6: Personal Information Exposure
- S7: Spam and Manipulation

Respond with ONLY a JSON object.`,
    userPromptTemplate: `Analyze this content for safety:

{{content}}

Respond with JSON: {"safe": boolean, "category": string|null, "reason": string|null}`,
    outputFormat: 'json',
  },
};

// ============================================
// CURATION CONFIGURATION
// ============================================

export const CURATION_MODELS: Record<string, ModelConfig> = {
  default: {
    id: 'curation-default',
    name: 'Llama 3.1 8B Instruct',
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.1-8b-instruct',
    maxTokens: 500,
    temperature: 0.3,
  },
  advanced: {
    id: 'curation-advanced',
    name: 'Llama 3.1 70B Instruct',
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.1-70b-instruct',
    maxTokens: 500,
    temperature: 0.3,
  },
  // For future: OpenAI, Anthropic options
  // gpt4: {
  //   id: 'curation-gpt4',
  //   name: 'GPT-4 Turbo',
  //   provider: 'openai',
  //   model: 'gpt-4-turbo-preview',
  //   maxTokens: 500,
  //   temperature: 0.3,
  // },
};

export const CURATION_PROMPTS: Record<string, PromptTemplate> = {
  summarize: {
    id: 'summarize',
    name: 'Post Summarization',
    description: 'Create concise summary of post content',
    systemPrompt: `You are a skilled summarizer for a discourse platform. Create concise, meaningful summaries that capture the essence of posts. Be neutral and objective.`,
    userPromptTemplate: `Summarize this post in 1-2 sentences (max 280 characters):

{{content}}

Summary:`,
    outputFormat: 'text',
  },
  
  extractTags: {
    id: 'extract-tags',
    name: 'Tag Extraction',
    description: 'Extract topic tags from content',
    systemPrompt: `You are a topic classifier for a discourse platform. Extract relevant topic tags from content. Return only lowercase, hyphenated tags.`,
    userPromptTemplate: `Extract 3-5 topic tags from this content:

{{content}}

Respond with JSON: {"tags": ["tag-one", "tag-two", ...]}`,
    outputFormat: 'json',
  },
  
  curatorResponse: {
    id: 'curator-response',
    name: 'Curator Comment Response',
    description: 'AI curator responds to comments with insights',
    systemPrompt: `You are a thoughtful curator for a discourse platform focused on authentic discussion. Your role is to:
- Synthesize ideas across comments
- Ask clarifying questions
- Point out interesting connections
- Encourage deeper exploration
- Never be preachy or condescending

Keep responses brief (2-3 sentences). Be genuinely curious.`,
    userPromptTemplate: `Original post:
{{postContent}}

Comment thread:
{{comments}}

New comment to respond to:
{{newComment}}

Curator response:`,
    outputFormat: 'text',
  },
};

// ============================================
// EMBEDDING CONFIGURATION
// ============================================

export const EMBEDDING_MODELS: Record<string, EmbeddingConfig> = {
  default: {
    id: 'embed-default',
    name: 'BGE Base EN v1.5',
    provider: 'cloudflare',
    model: '@cf/baai/bge-base-en-v1.5',
    dimensions: 768,
  },
  large: {
    id: 'embed-large',
    name: 'BGE Large EN v1.5',
    provider: 'cloudflare',
    model: '@cf/baai/bge-large-en-v1.5',
    dimensions: 1024,
  },
  // For future: OpenAI embeddings
  // openai: {
  //   id: 'embed-openai',
  //   name: 'text-embedding-3-small',
  //   provider: 'openai',
  //   model: 'text-embedding-3-small',
  //   dimensions: 1536,
  // },
};

// ============================================
// ACTIVE CONFIGURATION
// ============================================

// Change these to switch models across the system
export const ACTIVE_CONFIG = {
  safety: {
    model: 'default',
    prompt: 'default',
  },
  curation: {
    model: 'default',  // Change to 'advanced' for 70B model
    summarizePrompt: 'summarize',
    tagPrompt: 'extractTags',
    responsePrompt: 'curatorResponse',
  },
  embedding: {
    model: 'default',  // Change to 'large' for larger embeddings
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getActiveModel(category: 'safety' | 'curation' | 'embedding'): ModelConfig | EmbeddingConfig {
  switch (category) {
    case 'safety':
      return SAFETY_MODELS[ACTIVE_CONFIG.safety.model];
    case 'curation':
      return CURATION_MODELS[ACTIVE_CONFIG.curation.model];
    case 'embedding':
      return EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.model];
  }
}

export function getPrompt(category: 'safety' | 'curation', promptId: string): PromptTemplate {
  switch (category) {
    case 'safety':
      return SAFETY_PROMPTS[promptId];
    case 'curation':
      return CURATION_PROMPTS[promptId];
  }
}

export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}
```

---

# PART 8: IMPLEMENTATION STEPS FOR PHASE 3

## Step 1: Create AI Configuration (above)

```bash
mkdir -p ~/humanizer_root/workers/post-social-api/src/config
# Create ai-models.ts with the configuration above
```

## Step 2: Database Migration

Create `/post-social-api/migrations/0002_curation_fields.sql`:

```sql
-- Add curation fields to posts
ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'pending' 
  CHECK(status IN ('pending', 'approved', 'rejected', 'curated'));
ALTER TABLE posts ADD COLUMN safety_check TEXT;  -- JSON: {safe, category, reason}
ALTER TABLE posts ADD COLUMN summary TEXT;
ALTER TABLE posts ADD COLUMN tags TEXT;  -- JSON array
ALTER TABLE posts ADD COLUMN embedding_id TEXT;  -- Reference to Vectorize
ALTER TABLE posts ADD COLUMN curated_at INTEGER;

CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_curated ON posts(curated_at);

-- Curator responses
CREATE TABLE curator_responses (
    id TEXT PRIMARY KEY,
    post_id TEXT,
    comment_id TEXT,
    response TEXT NOT NULL,
    model_used TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_curator_responses_post ON curator_responses(post_id);
```

## Step 3: Update wrangler.toml

Add to `/post-social-api/wrangler.toml`:

```toml
# AI binding
[ai]
binding = "AI"

# Vectorize for semantic search
[[vectorize]]
binding = "POST_VECTORS"
index_name = "post-social-posts"

# Queue for async curation
[[queues.producers]]
queue = "curation-queue"
binding = "CURATION_QUEUE"

[[queues.consumers]]
queue = "curation-queue"
max_batch_size = 10
max_batch_timeout = 30
```

## Step 4: Create Service Files

### safety-gate.ts
```typescript
import { ACTIVE_CONFIG, getActiveModel, getPrompt, interpolatePrompt } from '../config/ai-models';

export interface SafetyResult {
  safe: boolean;
  category: string | null;
  reason: string | null;
  model: string;
}

export async function checkSafety(ai: any, content: string): Promise<SafetyResult> {
  const modelConfig = getActiveModel('safety');
  const promptConfig = getPrompt('safety', ACTIVE_CONFIG.safety.prompt);
  
  const userPrompt = interpolatePrompt(promptConfig.userPromptTemplate, { content });
  
  const response = await ai.run(modelConfig.model, {
    messages: [
      { role: 'system', content: promptConfig.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
  });
  
  try {
    const result = JSON.parse(response.response);
    return { ...result, model: modelConfig.model };
  } catch {
    // If parsing fails, assume safe
    return { safe: true, category: null, reason: null, model: modelConfig.model };
  }
}
```

### curation.ts
```typescript
import { ACTIVE_CONFIG, getActiveModel, getPrompt, interpolatePrompt } from '../config/ai-models';

export interface CurationResult {
  summary: string;
  tags: string[];
  model: string;
}

export async function curatePost(ai: any, content: string): Promise<CurationResult> {
  const modelConfig = getActiveModel('curation');
  
  // Summarize
  const summaryPrompt = getPrompt('curation', ACTIVE_CONFIG.curation.summarizePrompt);
  const summaryResponse = await ai.run(modelConfig.model, {
    messages: [
      { role: 'system', content: summaryPrompt.systemPrompt },
      { role: 'user', content: interpolatePrompt(summaryPrompt.userPromptTemplate, { content }) },
    ],
    max_tokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
  });
  
  // Extract tags
  const tagPrompt = getPrompt('curation', ACTIVE_CONFIG.curation.tagPrompt);
  const tagResponse = await ai.run(modelConfig.model, {
    messages: [
      { role: 'system', content: tagPrompt.systemPrompt },
      { role: 'user', content: interpolatePrompt(tagPrompt.userPromptTemplate, { content }) },
    ],
    max_tokens: 100,
    temperature: 0,
  });
  
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(tagResponse.response);
    tags = parsed.tags || [];
  } catch {
    tags = [];
  }
  
  return {
    summary: summaryResponse.response.trim(),
    tags,
    model: modelConfig.model,
  };
}
```

### embeddings.ts
```typescript
import { ACTIVE_CONFIG, EMBEDDING_MODELS } from '../config/ai-models';

export async function generateEmbedding(ai: any, text: string): Promise<number[]> {
  const config = EMBEDDING_MODELS[ACTIVE_CONFIG.embedding.model];
  
  const result = await ai.run(config.model, {
    text: [text],
  });
  
  return result.data[0];
}

export async function indexPost(
  vectorize: any,
  postId: string,
  content: string,
  embedding: number[],
  metadata: Record<string, unknown>
): Promise<void> {
  await vectorize.upsert([{
    id: postId,
    values: embedding,
    metadata,
  }]);
}
```

---

# PART 9: CREDENTIALS & SECRETS

## npe-api Secrets

```bash
# View current secrets
cd ~/humanizer_root/workers/npe-api
npx wrangler secret list

# Required secrets:
JWT_SECRET         # Shared JWT signing key
GITHUB_CLIENT_ID   # GitHub OAuth
GITHUB_CLIENT_SECRET
# Future OAuth providers:
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
```

## post-social-api Secrets

```bash
cd ~/humanizer_root/workers/post-social-api
npx wrangler secret put JWT_SECRET
# Use the SAME value as npe-api
```

---

# PART 10: DEMO CREDENTIALS

```
Email:    demo@humanizer.com
Password: WeDidn'tKn0w!!
Role:     pro
```

Or login via GitHub OAuth.

---

# PART 11: DEVELOPMENT WORKFLOW

## Starting Fresh Session

```bash
# 1. Read handoff doc
cat ~/humanizer_root/workers/POST_SOCIAL_HANDOFF.md

# 2. Check git status
cd ~/humanizer_root
git status

# 3. Start workers for local dev
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

## Database Migrations

```bash
# Apply migration
cd ~/humanizer_root/workers/post-social-api
npx wrangler d1 execute post-social-db --remote --file=migrations/0002_curation_fields.sql

# Query database
npx wrangler d1 execute post-social-db --remote --command="SELECT * FROM posts LIMIT 5"
```

---

# PART 12: NEXT STEPS CHECKLIST

## Phase 3: Curation Queue

- [ ] Create `/src/config/ai-models.ts` with full configuration
- [ ] Create migration `0002_curation_fields.sql`
- [ ] Apply migration to post-social-db
- [ ] Update `wrangler.toml` with AI, Vectorize, Queue bindings
- [ ] Create Vectorize index: `npx wrangler vectorize create post-social-posts --dimensions=768`
- [ ] Create `/src/services/safety-gate.ts`
- [ ] Create `/src/services/curation.ts`
- [ ] Create `/src/services/embeddings.ts`
- [ ] Update `/src/routes/posts.ts` to run curation on create
- [ ] Create `/src/routes/search.ts` for semantic search
- [ ] Test locally
- [ ] Deploy
- [ ] Test in production

## Phase 4: Semantic Search

- [ ] `/src/routes/search.ts` - Query Vectorize
- [ ] Frontend search UI
- [ ] Relevance ranking (semantic + recency)

## Phase 5: Synthesis Engine

- [ ] Post versioning schema
- [ ] Diff view (Git-style)
- [ ] Author approval flow
- [ ] Scheduled synthesis job

---

# PART 13: QUICK REFERENCE COMMANDS

```bash
# Test login
curl -X POST https://npe-api.tem-527.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}'

# Test OAuth providers
curl https://npe-api.tem-527.workers.dev/auth/oauth/providers | jq

# Create post
TOKEN="your-jwt-token"
curl -X POST https://post-social-api.tem-527.workers.dev/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Test post","visibility":"public"}'

# List posts
curl https://post-social-api.tem-527.workers.dev/api/posts \
  -H "Authorization: Bearer $TOKEN" | jq

# Frontend
open https://post-social.humanizer.com
```

---

**Document Created**: November 24, 2025  
**Status**: Phase 2 Complete, Phase 3 Ready  
**Next Session**: Implement Curation Queue with configurable AI models
