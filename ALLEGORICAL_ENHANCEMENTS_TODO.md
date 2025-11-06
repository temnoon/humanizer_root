# Allegorical Transform Enhancements - TODO List

**Start Date:** November 6, 2025
**Plan Document:** `/Users/tem/humanizer_root/Model_selection_API_key_implementation.txt`
**Status:** NOT STARTED

---

## Phase 1: Database Migration & Security Infrastructure ⏳ NOT STARTED

### 1.1 Database Migration
- [ ] Create migration file: `0008_api_keys_and_model_preferences.sql`
  - [ ] Add API key columns (encrypted): openai, anthropic, google
  - [ ] Add model preference columns: preferred_model, preferred_length
  - [ ] Add audit column: api_keys_updated_at
- [ ] Test migration locally with `wrangler d1 execute`
- [ ] Apply migration to production database

### 1.2 Encryption Utilities
- [ ] Create `/workers/npe-api/src/utils/encryption.ts`
  - [ ] Implement `encryptAPIKey()` using AES-GCM
  - [ ] Implement `decryptAPIKey()` with error handling
  - [ ] Write unit tests for encryption/decryption roundtrip
- [ ] Verify encryption uses JWT_SECRET + user_id for key derivation
- [ ] Test with sample API keys

---

## Phase 2: Backend API Changes ⏳ NOT STARTED

### 2.1 API Key Management Endpoints
- [ ] Create `/workers/npe-api/src/routes/user-settings.ts`
  - [ ] POST `/api/user/api-keys` - Set/update API keys (PRO+ only)
  - [ ] GET `/api/user/api-keys/status` - Check which keys are configured
  - [ ] DELETE `/api/user/api-keys/:provider` - Remove specific API key
- [ ] Add tier validation middleware (PRO/PREMIUM/ADMIN only)
- [ ] Add encryption/decryption calls
- [ ] Test with Postman/curl

### 2.2 Model Selection Endpoint
- [ ] Create GET `/api/models` endpoint
  - [ ] Return Cloudflare models (always available)
  - [ ] Return external provider models if API key exists
  - [ ] Filter by user tier
- [ ] Define ModelInfo interface in shared types
- [ ] Document model capabilities and requirements

### 2.3 Update Allegorical Service
- [ ] Update `allegorical.ts` to accept `model` and `length_preference` params
  - [ ] Add token calculation logic based on length preference
  - [ ] Add model routing logic (Cloudflare vs external)
  - [ ] Update 5-stage pipeline to use selected model
- [ ] Create `/services/llm-providers/` directory
  - [ ] Implement `cloudflare.ts` (existing logic)
  - [ ] Implement `openai.ts`
  - [ ] Implement `anthropic.ts`
  - [ ] Implement `google.ts`
- [ ] Add error handling for API key validation
- [ ] Update transformation database schema to track model used

---

## Phase 3: Frontend Changes ⏳ NOT STARTED

### 3.1 Update AllegoricalForm Component
- [ ] Add length control dropdown
  - [ ] shorter (50%), same (100%), longer (200%), much_longer (300%)
  - [ ] Save preference to state
  - [ ] Include in API request
- [ ] Add model selection dropdown
  - [ ] Fetch available models from `/api/models`
  - [ ] Group by provider (Cloudflare, OpenAI, Anthropic, Google)
  - [ ] Disable external models if no API key
  - [ ] Save selection to state
- [ ] Add "Configure API Keys" button (PRO+ only)
  - [ ] Show only if user.role is 'pro', 'premium', or 'admin'
  - [ ] Opens APIKeySettings modal

### 3.2 Create APIKeySettings Component
- [ ] Create `/cloud-frontend/src/components/settings/APIKeySettings.tsx`
  - [ ] Input fields for OpenAI, Anthropic, Google API keys
  - [ ] Mask existing keys with `*****`
  - [ ] "Test Connection" button for each provider
  - [ ] "Save" button with encryption notice
  - [ ] "Delete" button for each key
- [ ] Add modal/panel styling
- [ ] Integrate with cloud-api-client

### 3.3 Update API Client
- [ ] Add methods to `cloud-api-client.ts`:
  - [ ] `setAPIKeys(keys: SetAPIKeysRequest): Promise<void>`
  - [ ] `getAPIKeysStatus(): Promise<APIKeysStatus>`
  - [ ] `getAvailableModels(): Promise<ModelInfo[]>`
  - [ ] `testAPIKeyConnection(provider: string, key: string): Promise<boolean>`
- [ ] Update TypeScript interfaces in shared types

---

## Phase 4: LLM Provider Integrations ⏳ NOT STARTED

### 4.1 OpenAI Integration
- [ ] Create `/workers/npe-api/src/services/llm-providers/openai.ts`
  - [ ] Implement `callOpenAI()` for GPT-4o, GPT-4o-mini
  - [ ] Handle API errors and rate limits
  - [ ] Map response format to standard interface
- [ ] Test with real OpenAI API key
- [ ] Document token costs

### 4.2 Anthropic Integration
- [ ] Create `/workers/npe-api/src/services/llm-providers/anthropic.ts`
  - [ ] Implement `callAnthropic()` for Claude 3.5 Sonnet/Haiku
  - [ ] Handle API errors and rate limits
  - [ ] Map response format to standard interface
- [ ] Test with real Anthropic API key
- [ ] Document token costs

### 4.3 Google Gemini Integration
- [ ] Create `/workers/npe-api/src/services/llm-providers/google.ts`
  - [ ] Implement `callGemini()` for Gemini 2.0 Flash, 1.5 Pro
  - [ ] Handle API errors and rate limits
  - [ ] Map response format to standard interface
- [ ] Test with real Google API key
- [ ] Document token costs

### 4.4 Cloudflare Models Refactor
- [ ] Extract existing Cloudflare AI logic to `cloudflare.ts`
- [ ] Add support for new models:
  - [ ] Llama 3.3 70B FP8 Fast
  - [ ] Llama 4 Scout 17B
  - [ ] GPT-OSS 20B
  - [ ] Qwen 32B
  - [ ] DeepSeek R1 Distill 32B
- [ ] Test each model with allegorical transform

---

## Phase 5: Testing & Validation ⏳ NOT STARTED

### 5.1 Security Testing
- [ ] Verify API keys are encrypted in database (inspect D1 directly)
- [ ] Verify decryption requires correct user_id + JWT_SECRET
- [ ] Test encryption/decryption with various key lengths
- [ ] Verify non-PRO users get 403 on API key endpoints
- [ ] Test API key deletion
- [ ] Verify keys are never logged or exposed in errors

### 5.2 Functionality Testing
- [ ] Test allegorical transform with each Cloudflare model
- [ ] Test length controls: shorter, same, longer, much_longer
- [ ] Test OpenAI integration (GPT-4o, GPT-4o-mini)
- [ ] Test Anthropic integration (Claude Sonnet, Haiku)
- [ ] Test Google integration (Gemini Flash, Pro)
- [ ] Verify model list updates when API keys added/removed
- [ ] Test error handling for invalid API keys
- [ ] Test timeout handling for slow models

### 5.3 UI/UX Testing
- [ ] Verify model dropdown shows correct options per tier
- [ ] Verify length dropdown saves preference
- [ ] Test API key settings modal (all CRUD operations)
- [ ] Verify "Configure API Keys" button visibility (PRO+ only)
- [ ] Test key masking (show as *****)
- [ ] Test "Test Connection" functionality
- [ ] Mobile testing (responsive layout)
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

---

## Phase 6: Deployment ⏳ NOT STARTED

### 6.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Migration tested locally
- [ ] Documentation complete
- [ ] Security review passed
- [ ] JWT_SECRET verified in production: `npx wrangler secret list`

### 6.2 Deployment Steps
- [ ] Apply D1 migration: `npx wrangler d1 migrations apply npe-db`
- [ ] Deploy Workers API: `cd workers/npe-api && npx wrangler deploy`
- [ ] Build frontend: `cd cloud-frontend && npm run build`
- [ ] Deploy frontend: `npx wrangler pages deploy dist --project-name=npe-cloud`
- [ ] Verify deployment on https://humanizer.com

### 6.3 Post-Deployment Verification
- [ ] Test as FREE user → only Cloudflare models visible
- [ ] Upgrade test user to PRO
- [ ] Add OpenAI key → verify GPT models appear
- [ ] Test allegorical transform with external model
- [ ] Verify length controls work correctly
- [ ] Monitor error logs for 24 hours
- [ ] Check API usage costs

---

## Session Handoff Checklist

At end of each session:
- [ ] Update this TODO with checkmarks
- [ ] Update `ALLEGORICAL_ENHANCEMENTS_HANDOFF.md` with progress
- [ ] Store session summary in ChromaDB using memory subagent
- [ ] Update CLAUDE.md with latest status
- [ ] Commit all code changes to GitHub
- [ ] Note any blockers or questions for next session

---

## Estimated Progress
- **Phase 1:** 0% complete (0/8 tasks)
- **Phase 2:** 0% complete (0/10 tasks)
- **Phase 3:** 0% complete (0/8 tasks)
- **Phase 4:** 0% complete (0/12 tasks)
- **Phase 5:** 0% complete (0/18 tasks)
- **Phase 6:** 0% complete (0/11 tasks)

**Overall:** 0% complete (0/67 tasks)

---

**Last Updated:** November 6, 2025 - Session Start
**Next Session:** Start with Phase 1.1 (Database Migration)
