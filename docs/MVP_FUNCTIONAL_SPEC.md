# Humanizer MVP - Functional Specification
**Version**: 1.0
**Date**: November 12, 2025
**Status**: Pre-Launch - Architecture Foundation
**Signups**: 73 (organic, no marketing yet!)

---

## Executive Summary

Humanizer is launching as **"Photoshop for Narrative"** - a professional workbench for transforming, analyzing, and understanding text through quantum narrative mechanics. The MVP focuses on:

1. **Individual tool excellence** - Each transformation/analysis works flawlessly
2. **Manual pipeline orchestration** - Users compose workflows via Canvas
3. **Complete persistence** - All narratives, operations, and sessions saved
4. **Launch-ready polish** - Error-free, intuitive, professional UX

**Core Differentiator**: World's only ρ-tracked narrative transformation system with scientific measurement capabilities.

---

## Product Vision

### What We're Building
A cloud-based workbench where users:
- Load **source narratives** (validated text with narrative structure)
- Apply **transformation tools** (Allegorical, Round-Trip, Maieutic, Personalizer)
- Run **analysis tools** (AI Detection, POVM, ρ Inspector, Multi-Reading)
- Save everything as **linear sessions** (reproducible history)
- Use **Canvas as workspace** (manual data flow between tools)

### What We're NOT Building (Yet)
- Visual workflow editor
- Automated pipelines
- Narrative merging/combination
- Team collaboration
- Version control/branching (full tree)

---

## Architecture Principles

### 1. Canvas as Pipeline Manager
**Philosophy**: Users manually orchestrate transformations by:
1. Loading narrative to Canvas
2. Selecting tool + parameters
3. Viewing output
4. Loading output back to Canvas (for next operation)
5. Repeating

**Why**: Simple, intuitive, no complex workflow engine needed. Users become their own pipeline managers.

### 2. Narrative Validation
**Problem**: Random text wastes user time and API costs.

**Solution**: Validate input has narrative structure before accepting:
- Minimum length (100 words)
- Sentence structure (proper punctuation)
- Coherent grammar (not gibberish)
- Narrative markers (pronouns, verbs, temporal flow)
- Semantic coherence score

**User Experience**:
```
❌ "asdf asdf asdf"
   → "This doesn't appear to be a narrative. Please provide coherent text."

✅ "Once upon a time in a distant land..."
   → Accepted, validation score: 0.89
```

### 3. Linear Session Model (MVP)
**Current Scope**: One user, one narrative, one tool at a time.

**Session Flow**:
```
User loads narrative → [Operation 1] → [Operation 2] → [Operation 3]
                         ↓               ↓               ↓
                      History         History         History
```

**Why Linear First**:
- Simpler to implement and debug
- Easier to understand for users
- Still allows manual chaining
- Ready for future branching/merging

### 4. Future-Ready Database
**Design Goal**: Schema supports MVP but anticipates Phase 2 features.

**Extension Points**:
- `parent_id` field (future: variation trees)
- `operation_params` JSON (future: reproducibility)
- `narrative_id` linkage (future: cross-narrative operations)
- `status` field (future: async processing)

---

## Data Model

### Core Entities

#### 1. Narratives (Root Texts)
**Purpose**: Validated source texts that can be operated on.

**Attributes**:
- `id` - UUID
- `user_id` - Owner
- `title` - Auto-generated or user-provided
- `source_text` - Original validated text
- `validation_score` - 0-1 (how "narrative" is it)
- `word_count` - Quick reference
- `created_at` - Timestamp

**Lifecycle**:
1. User pastes/uploads text
2. System validates narrative structure
3. If valid, create record
4. User can rename, delete

#### 2. Operations (Transformations & Analyses)
**Purpose**: Record of every tool invocation in a session.

**Attributes**:
- `id` - UUID
- `user_id` - Owner
- `narrative_id` - Which narrative session
- `operation_type` - Tool used ('allegorical', 'round-trip', 'povm', etc.)
- `input_text` - What went in
- `output_text` - What came out (NULL for measurements)
- `params` - JSON configuration
- `status` - 'pending', 'completed', 'failed'
- `duration_ms` - Performance tracking
- `created_at` - Timestamp

**Operation Types**:
- **Transformative**: allegorical, round-trip, maieutic, personalizer
- **Analytical**: ai-detection, povm, rho-inspector, multi-reading
- **Interactive**: quantum-reading (special case)

**Why Single Table**:
- Simple queries
- Unified history view
- Easy to add new tools
- Clear chronological order

#### 3. Quantum Sessions (Special Case)
**Purpose**: Multi-step sentence-by-sentence analysis.

**Attributes**:
- `id` - UUID
- `user_id` - Owner
- `narrative_id` - Source narrative
- `title` - User-provided name
- `sentence_count` - Total sentences
- `current_position` - Current sentence index
- `status` - 'in_progress', 'completed'
- `created_at` - Timestamp

**Why Separate**:
- Has many child measurements (not just one output)
- Resumable (user can pause/continue)
- Different UX pattern (interactive reading)

#### 4. Quantum Measurements (Sub-records)
**Purpose**: Per-sentence ρ and POVM data.

**Attributes**:
- `id` - UUID
- `session_id` - Parent session
- `sentence_index` - Position (0-based)
- `sentence_text` - The sentence
- `rho_before` - JSON density matrix state
- `rho_after` - JSON density matrix after measurement
- `povm_result` - JSON POVM probabilities
- `coherence` - Quality metric
- `created_at` - Timestamp

**Why Separate Table**:
- Each session has 10-100+ measurements
- Allows incremental processing
- Supports partial sessions (incomplete readings)

---

## Database Schema

```sql
-- ============================================================================
-- Migration 0013: Narrative Session Architecture
-- ============================================================================

-- Root validated narratives
CREATE TABLE narratives (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  source_text TEXT NOT NULL,
  validation_score REAL,
  word_count INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_narratives_user ON narratives(user_id);
CREATE INDEX idx_narratives_created ON narratives(created_at DESC);

-- Linear session operations
CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  narrative_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT,
  params TEXT NOT NULL, -- JSON
  status TEXT DEFAULT 'completed',
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX idx_operations_narrative ON operations(narrative_id, created_at DESC);
CREATE INDEX idx_operations_user ON operations(user_id);
CREATE INDEX idx_operations_type ON operations(operation_type);

-- Quantum reading sessions
CREATE TABLE quantum_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  narrative_id TEXT NOT NULL,
  title TEXT,
  sentence_count INTEGER,
  current_position INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX idx_quantum_sessions_user ON quantum_sessions(user_id, created_at DESC);
CREATE INDEX idx_quantum_sessions_narrative ON quantum_sessions(narrative_id);

-- Sentence-level measurements
CREATE TABLE quantum_measurements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sentence_index INTEGER NOT NULL,
  sentence_text TEXT NOT NULL,
  rho_before TEXT NOT NULL, -- JSON
  rho_after TEXT NOT NULL,  -- JSON
  povm_result TEXT NOT NULL, -- JSON
  coherence REAL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES quantum_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_quantum_measurements_session ON quantum_measurements(session_id, sentence_index);
```

---

## API Endpoints

### Narratives
```
POST   /narratives
  Body: { text: string, title?: string }
  Response: { id, title, validation_score, word_count }
  Validation: Rejects if validation_score < 0.6

GET    /narratives
  Response: [{ id, title, word_count, created_at }]
  Pagination: ?limit=20&offset=0

GET    /narratives/:id
  Response: { id, title, source_text, validation_score, word_count }

DELETE /narratives/:id
  Response: 204 No Content
```

### Operations (History)
```
GET    /narratives/:id/operations
  Response: [{ id, operation_type, params, status, created_at }]
  Purpose: Show session history for this narrative

POST   /narratives/:id/operations
  Body: { operation_type, input_text, params }
  Response: { id, output_text, duration_ms }
  Purpose: Record operation (called by transformation routes)
```

### Quantum Reading Sessions
```
GET    /quantum-analysis/sessions
  Response: [{ id, title, sentence_count, current_position, status }]
  Purpose: List user's quantum reading sessions

GET    /quantum-analysis/sessions/:id
  Response: {
    id, title, sentence_count, current_position, status,
    measurements: [{ sentence_index, sentence_text, rho_before, rho_after, povm_result }]
  }
  Purpose: Get full session with all measurements

POST   /quantum-analysis/sessions
  Body: { narrative_id, title }
  Response: { id, title, sentence_count, status }
  Purpose: Start new quantum reading session

PATCH  /quantum-analysis/sessions/:id/advance
  Body: { sentence_index }
  Response: { current_position, measurement }
  Purpose: Process next sentence, store measurement
```

### Integration with Existing Routes
All transformation routes (allegorical, round-trip, etc.) will:
1. Accept optional `narrative_id` parameter
2. Create operation record if provided
3. Maintain backward compatibility (work without narrative_id)

---

## User Flows

### Flow 1: First-Time User Experience
```
1. User clicks "Login" → Authenticates
2. Sees empty workbench with Canvas + tool dock
3. Clicks "Paste Text" → Modal opens
4. Pastes narrative → System validates
   ✅ Valid → "Loaded to Canvas" (200 words)
   ❌ Invalid → "Please provide a coherent narrative"
5. Canvas shows narrative preview
6. User clicks tool icon (e.g., Allegorical)
7. Tool panel opens with form
8. User configures (persona, namespace, style)
9. Clicks "Generate Story"
10. Output appears in tool panel
11. User clicks "Load to Canvas" button
12. Canvas now shows transformed text
13. User can apply another tool
14. History panel tracks all operations
```

### Flow 2: Returning User with History
```
1. User logs in → Sees last session
2. History panel shows previous operations
3. Clicks operation → Details expand
   - Input text shown
   - Output text shown
   - Parameters shown
   - "Load Input to Canvas" button
   - "Load Output to Canvas" button
4. User clicks "Load Output to Canvas"
5. Can continue from previous work
```

### Flow 3: Quantum Reading Session
```
1. User loads narrative to Canvas
2. Clicks Multi-Reading tool
3. Selects POVM axes (Literalness, Emotion, Time)
4. Clicks "Analyze on 1 axis" → Creates session
5. System splits into sentences
6. User sees first sentence highlighted
7. ρ metrics shown: Purity, Entropy, Eigenvalues
8. POVM result shown: Probabilities for selected axis
9. User presses → or ↓ to advance
10. Next sentence analyzed
11. Previous measurements in history table
12. User can pause/resume anytime
13. Session saved for later review
```

---

## Validation Logic

### Narrative Structure Validation

**Goal**: Accept texts that benefit from our tools, reject nonsense.

**Criteria**:
```typescript
interface ValidationResult {
  valid: boolean;
  score: number; // 0-1
  reasons?: string[];
}

function validateNarrative(text: string): ValidationResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Length check (20 points)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 50) {
    reasons.push("Text too short (minimum 50 words)");
    return { valid: false, score: 0, reasons };
  }
  if (wordCount >= 100) score += 20;
  else score += (wordCount / 100) * 20;

  // 2. Sentence structure (20 points)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 3) {
    reasons.push("Not enough sentences (minimum 3)");
    score += 5;
  } else {
    score += Math.min(20, sentences.length * 2);
  }

  // 3. Punctuation coherence (15 points)
  const hasPunctuation = /[.,!?;:]/.test(text);
  const properCapitalization = /[A-Z]/.test(text);
  if (hasPunctuation && properCapitalization) score += 15;
  else score += 5;

  // 4. Word diversity (15 points)
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const diversity = uniqueWords.size / words.length;
  if (diversity > 0.5) score += 15;
  else score += diversity * 30;

  // 5. Not gibberish (15 points)
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  if (avgWordLength >= 3 && avgWordLength <= 12) score += 15;
  else score += 5;

  // 6. Has narrative markers (15 points)
  const hasPronouns = /\b(I|you|he|she|it|we|they|me|him|her|us|them)\b/i.test(text);
  const hasVerbs = /\b(was|were|is|are|said|went|came|thought|felt)\b/i.test(text);
  const hasTemporal = /\b(then|when|before|after|while|during|once|until)\b/i.test(text);
  if (hasPronouns) score += 5;
  if (hasVerbs) score += 5;
  if (hasTemporal) score += 5;

  const finalScore = score / 100;
  const valid = finalScore >= 0.6; // Threshold

  if (!valid) {
    reasons.push(`Validation score ${finalScore.toFixed(2)} below threshold 0.60`);
  }

  return { valid, score: finalScore, reasons: valid ? undefined : reasons };
}
```

**User Feedback**:
- Score ≥ 0.80: ✅ "Excellent narrative structure"
- Score 0.60-0.79: ⚠️ "Acceptable narrative, may have mixed results"
- Score < 0.60: ❌ "Does not appear to be a coherent narrative" + specific reasons

---

## Technical Implementation

### Migration Strategy
```
Migration 0013: narrative_session_architecture.sql
├─ Create tables: narratives, operations, quantum_sessions, quantum_measurements
├─ Create indexes for performance
├─ Add foreign key constraints
└─ Backward compatible (existing tables untouched)
```

### Route Implementation
```
New routes:
├─ /routes/narratives.ts         # CRUD for narratives
├─ /routes/operations.ts          # History/session tracking
└─ /routes/quantum-sessions.ts    # Replaces broken sessions endpoint

Modified routes:
├─ /routes/transformations.ts     # Add narrative_id parameter
├─ /routes/v2/allegorical.ts      # Link operations to narratives
└─ /routes/quantum-analysis.ts    # Integrate with sessions table
```

### Frontend Changes
```
New components:
├─ NarrativeValidator.tsx         # Validation feedback UI
├─ SessionHistory.tsx             # Enhanced history panel
└─ QuantumSessionList.tsx         # Sessions panel with data

Modified components:
├─ Canvas.tsx                     # Add "Load to Canvas" from history
├─ ToolDock.tsx                   # Pass narrative_id to tools
└─ TransformationPanels/*         # Accept narrative context
```

---

## Success Criteria (MVP Launch)

### Must Have (Blocking)
- [ ] All 10 panels load without errors
- [ ] Narrative validation working (rejects gibberish)
- [ ] History panel shows all operations
- [ ] Sessions panel shows quantum readings (no 404)
- [ ] Operations linked to narratives
- [ ] Login/auth working flawlessly
- [ ] V1 and V2 APIs both functional
- [ ] Mobile responsive (basic testing)
- [ ] No console errors on any panel

### Should Have (High Priority)
- [ ] V1/V2 selector on Allegorical panel
- [ ] "Load to Canvas" buttons on history
- [ ] Quantum reading resumable
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] Performance: All transformations < 30s

### Could Have (Nice to Have)
- [ ] Auto-save drafts to localStorage
- [ ] Keyboard shortcuts (→ for next in quantum reading)
- [ ] Export session history as JSON
- [ ] Dark mode preference persists

---

## Launch Readiness Checklist

### Backend
- [ ] Migration 0013 applied to production D1
- [ ] All new routes deployed
- [ ] Validation endpoint tested
- [ ] Sessions endpoint returns data (not 404)
- [ ] Error logging configured
- [ ] Rate limiting confirmed

### Frontend
- [ ] Build completes without warnings
- [ ] All panels tested end-to-end
- [ ] Mobile layout verified
- [ ] Auth flow tested (login, logout, token refresh)
- [ ] Error states handled gracefully
- [ ] Loading states shown appropriately

### Documentation
- [ ] CLAUDE.md updated with new architecture
- [ ] API endpoints documented
- [ ] Known issues list finalized
- [ ] User guide written (basic operations)

### Marketing
- [ ] Landing page copy emphasizes unique value
- [ ] Signup flow tested
- [ ] Email confirmation working
- [ ] First-time user onboarding smooth

---

## Future Phases (Post-Launch)

### Phase 2: Enhanced Lineage & Workflows
**Timeline**: 4-6 weeks post-launch

**Features**:
- Add `parent_id` to operations (tree structure)
- "Fork from here" button on any operation
- Tree view visualization of variations
- Narrative combination tool
- Partial transformations (select text regions)

**Why Wait**:
- Observe actual usage patterns first
- Ensure core functionality is stable
- Get user feedback on most-wanted features

### Phase 3: Pipeline Builder
**Timeline**: 3-6 months post-launch

**Features**:
- Visual workflow editor
- Save pipeline templates
- Batch processing (apply pipeline to multiple narratives)
- Conditional logic (if-then operations)
- Schedule automated runs

**Why Wait**:
- Requires substantial UI/UX work
- Need clear use cases from real users
- May partner with power users for design

### Phase 4: Quantum Reading UX Overhaul
**Timeline**: 2-3 months post-launch

**Features**:
- High-density hover display
- Inline sentence metrics (no separate panel)
- "Transform this sentence" quick action
- Highlight critical inflection points
- Export annotated narrative

**Research Needed**:
- ChromaDB archive notes on "Hi density display"
- User testing on hover interactions
- Actionability: What do users DO with the metrics?

---

## Open Questions & Decisions Needed

### Immediate (This Session)
1. ✅ Validation threshold: 0.6 seems right?
2. ✅ Narrative minimum: 50 words or 100?
3. ✅ Sessions API structure confirmed?

### Near-Term (Next Session)
1. Should History panel filter by operation type?
2. How to handle failed operations (retry button)?
3. Quantum reading: Resume from any sentence or only current?

### Strategic (After Launch)
1. Pricing tiers: V1 free, V2 paid? Or both in tier limits?
2. Usage quotas: How many narratives/operations per tier?
3. API access: Allow programmatic usage? Rate limits?

---

## Metrics to Track (Post-Launch)

### User Behavior
- Signups → Activation rate (first operation)
- Most-used tools (which panels get clicks)
- Session length (time spent in workbench)
- Operations per session (chaining depth)
- Narrative length distribution

### Technical
- API response times (p50, p95, p99)
- Error rates by endpoint
- Validation rejection rate
- Quantum session completion rate

### Business
- Free → Paid conversion rate
- Churn rate by tier
- Support ticket volume
- Feature requests (categorized)

---

## Conclusion

This functional spec defines a **launch-ready MVP** that:
- Solves real user problems (narrative transformation with scientific rigor)
- Differentiates from competitors (quantum measurement, ρ tracking)
- Scales to future complexity (lineage-ready, pipeline-ready)
- Ships fast (linear sessions, manual orchestration)

**Next Step**: Implement Phase 1 foundation (narratives, operations, sessions tables + API endpoints).

**Timeline to Launch**:
- Phase 1 Implementation: 1-2 sessions (6-12 hours)
- Testing & Polish: 1 session (3-4 hours)
- Deployment & Verification: 1 session (2-3 hours)
- **Total**: 3-4 sessions (~15-20 hours)

**Risk**: Minimal. All changes are additive (no breaking changes). Existing functionality preserved.

**Opportunity**: 73 signups waiting. First-mover advantage in quantum narrative space. No competitors have this.

---

**Document Status**: APPROVED - Ready for Implementation
**Next Action**: Begin Phase 1 database migration and API endpoints
**Owner**: Development Team
**Review Date**: After Phase 1 complete
