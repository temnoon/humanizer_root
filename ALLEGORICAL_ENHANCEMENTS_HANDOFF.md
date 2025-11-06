# Allegorical Transform Enhancements - Session Handoff

**Project:** Model Selection & API Key Storage Implementation
**Start Date:** November 6, 2025
**Current Status:** Planning Complete, Implementation Not Started

---

## Quick Start for Next Session

```bash
# 1. Check ChromaDB for latest context
Launch memory-agent and recall "allegorical enhancements model selection API keys"

# 2. Review master plan
cat /Users/tem/humanizer_root/Model_selection_API_key_implementation.txt

# 3. Check TODO list
cat /Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_TODO.md

# 4. This handoff document
cat /Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_HANDOFF.md
```

---

## Project Overview

### Goals
1. **Length Control:** User-selectable output length (shorter/same/longer/much_longer)
2. **Model Selection:** Choose from Cloudflare native models + external APIs (OpenAI, Anthropic, Google)
3. **Secure API Storage:** Encrypted API keys for PRO+ users

### Scope
- **Service:** Allegorical Transform only (not Round-Trip, Maieutic, Quantum Reading)
- **Access:** External API keys restricted to PRO, PREMIUM, ADMIN tiers
- **Security:** AES-GCM encryption using JWT_SECRET + user_id as key

### Key Decisions Made
- **Length Control:** Token multipliers (0.5x, 1x, 2x, 3x input length)
- **Encryption:** Server Secret + User ID approach (balanced security/usability)
- **Access Control:** PRO and above for external API keys
- **Implementation:** Token multipliers (not just prompt instructions)

---

## Current State

### Completed
- ✅ Full research on current implementation
- ✅ Identified all LLM usage across services
- ✅ Compiled list of available Cloudflare models (2025)
- ✅ Designed database schema changes
- ✅ Designed API endpoints
- ✅ Designed frontend UX
- ✅ Created comprehensive implementation plan
- ✅ User approved plan
- ✅ Created TODO list (67 tasks across 6 phases)
- ✅ Created this handoff document

### Not Started
- ⏳ Phase 1: Database Migration & Security (0% - 8 tasks)
- ⏳ Phase 2: Backend API Changes (0% - 10 tasks)
- ⏳ Phase 3: Frontend Changes (0% - 8 tasks)
- ⏳ Phase 4: LLM Provider Integrations (0% - 12 tasks)
- ⏳ Phase 5: Testing & Validation (0% - 18 tasks)
- ⏳ Phase 6: Deployment (0% - 11 tasks)

### Files Created This Session
1. `/Users/tem/humanizer_root/Model_selection_API_key_implementation.txt` - Master plan (detailed)
2. `/Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_TODO.md` - Task list
3. `/Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_HANDOFF.md` - This document

---

## Key Technical Details

### Current Allegorical Implementation
- **File:** `/workers/npe-api/src/services/allegorical.ts` (321 lines)
- **Model:** `@cf/meta/llama-3.1-8b-instruct` (hardcoded)
- **Config:** `max_tokens: 2048`, `temperature: 0.7`
- **Pipeline:** 5 stages (Deconstruct → Map → Reconstruct → Stylize → Reflect)
- **No length controls:** Currently relies only on max_tokens

### Database Changes Needed
```sql
-- Migration: 0008_api_keys_and_model_preferences.sql
ALTER TABLE users ADD COLUMN openai_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN anthropic_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN google_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN preferred_model TEXT DEFAULT '@cf/meta/llama-3.1-8b-instruct';
ALTER TABLE users ADD COLUMN preferred_length TEXT DEFAULT 'same'
  CHECK(preferred_length IN ('shorter', 'same', 'longer', 'much_longer'));
ALTER TABLE users ADD COLUMN api_keys_updated_at INTEGER;
```

### Encryption Strategy
```typescript
// Key Derivation: SHA-256(JWT_SECRET + user_id)
// Algorithm: AES-GCM (256-bit)
// Format: base64(iv):base64(encrypted_data)

const key = await deriveKey(JWT_SECRET, userId);
const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
```

### Token Calculation
```typescript
const multipliers = {
  shorter: 0.5,      // 50% of input length
  same: 1.0,         // 100% (same as input)
  longer: 2.0,       // 200% (2x input)
  much_longer: 3.0   // 300% (3x input)
};
const inputTokens = Math.ceil(input_text.length / 4);  // ~4 chars per token
const max_tokens = Math.min(
  inputTokens * multipliers[length_preference],
  8192  // Hard cap at 8K tokens
);
```

### Available Cloudflare Models (2025)
**Top Recommendations:**
1. `@cf/meta/llama-3.1-8b-instruct` - Current baseline (8B)
2. `@cf/meta/llama-3.3-70b-instruct-fp8-fast` - 70B, 2-4x faster
3. `@cf/meta/llama-4-scout-17b-16e-instruct` - Newest, multimodal (17B MoE)
4. `@cf/openai/gpt-oss-20b` - OpenAI open model (20B)
5. `@cf/qwen/qwq-32b` - Reasoning model (32B)
6. `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` - Chain-of-thought (32B)

**External APIs to Support:**
- OpenAI: gpt-4o, gpt-4o-mini
- Anthropic: claude-3-5-sonnet, claude-3-5-haiku
- Google: gemini-2.0-flash, gemini-1.5-pro

---

## Implementation Order (Recommended)

### Session 1 (Est. 2-3 hours)
1. Create migration `0008_api_keys_and_model_preferences.sql`
2. Create `utils/encryption.ts` with AES-GCM implementation
3. Test encryption/decryption locally
4. Apply migration to local D1 database

### Session 2 (Est. 3-4 hours)
1. Create `routes/user-settings.ts` with API key endpoints
2. Add tier validation middleware
3. Update shared TypeScript types
4. Test API endpoints with Postman

### Session 3 (Est. 3-4 hours)
1. Create LLM provider integrations:
   - `services/llm-providers/openai.ts`
   - `services/llm-providers/anthropic.ts`
   - `services/llm-providers/google.ts`
2. Update `allegorical.ts` with model routing
3. Add length preference logic

### Session 4 (Est. 2-3 hours)
1. Update `AllegoricalForm.tsx` with dropdowns
2. Create `APIKeySettings.tsx` component
3. Update `cloud-api-client.ts` with new methods

### Session 5 (Est. 2-3 hours)
1. Comprehensive testing (security, functionality, UI)
2. Fix any bugs found
3. Documentation updates

### Session 6 (Est. 1-2 hours)
1. Deploy to production
2. Post-deployment verification
3. Monitor for 24 hours

**Total Estimated Time:** 12-16 hours (6 sessions)

---

## Critical Security Notes

### Must-Do Security Checklist
- [ ] Never log API keys (even partially)
- [ ] Never include keys in error messages
- [ ] Verify encryption working before production
- [ ] Test decryption fails with wrong user_id
- [ ] Add rate limiting to API key endpoints
- [ ] Audit D1 database to ensure no plaintext keys
- [ ] Add CORS restrictions to API key endpoints

### Encryption Implementation Notes
```typescript
// CORRECT: Each user has unique encryption key
const encryptionKey = SHA-256(JWT_SECRET + user_id);

// WRONG: Don't use same key for all users
const encryptionKey = SHA-256(JWT_SECRET);  // ❌ BAD

// CORRECT: Randomize IV per encryption
const iv = crypto.getRandomValues(new Uint8Array(12));

// WRONG: Don't reuse IV
const iv = new Uint8Array(12);  // ❌ BAD
```

---

## Common Pitfalls to Avoid

1. **Token Limits:** Different models have different max_tokens caps
   - Solution: Check model limits before calling API

2. **API Costs:** External models cost money per token
   - Solution: Show clear warnings to users, track usage

3. **Error Handling:** External APIs can fail/timeout
   - Solution: Graceful degradation, retry logic, clear error messages

4. **Model Quality Variance:** Not all models produce same quality
   - Solution: Default to proven Llama 3.1, let users experiment

5. **Key Rotation:** Users may want to update API keys
   - Solution: Allow easy updates, re-encryption with new values

---

## Testing Strategy

### Unit Tests
- Encryption/decryption roundtrip
- Token calculation for each length preference
- Model routing logic
- API key validation

### Integration Tests
- API key CRUD operations
- Model selection with different tiers
- Allegorical transform with each provider
- Length control accuracy

### E2E Tests
- FREE user cannot access API key settings
- PRO user can add/update/delete API keys
- Model dropdown updates when keys added
- Complete allegorical transform flow

---

## Blockers & Dependencies

### Required Before Starting
- ✅ JWT_SECRET must be set in Workers environment
- ✅ User tier system must be functional (already is)
- ✅ D1 database must be accessible (already is)

### External Dependencies
- OpenAI API access (user provides key)
- Anthropic API access (user provides key)
- Google AI API access (user provides key)
- Cloudflare Workers AI (already available)

### No Blockers Currently
All prerequisites are met, ready to begin implementation.

---

## Questions for Future Sessions

1. Should we add cost tracking per transformation?
2. Should we show estimated costs before running?
3. Should we add model performance metrics (speed, quality)?
4. Should we add streaming responses for long generations?
5. Should we extend to other services (Round-Trip, Maieutic)?

**User Answer:** Defer these to later, focus on core implementation first.

---

## Session End Checklist

Before ending each session:
1. [ ] Update TODO list with completed tasks
2. [ ] Update this handoff with progress made
3. [ ] Store session summary in ChromaDB
4. [ ] Update CLAUDE.md
5. [ ] Commit all code changes
6. [ ] Push to GitHub
7. [ ] Note any blockers for next session

---

## ChromaDB Memory Tags

Use these tags when storing session summaries:
- `allegorical-enhancements`
- `model-selection`
- `api-key-storage`
- `phase-N-complete` (where N is 1-6)
- `session-handoff`
- `implementation-progress`

---

## Next Session Starting Point

**Start Here:**
1. Read this handoff document (you're reading it now!)
2. Recall latest ChromaDB memory: "allegorical enhancements"
3. Review TODO list: `ALLEGORICAL_ENHANCEMENTS_TODO.md`
4. Check master plan: `Model_selection_API_key_implementation.txt`
5. Begin Phase 1.1: Create migration file

**First Task:** Create `/workers/npe-api/migrations/0008_api_keys_and_model_preferences.sql`

---

**Last Updated:** November 6, 2025 - Planning Complete
**Status:** Ready to begin Phase 1 (Database Migration)
**Estimated Completion:** 6 sessions (12-16 hours total)
