# AI Tell Detector - Implementation Handoff

**Started:** November 8, 2025
**Status:** Phase 1 - 50% Complete (Backend Services Done)
**Last Updated:** 2025-11-08
**Git Commit:** 4f687b1

---

## Vision Summary

The AI Tell Detector identifies AI-generated text using a hybrid approach:
1. **Fast local statistical analysis** (70% of cases, <100ms, privacy-friendly)
2. **GPTZero API fallback** (30% uncertain cases, ~2-3s, high accuracy)

**Goals:**
- Help users identify AI-generated content
- Provide transparency about AI "tells" (common phrases)
- Offer both free (local) and premium (API) tiers
- Privacy-first architecture (local detection prioritized)

---

## ✅ Completed Components (50%)

### Backend Services (697 lines)

#### 1. tell-words.ts (160 lines)
**Purpose:** Curated dictionary of AI "tell" words/phrases

**Features:**
- 100+ tell-words in 5 categories:
  - Overused Academic: "delve", "tapestry", "leverage", "robust"
  - Transitional Phrases: "it's worth noting", "in today's landscape"
  - Hedging/Qualifiers: "typically", "generally", "arguably"
  - Metadiscourse: "as mentioned", "clearly", "obviously"
  - Sentence Starters: "in recent years", "looking ahead"
- Weighted scoring (categories have different importance)
- Frequency analysis with category tracking

**Key Function:**
```typescript
calculateTellWordScore(text: string): {
  score: number; // 0-100 (higher = more AI-like)
  detectedWords: Array<{ word, category, count }>;
  totalMatches: number;
}
```

#### 2. utils.ts (220 lines)
**Purpose:** Statistical utility functions for AI detection

**Features:**
- **Burstiness calculation:** Measures sentence length variation
  - Human: High variation (CV 0.4-0.8)
  - AI: Low variation (CV 0.1-0.3)
- **Flesch Reading Ease:** 0-100 readability score
- **Gunning Fog Index:** Grade level estimation
- **Lexical Diversity:** Type-token ratio (unique words / total words)
- **Syllable counter:** For readability metrics
- **Readability pattern analysis:** Detects typical AI ranges

**Key Functions:**
```typescript
calculateBurstiness(text): number // 0-100
calculateFleschReadingEase(text): number // 0-100
calculateGunningFog(text): number // grade level
calculateLexicalDiversity(text): number // 0-100
```

#### 3. local-detector.ts (160 lines)
**Purpose:** Fast local AI detection (no external calls)

**Algorithm:**
1. Calculate 4 signals:
   - Burstiness (35% weight)
   - Tell-word score (30% weight)
   - Readability pattern (20% weight)
   - Lexical diversity (15% weight)
2. Combine into weighted confidence score (0-100)
3. Classify verdict:
   - < 35%: Human
   - 35-65%: Uncertain
   - > 65%: AI

**Accuracy:** ~70% (based on academic research benchmarks)
**Speed:** <100ms
**Privacy:** 100% local, no data sharing

**Key Function:**
```typescript
detectAILocal(text): Promise<LocalDetectionResult> {
  verdict, confidence, signals, metrics, detectedTellWords, processingTimeMs
}
```

#### 4. gptzero-client.ts (140 lines)
**Purpose:** GPTZero API v2 integration (premium tier)

**Features:**
- Sentence-level AI probability analysis
- Multi-model detection (GPT-4, Claude, Gemini, etc.)
- Error handling (401 auth, 429 rate limit, 400 bad request)
- API key validation helper

**Accuracy:** ~99% (GPTZero claim)
**Speed:** ~2-3s
**Privacy:** Sends text to GPTZero servers (requires user consent)

**Key Function:**
```typescript
detectAIWithGPTZero(text, apiKey): Promise<GPTZeroDetectionResult> {
  verdict, confidence, details: { sentences[], probabilities }, processingTimeMs
}
```

---

## ⏳ Remaining Work (50%)

### Backend (4-5 hours)

#### 1. hybrid-orchestrator.ts (NEW FILE)
**Purpose:** Decision logic for local vs API detection

**Pseudocode:**
```typescript
async function detectAI(text, userId, useAPI) {
  // Always run local detection first
  const localResult = await detectAILocal(text);

  // If confident OR user didn't opt-in to API, return local result
  if (localResult.verdict !== 'uncertain' || !useAPI) {
    return localResult;
  }

  // Check user tier (PRO+ only for API)
  if (userTier === 'free') {
    return { ...localResult, message: 'API requires PRO+ tier' };
  }

  // Check API quota
  if (apiQuotaExceeded) {
    return { ...localResult, message: 'API quota exceeded' };
  }

  // Call GPTZero API
  const apiResult = await detectAIWithGPTZero(text, apiKey);

  // Return combined result
  return {
    verdict: apiResult.verdict,
    confidence: apiResult.confidence,
    local: localResult,
    api: apiResult,
    method: 'hybrid'
  };
}
```

#### 2. ai-detection.ts (NEW FILE - routes)
**Purpose:** HTTP endpoints for AI detection

**Endpoints:**
```typescript
POST /ai-detection/detect
Request: { text, useAPI: boolean }
Response: {
  verdict, confidence, signals, detectedTellWords,
  method: 'local' | 'hybrid',
  processingTimeMs
}

GET /ai-detection/history (optional)
Response: { detections: [...], total, limit, offset }
```

**Middleware:**
- `requireAuth()` - Must be logged in
- Tier validation (FREE = local only, PRO+ = API access)
- Rate limiting (50/day local, 10/day API)

#### 3. Update workers/shared/types.ts
Add to `Env` interface:
```typescript
GPTZERO_API_KEY?: string;
```

#### 4. Register routes in index.ts
```typescript
import aiDetectionRoutes from './routes/ai-detection';
app.route('/ai-detection', aiDetectionRoutes);
```

---

### Frontend (6-8 hours)

#### 1. AIDetectorPanel.tsx (NEW COMPONENT)
**Purpose:** Main UI for AI detection

**Layout:**
```
┌─────────────────────────────────────┐
│ AI Tell Detector                    │
│ Identify AI-generated text patterns │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Textarea (paste text here)          │
│ Minimum 20 words                    │
│                                     │
└─────────────────────────────────────┘

[ ] Use advanced detection (GPTZero API) ⓘ
    Privacy: Sends text to GPTZero servers

[Detect AI Content]

┌─────────────────────────────────────┐
│ Results:                            │
│ Verdict: Likely AI (72% confidence) │
│ Method: Local analysis (<100ms)     │
│                                     │
│ Signals:                            │
│ • Burstiness: 35/100 (uniform)      │
│ • Tell-words: 45/100 (moderate)     │
│ • Readability: 60/100 (typical AI)  │
│ • Diversity: 55/100 (moderate)      │
│                                     │
│ Detected Tell-Words:                │
│ • "delve" (3x) - Overused Academic  │
│ • "leverage" (2x) - Overused        │
│ • "it's worth noting" (1x)          │
└─────────────────────────────────────┘
```

**Features:**
- Text input (min 20 words)
- API opt-in checkbox with privacy notice
- Results display (confidence meter, verdict)
- Signal breakdown (4 metrics with explanations)
- Tell-word highlighting in original text
- Loading states
- Error handling

#### 2. Update cloud-api-client.ts
Add methods:
```typescript
async detectAI(text: string, useAPI: boolean): Promise<DetectionResult>
async getDetectionHistory(limit, offset): Promise<Detection[]>
```

#### 3. Update App.tsx
Add "AI Detector" tab to navigation (5th tab)

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│ User Submits Text (20+ words)           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ TIER 1: Local Statistical Analysis      │
│ • Burstiness (sentence variation)       │
│ • Tell-word frequency                   │
│ • Readability pattern                   │
│ • Lexical diversity                     │
│ (~50ms, privacy-friendly, free)         │
└────────────────┬────────────────────────┘
                 │
                 ▼
            Confidence?
                 │
        ┌────────┼────────┐
        │        │        │
    Human   Uncertain   AI
    (0-35%)  (35-65%)  (65-100%)
        │        │        │
        │        ▼        │
        │   ┌─────────────────────┐
        │   │ User Opted API?     │
        │   │ & PRO+ Tier?        │
        │   │ & Quota Available?  │
        │   └─────────┬───────────┘
        │             │
        │        Yes  │  No
        │             ▼
        │   ┌─────────────────────┐
        │   │ TIER 2: GPTZero API │
        │   │ • Multi-model detect│
        │   │ • Sentence analysis │
        │   │ • ~2-3s latency     │
        │   │ • $0.001/check      │
        │   └─────────────────────┘
        │             │
        └─────────────┴───────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Display Results     │
        │ • Confidence %      │
        │ • Verdict           │
        │ • Signal breakdown  │
        │ • Tell-word list    │
        └─────────────────────┘
```

---

## Configuration

### Environment Variables
```bash
# Add GPTZero API key (Essential plan $10/month)
cd /Users/tem/humanizer_root/workers/npe-api
npx wrangler secret put GPTZERO_API_KEY
# Paste key when prompted
```

### Tier Configuration
| Tier | Local Detection | API Detection | Rate Limits |
|------|----------------|---------------|-------------|
| FREE | ✅ Yes | ❌ No | 50 checks/day |
| MEMBER | ✅ Yes | ❌ No | 50 checks/day |
| PRO | ✅ Yes | ✅ Yes | 50 local, 10 API/day |
| PREMIUM | ✅ Yes | ✅ Yes | Unlimited |
| ADMIN | ✅ Yes | ✅ Yes | Unlimited |

---

## Testing Plan

### Unit Tests
1. Tell-word detection accuracy
2. Burstiness calculation correctness
3. Readability metrics validation
4. Local detector confidence scoring

### Integration Tests
1. Local detection flow (no API)
2. Hybrid detection flow (local → API)
3. Tier enforcement (FREE vs PRO+)
4. Quota tracking
5. Error handling (invalid API key, rate limits)

### E2E Tests
1. Upload human-written text → expect "Human" verdict
2. Upload AI-generated text → expect "AI" verdict
3. Upload mixed content → expect "Uncertain" or "Mixed"
4. Test tell-word highlighting
5. Test API opt-in toggle

### Test Data
**Human samples:**
- Personal emails
- Blog posts
- Academic papers (pre-2020)

**AI samples:**
- GPT-4 generated essays
- Claude outputs
- ChatGPT responses

---

## Cost Breakdown

### GPTZero Pricing
**Essential Plan:** $10/month
- 150,000 words/month (~750 checks @ 200 words avg)
- 100 scans/hour rate limit
- API access included

**Estimated Usage (1,000 users):**
- 5,000 checks/month total
- 70% local (3,500 checks) = $0
- 30% API (1,500 checks) = 300,000 words
- Fits in Essential plan ($10/month)

**Cost per check:** $0.0067 (API), $0.00 (local)
**Hybrid average:** $0.002 per check

---

## Privacy & Compliance

### Local Detection
✅ No data sharing
✅ GDPR-compliant by default
✅ No DPA required
✅ User trust

### API Detection (GPTZero)
⚠️ User text sent to external service
⚠️ Requires explicit consent (GDPR Article 6)
⚠️ Need Data Processing Agreement (DPA) with GPTZero
⚠️ Must document in Privacy Policy
⚠️ Data retention: GPTZero policy unclear

### Implementation
1. **Default:** Local detection only
2. **Opt-in:** Checkbox with privacy notice
3. **Transparency:** Show "Uses GPTZero API" badge
4. **Data minimization:** Only send necessary text
5. **Logging:** Don't log user text, only scores

---

## Known Limitations

### Local Detection
- **Accuracy:** ~70% (vs 99% API)
- **False positives:** Formal human writing (legal, academic)
- **False negatives:** Well-prompted AI can avoid tells
- **Context-insensitive:** Doesn't understand meaning

### GPTZero API
- **Privacy:** Sends text to 3rd party
- **Cost:** $10/month ongoing
- **Dependency:** External service uptime
- **Latency:** 2-3s per request

### General
- **Model drift:** As AI improves, detection becomes harder
- **Adversarial:** Users can prompt AI to avoid detection
- **Short text:** Requires 20+ words minimum for accuracy

---

## Future Enhancements (Phase 2)

1. **Custom tell-word lists** - Users add their own AI tells
2. **Interactive highlighting** - Click words to flag as tell
3. **Batch processing** - Analyze multiple texts at once
4. **History tracking** - Store detection results in DB
5. **ML model** - Train lightweight classifier on labeled data (82-85% accuracy)
6. **Sentence-level analysis** - Highlight specific AI sentences
7. **Export reports** - PDF/CSV export of detection results
8. **Browser extension** - Detect AI on any webpage

---

## Quick Start (Next Session)

```bash
# 1. Navigate to backend
cd /Users/tem/humanizer_root/workers/npe-api

# 2. Create remaining backend files
# - src/services/ai-detection/hybrid-orchestrator.ts
# - src/routes/ai-detection.ts

# 3. Update types
# - Add GPTZERO_API_KEY to Env in shared/types.ts

# 4. Register routes
# - Import and mount in src/index.ts

# 5. Add GPTZero API key
npx wrangler secret put GPTZERO_API_KEY
# Paste key from gptzero.me account

# 6. Deploy backend
npx wrangler deploy

# 7. Test with curl
curl -X POST https://api.humanizer.com/ai-detection/detect \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Your test text here","useAPI":false}'

# 8. Build frontend
cd ../cloud-frontend
# Create AIDetectorPanel.tsx
# Update cloud-api-client.ts
# Add navigation tab
npm run build
npx wrangler pages deploy dist --project-name=npe-cloud

# 9. E2E testing
```

---

**Status:** Backend services complete (50%), frontend + integration remaining (50%)
**Est. Time to Complete:** 2-3 sessions (8-12 hours)
**Blocker:** Need GPTZero API key ($10/month signup)

**Next Steps:**
1. Complete hybrid-orchestrator.ts
2. Create ai-detection.ts routes
3. Update types and register routes
4. Deploy backend
5. Build frontend UI
6. Test end-to-end

---

**Last Updated:** 2025-11-08
**Git Commit:** 4f687b1
