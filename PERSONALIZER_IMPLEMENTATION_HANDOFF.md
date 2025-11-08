# Personalizer Feature - Implementation Handoff

**Started:** January 8, 2025
**Status:** Phase 1 Complete (Foundation)
**Philosophy:** Enhance human expression, NOT hide AI writing
**Tier Requirement:** PRO+ only

---

## Vision Summary

The Personalizer learns from users' authentic writing to express content through their unique voices. It discovers multiple "selves" (personas & styles) from writing samples, allowing conscious perspective-shifting.

### Key Differentiators from Market
1. **Authenticity:** Learns from YOUR actual writing, not generic patterns
2. **Multiplicity:** Discovers 3-7 distinct voices you contain
3. **Consciousness:** Frame as perspective-shifting, not optimization
4. **Quality:** Semantic preservation >95% (BBScore metric)
5. **Philosophy:** "You contain multitudes - choose which self to express"

---

## ✅ Completed (Phase 1)

### Database Schema (Migration 0009)
**Tables Created:**
- `writing_samples` - User's uploaded writing samples
- `personal_personas` - Discovered/custom personas
- `personal_styles` - Discovered/custom styles
- `personalizer_transformations` - Transformation history

**Applied to production:** ✅ 2025-01-08

### TypeScript Types
**Location:** `/workers/shared/types.ts`

**Added Types:**
- `WritingSample`, `PersonalPersona`, `PersonalStyle`
- `PersonalizerTransformation`
- Request/Response types for all APIs
- Added `'personalizer'` to `TransformationType`

### Writing Samples API
**Location:** `/workers/npe-api/src/routes/writing-samples.ts`

**Endpoints Implemented:**
- `POST /personal/samples/upload` - Upload writing sample (min 100 words)
- `GET /personal/samples` - List user's samples with stats
- `GET /personal/samples/:id` - Get specific sample
- `DELETE /personal/samples/:id` - Delete sample

**Features:**
- Word count validation (100 word minimum)
- Content preview (first 200 chars)
- Total word count tracking
- User isolation (can only access own samples)

---

## 🔄 In Progress / Next Steps

### Immediate Next (Phase 2)

#### 1. Persona Management API
**Create:** `/workers/npe-api/src/routes/personal-personas.ts`

**Endpoints Needed:**
```typescript
GET /personal/personas - List user's personas (discovered + custom)
POST /personal/personas - Create custom persona
PUT /personal/personas/:id - Update persona name/description
DELETE /personal/personas/:id - Delete persona
```

**Key Features:**
- Badge auto-discovered personas
- Allow editing descriptions but preserve embeddings
- Validate user ownership
- Return example texts with each persona

#### 2. Style Management API
**Create:** `/workers/npe-api/src/routes/personal-styles.ts`

**Endpoints Needed:**
```typescript
GET /personal/styles - List user's styles (discovered + custom)
POST /personal/styles - Create custom style
PUT /personal/styles/:id - Update style properties
DELETE /personal/styles/:id - Delete style
```

**Key Features:**
- Formality/complexity scores (0.0-1.0)
- Tone markers array
- Example texts
- Validate user ownership

#### 3. Voice Discovery Service
**Create:** `/workers/npe-api/src/services/voice-discovery.ts`

**Purpose:** Analyze writing samples to discover personas & styles

**Algorithm:**
```
1. Retrieve all user's writing samples
2. Chunk into 500-word segments
3. Generate embeddings (@cf/baai/bge-base-en-v1.5)
4. Cluster into k groups (k=3-7, use silhouette score to find optimal)
5. For each cluster:
   a. Extract linguistic features:
      - Avg sentence length
      - Vocabulary diversity (type-token ratio)
      - Formality score (latinate words, passive voice, etc.)
      - Complexity score (avg word length, subordinate clauses)
   b. Generate persona description via LLM:
      "Analyze these writing samples and describe the voice/persona in 1-2 sentences"
   c. Select 3 representative examples
6. Save to personal_personas and personal_styles tables
```

**Dependencies:**
- Workers AI embeddings binding
- K-means clustering (implement simple version)
- LLM for description generation

#### 4. Discovery Endpoint
**Create:** `POST /personal/discover-voices` in persona routes

**Request:**
```typescript
{
  min_clusters?: 3,
  max_clusters?: 7
}
```

**Response:**
```typescript
{
  personas_discovered: 5,
  styles_discovered: 5,
  personas: PersonalPersona[],
  styles: PersonalStyle[],
  total_words_analyzed: 15420
}
```

**Flow:**
1. Check if user has enough samples (min 5,000 words)
2. Run voice discovery algorithm
3. Save discovered personas/styles
4. Return results

---

### Phase 3: Transformation

#### 5. Personalizer Service
**Create:** `/workers/npe-api/src/services/personalizer.ts`

**Purpose:** Transform text using persona + style

**Algorithm:**
```
1. Load selected persona's example texts + embedding signature
2. Load selected style's linguistic properties
3. Generate embeddings for input text
4. Construct LLM prompt:
   - Show persona description & examples
   - Show style characteristics
   - Input text to transform
5. Use Workers AI to transform
6. Calculate semantic similarity (input vs output embeddings)
7. Save to personalizer_transformations
8. Return transformed text + similarity score
```

**Prompt Template:**
```
You are helping express content through a specific person's authentic voice.

PERSONA: {name} - {description}
{example_text_1}
{example_text_2}
{example_text_3}

STYLE CHARACTERISTICS:
- Formality: {formality_score}/1.0
- Complexity: {complexity_score}/1.0
- Avg sentence length: {avg_sentence_length} words
- Tone markers: {tone_markers}

ORIGINAL TEXT:
{input_text}

Rewrite the text to express the same ideas through this person's authentic voice and style.
Preserve the core meaning (95%+ semantic similarity) while adopting their linguistic patterns.
This is about authentic expression, NOT hiding authorship.

OUTPUT:
```

#### 6. Transformation Endpoint
**Create:** `POST /transformations/personalizer`

**Request:**
```typescript
{
  text: string,
  persona_id?: number,
  style_id?: number
}
```

**Response:**
```typescript
{
  transformation_id: number,
  output_text: string,
  semantic_similarity: 0.96,
  tokens_used: 450,
  model_used: "@cf/meta/llama-3.1-8b-instruct"
}
```

**Validations:**
- User must be PRO+ tier
- Check quota (tokens + transformations)
- Persona/style must belong to user
- Text length limits

---

### Phase 4: Frontend

#### 7. Personalizer Tab Component
**Create:** `/cloud-frontend/src/components/transformations/PersonalizerForm.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│ Input Textarea                      │
│ "Paste content to personalize..."  │
│                                     │
└─────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐
│ Persona ▼    │  │ Style ▼      │
│ My Scholar   │  │ Formal       │
└──────────────┘  └──────────────┘

[Discover My Voices] [Transform]

┌─────────────────────────────────────┐
│ Output Display                      │
│ (markdown rendered)                 │
│                                     │
└─────────────────────────────────────┘

Similarity: 96% | Tokens: 450
[Copy Text] [Copy Markdown]
```

**Features:**
- Persona/style dropdowns (fetch from APIs)
- "Discover My Voices" button if no personas
- Loading states during transformation
- Similarity score display
- Copy buttons (like Allegorical)

#### 8. Voice Management UI
**Create:** `/cloud-frontend/src/components/personalizer/VoiceManager.tsx`

**Sections:**

**Writing Samples:**
```
Total: 12 samples | 15,420 words

[Upload Sample] [Import from Archives]

┌──────────────────────────────────┐
│ 📝 Manual sample (850 words)    │
│ "I've been thinking about..."   │
│ Jan 5, 2025      [View] [Delete]│
└──────────────────────────────────┘
```

**Discovered Personas:**
```
🎭 Your Voices (5 discovered)

┌──────────────────────────────────┐
│ 🤖 The Scholar                   │
│ Auto-discovered                  │
│ "Analytical, formal, structured" │
│ Examples: 3       [Edit] [Delete]│
└──────────────────────────────────┘
```

**Custom Personas:**
```
[+ Create Custom Persona]
```

#### 9. Sample Upload Modal
**Create:** `/cloud-frontend/src/components/personalizer/SampleUploadModal.tsx`

**Fields:**
- Large textarea for content
- Source dropdown (Manual / ChatGPT / Claude / Other)
- Optional metadata (title, date, context)
- Word count display (live)
- Warning if < 100 words

---

## Integration Points

### 1. Route Registration
**File:** `/workers/npe-api/src/index.ts`

**Add:**
```typescript
import writingSamplesRoutes from './routes/writing-samples';
import personalPersonasRoutes from './routes/personal-personas';
import personalStylesRoutes from './routes/personal-styles';

app.route('/personal/samples', writingSamplesRoutes);
app.route('/personal/personas', personalPersonasRoutes);
app.route('/personal/styles', personalStylesRoutes);
```

### 2. Frontend Navigation
**File:** `/cloud-frontend/src/App.tsx` or main nav

**Add:**
- "Personalizer" tab (4th transformation type)
- "Manage Voices" link in settings/profile

### 3. Tier Validation
**File:** `/workers/npe-api/src/middleware/tier-check.ts` (create if needed)

**Function:**
```typescript
export function requireProPlus() {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth');
    if (!auth) return c.json({ error: 'Unauthorized' }, 401);

    if (!['pro', 'premium', 'admin'].includes(auth.user.role)) {
      return c.json({
        error: 'Personalizer requires PRO or higher tier',
        upgrade_url: '/pricing'
      }, 403);
    }

    await next();
  };
}
```

**Apply to all Personalizer routes**

---

## Testing Strategy

### Unit Tests
1. Voice discovery clustering algorithm
2. Linguistic feature extraction (formality, complexity)
3. Semantic similarity calculation
4. Word count validation

### Integration Tests
1. Full discovery flow (samples → personas → styles)
2. Transformation flow (persona + style → output)
3. Semantic preservation (95%+ similarity)
4. Quota enforcement (PRO+ only)

### E2E Tests
1. Upload samples → discover voices → transform text
2. Create custom persona → use in transformation
3. Edit discovered persona → verify changes preserved
4. Archive import → auto-discovery

---

## Dependencies

### NPM Packages (if needed)
- None required! Use built-in Workers AI

### Workers AI Models
- `@cf/baai/bge-base-en-v1.5` - Embeddings (768d)
- `@cf/meta/llama-3.1-8b-instruct` - Text generation
- `@cf/meta/llama-3.3-70b-instruct` - Optional for better quality

### External APIs
- None! Fully self-contained

---

## Success Metrics (Philosophy-Aligned)

**Qualitative:**
- Users report: "This feels like ME"
- Discovery reveals unexpected multitudes
- Conscious perspective-shifting

**Quantitative:**
- Average personas discovered: 3-7
- Semantic similarity maintained: >95%
- PRO tier conversions (authentic value)

**Anti-Metrics (NOT success):**
- AI detection bypass rate ❌
- "Fooling detectors" ❌
- Productivity metrics ❌

---

## Known Challenges

### 1. Clustering Quality
**Issue:** K-means may not find meaningful personas
**Solution:** Try HDBSCAN or hierarchical clustering if needed

### 2. Embedding Dimensionality
**Issue:** 768d embeddings too large for D1 JSON storage
**Solution:** Store as compressed array or reduce dimensions (PCA to 128d)

### 3. LLM Hallucination
**Issue:** Generated descriptions may be generic
**Solution:** Provide strong examples in prompt, validate against samples

### 4. Semantic Drift
**Issue:** Transformation changes meaning too much
**Solution:** Calculate similarity, retry if < 95%, show score to user

---

## File Structure

```
workers/npe-api/
├── migrations/
│   └── 0009_personalizer.sql ✅
├── src/
│   ├── routes/
│   │   ├── writing-samples.ts ✅
│   │   ├── personal-personas.ts 🔄 (next)
│   │   ├── personal-styles.ts 🔄 (next)
│   │   └── personalizer.ts 🔄 (Phase 3)
│   ├── services/
│   │   ├── voice-discovery.ts 🔄 (Phase 2)
│   │   └── personalizer.ts 🔄 (Phase 3)
│   └── middleware/
│       └── tier-check.ts 🔄 (Phase 3)

cloud-frontend/src/
├── components/
│   ├── transformations/
│   │   └── PersonalizerForm.tsx 🔄 (Phase 4)
│   └── personalizer/
│       ├── VoiceManager.tsx 🔄 (Phase 4)
│       ├── SampleUploadModal.tsx 🔄 (Phase 4)
│       └── PersonaCard.tsx 🔄 (Phase 4)
└── lib/
    └── cloud-api-client.ts (update with new endpoints)
```

---

## Quick Start (Next Session)

```bash
# 1. Pull latest code
cd /Users/tem/humanizer_root
git pull

# 2. Verify migration applied
cd workers/npe-api
npx wrangler d1 execute npe-production-db --remote --command "SELECT COUNT(*) FROM writing_samples"

# 3. Start with persona management API
# Create: src/routes/personal-personas.ts
# Implement: GET, POST, PUT, DELETE endpoints

# 4. Register routes in src/index.ts

# 5. Test with curl or Postman
```

---

## Questions for User

1. **Archive Import Priority:** Should Phase 2 include MCP archive import, or defer to later?
2. **Default Personas:** Should we seed some starter personas for users with no samples?
3. **Sharing:** Future feature - allow users to share discovered personas publicly?
4. **Naming:** Is "Personalizer" the final name, or prefer "Voice Lab", "Expression Engine", etc.?

---

**Next Session:** Start with persona management API, then style management, then voice discovery engine.

**Estimated Time to MVP:** 3-4 more sessions (15-20 hours total)

---

**Last Updated:** 2025-01-08
**Git Commit:** 02204b2 (Phase 1 foundation complete)
**Migration Status:** 0009 applied to production ✅
