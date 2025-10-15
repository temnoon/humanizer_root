# Narrative Objects Architecture
## Unified Multi-User Platform with Privacy-First AUI/GUI/API/CLI Integration

**Date**: October 12, 2025
**Status**: Architectural Proposal
**Philosophy**: Post-social, privacy-first, self-improving platform

---

## Executive Summary

This document proposes a **narrative object-centric architecture** where:

1. **Narrative Objects** are first-class citizens (conversations, transformations, notes, artifacts)
2. **Multi-user** with strong privacy guarantees (veiled identities, billing separation)
3. **Post-social principles** enforced by agent moderation
4. **Self-improving UI** where AUI/GUI/API/CLI learn from each other

### Core Innovation: The Learning Loop

```
User asks AUI: "Can you show me my transformation history?"
  ↓
AUI discovers: This is possible via API but not in GUI
  ↓
AUI teaches User: Opens API response, suggests GUI feature
  ↓
User & AUI collaborate: Design the GUI component
  ↓
Feature added to GUI
  ↓
Next user: Can now access via GUI or natural language
  ↓
CLI tool generated automatically from API schema
```

**Result**: Feature parity emerges organically through human-AI collaboration.

---

## 1. Narrative Objects Model

### What Are Narrative Objects?

**Definition**: Any semantic entity with provenance, transformations, and references.

### Core Types

```python
class NarrativeObject(ABC):
    """Base class for all narrative objects."""

    # Identity
    id: UUID
    type: NarrativeObjectType  # message, conversation, transformation, note, artifact

    # Ownership & Privacy
    owner_id: UUID
    avatar_id: UUID | None  # Which avatar created this
    visibility: Visibility  # private, shared, public
    encryption_key_id: UUID | None

    # Content
    content: str | dict
    embeddings: Vector[1024] | None
    language: str  # ISO 639-1

    # Provenance
    source_objects: List[UUID]  # What this derived from
    source_operation: str | None  # How it was created
    source_params: dict | None

    # Transformations
    transformations: List[Transformation]  # History of changes

    # References
    references_to: List[UUID]  # Objects this refers to
    referenced_by: List[UUID]  # Objects referring to this

    # Annotations
    notes: List[Note]  # User notes on this object
    tags: List[str]
    topics: List[str]

    # Metadata
    created_at: datetime
    updated_at: datetime
    accessed_at: datetime

    # Social (optional)
    shared_with: List[UUID]  # User IDs with access
    permissions: dict  # Fine-grained permissions
```

### Narrative Object Types

| Type | Description | Example |
|------|-------------|---------|
| **Message** | Single unit of text with metadata | ChatGPT message, email, tweet |
| **Conversation** | Collection of messages with flow | Chat session, email thread |
| **Transformation** | Text transformation with provenance | Personification, translation, summary |
| **Note** | User annotation on any object | Observation, question, insight |
| **Artifact** | Persistent semantic output | Report, extraction, synthesis |
| **Collection** | User-curated grouping | Reading list, research topic |
| **Link** | Semantic relationship | "contradicts", "supports", "extends" |

### Key Properties

1. **Everything is addressable** - Every object has a UUID
2. **Everything has provenance** - Track where objects came from
3. **Everything can be transformed** - Apply operations to any object
4. **Everything can be annotated** - Add notes, tags, topics
5. **Everything can be linked** - Create semantic relationships
6. **Everything can be shared** - With fine-grained permissions

---

## 2. Multi-User Privacy Architecture

### Identity Model: Veiled & Multi-Avatar

#### Database Schema

```sql
-- Core identity (minimal PII)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,  -- For auth only, never exposed
    email_hash VARCHAR(64),      -- For gravatar, etc.
    password_hash VARCHAR(255),  -- bcrypt
    created_at TIMESTAMPTZ,

    -- Privacy flags
    is_anonymous BOOLEAN DEFAULT false,
    consent_analytics BOOLEAN DEFAULT false,
    consent_ai_training BOOLEAN DEFAULT false,

    -- Billing separation (in separate microservice)
    billing_customer_id UUID,   -- References external billing service

    -- Preferences
    preferences JSONB
);

-- Avatars (multiple per user)
CREATE TABLE avatars (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Avatar identity (what others see)
    display_name VARCHAR(100),  -- Can be pseudonym
    avatar_url VARCHAR(500),
    bio TEXT,

    -- Avatar type
    is_primary BOOLEAN DEFAULT false,
    avatar_seed VARCHAR(100),    -- For deterministic generation

    -- Metadata
    created_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

-- Ownership (all narrative objects)
ALTER TABLE narrative_objects
    ADD COLUMN owner_id UUID REFERENCES users(id),
    ADD COLUMN avatar_id UUID REFERENCES avatars(id),
    ADD COLUMN visibility VARCHAR(20) DEFAULT 'private',
    ADD COLUMN encrypted BOOLEAN DEFAULT false;
```

### Billing Separation Strategy

**Goal**: Legally separate billing records from user activity.

**Architecture**:

```
┌─────────────────────────────────────┐
│     Humanizer.com Platform          │
│  (User activity, content, AI ops)   │
│                                     │
│  user_id: abc-123                   │
│  billing_customer_id: cust_xyz      │ ← Opaque reference
└─────────────────────────────────────┘
              ↕ (API only)
┌─────────────────────────────────────┐
│   Billing Microservice (Separate)   │
│  (Stripe, payment processing)        │
│                                     │
│  customer_id: cust_xyz              │
│  email: user@example.com            │
│  payment_methods: [...]             │
└─────────────────────────────────────┘
```

**Implementation**:
- **Separate database** for billing (different host/region)
- **Separate service** (billing-service.internal)
- **API gateway** enforces separation
- **Webhook auth** via signed tokens
- **No direct joins** between user activity and billing

**Legal Benefits**:
- Billing records in separate jurisdiction
- Can provide user data without billing info
- Can provide billing info without activity logs
- Complies with data minimization principles

**Practical Implementation**:
```python
# In main app
class User:
    id: UUID
    billing_customer_id: str  # Opaque reference

    async def get_subscription_status(self) -> SubscriptionStatus:
        # Call external billing service
        return await billing_service.check_status(
            self.billing_customer_id
        )

# Billing service (separate FastAPI app)
class BillingService:
    async def check_status(self, customer_id: str) -> SubscriptionStatus:
        # Query Stripe, return status only
        return SubscriptionStatus(
            is_active=True,
            tier="premium",
            usage_limit=10000
        )
```

### Encryption Strategy

**Goal**: End-to-end encryption for sensitive narrative objects.

**Model**: Hybrid encryption (RSA + AES)

```python
# User keypair (generated client-side)
class UserKeypair:
    public_key: str   # Stored on server
    private_key: str  # Stored in browser (encrypted with password)

# Object encryption
class EncryptedObject:
    object_id: UUID
    encrypted_content: bytes     # AES-256 encrypted
    encrypted_key: bytes         # RSA encrypted AES key
    encryption_metadata: dict    # Algorithm, IV, etc.

# Sharing (re-encryption)
class SharedKey:
    object_id: UUID
    recipient_avatar_id: UUID
    encrypted_key: bytes  # Object key encrypted with recipient's public key
```

**Flow**:
1. User creates narrative object
2. Client generates AES key, encrypts content
3. Client encrypts AES key with user's public key
4. Both sent to server
5. To share: Client re-encrypts AES key with recipient's public key
6. Server stores shared key (can't decrypt)

**Trade-offs**:
- ✅ Server can't read content
- ✅ Can still search encrypted objects by metadata/tags
- ❌ Can't do server-side semantic search on encrypted content
- ✅ Can do client-side decryption → embedding → search

---

## 3. Post-Social Principles

### Design Philosophy

**Traditional Social Network**:
- Real identities expected
- Follower counts as status
- Engagement metrics prioritized
- Public by default
- Advertising-driven

**Post-Social (Humanizer)**:
- Identities conventionally veiled
- No follower counts or metrics
- Meaning-making prioritized
- Private by default
- Subscription-driven

### Implementation

#### 1. Veiled Identities

```python
# When User A sees User B's content
class PublicProfile:
    avatar_id: UUID
    display_name: str  # Pseudonym
    avatar_url: str
    bio: str

    # NO email, NO real name, NO location
    # NO follower count, NO engagement metrics
    # NO "online status"
```

#### 2. Agent Moderation

**Automated Enforcement**:

```python
class ModerationAgent:
    """AI agent that reviews all public content."""

    async def moderate_content(self, obj: NarrativeObject) -> ModerationResult:
        """Check for policy violations."""

        checks = await asyncio.gather(
            self.check_violence(obj.content),
            self.check_threats(obj.content),
            self.check_trolling(obj.content),
            self.check_spam(obj.content),
        )

        return ModerationResult(
            approved=all(c.passed for c in checks),
            violations=[c for c in checks if not c.passed],
            confidence=min(c.confidence for c in checks)
        )

    async def check_violence(self, text: str) -> Check:
        """Detect violent content."""
        # Use LLM with safety-tuned prompt
        # Return confidence score + explanation
        ...
```

**Three-Strike System**:
1. First violation: Content hidden + warning
2. Second violation: Temp suspension (7 days)
3. Third violation: Permanent ban

**Appeals Process**:
- Human review requested
- Review board (community + staff)
- Transparent process

#### 3. Privacy-First Sharing

```python
class SharingModel:
    """Fine-grained sharing controls."""

    levels = [
        "private",          # Only owner
        "avatar_shared",    # Specific avatars
        "circle_shared",    # User-defined circle
        "public",           # Anyone with link
        "fully_public"      # Discoverable
    ]

    permissions = [
        "view",
        "comment",  # Add notes (not edit)
        "transform", # Create transformations
        "reshare",   # Share with others
    ]
```

---

## 4. The Learning Loop: AUI/GUI/API/CLI Integration

### Core Concept

**The system learns what features users want and helps build them.**

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Feature Registry                       │
│  - All API endpoints                                     │
│  - All GUI components                                    │
│  - All CLI commands                                      │
│  - All AUI tool definitions                              │
└──────────────────────────────────────────────────────────┘
                          ↕
┌──────────────────────────────────────────────────────────┐
│                  Capability Analyzer                      │
│  - Detects API features not exposed in GUI               │
│  - Suggests GUI components for common AUI patterns       │
│  - Generates CLI commands from API schema                │
│  - Tracks user requests that require new features        │
└──────────────────────────────────────────────────────────┘
                          ↕
┌──────────────────────────────────────────────────────────┐
│                  Feature Development Agent                │
│  - Proposes UI designs for missing features              │
│  - Generates component skeletons                         │
│  - Creates CLI command definitions                       │
│  - Documents new capabilities                            │
└──────────────────────────────────────────────────────────┘
```

### Example Workflow

**Scenario**: User asks AUI for transformation history

**Step 1: User Request**
```
User: "Show me all my transformations from last week"
```

**Step 2: AUI Processing**
```python
# AUI recognizes intent
intent = "view_transformation_history"
filters = {"time_range": "last_week"}

# Check if GUI component exists
gui_component = feature_registry.get_component(intent)

if not gui_component:
    # API endpoint exists, but no GUI
    api_endpoint = "/api/transform/history"

    # AUI responds with both: answer + suggestion
    response = {
        "answer": call_api(api_endpoint, filters),
        "gui_suggestion": {
            "message": "I found this in the API, but there's no GUI yet. Want to build it together?",
            "proposed_component": "TransformationHistoryView",
            "estimated_effort": "1-2 hours",
            "similar_components": ["ConversationList", "MediaGallery"]
        }
    }
```

**Step 3: Collaborative Development**

```
AUI: "I can show you the data via API. Would you like me to:
      1. Display it in the chat (quick)
      2. Open in a new tab (better for browsing)
      3. Help design a permanent GUI component (future users benefit)"

User: "Let's design a component"

AUI: "Great! I'll show you the API structure and suggest a design.
      Then I can generate the component skeleton for you to refine."

AUI: [Displays API response structure]
     [Shows mockup of proposed UI]
     [Offers to generate React component]

User: "Looks good, generate it"

AUI: [Creates TransformationHistoryView.tsx]
     [Adds to ToolPanel]
     [Updates feature registry]
     [Documents in CHANGELOG]

AUI: "Component created! Next time you or anyone asks for transformation
      history, I can open it directly in the GUI."
```

**Step 4: Feature Registry Update**

```python
# Feature registry now knows:
feature_registry.register({
    "intent": "view_transformation_history",
    "api_endpoint": "/api/transform/history",
    "gui_component": "TransformationHistoryView",
    "cli_command": "humanizer history transformations",
    "aui_tool": "get_transformation_history",
    "keywords": ["transformations", "history", "changes", "edits"],
    "created_by": "collaborative_development",
    "created_at": "2025-10-12T15:30:00Z"
})
```

### Self-Improvement Metrics

**Track**:
- Requests that couldn't be fulfilled by GUI
- API endpoints with no GUI exposure
- Features built collaboratively
- User satisfaction with new features
- Time from request → feature availability

**Goal**: Reduce time from "I wish I could..." to "Here it is!" from weeks to hours.

---

## 5. Database Schema (Unified)

### Core Tables

```sql
-- Users (authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    billing_customer_id VARCHAR(100),
    created_at TIMESTAMPTZ,
    preferences JSONB
);

-- Avatars (multiple per user)
CREATE TABLE avatars (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    bio TEXT,
    is_primary BOOLEAN,
    created_at TIMESTAMPTZ
);

-- Narrative Objects (polymorphic base)
CREATE TABLE narrative_objects (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,  -- message, conversation, transformation, note, artifact

    -- Ownership
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    avatar_id UUID REFERENCES avatars(id),

    -- Privacy
    visibility VARCHAR(20) DEFAULT 'private',
    encrypted BOOLEAN DEFAULT false,
    encryption_key_id UUID,

    -- Content
    content TEXT,
    content_hash VARCHAR(64),  -- For deduplication
    embeddings VECTOR(1024),
    language VARCHAR(10),

    -- Provenance
    source_objects UUID[],
    source_operation VARCHAR(100),
    source_params JSONB,

    -- Metadata
    tags TEXT[],
    topics TEXT[],
    custom_metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    accessed_at TIMESTAMPTZ,

    -- Indexes
    INDEX idx_narrative_objects_owner (owner_id),
    INDEX idx_narrative_objects_type (type),
    INDEX idx_narrative_objects_visibility (visibility),
    INDEX idx_narrative_objects_embeddings USING ivfflat (embeddings vector_cosine_ops)
);

-- Transformations (extends narrative_objects)
CREATE TABLE transformations (
    id UUID PRIMARY KEY REFERENCES narrative_objects(id),
    source_object_id UUID REFERENCES narrative_objects(id),
    transformation_type VARCHAR(50),
    parameters JSONB,
    metrics JSONB
);

-- Notes (annotations on any object)
CREATE TABLE notes (
    id UUID PRIMARY KEY,
    object_id UUID REFERENCES narrative_objects(id),
    author_avatar_id UUID REFERENCES avatars(id),
    content TEXT,
    note_type VARCHAR(50),  -- observation, question, insight
    created_at TIMESTAMPTZ
);

-- Links (semantic relationships)
CREATE TABLE object_links (
    id UUID PRIMARY KEY,
    from_object_id UUID REFERENCES narrative_objects(id),
    to_object_id UUID REFERENCES narrative_objects(id),
    link_type VARCHAR(50),  -- contradicts, supports, extends, references
    created_by_avatar_id UUID REFERENCES avatars(id),
    created_at TIMESTAMPTZ,

    UNIQUE(from_object_id, to_object_id, link_type)
);

-- Sharing & Permissions
CREATE TABLE object_permissions (
    id UUID PRIMARY KEY,
    object_id UUID REFERENCES narrative_objects(id),
    avatar_id UUID REFERENCES avatars(id),
    permission_level VARCHAR(20),  -- view, comment, transform, reshare
    granted_by_avatar_id UUID REFERENCES avatars(id),
    granted_at TIMESTAMPTZ
);

-- Feature Registry
CREATE TABLE feature_registry (
    id UUID PRIMARY KEY,
    intent VARCHAR(100) UNIQUE,
    api_endpoint VARCHAR(200),
    gui_component VARCHAR(100),
    cli_command VARCHAR(200),
    aui_tool VARCHAR(100),
    keywords TEXT[],
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ
);
```

---

## 6. API Architecture

### RESTful Endpoints

```
/api/v1/
  /auth/
    POST /register
    POST /login
    POST /logout
    GET /me

  /avatars/
    GET /avatars
    POST /avatars
    GET /avatars/:id
    PUT /avatars/:id
    DELETE /avatars/:id

  /objects/
    GET /objects              # List with filters
    POST /objects             # Create
    GET /objects/:id
    PUT /objects/:id
    DELETE /objects/:id

    POST /objects/:id/transform
    POST /objects/:id/note
    POST /objects/:id/link
    POST /objects/:id/share

    GET /objects/search       # Semantic search
    GET /objects/related/:id  # Find related objects

  /transformations/
    POST /transformations
    GET /transformations/:id
    GET /transformations/history

  /agent/
    POST /agent/chat
    GET /agent/conversations
    GET /agent/conversations/:id

  /features/
    GET /features/registry
    POST /features/suggest
    GET /features/missing
```

### GraphQL Alternative

For complex queries:

```graphql
query GetUserNarratives($userId: UUID!, $filters: ObjectFilters) {
  user(id: $userId) {
    avatars {
      id
      displayName
      objects(filters: $filters) {
        id
        type
        content
        transformations {
          type
          createdAt
        }
        notes {
          content
          author {
            displayName
          }
        }
      }
    }
  }
}
```

---

## 7. CLI Architecture

### Auto-Generated from API

```bash
# Installation
pip install humanizer-cli

# Authentication
humanizer auth login
humanizer auth logout

# Avatars
humanizer avatar list
humanizer avatar create "My Research Avatar"
humanizer avatar switch <id>

# Objects
humanizer objects list --type=transformation --limit=20
humanizer objects get <id>
humanizer objects create --file=input.txt --type=note

# Transformations
humanizer transform personify input.txt -o output.txt
humanizer transform trm input.txt --povm=tone

# Agent
humanizer agent chat "Find transformations from last week"

# Feature development
humanizer features missing
humanizer features suggest "transformation history viewer"
```

### CLI Generation

```python
# Auto-generate CLI from API schema
class CLIGenerator:
    """Generate CLI commands from OpenAPI spec."""

    def generate_from_openapi(self, spec: dict) -> List[CLICommand]:
        commands = []

        for path, methods in spec["paths"].items():
            for method, details in methods.items():
                cmd = self.create_command(path, method, details)
                commands.append(cmd)

        return commands

    def create_command(self, path, method, details):
        # /api/objects/:id → humanizer objects get <id>
        # POST /api/transform → humanizer transform <params>
        ...
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goal**: Multi-user auth, avatars, basic narrative objects

**Tasks**:
1. User registration & JWT auth
2. Avatar system (deterministic generation)
3. Narrative objects table
4. Polymorphic object types
5. Basic CRUD API

**Deliverables**:
- Multi-user authentication ✅
- Avatar creation & management ✅
- Objects API ✅

### Phase 2: Privacy & Encryption (Weeks 5-8)

**Goal**: Encryption, sharing, permissions

**Tasks**:
1. RSA keypair generation (client-side)
2. Hybrid encryption implementation
3. Sharing & permissions system
4. Billing microservice separation
5. Privacy policy & consent UI

**Deliverables**:
- End-to-end encryption ✅
- Fine-grained sharing ✅
- Billing separation ✅

### Phase 3: Moderation & Safety (Weeks 9-10)

**Goal**: Agent moderation, content safety

**Tasks**:
1. Moderation agent implementation
2. Violence/threat detection
3. Troll detection
4. Appeals process
5. Reporting system

**Deliverables**:
- Automated moderation ✅
- Three-strike system ✅
- Human review process ✅

### Phase 4: Feature Parity Loop (Weeks 11-14)

**Goal**: AUI/GUI/API/CLI learning system

**Tasks**:
1. Feature registry implementation
2. Capability analyzer
3. GUI suggestion system
4. CLI auto-generation
5. Collaborative development UI

**Deliverables**:
- Feature registry ✅
- AUI suggests missing features ✅
- CLI commands auto-generated ✅

### Phase 5: Integration & Polish (Weeks 15-16)

**Goal**: Unified experience, documentation

**Tasks**:
1. Integrate with existing features (transformations, embeddings, agent)
2. Comprehensive documentation
3. User onboarding flow
4. Performance optimization
5. Security audit

**Deliverables**:
- Complete platform ✅
- Documentation ✅
- Ready for beta launch ✅

---

## 9. Privacy & Legal Considerations

### Data Minimization

**Principle**: Collect only what's necessary.

**Implementation**:
- Email only for auth (never exposed)
- Optional analytics (opt-in)
- No tracking cookies
- No third-party analytics
- Minimal metadata

### Billing Separation

**Architecture**:
- Separate microservice
- Separate database (different jurisdiction)
- Opaque references only
- No direct joins with activity data

**Legal Benefit**:
- Can provide user data without billing
- Can provide billing without activity
- Complies with GDPR/CCPA data minimization

### Encryption

**What's Encrypted**:
- Private narrative objects (user choice)
- Shared objects (automatically)
- Notes on encrypted objects

**What's Not Encrypted**:
- Public objects
- Metadata (for search/discovery)
- System logs (anonymized)

### GDPR/CCPA Compliance

**User Rights**:
- Access: Full export of all data
- Rectification: Edit any object
- Erasure: Delete account + all data
- Portability: JSON/CSV export
- Object: Opt-out of AI training

**Implementation**:
```python
# Export all user data
GET /api/users/me/export
→ Returns JSON with all objects, transformations, notes

# Delete account
DELETE /api/users/me
→ Cascades to all owned objects
```

---

## 10. Feasibility Assessment

### Is Billing Separation Practical?

**✅ YES** - Many companies do this:
- Separate microservice (minimal complexity)
- Well-defined API boundary
- Standard practice for high-compliance industries

**Implementation Cost**: 1-2 weeks

### Is Encryption Feasible?

**✅ YES** - Established pattern:
- Hybrid RSA+AES encryption
- Client-side key generation
- Re-encryption for sharing

**Trade-offs**:
- Can't do server-side semantic search on encrypted content
- Solution: Client-side decryption → local embedding → search

**Implementation Cost**: 2-3 weeks

### Is Agent Moderation Sufficient?

**⚠️ PARTIALLY** - Requires:
- Good LLM safety tuning
- Human review process
- Appeals system
- Community reporting

**Recommendation**:
- Start with agent moderation
- Add human review within 48 hours
- Build appeal process from day one

**Implementation Cost**: 2-3 weeks

### Is the Learning Loop Realistic?

**✅ YES** - Components already exist:
- AUI system: ✅ Built
- API: ✅ Comprehensive
- Feature detection: New (1 week)
- GUI generation: Skeleton only (user refines)

**Realistic Expectation**:
- System suggests features
- Generates component skeleton
- Human developer completes
- Not fully automated (yet)

**Implementation Cost**: 2-3 weeks

---

## 11. Next Steps

### Immediate Actions (This Week)

1. **Review & Feedback**
   - Discuss architecture with team
   - Validate privacy approach
   - Confirm feasibility

2. **Prototype Key Innovations**
   - Build narrative object base table
   - Test billing separation
   - Prototype feature registry

3. **Plan Migration**
   - How to migrate existing data
   - Backward compatibility
   - Rollout strategy

### Short-Term (Next Month)

1. **Phase 1 Implementation**
   - Multi-user auth
   - Avatar system
   - Narrative objects API

2. **Privacy Infrastructure**
   - Encryption implementation
   - Billing microservice
   - Consent management

3. **Documentation**
   - API documentation
   - Privacy policy
   - User guides

---

## 12. Open Questions

1. **Avatar Determinism**: DiceBear vs. Gravatar vs. custom?
2. **Encryption Default**: All private objects encrypted by default?
3. **Moderation Appeals**: Who serves on review board?
4. **Feature Development**: How much human guidance vs. automation?
5. **Billing Jurisdiction**: Where to host billing microservice?

---

## Conclusion

This architecture proposes a **privacy-first, multi-user platform** where:

✅ **Narrative objects** are first-class citizens with full provenance
✅ **Privacy** is enforced through encryption, avatars, and billing separation
✅ **Safety** is maintained through agent moderation with human oversight
✅ **Learning loop** enables organic feature development
✅ **Feature parity** emerges from AUI/GUI/API/CLI collaboration

**Philosophy**: Post-social platform that honors subjective experience while enabling meaningful connection.

**Feasibility**: All components are implementable with existing technology.

**Timeline**: 16 weeks to complete platform (MVP in 8 weeks).

---

**Next**: Review, refine, and begin Phase 1 implementation.
