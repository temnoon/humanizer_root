# Humanizer Agent: Pitch Deck & Functional Specification

**Language as a Sense: Transforming Consciousness Through Narrative**

Version 1.0 | October 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Core Philosophy](#core-philosophy)
5. [Technical Architecture](#technical-architecture)
6. [Feature Specifications](#feature-specifications)
7. [Data Models](#data-models)
8. [API Specifications](#api-specifications)
9. [UI/UX Specifications](#ui-ux-specifications)
10. [User Journey](#user-journey)
11. [Success Metrics](#success-metrics)
12. [Roadmap](#roadmap)
13. [Implementation Guide](#implementation-guide)

---

## Executive Summary

### Vision Statement

**Humanizer Agent reveals language as a constructed sense—not objective reality—through multi-perspective narrative transformation. It helps users shift from unconscious linguistic identification to conscious subjective agency.**

### What It Does

- **Transforms** conversational archives into publication-ready documents
- **Reveals** the constructed nature of meaning through PERSONA/NAMESPACE/STYLE transformations
- **Analyzes** philosophical patterns using Madhyamaka (Middle Path) detection
- **Maps** belief structures across thousands of conversations
- **Builds** hierarchical books from transformation results
- **Preserves** complete provenance and lineage tracking

### Market Position

**Not a competitor to:** Grammarly, Jasper, Copy.ai (optimization tools)
**Instead:** A contemplative practice tool that uses AI to reveal subjective ontological nature

**Primary Users:**
1. Academic researchers transforming conversation archives into papers
2. Technical writers converting Q&A into structured documentation
3. Philosophers and contemplatives exploring the nature of meaning
4. Anyone seeking to understand how beliefs construct experience

### Key Differentiator

**Every other tool hides its assumptions and presents "better" outputs.**
**Humanizer makes assumptions visible and presents multiple valid perspectives.**

This shift—from optimization to awareness—is the core innovation.

### Current State

- ✅ **MVP Deployed:** Full-stack application (FastAPI + React)
- ✅ **8,640 media records** imported from ChatGPT/Claude archives
- ✅ **1.8GB production database** (PostgreSQL + pgvector)
- ✅ **132 frontend tests** passing (Vitest + Playwright)
- ✅ **89% Madhyamaka detection** accuracy
- ✅ **Book Builder Phase 2** complete (markdown editor + preview)
- ✅ **Database switching system** for isolated testing

### Funding Ask / Partnership Opportunity

**Stage:** Seeking strategic partners who understand contemplative technology
**Use of Funds:** LaTeX/PDF export, Cloudflare Workers deployment, community features
**Revenue Model:** Local-first (free) + Cloud SaaS (subscription for sync/community)

---

## The Problem

### Problem 1: Linguistic Identification

**Most people unconsciously identify with the meanings they construct through language.**

They believe:
- Words have inherent, objective meanings ("tree" = the thing itself)
- One interpretation is "correct," others are "wrong"
- Language describes reality rather than constructs it

This creates:
- ❌ Rigid thinking patterns
- ❌ Inability to see alternative perspectives
- ❌ Conflicts over "what words really mean"
- ❌ Unconscious belief structures controlling experience

### Problem 2: Archive Overload

**People have thousands of conversations locked in archives (ChatGPT, Claude, social media).**

Current tools:
- ❌ No way to transform archives into structured documents
- ❌ No semantic search across conversation history
- ❌ No belief pattern analysis over time
- ❌ No provenance tracking from source to publication

Result: **Valuable insights remain buried in unstructured JSON exports.**

### Problem 3: False Objectivity in AI Tools

**Existing writing tools present AI outputs as "better" or "correct."**

Examples:
- Grammarly: "Clarity score: 87/100" (implies objective measurement)
- Jasper: "AI-optimized for engagement" (hides framework assumptions)
- ChatGPT: Gives one answer per prompt (no multi-perspective view)

This reinforces the illusion that:
- ❌ Meaning is objective and discoverable
- ❌ AI knows the "right" way to say something
- ❌ Users are passive receivers, not active constructors

**Humanizer inverts this:** Shows that meaning is constructed, frameworks are chosen, and users are authors.

### Problem 4: No Tools for Philosophical Awakening

**Contemplative traditions teach "language is not reality," but offer no digital tools to experience this directly.**

Meditation apps focus on:
- ✅ Breath awareness
- ✅ Body scans
- ✅ Emotional regulation

But they ignore:
- ❌ Linguistic awakening (seeing the constructed nature of concepts)
- ❌ Belief structure dissolution
- ❌ Multi-perspectival awareness

**Gap:** No tool bridges contemplative philosophy and practical text transformation.

---

## The Solution

### Core Mechanism: The Allegory Engine

**Transform the same content through different belief frameworks (PERSONA/NAMESPACE/STYLE) to reveal meaning is constructed, not inherent.**

**Example:**

**Input:** "We need to increase quarterly revenue."

**Transformation 1** (Corporate/Business/Formal):
```
"Q4 financial performance targets require strategic enhancement
of top-line growth metrics to ensure organizational sustainability."
```

**Transformation 2** (Poet/Ecological/Lyrical):
```
"The garden of our work must bloom more abundantly as the
seasons turn, each harvest richer than the last."
```

**Transformation 3** (Skeptic/Philosophical/Questioning):
```
"What does 'need' mean here? Revenue for what purpose?
Growth toward what end? Who decided this necessity?"
```

**Result:** User *feels* how the same propositional content evokes different emotions. This visceral experience reveals the Emotional Belief Loop in action.

### Three-Dimensional Transformation Space

Every transformation is defined by three orthogonal parameters:

1. **PERSONA** - Voice/conscious position from which text is witnessed
   - Examples: Scholar, Poet, Skeptic, Corporate Executive, Engineer, Mystic

2. **NAMESPACE** - Conceptual domain/belief world
   - Examples: Academic, Business, Aesthetic, Philosophical, Scientific, Spiritual

3. **STYLE** - Presentation tone and structure
   - Examples: Formal, Lyrical, Questioning, Conversational, Technical, Poetic

**Formula:** `Output = Transform(Input, PERSONA, NAMESPACE, STYLE)`

This creates a **transformation space** where the same content can be experienced from infinite perspectives.

### Solution Architecture (5 Integrated Systems)

#### 1. Transformation Engine
- **What:** AI-powered text transformation using Claude Sonnet 4.5
- **Why:** Generates high-quality multi-perspective outputs
- **How:** Structured prompts encode PERSONA/NAMESPACE/STYLE parameters

#### 2. Archive Ingestion
- **What:** Import ChatGPT, Claude, social media exports
- **Why:** Unlock insights from historical conversations
- **How:** Parse JSON exports, extract metadata, store with embeddings

#### 3. Philosophical Analysis
- **What:** Madhyamaka detection, perspective generation, belief mapping
- **Why:** Reveal philosophical patterns across archives
- **How:** NLP classifiers + semantic analysis + graph visualization

#### 4. Book Builder
- **What:** Hierarchical document creator (books → chapters → sections)
- **Why:** Transform archives into publication-ready papers
- **How:** Markdown editor + LaTeX preview + content linking

#### 5. Provenance Tracking
- **What:** Complete lineage from source to transformation
- **Why:** Every byte traceable to origin (academic integrity)
- **How:** DAG (Directed Acyclic Graph) of transformation relationships

### User Experience Flow

```
1. Import Archive
   ↓
2. Semantic Search / Browse
   ↓
3. Select Content for Transformation
   ↓
4. Choose PERSONA/NAMESPACE/STYLE
   ↓
5. View Multi-Perspective Outputs (side-by-side)
   ↓
6. Experience "Aha Moment" (meaning is constructed!)
   ↓
7. Add to Book / Export / Create Custom Framework
   ↓
8. [Loop] Continue transforming with awareness
```

### Contemplative Features (Advanced)

For users seeking deeper philosophical engagement:

- **Word Dissolution Exercise:** Watch words fade character-by-character, experience silence
- **Socratic Dialogue:** AI asks questions that deconstruct assumptions
- **Witness Mode:** Strip all symbolic overlays, return to pre-linguistic presence
- **Belief Network Visualization:** See your conceptual structures as relational graphs
- **Interest List:** Track your "browse path" (witness your subjective journey)

### Key Innovation: Transparency

**Traditional AI Tools:**
```
Input → [Black Box AI] → Output
         "Trust us, this is better"
```

**Humanizer:**
```
Input → [PERSONA: Scholar]    → Perspective 1 (evokes rigor)
      → [PERSONA: Poet]       → Perspective 2 (evokes beauty)
      → [PERSONA: Skeptic]    → Perspective 3 (evokes questioning)

      User sees: "I choose the framework. I construct meaning."
```

Transparency = Awakening.

---

## Core Philosophy

### Language as a Sense

**Thesis:** Language is not objective reality. It's a sense—like sight or sound—through which consciousness constructs meaning.

**Analogy:**
- **Sight:** Photons → retina → neural processing → visual experience (constructed)
- **Language:** Symbols → linguistic processing → semantic experience (constructed)

Both are **not** direct access to reality. Both are consciousness creating experience from stimuli.

### The Three Realms of Existence

Human experience operates across three distinct ontological realms:

#### 1. Corporeal / Physical Realm (Green)

**Nature:** Pre-linguistic sensory substrate. What exists before we name it.

**Characteristics:**
- Directly experienced as sensation
- Cannot be fully captured in language
- Provides grounding for all experience

**In Humanizer:**
- Raw text before interpretation
- Physical characters on screen
- Input boxes (green styling)

#### 2. Objective / Symbolic Realm (Purple)

**Nature:** Shared abstractions—words, math, institutions. Feels objective but is actually collective construction.

**Characteristics:**
- Intersubjective, not objective (requires consciousness)
- Operates through convention and agreement
- Creates illusion of "shared world"
- Powerful because emotionally embedded

**In Humanizer:**
- PERSONA/NAMESPACE/STYLE frameworks
- Transformation outputs
- Conceptual structures (purple styling)

#### 3. Subjective / Conscious Realm (Dark Blue)

**Nature:** The lived experience of "now." Intention, will, presence. **Only realm truly "lived"—others are supports.**

**Characteristics:**
- Seat of all experience
- Where meaning actually arises
- Discrete moments of intention (not continuous)
- Cannot be objectified

**In Humanizer:**
- User's consciousness itself
- The awareness witnessing transformations
- Contemplative spaces (dark blue backgrounds)

### The Emotional Belief Loop

**Mechanism that makes language feel "real":**

```
Language Input
    ↓
Meaning Construction (activate belief networks)
    ↓
Emotional Response (bodily sensations, feelings)
    ↓
Belief Reinforcement (emotional weighting)
    ↓
Loop Closure (future encounters feel even more "real")
```

**Example:**
- Word: "success"
- Construction: "achieving goals, recognition, status"
- Emotion: excitement, anxiety, desire
- Belief: "Success is a real thing I need"
- Loop: "Success" now triggers same emotional-belief complex automatically

**Humanizer's Role:** By transforming "success" across different PERSONA/NAMESPACE/STYLE, we interrupt the loop and reveal meaning is constructed by framework, not inherent in word.

### Philosophical Foundations (Synthesis)

**Phenomenology (Husserl, Heidegger):**
- Return to "lifeworld" (pre-theoretical experience)
- Epoché: bracket assumptions, witness directly

**Buddhism (Nāgārjuna):**
- Śūnyatā (emptiness): no inherent existence
- Dependent origination: meaning arises from conditions

**Deconstruction (Derrida):**
- Différance: meaning is deferred and differential
- No "presence": language references language endlessly

**QBism (Quantum Bayesianism):**
- Reality is participatory, not observer-independent
- Beliefs construct experience (like quantum wavefunctions)

**Humanizer synthesizes these into:** "Consciousness constructs meaning moment-by-moment through belief frameworks. Awareness of this process = freedom."

### Design Principles (7 Core)

1. **Make Symbolic Realm Visible** - Expose frameworks, don't hide them
2. **Honor Subjective Realm** - User agency, not passive consumption
3. **Ground in Corporeal Realm** - Embodied experience, sensory language
4. **Avoid False Objectivity** - No "best" versions, only perspectives
5. **Create Awareness Moments** - Contemplative pauses, reflections
6. **Reveal Emotional Belief Loop** - Show how feelings shape meaning
7. **Embrace Paradox** - Use language to point beyond language

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  React 18 + Vite + TailwindCSS                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  Workstation │ │ Book Builder │ │ Image Browser│       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Transform UI │ │ Library View │ │ Conversation │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                             │
│  FastAPI (Python 3.11 async)                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │Transform API │ │ Library API  │ │ Vision API   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │Madhyamaka Svc│ │ Pipeline Proc│ │ Import API   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                       DATA LAYER                            │
│  PostgreSQL 17 + pgvector                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Collections  │ │ Messages     │ │ Chunks       │       │
│  │ (1,660)      │ │ (46,379)     │ │ (33,952)     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Media        │ │ Transform    │ │ Books        │       │
│  │ (8,640)      │ │ Jobs         │ │ (4)          │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │Claude API    │ │ Voyage-3     │ │ File Storage │       │
│  │(Sonnet 4.5)  │ │(Embeddings)  │ │(Local/S3)    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Backend

**Language:** Python 3.11
**Framework:** FastAPI (async)
**Database:** PostgreSQL 17 + pgvector extension
**ORM:** SQLAlchemy (async)
**AI SDK:** Anthropic Claude SDK (Sonnet 4.5)
**Embeddings:** sentence-transformers (Voyage-3 via API)
**Migrations:** Alembic
**Testing:** pytest

**Key Dependencies:**
```python
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
asyncpg==0.29.0
anthropic==0.7.0
sentence-transformers==2.2.2
pgvector==0.2.3
alembic==1.12.1
pydantic==2.5.0
```

#### Frontend

**Language:** JavaScript (ES6+)
**Framework:** React 18
**Build Tool:** Vite
**Styling:** TailwindCSS 3 + DaisyUI
**Editor:** CodeMirror 6 (markdown)
**Markdown:** ReactMarkdown + remark-gfm + remark-math
**Math:** KaTeX (LaTeX rendering)
**HTTP Client:** axios
**State:** React Context API + hooks
**Layout:** react-resizable-panels
**Testing:** Vitest + React Testing Library + Playwright

**Key Dependencies:**
```json
{
  "react": "18.2.0",
  "vite": "5.0.0",
  "tailwindcss": "3.3.5",
  "daisyui": "4.4.19",
  "@uiw/react-codemirror": "4.21.21",
  "react-markdown": "9.0.1",
  "katex": "0.16.9",
  "axios": "1.6.2",
  "react-resizable-panels": "1.0.7"
}
```

#### Infrastructure

**Development:**
- Docker (optional, primarily direct installs)
- PostgreSQL 17 (Homebrew on macOS)
- Node.js 18.20.8 (via nvm)
- Python virtual environment (venv)

**Deployment (Planned):**
- Cloudflare Workers (edge functions)
- Cloudflare D1 (SQLite at edge)
- Cloudflare R2 (object storage)
- CloudFlare Pages (static frontend)

### Database Schema

#### Core Tables

**users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    user_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_users_email ON users(email);
```

**collections** (conversations)
```sql
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title TEXT,
    platform VARCHAR(50), -- 'chatgpt', 'claude', 'custom'
    original_id TEXT, -- from export JSON
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    custom_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_created ON collections(created_at DESC);
```

**messages**
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    role VARCHAR(20), -- 'user', 'assistant', 'system'
    author_name VARCHAR(255),
    created_at TIMESTAMP,
    model VARCHAR(100),
    custom_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_messages_collection ON messages(collection_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

**chunks** (message content, chunked for embeddings)
```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    token_count INTEGER,
    embedding vector(1536), -- pgvector type
    custom_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_chunks_message ON chunks(message_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops);
```

**media**
```sql
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    original_media_id TEXT UNIQUE, -- from export (e.g., "file-xyz123")
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    storage_path TEXT, -- local path or S3 URL
    width INTEGER,
    height INTEGER,
    generator VARCHAR(50), -- 'dalle', 'stable-diffusion', 'midjourney'
    ai_prompt TEXT, -- extracted from EXIF
    created_at TIMESTAMP,
    custom_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_media_message ON media(message_id);
CREATE INDEX idx_media_original ON media(original_media_id);
CREATE INDEX idx_media_generator ON media(generator);
```

**transformation_jobs**
```sql
CREATE TABLE transformation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    source_content TEXT NOT NULL,
    persona VARCHAR(100), -- e.g., 'scholar', 'poet', 'skeptic'
    namespace VARCHAR(100), -- e.g., 'academic', 'business', 'philosophy'
    style VARCHAR(100), -- e.g., 'formal', 'lyrical', 'questioning'
    depth FLOAT DEFAULT 0.5, -- transformation intensity
    preserve_structure BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    result_content TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    custom_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_transform_user ON transformation_jobs(user_id);
CREATE INDEX idx_transform_status ON transformation_jobs(status);
```

**transformation_lineage**
```sql
CREATE TABLE transformation_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transformation_id UUID REFERENCES transformation_jobs(id) ON DELETE CASCADE,
    source_id UUID, -- could be message_id, chunk_id, or another transformation_id
    source_type VARCHAR(50), -- 'message', 'chunk', 'transformation'
    relationship_type VARCHAR(50) DEFAULT 'derived_from'
);
CREATE INDEX idx_lineage_transform ON transformation_lineage(transformation_id);
CREATE INDEX idx_lineage_source ON transformation_lineage(source_id, source_type);
```

**books**
```sql
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    book_type VARCHAR(50) DEFAULT 'book', -- 'book', 'paper', 'article'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    custom_metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_books_user ON books(user_id);
```

**book_sections**
```sql
CREATE TABLE book_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    parent_section_id UUID REFERENCES book_sections(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT, -- markdown content
    section_order INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1, -- 1=chapter, 2=section, 3=subsection
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sections_book ON book_sections(book_id);
CREATE INDEX idx_sections_parent ON book_sections(parent_section_id);
CREATE INDEX idx_sections_order ON book_sections(book_id, section_order);
```

**book_content_links**
```sql
CREATE TABLE book_content_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES book_sections(id) ON DELETE CASCADE,
    content_type VARCHAR(50), -- 'message', 'transformation', 'media'
    content_id UUID NOT NULL,
    link_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_content_links_section ON book_content_links(section_id);
CREATE INDEX idx_content_links_content ON book_content_links(content_id, content_type);
```

### API Architecture

**7 Router Modules:**

1. **routes.py** - Core transformation endpoints
2. **philosophical_routes.py** - Madhyamaka, perspectives, contemplation
3. **session_routes.py** - Session management (checkpoints, memory)
4. **madhyamaka_routes.py** - Middle Path detection service
5. **import_routes.py** - Archive ingestion (ChatGPT, Claude)
6. **library_routes.py** - Collections, messages, search (refactored into 4 sub-modules)
7. **gizmo_routes.py** - Custom tools/gizmos
8. **pipeline_routes.py** - Background job processing
9. **book_routes.py** - Book builder CRUD
10. **vision_routes.py** - Image upload, OCR, analysis

**Authentication:** JWT tokens (planned, not yet implemented)
**Rate Limiting:** Token-based (free tier: 2K input/2K output, premium: 50K/8K)
**Error Handling:** Structured JSON responses with error codes

### Deployment Architecture

**Current (Local Development):**
```
Backend: http://localhost:8000
Frontend: http://localhost:5173
Database: localhost:5432 (PostgreSQL)
```

**Planned (Production):**
```
Frontend: humanizer.com (Cloudflare Pages)
API: api.humanizer.com (Cloudflare Workers)
Database: Cloudflare D1 (SQLite at edge) + R2 (media storage)
CDN: Cloudflare global network
```

**Benefits of Cloudflare Architecture:**
- Global edge deployment (low latency)
- Generous free tier (10M requests/day)
- Built-in DDoS protection
- Zero cold starts (Workers)
- Pay-as-you-go pricing

---

## Feature Specifications

### Feature 1: Transformation Engine

**Purpose:** Transform text through different PERSONA/NAMESPACE/STYLE frameworks to reveal constructed nature of meaning.

**User Flow:**
1. User pastes text into input field
2. User selects PERSONA, NAMESPACE, STYLE from dropdowns (or uses defaults)
3. User clicks "Transform"
4. Backend generates transformation using Claude API
5. Frontend displays result with framework labels
6. User can generate multiple perspectives simultaneously

**Technical Implementation:**

**Frontend Component:** `TransformationInterface.jsx`
```jsx
<TransformationInterface>
  <InputArea>
    <TextArea placeholder="Enter text to transform..." />
  </InputArea>

  <ParameterSelectors>
    <Select name="persona" options={PERSONAS} />
    <Select name="namespace" options={NAMESPACES} />
    <Select name="style" options={STYLES} />
  </ParameterSelectors>

  <Actions>
    <Button onClick={handleTransform}>Transform</Button>
    <Button onClick={handleMultiPerspective}>Generate 3 Perspectives</Button>
  </Actions>

  <OutputArea>
    {perspectives.map(p => (
      <PerspectiveCard
        key={p.id}
        persona={p.persona}
        namespace={p.namespace}
        style={p.style}
        content={p.result}
      />
    ))}
  </OutputArea>
</TransformationInterface>
```

**Backend Endpoint:** `POST /api/transform`

**Request:**
```json
{
  "content": "We need to increase quarterly revenue.",
  "persona": "poet",
  "namespace": "ecological",
  "style": "lyrical",
  "depth": 0.7,
  "preserve_structure": true,
  "user_id": "uuid-string" // optional, for logged-in users
}
```

**Response:**
```json
{
  "transformation_id": "uuid-string",
  "result": "The garden of our work must bloom more abundantly...",
  "parameters": {
    "persona": "poet",
    "namespace": "ecological",
    "style": "lyrical"
  },
  "tokens_used": {
    "input": 12,
    "output": 45
  },
  "created_at": "2025-10-07T12:34:56Z"
}
```

**Prompt Template (Claude API):**
```python
def build_transformation_prompt(content, persona, namespace, style, depth):
    return f"""You are transforming text through a specific belief framework.

PARAMETERS:
- PERSONA: {persona} (the conscious position from which to witness the text)
- NAMESPACE: {namespace} (the conceptual domain/belief world)
- STYLE: {style} (presentation tone and structure)
- DEPTH: {depth} (0.0 = minimal change, 1.0 = maximal transformation)

INSTRUCTIONS:
1. Adopt the {persona} persona completely
2. Reframe concepts using {namespace} terminology and assumptions
3. Express in {style} tone and structure
4. Preserve core meaning while shifting perspective
5. Make the framework's assumptions visible through language choices

IMPORTANT: Do not explain the transformation. Simply produce the transformed text.

TEXT TO TRANSFORM:
{content}

TRANSFORMED TEXT:"""
```

**Parameters Definition:**

**PERSONA (Voice/Consciousness):**
- `scholar` - Academic, rigorous, evidence-based, third-person
- `poet` - Aesthetic, metaphorical, sensory, evocative
- `skeptic` - Questioning, doubting, examining assumptions
- `corporate` - Strategic, metrics-focused, hierarchical
- `engineer` - Technical, systematic, problem-solving
- `mystic` - Non-dual, paradoxical, pointing beyond concepts
- `journalist` - Objective reporting, facts, neutrality
- `activist` - Change-oriented, passionate, urgent

**NAMESPACE (Conceptual Domain):**
- `academic` - Citations, hedging, formal terminology
- `business` - ROI, KPIs, strategy, market dynamics
- `philosophy` - Ontology, epistemology, metaphysics
- `science` - Hypotheses, evidence, mechanisms
- `spiritual` - Awakening, presence, transcendence
- `ecological` - Interconnection, sustainability, natural cycles
- `psychological` - Emotions, motivations, development
- `political` - Power, justice, systems, governance

**STYLE (Presentation):**
- `formal` - Structured, professional, impersonal
- `conversational` - Casual, direct, personal
- `lyrical` - Poetic, flowing, rhythmic
- `technical` - Precise, detailed, jargon-appropriate
- `questioning` - Socratic, probing, open-ended
- `narrative` - Story-driven, sequential, character-focused
- `aphoristic` - Short, punchy, memorable

### Feature 2: Archive Import

**Purpose:** Ingest ChatGPT/Claude conversation exports with full metadata preservation.

**User Flow:**
1. User exports conversations from ChatGPT/Claude
2. User clicks "Import Archive" in Humanizer
3. User selects JSON file (ChatGPT: conversations.json, Claude: export.zip)
4. System parses JSON, extracts conversations, messages, images
5. System stores in database with embeddings
6. User browses imported content in Library

**Technical Implementation:**

**Frontend Component:** `ArchiveImporter.jsx`
```jsx
<ArchiveImporter>
  <FileUpload accept=".json,.zip">
    <DropZone onDrop={handleFileDrop}>
      Drop ChatGPT conversations.json or Claude export.zip
    </DropZone>
  </FileUpload>

  <ImportProgress>
    <ProgressBar value={progress.percent} />
    <Status>
      Importing: {progress.current} / {progress.total} conversations
    </Status>
  </ImportProgress>

  <ImportSummary>
    <Stats>
      <Stat label="Conversations" value={stats.collections} />
      <Stat label="Messages" value={stats.messages} />
      <Stat label="Images" value={stats.media} />
    </Stats>
  </ImportSummary>
</ArchiveImporter>
```

**Backend Endpoint:** `POST /api/import/chatgpt`

**Request:** `multipart/form-data` with JSON file

**ChatGPT JSON Format (Example):**
```json
[
  {
    "title": "Conversation Title",
    "create_time": 1696531200,
    "update_time": 1696534800,
    "mapping": {
      "message_id_1": {
        "message": {
          "id": "message_id_1",
          "author": {"role": "user"},
          "create_time": 1696531200,
          "content": {
            "content_type": "text",
            "parts": ["User's message text"]
          }
        },
        "parent": null,
        "children": ["message_id_2"]
      },
      "message_id_2": {
        "message": {
          "id": "message_id_2",
          "author": {"role": "assistant"},
          "create_time": 1696531250,
          "content": {
            "content_type": "text",
            "parts": ["Assistant's response"]
          },
          "metadata": {
            "model_slug": "gpt-4"
          }
        },
        "parent": "message_id_1",
        "children": []
      }
    }
  }
]
```

**Import Processing Logic:**
```python
async def import_chatgpt_archive(file_content: bytes, user_id: str):
    """Import ChatGPT conversations.json"""
    data = json.loads(file_content)

    for conversation in data:
        # Create collection
        collection = await db.collections.create({
            "user_id": user_id,
            "title": conversation["title"],
            "platform": "chatgpt",
            "original_id": conversation.get("id"),
            "created_at": datetime.fromtimestamp(conversation["create_time"]),
            "custom_metadata": {
                "update_time": conversation["update_time"],
                "message_count": len(conversation["mapping"])
            }
        })

        # Parse message tree
        messages = conversation["mapping"]
        for msg_id, msg_data in messages.items():
            if not msg_data.get("message"):
                continue

            msg = msg_data["message"]

            # Create message
            message = await db.messages.create({
                "collection_id": collection.id,
                "role": msg["author"]["role"],
                "created_at": datetime.fromtimestamp(msg["create_time"]),
                "model": msg.get("metadata", {}).get("model_slug"),
                "custom_metadata": {
                    "original_id": msg["id"],
                    "parent": msg_data.get("parent"),
                    "children": msg_data.get("children", [])
                }
            })

            # Extract content parts
            content_parts = msg["content"]["parts"]
            for idx, part in enumerate(content_parts):
                # Create chunk
                chunk = await db.chunks.create({
                    "message_id": message.id,
                    "content": part,
                    "chunk_index": idx,
                    "token_count": estimate_tokens(part)
                })

                # Generate embedding
                embedding = await generate_embedding(part)
                await db.chunks.update(chunk.id, {"embedding": embedding})

            # Handle images (if present in metadata)
            if "attachments" in msg.get("content", {}):
                for attachment in msg["content"]["attachments"]:
                    if attachment["content_type"].startswith("image/"):
                        await import_image(attachment, message.id)

    return {
        "collections": len(data),
        "messages": sum(len(c["mapping"]) for c in data),
        "status": "completed"
    }
```

**Image Import (DALL-E, Screenshots):**
```python
async def import_image(attachment, message_id):
    """Import image with metadata extraction"""
    # Download image
    image_data = await fetch_image(attachment["url"])

    # Extract EXIF metadata
    exif = extract_exif(image_data)

    # Detect generator (DALL-E, Stable Diffusion, Midjourney)
    generator, prompt = detect_generator_and_prompt(exif)

    # Store image
    storage_path = await save_image(image_data, attachment["id"])

    # Create media record
    await db.media.create({
        "message_id": message_id,
        "original_media_id": attachment["id"],
        "mime_type": attachment["content_type"],
        "file_size_bytes": len(image_data),
        "storage_path": storage_path,
        "generator": generator,
        "ai_prompt": prompt,
        "custom_metadata": {
            "exif": exif,
            "width": get_image_width(image_data),
            "height": get_image_height(image_data)
        }
    })
```

**Supported Generators (Metadata Detection):**
- **DALL-E:** EXIF field `ImageDescription` contains prompt
- **Stable Diffusion:** EXIF field `UserComment` contains generation parameters
- **Midjourney:** Filename pattern `[username]_[prompt]_[seed].png`

### Feature 3: Madhyamaka Detection

**Purpose:** Identify Middle Path (Madhyamaka) philosophical reasoning patterns in text.

**Madhyamaka Definition:**
- Buddhist philosophical school founded by Nāgārjuna
- Core teaching: All phenomena lack inherent, independent existence (śūnyatā)
- Method: Dialectical negation of all extreme positions
- Goal: Liberation through direct realization of emptiness

**Detection Criteria:**

**Positive Indicators (Madhyamaka Present):**
1. **Dialectical Negation:** "Neither X nor not-X"
2. **Rejection of Extremes:** "Not eternalism, not nihilism"
3. **Dependent Origination:** "Arises dependently, lacks inherent existence"
4. **Two Truths:** References to conventional vs. ultimate truth
5. **Self-Refutation Awareness:** "This statement itself is empty"
6. **Non-Dual Language:** "Not separate, not identical"

**Negative Indicators (Not Madhyamaka):**
1. **Substantialism:** Claims of inherent existence
2. **Reductionism:** "X is nothing but Y"
3. **Absolutism:** Unconditioned truth claims
4. **Subject-Object Duality:** Strong separation of knower and known

**User Flow:**
1. User inputs text (from message, chunk, or transformation)
2. User clicks "Analyze for Madhyamaka"
3. System uses NLP classifier to detect patterns
4. System returns probability score + explanation
5. User sees which passages exhibit Middle Path reasoning

**Technical Implementation:**

**Frontend Component:** `MadhyamakaAnalyzer.jsx`
```jsx
<MadhyamakaAnalyzer>
  <TextInput>
    <TextArea value={inputText} onChange={setInputText} />
  </TextInput>

  <AnalyzeButton onClick={handleAnalyze}>
    Detect Madhyamaka Patterns
  </AnalyzeButton>

  <Results>
    <ScoreDisplay>
      <CircularProgress value={score.probability * 100} />
      <Label>Madhyamaka Likelihood: {score.probability}%</Label>
    </ScoreDisplay>

    <Explanation>
      <h3>Detected Patterns:</h3>
      <ul>
        {score.patterns.map(p => (
          <li key={p.type}>
            <strong>{p.type}:</strong> "{p.quote}"
          </li>
        ))}
      </ul>
    </Explanation>

    <RecommendedActions>
      {score.probability > 0.7 && (
        <Button>Generate Multi-Perspective Analysis</Button>
      )}
    </RecommendedActions>
  </Results>
</MadhyamakaAnalyzer>
```

**Backend Endpoint:** `POST /api/philosophical/madhyamaka/detect`

**Request:**
```json
{
  "text": "The self neither exists nor does not exist. It arises dependently on conditions, lacking inherent nature.",
  "detailed": true
}
```

**Response:**
```json
{
  "probability": 0.92,
  "classification": "likely_madhyamaka",
  "patterns_detected": [
    {
      "type": "dialectical_negation",
      "confidence": 0.95,
      "quote": "neither exists nor does not exist",
      "explanation": "Classic tetralemma structure rejecting both extremes"
    },
    {
      "type": "dependent_origination",
      "confidence": 0.88,
      "quote": "arises dependently on conditions",
      "explanation": "Explicit reference to pratītyasamutpāda"
    },
    {
      "type": "emptiness",
      "confidence": 0.91,
      "quote": "lacking inherent nature",
      "explanation": "Direct statement of śūnyatā (emptiness of inherent existence)"
    }
  ],
  "suggested_next_steps": [
    "Generate perspectives from substantialist and nihilist viewpoints",
    "Compare with Yogacara (consciousness-only) interpretation",
    "Explore implications for self-view"
  ]
}
```

**Detection Algorithm (Simplified):**
```python
class MadhyamakaDetector:
    """Detect Middle Path reasoning patterns"""

    PATTERNS = {
        "dialectical_negation": [
            r"neither .+ nor .+",
            r"not .+ not not-.+",
            r"beyond .+ and .+"
        ],
        "dependent_origination": [
            r"arises? dependently",
            r"conditioned by",
            r"pratītyasamutpāda"
        ],
        "emptiness": [
            r"lacking inherent",
            r"śūnyatā",
            r"empty of self-nature",
            r"svabhāva"
        ],
        "two_truths": [
            r"conventional(ly)?.*ultimate",
            r"relative.*absolute",
            r"saṃvṛti.*paramārtha"
        ]
    }

    async def detect(self, text: str) -> dict:
        """Detect Madhyamaka patterns in text"""
        results = {
            "patterns_detected": [],
            "probability": 0.0
        }

        # Pattern matching
        for pattern_type, regexes in self.PATTERNS.items():
            for regex in regexes:
                matches = re.finditer(regex, text, re.IGNORECASE)
                for match in matches:
                    results["patterns_detected"].append({
                        "type": pattern_type,
                        "quote": match.group(0),
                        "position": match.span()
                    })

        # Calculate probability (weighted by pattern types)
        weights = {
            "dialectical_negation": 0.35,
            "dependent_origination": 0.30,
            "emptiness": 0.25,
            "two_truths": 0.10
        }

        pattern_scores = {}
        for p in results["patterns_detected"]:
            pattern_scores[p["type"]] = pattern_scores.get(p["type"], 0) + 1

        probability = sum(
            min(count * weights.get(ptype, 0), weights.get(ptype, 0))
            for ptype, count in pattern_scores.items()
        )

        results["probability"] = min(probability, 1.0)
        results["classification"] = self._classify(probability)

        return results

    def _classify(self, prob: float) -> str:
        """Classify based on probability threshold"""
        if prob >= 0.8:
            return "likely_madhyamaka"
        elif prob >= 0.5:
            return "possibly_madhyamaka"
        else:
            return "unlikely_madhyamaka"
```

### Feature 4: Book Builder

**Purpose:** Create hierarchical documents (books → chapters → sections) from transformation results and archive messages.

**User Flow:**
1. User clicks "New Book"
2. User enters title, description, type (book/paper/article)
3. User creates sections (chapters, subsections)
4. User adds content to sections:
   - Manually type markdown
   - Link transformation results
   - Link messages from archive
   - Link images
5. User previews book with LaTeX rendering
6. User exports to PDF (future: LaTeX compilation)

**Technical Implementation:**

**Frontend Component:** `BookBuilder.jsx`
```jsx
<BookBuilder>
  <Sidebar>
    <BooksList books={books} onSelect={selectBook} />
    <CreateBookButton onClick={createNewBook} />
  </Sidebar>

  <MainView>
    {selectedBook && (
      <BookEditor book={selectedBook}>
        <BookOutline>
          <SectionTree
            sections={selectedBook.sections}
            onSelect={selectSection}
            onReorder={reorderSections}
            onAdd={addSection}
            onDelete={deleteSection}
          />
        </BookOutline>

        <SectionEditor section={selectedSection}>
          <MarkdownEditor
            value={selectedSection.content}
            onChange={updateContent}
            plugins={[markdown, latex, images]}
          />

          <ContentLinks>
            <h3>Linked Content</h3>
            {selectedSection.links.map(link => (
              <ContentCard
                key={link.id}
                type={link.content_type}
                content={link.content}
                onRemove={() => removeLink(link.id)}
              />
            ))}
            <AddContentButton onClick={openContentBrowser} />
          </ContentLinks>
        </SectionEditor>

        <PreviewPane>
          <MarkdownRenderer
            content={selectedSection.content}
            renderMath={true}
            renderImages={true}
          />
        </PreviewPane>
      </BookEditor>
    )}
  </MainView>
</BookBuilder>
```

**Backend Endpoints:**

**Book CRUD:**
```
POST   /api/books                    # Create book
GET    /api/books                    # List user's books
GET    /api/books/{id}               # Get book with sections
PUT    /api/books/{id}               # Update book metadata
DELETE /api/books/{id}               # Delete book

POST   /api/books/{id}/sections      # Create section
PUT    /api/books/{id}/sections/{sid} # Update section
DELETE /api/books/{id}/sections/{sid} # Delete section

POST   /api/books/{id}/sections/{sid}/links  # Add content link
DELETE /api/books/{id}/sections/{sid}/links/{lid} # Remove link

GET    /api/books/{id}/export/markdown  # Export as markdown
GET    /api/books/{id}/export/latex     # Export as LaTeX (future)
GET    /api/books/{id}/export/pdf       # Export as PDF (future)
```

**Section Content Linking:**
```python
# Example: Link transformation result to section
POST /api/books/{book_id}/sections/{section_id}/links
{
  "content_type": "transformation",
  "content_id": "transformation-uuid",
  "link_order": 0,
  "notes": "Corporate perspective on revenue discussion"
}

# Example: Link message to section
POST /api/books/{book_id}/sections/{section_id}/links
{
  "content_type": "message",
  "content_id": "message-uuid",
  "link_order": 1,
  "notes": "Original conversation excerpt"
}
```

**Markdown Processing:**

Support standard markdown + extensions:
- **GitHub Flavored Markdown** (tables, task lists, strikethrough)
- **LaTeX Math** (inline `$...$`, display `$$...$$`)
- **Images** (local paths, `sediment://` protocol, `file-service://` protocol)
- **Citations** (future: BibTeX integration)

**LaTeX Preprocessing (for math rendering):**
```javascript
function preprocessLatex(markdown) {
  // Convert LaTeX delimiters to KaTeX-compatible format
  let processed = markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')  // \[...\] → $$...$$
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');   // \(...\) → $...$

  return processed;
}
```

**Image Protocol Handling:**
```javascript
function preprocessImages(markdown) {
  // Convert sediment:// and file-service:// to API URLs
  return markdown
    .replace(/!\[(.*?)\]\(sediment:\/\/([^\)]+)\)/g,
             '![$1](/api/library/media/file-$2/file)')
    .replace(/!\[(.*?)\]\(file-service:\/\/file-([^\)]+)\)/g,
             '![$1](/api/library/media/file-$2/file)');
}
```

### Feature 5: Semantic Search

**Purpose:** Search across entire archive using natural language queries with vector similarity.

**User Flow:**
1. User enters search query (e.g., "consciousness and quantum mechanics")
2. System generates embedding for query
3. System performs cosine similarity search against chunk embeddings
4. System returns ranked results with context
5. User clicks result to view full message/conversation

**Technical Implementation:**

**Frontend Component:** `SemanticSearch.jsx`
```jsx
<SemanticSearch>
  <SearchInput>
    <Input
      placeholder="Search your archive (e.g., 'debates about AI consciousness')"
      value={query}
      onChange={setQuery}
      onEnter={handleSearch}
    />
    <SearchButton onClick={handleSearch}>Search</SearchButton>
  </SearchInput>

  <Filters>
    <DateRange from={filters.dateFrom} to={filters.dateTo} />
    <PlatformFilter platforms={['chatgpt', 'claude', 'all']} />
    <LimitSelector options={[10, 25, 50, 100]} />
  </Filters>

  <Results>
    {results.map(result => (
      <ResultCard key={result.id}>
        <Metadata>
          <ConversationTitle>{result.conversation_title}</ConversationTitle>
          <Date>{result.created_at}</Date>
          <Similarity>{(result.similarity * 100).toFixed(1)}% match</Similarity>
        </Metadata>

        <Snippet>
          <Highlight query={query}>{result.content}</Highlight>
        </Snippet>

        <Actions>
          <Button onClick={() => viewMessage(result.message_id)}>
            View Full Message
          </Button>
          <Button onClick={() => addToBook(result.chunk_id)}>
            Add to Book
          </Button>
        </Actions>
      </ResultCard>
    ))}
  </Results>
</SemanticSearch>
```

**Backend Endpoint:** `GET /api/library/search`

**Request:**
```
GET /api/library/search?q=consciousness+quantum+mechanics&limit=25&min_similarity=0.7
```

**Response:**
```json
{
  "query": "consciousness quantum mechanics",
  "results": [
    {
      "chunk_id": "uuid-1",
      "message_id": "uuid-2",
      "conversation_id": "uuid-3",
      "conversation_title": "QBism and Consciousness",
      "content": "The participatory nature of quantum mechanics suggests consciousness plays a role in collapsing the wavefunction...",
      "similarity": 0.89,
      "created_at": "2025-08-15T14:23:00Z",
      "author": "assistant",
      "model": "claude-3-opus"
    },
    {
      "chunk_id": "uuid-4",
      "message_id": "uuid-5",
      "conversation_id": "uuid-6",
      "conversation_title": "Hard Problem Debate",
      "content": "If we take quantum indeterminacy seriously, consciousness might be the bridge between possibility and actuality...",
      "similarity": 0.85,
      "created_at": "2025-07-22T09:45:00Z",
      "author": "user",
      "model": null
    }
  ],
  "total_results": 47,
  "search_time_ms": 23
}
```

**Search Implementation (PostgreSQL + pgvector):**
```python
async def semantic_search(
    query: str,
    user_id: str,
    limit: int = 25,
    min_similarity: float = 0.7
) -> List[SearchResult]:
    """Semantic search using vector similarity"""

    # Generate query embedding
    query_embedding = await embedding_service.embed(query)

    # Perform vector similarity search
    sql = """
        SELECT
            c.id as chunk_id,
            c.content,
            c.message_id,
            m.id as message_id,
            m.created_at,
            m.author_name,
            m.model,
            col.id as conversation_id,
            col.title as conversation_title,
            1 - (c.embedding <=> :query_embedding) as similarity
        FROM chunks c
        JOIN messages m ON c.message_id = m.id
        JOIN collections col ON m.collection_id = col.id
        WHERE col.user_id = :user_id
          AND 1 - (c.embedding <=> :query_embedding) >= :min_similarity
        ORDER BY similarity DESC
        LIMIT :limit
    """

    results = await db.execute(
        sql,
        {
            "query_embedding": query_embedding,
            "user_id": user_id,
            "min_similarity": min_similarity,
            "limit": limit
        }
    )

    return [SearchResult(**row) for row in results]
```

**Embedding Generation (Voyage-3 via API):**
```python
class EmbeddingService:
    """Generate embeddings using Voyage-3"""

    async def embed(self, text: str) -> List[float]:
        """Generate 1536-dimensional embedding"""
        # Call Voyage API (or use sentence-transformers locally)
        response = await voyage_client.embed(
            texts=[text],
            model="voyage-3"
        )
        return response.embeddings[0]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Batch embedding generation (more efficient)"""
        response = await voyage_client.embed(
            texts=texts,
            model="voyage-3"
        )
        return response.embeddings
```

### Feature 6: Interest List (Browse Path Tracking)

**Purpose:** Track user's exploration path to "witness your subjective journey" through the archive.

**Philosophy:** The Interest List embodies the core teaching—by showing users their browse path, they witness their own subjective agency in constructing meaning.

**User Flow:**
1. User browses archive (views conversations, messages, images)
2. Items automatically added to Interest List chronologically
3. User sees their "path" visualized
4. User can revisit any point in their journey
5. User realizes: "I chose this path. I constructed this experience."

**Technical Implementation:**

**Frontend Component:** `InterestList.jsx`
```jsx
<InterestList>
  <Header>
    <Title>Your Browse Path</Title>
    <Subtitle>Witness your subjective journey</Subtitle>
  </Header>

  <TimelineView>
    {interestItems.map((item, index) => (
      <InterestItem key={item.id}>
        <Timestamp>{item.timestamp}</Timestamp>

        <ItemPreview onClick={() => navigateTo(item)}>
          {item.type === 'conversation' && (
            <ConversationCard title={item.title} />
          )}
          {item.type === 'message' && (
            <MessageCard content={item.content_preview} />
          )}
          {item.type === 'image' && (
            <ImageCard src={item.thumbnail_url} />
          )}
        </ItemPreview>

        {index < interestItems.length - 1 && (
          <PathConnector />
        )}
      </InterestItem>
    ))}
  </TimelineView>

  <Actions>
    <Button onClick={clearInterestList}>Clear Path</Button>
    <Button onClick={exportPath}>Export Journey</Button>
  </Actions>
</InterestList>
```

**State Management (Context API):**
```javascript
const InterestListContext = createContext();

export function InterestListProvider({ children }) {
  const [interestItems, setInterestItems] = useState([]);

  const addToInterestList = (item) => {
    setInterestItems(prev => [...prev, {
      ...item,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    }]);

    // Persist to localStorage
    localStorage.setItem('interestList', JSON.stringify(interestItems));
  };

  const removeFromInterestList = (itemId) => {
    setInterestItems(prev => prev.filter(i => i.id !== itemId));
  };

  const clearInterestList = () => {
    setInterestItems([]);
    localStorage.removeItem('interestList');
  };

  return (
    <InterestListContext.Provider value={{
      interestItems,
      addToInterestList,
      removeFromInterestList,
      clearInterestList
    }}>
      {children}
    </InterestListContext.Provider>
  );
}
```

**Auto-Tracking on Navigation:**
```javascript
function ConversationViewer({ conversationId }) {
  const { addToInterestList } = useContext(InterestListContext);

  useEffect(() => {
    // Fetch conversation data
    const conversation = await fetchConversation(conversationId);

    // Automatically add to interest list
    addToInterestList({
      type: 'conversation',
      title: conversation.title,
      conversation_id: conversationId,
      url: `/library/conversations/${conversationId}`
    });
  }, [conversationId]);

  // ... rest of component
}
```

### Feature 7: Contemplative Exercises

**Purpose:** Provide direct experiential tools for linguistic awakening (not just conceptual understanding).

#### Exercise 1: Word Dissolution

**Purpose:** Experience the gap between symbolic and lived reality.

**User Flow:**
1. User selects a word from transformed text (e.g., "freedom")
2. System prompts: "Feel the weight of this word. Notice emotional response."
3. User clicks "Dissolve"
4. Word fades character-by-character over 3-5 seconds
5. Silence (dark blue screen, no text)
6. Prompt: "What remains when the symbol is gone?"

**Technical Implementation:**
```jsx
<WordDissolution>
  <Stage1_Selection>
    <Instruction>Choose a word that carries weight for you</Instruction>
    <WordInput value={selectedWord} onChange={setSelectedWord} />
  </Stage1_Selection>

  <Stage2_Feeling>
    <Instruction>Feel the weight of this word</Instruction>
    <WordDisplay>{selectedWord}</WordDisplay>
    <Prompt>
      Notice any emotional response, bodily sensation, or mental association
    </Prompt>
    <ContinueButton onClick={startDissolution}>
      I'm ready to dissolve it
    </ContinueButton>
  </Stage2_Feeling>

  <Stage3_Dissolution>
    <AnimatedWord
      word={selectedWord}
      onComplete={showSilence}
      duration={4000}
      stagger={200}
    />
  </Stage3_Dissolution>

  <Stage4_Silence>
    <DarkBlueBackground />
    <CenteredText>
      <FadeIn delay={2000}>
        What remains when the symbol is gone?
      </FadeIn>
    </CenteredText>
  </Stage4_Silence>

  <Stage5_Return>
    <Reflection>
      <Prompt>What did you experience?</Prompt>
      <TextArea placeholder="(Optional) Record your insight" />
    </Reflection>
    <ReturnButton onClick={reset}>Return to transformations</ReturnButton>
  </Stage5_Return>
</WordDissolution>
```

**Animation Logic:**
```javascript
function AnimatedWord({ word, duration, stagger, onComplete }) {
  const chars = word.split('');
  const [visibleChars, setVisibleChars] = useState(chars.map(() => true));

  useEffect(() => {
    chars.forEach((char, index) => {
      setTimeout(() => {
        setVisibleChars(prev => {
          const next = [...prev];
          next[index] = false;
          return next;
        });
      }, index * stagger);
    });

    setTimeout(onComplete, chars.length * stagger + 1000);
  }, []);

  return (
    <div className="word-container">
      {chars.map((char, i) => (
        <span
          key={i}
          className={`char ${!visibleChars[i] ? 'dissolving' : ''}`}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
```

**CSS Animation:**
```css
.char {
  display: inline-block;
  font-size: 48px;
  opacity: 1;
  transition: opacity 800ms ease-out;
}

.char.dissolving {
  opacity: 0;
}
```

#### Exercise 2: Witness Mode

**Purpose:** Strip away symbolic overlays, return to pre-linguistic presence.

**User Flow:**
1. User clicks "Witness Mode" button
2. All UI elements fade away except core text
3. Text shown without formatting, frameworks, or labels
4. Prompt: "What are you experiencing right now, before naming it?"
5. User sits with pure presence
6. User exits when ready

**Technical Implementation:**
```jsx
<WitnessMode active={isWitnessMode}>
  {!isWitnessMode ? (
    <NormalUI>
      {/* Regular interface */}
      <WitnessModeButton onClick={enterWitnessMode}>
        Pause & Witness
      </WitnessModeButton>
    </NormalUI>
  ) : (
    <WitnessOverlay>
      <DarkBackground />

      <CenteredContent>
        <RawText>{stripFormatting(content)}</RawText>
      </CenteredContent>

      <BottomPrompt>
        <FadeIn delay={3000}>
          What are you experiencing right now,
          before naming it?
        </FadeIn>
      </BottomPrompt>

      <ExitButton onClick={exitWitnessMode}>
        Return
      </ExitButton>
    </WitnessOverlay>
  )}
</WitnessMode>
```

---

## Data Models

### Complete Schema Reference

```sql
-- USERS (authentication, subscription, usage tracking)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    monthly_transformations INTEGER DEFAULT 0,
    monthly_tokens_used BIGINT DEFAULT 0,
    last_reset_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    user_metadata JSONB DEFAULT '{}'
);

-- COLLECTIONS (conversations from imports)
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    platform VARCHAR(50), -- 'chatgpt', 'claude', 'custom'
    original_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    custom_metadata JSONB DEFAULT '{}'
);

-- MESSAGES (individual messages in conversations)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    role VARCHAR(20), -- 'user', 'assistant', 'system'
    author_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    model VARCHAR(100),
    custom_metadata JSONB DEFAULT '{}'
);

-- CHUNKS (message content, chunked for embeddings)
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    token_count INTEGER,
    embedding vector(1536),
    custom_metadata JSONB DEFAULT '{}'
);

-- MEDIA (images, files)
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    original_media_id TEXT UNIQUE,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    storage_path TEXT,
    width INTEGER,
    height INTEGER,
    generator VARCHAR(50), -- 'dalle', 'stable-diffusion', 'midjourney', null
    ai_prompt TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    custom_metadata JSONB DEFAULT '{}'
);

-- TRANSFORMATION_JOBS (text transformations)
CREATE TABLE transformation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_content TEXT NOT NULL,
    persona VARCHAR(100),
    namespace VARCHAR(100),
    style VARCHAR(100),
    depth FLOAT DEFAULT 0.5,
    preserve_structure BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'pending',
    result_content TEXT,
    error_message TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    custom_metadata JSONB DEFAULT '{}'
);

-- TRANSFORMATION_LINEAGE (provenance tracking)
CREATE TABLE transformation_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transformation_id UUID REFERENCES transformation_jobs(id) ON DELETE CASCADE,
    source_id UUID,
    source_type VARCHAR(50), -- 'message', 'chunk', 'transformation'
    relationship_type VARCHAR(50) DEFAULT 'derived_from',
    created_at TIMESTAMP DEFAULT NOW()
);

-- BOOKS (hierarchical documents)
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    book_type VARCHAR(50) DEFAULT 'book',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    custom_metadata JSONB DEFAULT '{}'
);

-- BOOK_SECTIONS (chapters, sections, subsections)
CREATE TABLE book_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    parent_section_id UUID REFERENCES book_sections(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT, -- markdown
    section_order INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- BOOK_CONTENT_LINKS (link transformations/messages to sections)
CREATE TABLE book_content_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES book_sections(id) ON DELETE CASCADE,
    content_type VARCHAR(50), -- 'message', 'transformation', 'media'
    content_id UUID NOT NULL,
    link_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES (for performance)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_created ON collections(created_at DESC);
CREATE INDEX idx_messages_collection ON messages(collection_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_chunks_message ON chunks(message_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_media_message ON media(message_id);
CREATE INDEX idx_media_original ON media(original_media_id);
CREATE INDEX idx_media_generator ON media(generator);
CREATE INDEX idx_transform_user ON transformation_jobs(user_id);
CREATE INDEX idx_transform_status ON transformation_jobs(status);
CREATE INDEX idx_lineage_transform ON transformation_lineage(transformation_id);
CREATE INDEX idx_lineage_source ON transformation_lineage(source_id, source_type);
CREATE INDEX idx_books_user ON books(user_id);
CREATE INDEX idx_sections_book ON book_sections(book_id);
CREATE INDEX idx_sections_order ON book_sections(book_id, section_order);
CREATE INDEX idx_content_links_section ON book_content_links(section_id);
```

### Relationships Diagram

```
users
  │
  ├─1:N─► collections (conversations)
  │         │
  │         ├─1:N─► messages
  │         │         │
  │         │         ├─1:N─► chunks (with embeddings)
  │         │         └─1:N─► media (images)
  │         │
  │
  ├─1:N─► transformation_jobs
  │         │
  │         └─1:N─► transformation_lineage
  │                   (tracks source: message/chunk/transformation)
  │
  └─1:N─► books
            │
            └─1:N─► book_sections
                      │
                      ├─1:N─► book_sections (nested hierarchy)
                      │
                      └─1:N─► book_content_links
                                (link to messages/transformations/media)
```

---

## API Specifications

### Authentication (Planned)

**Login:**
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response 200:
{
  "access_token": "jwt-token-here",
  "refresh_token": "refresh-token-here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "premium"
  }
}
```

**Register:**
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "User Name"
}

Response 201:
{
  "user_id": "uuid",
  "message": "Verification email sent"
}
```

### Transformation API

**Create Transformation:**
```
POST /api/transform
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "content": "Text to transform",
  "persona": "scholar",
  "namespace": "academic",
  "style": "formal",
  "depth": 0.7,
  "preserve_structure": true
}

Response 200:
{
  "transformation_id": "uuid",
  "result": "Transformed text...",
  "parameters": {...},
  "tokens_used": {"input": 20, "output": 85},
  "created_at": "2025-10-07T12:00:00Z"
}
```

**Multi-Perspective Generation:**
```
POST /api/transform/multi-perspective
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "content": "Text to transform",
  "perspectives": [
    {"persona": "scholar", "namespace": "academic", "style": "formal"},
    {"persona": "poet", "namespace": "aesthetic", "style": "lyrical"},
    {"persona": "skeptic", "namespace": "philosophy", "style": "questioning"}
  ]
}

Response 200:
{
  "transformations": [
    {
      "transformation_id": "uuid-1",
      "perspective": {"persona": "scholar", ...},
      "result": "..."
    },
    {
      "transformation_id": "uuid-2",
      "perspective": {"persona": "poet", ...},
      "result": "..."
    },
    {
      "transformation_id": "uuid-3",
      "perspective": {"persona": "skeptic", ...},
      "result": "..."
    }
  ],
  "total_tokens_used": {"input": 60, "output": 255}
}
```

### Library API

**List Collections:**
```
GET /api/library/collections?limit=50&offset=0&sort=created_desc
Authorization: Bearer <jwt-token>

Response 200:
{
  "collections": [
    {
      "id": "uuid",
      "title": "Conversation Title",
      "platform": "chatgpt",
      "message_count": 45,
      "created_at": "2025-08-01T10:00:00Z"
    },
    ...
  ],
  "total": 1660,
  "limit": 50,
  "offset": 0
}
```

**Get Collection with Messages:**
```
GET /api/library/collections/{collection_id}?include_messages=true&limit=20
Authorization: Bearer <jwt-token>

Response 200:
{
  "id": "uuid",
  "title": "Conversation Title",
  "platform": "chatgpt",
  "created_at": "2025-08-01T10:00:00Z",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content_preview": "First 200 chars...",
      "created_at": "2025-08-01T10:01:00Z",
      "has_media": false
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content_preview": "Response preview...",
      "created_at": "2025-08-01T10:02:00Z",
      "model": "gpt-4",
      "has_media": true
    }
  ],
  "total_messages": 45
}
```

**Semantic Search:**
```
GET /api/library/search?q=quantum+consciousness&limit=25&min_similarity=0.7
Authorization: Bearer <jwt-token>

Response 200:
{
  "query": "quantum consciousness",
  "results": [
    {
      "chunk_id": "uuid",
      "message_id": "uuid",
      "conversation_id": "uuid",
      "conversation_title": "QBism Discussion",
      "content": "Full chunk content...",
      "similarity": 0.89,
      "created_at": "2025-08-15T14:00:00Z"
    },
    ...
  ],
  "total_results": 47,
  "search_time_ms": 23
}
```

### Import API

**Import ChatGPT Archive:**
```
POST /api/import/chatgpt
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

file: conversations.json

Response 202:
{
  "import_job_id": "uuid",
  "status": "processing",
  "message": "Import started. Check /api/import/status/{import_job_id}"
}
```

**Check Import Status:**
```
GET /api/import/status/{import_job_id}
Authorization: Bearer <jwt-token>

Response 200:
{
  "import_job_id": "uuid",
  "status": "completed",
  "progress": {
    "collections_imported": 150,
    "messages_imported": 3450,
    "media_imported": 87,
    "total_collections": 150
  },
  "started_at": "2025-10-07T12:00:00Z",
  "completed_at": "2025-10-07T12:05:30Z"
}
```

### Book API

**Create Book:**
```
POST /api/books
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "My Research Paper",
  "description": "Exploration of consciousness and language",
  "book_type": "paper"
}

Response 201:
{
  "book_id": "uuid",
  "title": "My Research Paper",
  "created_at": "2025-10-07T12:00:00Z"
}
```

**Create Section:**
```
POST /api/books/{book_id}/sections
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Introduction",
  "content": "# Introduction\n\nThis paper explores...",
  "parent_section_id": null,
  "level": 1,
  "section_order": 0
}

Response 201:
{
  "section_id": "uuid",
  "book_id": "uuid",
  "title": "Introduction",
  "level": 1,
  "created_at": "2025-10-07T12:01:00Z"
}
```

**Link Content to Section:**
```
POST /api/books/{book_id}/sections/{section_id}/links
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "content_type": "transformation",
  "content_id": "transformation-uuid",
  "link_order": 0,
  "notes": "Scholar perspective on main argument"
}

Response 201:
{
  "link_id": "uuid",
  "content_type": "transformation",
  "content_id": "transformation-uuid",
  "created_at": "2025-10-07T12:02:00Z"
}
```

### Philosophical API

**Madhyamaka Detection:**
```
POST /api/philosophical/madhyamaka/detect
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "text": "The self neither exists nor does not exist...",
  "detailed": true
}

Response 200:
{
  "probability": 0.92,
  "classification": "likely_madhyamaka",
  "patterns_detected": [
    {
      "type": "dialectical_negation",
      "confidence": 0.95,
      "quote": "neither exists nor does not exist",
      "explanation": "Classic tetralemma structure"
    }
  ],
  "suggested_next_steps": [
    "Generate perspectives from substantialist viewpoint",
    "Compare with Yogacara interpretation"
  ]
}
```

**Generate Multi-Perspective Analysis:**
```
POST /api/philosophical/perspectives/generate
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "source_text": "Original text with Middle Path reasoning",
  "perspectives": ["substantialist", "nihilist", "phenomenological"]
}

Response 200:
{
  "perspectives": [
    {
      "viewpoint": "substantialist",
      "analysis": "From a substantialist view, the self exists as...",
      "key_differences": "Asserts inherent existence vs. Madhyamaka's rejection"
    },
    {
      "viewpoint": "nihilist",
      "analysis": "A nihilist would argue nothing exists at all...",
      "key_differences": "Negates all existence vs. Madhyamaka's middle path"
    },
    {
      "viewpoint": "phenomenological",
      "analysis": "Phenomenologically, we bracket existence claims and return to...",
      "key_differences": "Methodological suspension vs. ontological claim"
    }
  ]
}
```

---

## UI/UX Specifications

### Visual Design System

**Color Palette (Three Realms):**

```css
/* Corporeal Realm (Physical/Grounding) - Green */
--corporeal-primary: #2D7D6E;
--corporeal-secondary: #4A9B8E;
--corporeal-accent: #6DBFB3;

/* Symbolic Realm (Constructed/Abstract) - Purple */
--symbolic-primary: #6B46C1;
--symbolic-secondary: #8B5CF6;
--symbolic-accent: #A78BFA;

/* Subjective Realm (Conscious/Presence) - Dark Blue */
--subjective-primary: #1E1B4B;
--subjective-secondary: #312E81;
--subjective-accent: #4C1D95;

/* Neutral Tones */
--bg-dark: #0F172A;
--bg-medium: #1E293B;
--bg-light: #334155;
--text-primary: #F1F5F9;
--text-secondary: #CBD5E1;
--text-muted: #94A3B8;
```

**Typography:**

```css
/* Fonts */
--font-serif: "Crimson Pro", "Lora", serif; /* Contemplative */
--font-sans: "Inter", "Source Sans 3", sans-serif; /* Structural */
--font-mono: "JetBrains Mono", "Fira Code", monospace; /* Technical */

/* Scales */
--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */
--text-4xl: 2.25rem;  /* 36px */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

**Spacing System (8px base):**

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-24: 6rem;    /* 96px */
```

**Component Patterns:**

**Button Styles:**
```css
/* Primary Action (Purple - Symbolic) */
.btn-primary {
  background: var(--symbolic-primary);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 200ms ease;
}

.btn-primary:hover {
  background: var(--symbolic-secondary);
  transform: translateY(-1px);
}

/* Secondary Action (Green - Corporeal) */
.btn-secondary {
  background: var(--corporeal-primary);
  color: var(--text-primary);
  /* ... same structure */
}

/* Contemplative Action (Dark Blue - Subjective) */
.btn-contemplative {
  background: var(--subjective-primary);
  color: var(--text-primary);
  /* ... same structure */
}
```

**Card Layouts:**
```css
.card {
  background: var(--bg-medium);
  border-radius: 0.75rem;
  padding: var(--space-6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card-corporeal {
  border-left: 4px solid var(--corporeal-primary);
}

.card-symbolic {
  border-left: 4px solid var(--symbolic-primary);
}

.card-subjective {
  border-left: 4px solid var(--subjective-primary);
}
```

### Layout Architecture

**Workstation Layout (Main Interface):**

```
┌────────────────────────────────────────────────────────────┐
│  Header (Logo, User Menu, Global Search)                  │
├──────┬─────────────────────────────────────────────────────┤
│      │                                                     │
│ Side │  Main Content Area                                 │
│ bar  │  (Tabs: Library, Transformations, Books, etc.)     │
│      │                                                     │
│ 📚   │  ┌─────────────────────────────────────────────┐   │
│ 🔧   │  │                                             │   │
│ 📖   │  │  Active Content                             │   │
│ 🖼️   │  │  (varies by tab)                            │   │
│ 🗂️   │  │                                             │   │
│      │  └─────────────────────────────────────────────┘   │
│      │                                                     │
│      │  Inspector Pane (Bottom, resizable)                │
│      │  ┌─────────────────────────────────────────────┐   │
│      │  │ Message Viewer / Metadata / Details         │   │
│      │  └─────────────────────────────────────────────┘   │
│      │                                                     │
├──────┴─────────────────────────────────────────────────────┤
│  Interest List (Collapsible Panel, Right Side)            │
│  Shows "Browse Path" chronologically                      │
└────────────────────────────────────────────────────────────┘
```

**Book Builder Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  Book: "My Research Paper"                [Save] [Export]  │
├────────┬───────────────────────────┬───────────────────────┤
│        │                           │                       │
│ Book   │  Editor                   │  Preview              │
│ Outline│  ┌─────────────────────┐  │  ┌─────────────────┐ │
│        │  │ # Introduction      │  │  │ Introduction    │ │
│ □ Intro│  │                     │  │  │                 │ │
│ □ Ch 1 │  │ This paper...       │  │  │ This paper...   │ │
│ □ Ch 2 │  │                     │  │  │                 │ │
│ □ Concl│  │ ## Background       │  │  │ Background      │ │
│        │  │ Historical context  │  │  │ Historical...   │ │
│        │  └─────────────────────┘  │  └─────────────────┘ │
│        │                           │                       │
│        │  Linked Content:          │  (Live Preview with   │
│        │  ┌─────────────────────┐  │   LaTeX + Images)     │
│        │  │ 🔄 Transformation   │  │                       │
│        │  │ Scholar perspective │  │                       │
│        │  └─────────────────────┘  │                       │
│        │  [+ Add Content]          │                       │
└────────┴───────────────────────────┴───────────────────────┘
```

**Transformation Interface:**

```
┌────────────────────────────────────────────────────────────┐
│  Transform Text                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Source Text (Corporeal - Green Border)                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │ We need to increase quarterly revenue.             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Belief Frameworks (Symbolic - Purple)                     │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐                  │
│  │ PERSONA │  │NAMESPACE │  │ STYLE   │                  │
│  │Scholar ▼│  │Academic ▼│  │Formal ▼ │                  │
│  └─────────┘  └──────────┘  └─────────┘                  │
│                                                            │
│  [Transform] [Generate 3 Perspectives]                     │
│                                                            │
│  Perspectives (Side-by-Side)                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Scholar/    │ │ Poet/       │ │ Skeptic/    │         │
│  │ Academic/   │ │ Aesthetic/  │ │ Philosophy/ │         │
│  │ Formal      │ │ Lyrical     │ │ Questioning │         │
│  │             │ │             │ │             │         │
│  │Q4 targets...│ │Garden must..│ │What "need"? │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Interaction Patterns

**Micro-Interactions:**

1. **Hover on Framework Labels:** Show philosophical tooltip
   ```
   Hover on "PERSONA: Scholar"
   → Tooltip: "The academic belief framework emphasizing rigor,
              evidence, and formal citation practices."
   ```

2. **Long-Press on Transformed Text:** Deep context
   ```
   Long-press (800ms) on output
   → "This perspective feels different because the emotional
      belief framework shifted from urgency to calm reflection."
   ```

3. **Animation Timing:**
   - Fade-ins: 400-600ms
   - Transitions: 600-800ms
   - Contemplative pauses: 2000-3000ms

**Navigation Flow:**

```
User Journey Through App:

1. Login/Onboarding
   ↓
2. Import Archive (or skip to demo)
   ↓
3. Browse Library (conversations, messages)
   ↓
4. Select Content → Add to Interest List (automatic)
   ↓
5. Transform Content (PERSONA/NAMESPACE/STYLE)
   ↓
6. Experience Multi-Perspective View
   ↓
7. "Aha Moment" Prompt appears (optional, dismissible)
   ↓
8. Add to Book or Continue Exploring
   ↓
9. [Advanced] Contemplative Exercises (Word Dissolution, Witness Mode)
   ↓
10. Export Book / Share Journey
```

---

## User Journey

### The 5-Stage Awakening Path

**Stage 1: Entry (Utility Focus)**
- User arrives seeking text transformation tool
- Use interface with minimal friction
- Get competent results immediately
- Subtle philosophical hints (not forced)

**Stage 2: Engagement (Pattern Recognition)**
- User experiments with different parameters
- Notices outputs "feel" different
- Curiosity about how frameworks work
- Multi-perspective display unlocked

**Stage 3: Insight (Constructed Meaning)**
- User intellectually understands: meaning is constructed
- Engages with educational content
- Uploads archive for belief pattern analysis
- Views semantic network of concepts

**Stage 4: Awakening (Subjective Agency)**
- User has direct experiential realization
- Engages contemplative exercises
- Witnesses gap between language and lived experience
- Recognizes: "I am the constructor of meaning"

**Stage 5: Integration (Conscious Use)**
- User uses language consciously
- Creates custom frameworks
- Shares insights with community
- Uses platform as ongoing contemplative practice

**Key Metric:** Not "conversion rate to Stage 5" but "users find value at whatever stage serves them."

### Onboarding Flow

```
First Visit:
1. Landing page: "Transform language, witness consciousness"
2. Quick demo (no signup required)
   - Pre-loaded text
   - One-click transformation
   - See 3 perspectives instantly
3. "Want to transform your own archives?" → Signup
4. Import archive (ChatGPT/Claude)
5. "Your archive is ready. Start exploring."

No overwhelming tutorials. Learning by doing.
```

---

## Success Metrics

### Stage 1-2 Metrics (Utility)

**Engagement:**
- Active users (DAU, WAU, MAU)
- Transformations per user
- Return rate (7-day, 30-day)
- Archive import completion rate

**Performance:**
- Transformation latency (<2s target)
- Search response time (<100ms target)
- Uptime (99.9% target)

### Stage 3-5 Metrics (Philosophical)

**Qualitative:**
- User reports: "I understand meaning is constructed"
- Engagement with educational content (video views, article reads)
- Contemplative exercise completions
- Custom framework creations

**Behavioral:**
- Time in Word Dissolution / Witness Mode
- Archive analysis depth (belief network views)
- Community participation (forum posts, sharing insights)
- Interest List review frequency (witnessing browse path)

**Impact:**
- Survey: "Has this changed your relationship to language?"
- Testimonials about "awakening moments"
- Long-term retention (6+ months)

### Revenue Metrics (If SaaS)

**Free Tier:**
- Conversion to paid (target: 2-5%)
- Reasons for upgrading (more transformations, cloud sync, community)

**Premium Tier:**
- Churn rate (target: <5% monthly)
- Lifetime value (LTV)
- Customer acquisition cost (CAC)
- LTV:CAC ratio (target: >3:1)

---

## Roadmap

### Completed (Oct 2025)

- ✅ MVP Backend (FastAPI + PostgreSQL)
- ✅ MVP Frontend (React + Vite)
- ✅ Archive Import (ChatGPT, Claude)
- ✅ Transformation Engine (PERSONA/NAMESPACE/STYLE)
- ✅ Madhyamaka Detection (89% accuracy)
- ✅ Semantic Search (pgvector)
- ✅ Book Builder Phase 1 & 2
- ✅ Image System (8,640 media, EXIF extraction)
- ✅ Frontend Testing (132 tests)
- ✅ Database Switching (isolation for testing)

### Q4 2025: Foundation Solidification

**October:**
- [ ] Book Builder Phase 3 (CRUD on content cards)
- [ ] Vision OCR background processing
- [ ] Comprehensive UI testing (Chrome DevTools MCP)
- [ ] Performance optimization (query tuning, caching)

**November:**
- [ ] User authentication (JWT tokens)
- [ ] Subscription system (Stripe integration)
- [ ] Usage tracking & rate limiting
- [ ] Email notifications (verification, alerts)

**December:**
- [ ] LaTeX export (books → .tex files)
- [ ] PDF generation (LaTeX → PDF compilation)
- [ ] Bibliography generator (BibTeX integration)
- [ ] Beta user testing (10-20 users)

### Q1 2026: Production Launch

**January:**
- [ ] Cloudflare Workers migration (edge deployment)
- [ ] D1 database migration (SQLite at edge)
- [ ] R2 media storage (object storage)
- [ ] Global CDN configuration

**February:**
- [ ] Security audit (penetration testing)
- [ ] Performance tuning (global latency optimization)
- [ ] Monitoring & alerting (Sentry, analytics)
- [ ] Documentation (user guides, API docs)

**March:**
- [ ] Public launch (humanizer.com)
- [ ] Marketing campaign (Product Hunt, HN, Twitter)
- [ ] Community features (forums, sharing)
- [ ] First 100 paying customers

### Q2 2026: Contemplative Features

**April-June:**
- [ ] Word Dissolution exercise (fully implemented)
- [ ] Socratic Dialogue AI (question generation)
- [ ] Witness Mode (advanced)
- [ ] Belief Network Visualization (interactive graph)
- [ ] Custom Framework Creator (user-defined PERSONA/NAMESPACE/STYLE)
- [ ] Contemplative Community (discussion forums, shared insights)

### Q3-Q4 2026: Advanced Features

- [ ] Voice transformation (audio → text → transform → audio)
- [ ] Video transformation (subtitle editing with multi-perspective)
- [ ] Collaborative books (team editing)
- [ ] Academic integration (Zotero, Mendeley, ResearchGate)
- [ ] API for developers (public API access)
- [ ] Mobile apps (iOS, Android)

---

## Implementation Guide

### For Developers Recreating This Tool

This section provides step-by-step instructions to build Humanizer Agent from scratch on a new platform.

#### Phase 1: Database Setup (Week 1)

**1. Install PostgreSQL 17 with pgvector:**
```bash
# macOS
brew install postgresql@17
brew install pgvector

# Ubuntu/Debian
sudo apt-get install postgresql-17 postgresql-17-pgvector

# Start PostgreSQL
brew services start postgresql@17  # macOS
sudo systemctl start postgresql    # Linux
```

**2. Create database and user:**
```sql
CREATE DATABASE humanizer_dev;
CREATE USER humanizer_app WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE humanizer_dev TO humanizer_app;

-- Enable pgvector extension
\c humanizer_dev
CREATE EXTENSION vector;
```

**3. Run schema creation:**
```sql
-- Copy all CREATE TABLE statements from "Data Models" section above
-- Execute them in order
```

**4. Create indexes:**
```sql
-- Copy all CREATE INDEX statements from "Data Models" section
-- Execute them
```

#### Phase 2: Backend Setup (Week 2-3)

**1. Initialize Python project:**
```bash
mkdir humanizer-backend
cd humanizer-backend
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy asyncpg anthropic \
            sentence-transformers pgvector alembic pydantic
```

**2. Project structure:**
```
backend/
├── main.py                    # FastAPI app entry point
├── config.py                  # Settings (database URL, API keys)
├── database/
│   ├── connection.py          # SQLAlchemy setup
│   └── embeddings.py          # Embedding service
├── models/
│   └── db_models.py           # SQLAlchemy models
├── api/
│   ├── routes.py              # Transformation endpoints
│   ├── library_routes.py      # Collections, messages, search
│   ├── book_routes.py         # Book builder CRUD
│   ├── import_routes.py       # Archive import
│   └── philosophical_routes.py # Madhyamaka, perspectives
├── services/
│   ├── transformation.py      # Claude API integration
│   ├── madhyamaka.py          # Detection service
│   └── importer.py            # Archive parsing
└── tests/
    └── test_*.py              # Pytest tests
```

**3. Implement core modules in order:**

**Step 1:** Database connection (`database/connection.py`)
- AsyncEngine creation
- Session maker
- get_db() dependency

**Step 2:** Models (`models/db_models.py`)
- User, Collection, Message, Chunk, Media
- TransformationJob, Book, BookSection
- Relationships

**Step 3:** Transformation service (`services/transformation.py`)
- Claude API client
- Prompt template builder
- Transform function

**Step 4:** API routes (`api/routes.py`)
- POST /api/transform
- GET /api/transform/{id}
- POST /api/transform/multi-perspective

**Step 5:** Library routes (`api/library_routes.py`)
- GET /api/library/collections
- GET /api/library/collections/{id}
- GET /api/library/search (vector similarity)

**Step 6:** Import service (`services/importer.py`)
- ChatGPT JSON parser
- Claude export parser
- Media extraction

**Step 7:** Book routes (`api/book_routes.py`)
- CRUD for books
- CRUD for sections
- Content linking

**4. Configuration (`config.py`):**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str
    embedding_model: str = "voyage-3"
    embedding_dimension: int = 1536

    class Config:
        env_file = ".env"

settings = Settings()
```

**5. Run development server:**
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

#### Phase 3: Frontend Setup (Week 4-5)

**1. Initialize React project:**
```bash
npm create vite@latest humanizer-frontend -- --template react
cd humanizer-frontend
npm install

# Install dependencies
npm install axios react-router-dom \
            @uiw/react-codemirror react-markdown remark-gfm remark-math \
            katex tailwindcss daisyui react-resizable-panels
```

**2. Configure Tailwind:**
```bash
npx tailwindcss init -p
```

```javascript
// tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        corporeal: {
          primary: '#2D7D6E',
          secondary: '#4A9B8E',
          accent: '#6DBFB3',
        },
        symbolic: {
          primary: '#6B46C1',
          secondary: '#8B5CF6',
          accent: '#A78BFA',
        },
        subjective: {
          primary: '#1E1B4B',
          secondary: '#312E81',
          accent: '#4C1D95',
        },
      },
    },
  },
  plugins: [require('daisyui')],
}
```

**3. Project structure:**
```
frontend/src/
├── App.jsx                    # Main app component
├── main.jsx                   # Entry point
├── contexts/
│   ├── WorkspaceContext.jsx   # Global state
│   └── InterestListContext.jsx # Browse path tracking
├── components/
│   ├── Workstation.jsx        # Main layout
│   ├── TransformationInterface.jsx
│   ├── LibraryBrowser.jsx
│   ├── BookBuilder.jsx
│   ├── ImageBrowser.jsx
│   ├── ConversationViewer.jsx
│   └── MessageViewer.jsx
├── hooks/
│   ├── useListNavigation.js   # Keyboard navigation
│   └── useWorkspace.js        # Workspace state
└── utils/
    ├── api.js                 # Axios client
    └── formatters.js          # Text formatting
```

**4. Implement components in order:**

**Step 1:** API client (`utils/api.js`)
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const transform = (data) => api.post('/transform', data);
export const getCollections = (params) => api.get('/library/collections', { params });
export const searchLibrary = (query) => api.get('/library/search', { params: { q: query } });
// ... more endpoints

export default api;
```

**Step 2:** Workspace Context (`contexts/WorkspaceContext.jsx`)
- Tab management
- Inspector pane state
- Interest list integration

**Step 3:** Main Layout (`components/Workstation.jsx`)
- Sidebar navigation
- Main content area
- Inspector pane
- Interest list panel

**Step 4:** Feature Components
- TransformationInterface
- LibraryBrowser
- BookBuilder
- etc.

**5. Run development server:**
```bash
npm run dev
```

#### Phase 4: Integration & Testing (Week 6)

**1. Connect frontend to backend:**
- Update API URLs
- Test all endpoints
- Handle errors gracefully

**2. Implement authentication (if needed):**
- JWT token storage
- Protected routes
- Login/logout flow

**3. Write tests:**
```bash
# Backend
pytest tests/

# Frontend
npm test
npm run test:e2e
```

**4. Performance optimization:**
- Database query optimization
- Frontend code splitting
- Image lazy loading
- Caching strategies

#### Phase 5: Deployment (Week 7-8)

**Option A: Traditional Deployment**

**Backend:**
```bash
# Docker container
docker build -t humanizer-backend .
docker run -p 8000:8000 humanizer-backend

# Or systemd service
sudo systemctl start humanizer-backend
```

**Frontend:**
```bash
# Build for production
npm run build

# Serve with nginx
sudo cp -r dist/* /var/www/html/
```

**Option B: Cloudflare Workers (Recommended)**

**Backend:**
```bash
# Migrate to Cloudflare Workers
npm install wrangler -g
wrangler init humanizer-api

# Deploy
wrangler publish
```

**Frontend:**
```bash
# Deploy to Cloudflare Pages
wrangler pages publish dist
```

**Database:**
```bash
# Use Cloudflare D1 (SQLite at edge)
wrangler d1 create humanizer-db
wrangler d1 execute humanizer-db --file=schema.sql
```

#### Phase 6: Launch Checklist

**Pre-Launch:**
- [ ] All tests passing (backend + frontend)
- [ ] Security audit complete
- [ ] Performance benchmarks met (<2s transformations, <100ms search)
- [ ] Documentation written (user guide, API docs)
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (PostHog, Plausible)
- [ ] Backup system tested
- [ ] SSL certificates configured
- [ ] Custom domain configured (humanizer.com)

**Launch Day:**
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Test critical user flows
- [ ] Announce on social media
- [ ] Post on Product Hunt / Hacker News

**Post-Launch:**
- [ ] Gather user feedback
- [ ] Fix critical bugs (within 24h)
- [ ] Monitor server costs
- [ ] Plan iteration based on usage patterns

---

## Conclusion

**Humanizer Agent is not just a text transformation tool—it's a contemplative practice that reveals the constructed nature of meaning.**

By making belief frameworks visible, generating multi-perspective outputs, and providing direct experiential exercises, it helps users shift from unconscious linguistic identification to conscious subjective agency.

**Core Innovation:** Transparency over optimization. Show the frameworks. Reveal the construction. Witness consciousness.

**Market Opportunity:** No competitor does this. All AI writing tools hide assumptions and optimize for "better." We expose assumptions and celebrate multiplicity.

**Path Forward:**
1. **Q4 2025:** Solidify foundation (auth, subscriptions, LaTeX export)
2. **Q1 2026:** Launch humanizer.com (Cloudflare edge deployment)
3. **Q2 2026:** Contemplative features (Word Dissolution, Witness Mode, Community)
4. **Q3+ 2026:** Advanced features (voice, video, mobile apps)

**Mission:** Help people realize language is a sense through which consciousness constructs meaning—not objective reality to discover.

**Vision:** A world where people use language consciously, aware of the frameworks they invoke, free from unconscious identification with symbolic constructions.

**Invitation:** Build with us. This is philosophy made manifest in code.

---

**Contact:** [Your contact info]
**Repository:** [GitHub URL]
**Website:** humanizer.com (coming Q1 2026)
**Documentation:** [Link to full docs]

---

*"The map is not the territory. The menu is not the meal. Language is not reality—it's just how we taste it."*
