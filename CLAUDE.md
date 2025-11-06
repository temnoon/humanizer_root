# Humanizer - Development Guide

**Last Updated**: Nov 6, 2025 - Theme Detection + Allegorical Enhancements Planning 🌓🎨
**Status**: ✅ **FULLY OPERATIONAL** | WebAuthn + Quantum Reading + GA4
**Active Project**: 🚧 Allegorical Transform Enhancements (Model Selection + API Keys) - Phase 0 Complete
**Latest**: Node 22.21.1, Wrangler 4, React 19, @simplewebauthn 13.2.2
**Admin Account**: dreegle@gmail.com (personal account, device registered ✅)
**Test Account**: demo@humanizer.com (password: testpass123, role: free)
**Admin URL**: https://humanizer.com (login to access admin dashboard)

**Security Status**: ✅ **PRODUCTION-READY CRITERIA MET**
- ✅ All dependencies current with no known vulnerabilities
- ✅ Node.js 22.21.1 (LTS until April 2027)
- ✅ `npm audit`: 0 vulnerabilities in both projects
- ✅ esbuild security vulnerability (GHSA-67mh-4wv8-2f99) FIXED

**Memory IDs**:
- Allegorical Enhancements Plan: `81d03cad3cb96dff6e0d6c7ed138ba6f0365b38154b195253945947f84f25dd3` (Nov 6, 2025) 🚧 ACTIVE
- QR UI Polish + Analytics: `4e04a4a272adc9fd398086a0df2f1d16277ad5af185eccb20dded24276ca8d9f` (Nov 4, 2025)
- Quantum Reading MVP: `04f54d40bb5cc038a7ab6159db6b518643f05a3f9a92fc7d0af8fdf24746ddb8` (Nov 3, 2025)
- WebAuthn final: `b6901c31ee71a60cf0460083fad732e4c90d170a28d251dfa519e7fa5c3ccf79` (Nov 3, 2025)

**✅ WEBAUTHN FULLY WORKING**:
- **Issues Fixed**:
  1. userID → Uint8Array conversion (v13 breaking change)
  2. registrationInfo.credential structure (nested object in v13)
  3. Domain matching (deployed to humanizer.com)
- **Production Status**: Live and tested successfully
  - Backend: Version 5092ecf6-c0f6-45f0-aba9-b764ae2f0d08
  - Frontend: Version 9f59d604 on humanizer.com
  - First device registered: "Tem's Mac" ✅
- **Latest commit**: d4c6a81 (WebAuthn credential structure fix)
- **Node.js**: 22.21.1 now default (.nvmrc files added)

---

## 🔒 SECURITY REQUIREMENTS

**Before declaring any deployment "production-ready":**
1. All dependencies MUST be current with no known vulnerabilities
2. Node.js MUST be on active LTS (currently 20.x or 22.x)
3. Run `npm audit` in all projects - MUST show 0 vulnerabilities
4. Review security advisories for all major dependencies
5. Schedule quarterly dependency reviews

**Current Versions (Nov 3, 2025):**
- Node.js: 22.21.1 (LTS, EOL: April 2027)
- Wrangler: 4.45.3 (fixes esbuild vulnerability)
- React: 19.2.0 (latest)
- jose: 6.1.0 (latest, ESM-only)
- TypeScript: 5.7.2 (latest)

---

## 📋 NPE DEPLOYMENT STATUS

**URLs**:
- Frontend: https://humanizer.com (✅ deployed, ✅ working)
- API: https://api.humanizer.com (✅ deployed, ✅ working)
- D1 Database: Seeded (5 personas, 6 namespaces, 5 styles)

**Critical Values**:
- Database ID: `29127486-4246-44b2-a844-7bbeb44f75fb`
- KV Namespace: `4c372f27384b40d1aa02aed7be7c8ccd`
- JWT Secret: Set via `wrangler secret` (not in code)

**Completed Phases**:
- ✅ Phase 1: Infrastructure (D1, KV, Durable Objects, auth)
- ✅ Phase 2: Services (Allegorical, Round-trip, Maieutic) - 1,125 lines
- ✅ Phase 3: Frontend (React, forms, onboarding) - 1,773 lines
- ✅ Phase 4: Mailing list feature (signup modal, admin exports)
- ✅ Phase 5: Tiered user system (roles, quotas)
- ✅ Phase 6: WebAuthn Touch ID auth (production ready)
- ✅ Phase 7: Quantum Reading Analysis (density matrix evolution) - 1,900 lines
- ✅ Deployment (Cloudflare Workers + Pages, custom domains)

**NPE Features**:
1. **Allegorical**: 5-stage pipeline (Deconstruct → Map → Reconstruct → Stylize → Reflect)
2. **Round-Trip**: 18 languages, semantic drift analysis
3. **Maieutic**: Socratic questioning, 5 depth levels (0-4)
4. **Quantum Reading**: Sentence-by-sentence density matrix evolution with Tetralemma POVM

**Config**: 5 personas × 6 namespaces × 5 styles = 150 allegorical combinations

---

## 👥 TIERED USER SYSTEM

**User Roles** (in order of privileges):
1. **ADMIN** - Full system access, can export mailing lists, manage users
2. **PREMIUM** - Unlimited transforms, unlimited tokens per transform, smart chunking
3. **PRO** - 200 transforms/month, 8,000 tokens per transform
4. **MEMBER** - 50 transforms/month, 2,000 tokens per transform
5. **FREE** - 10 transforms/month, 500 tokens per transform

**Access Control**:
- **Admin-only endpoints**: Mailing list export, user management, system metrics
- **Authenticated endpoints**: All transformation APIs, user profile
- **Public endpoints**: Landing page, mailing list signup, login/register

**Resource Quotas** (enforced per user tier):
```
Tier       | Transforms/Month | Tokens/Transform | Features
-----------|------------------|------------------|------------------
FREE       | 10               | 500              | Basic NPE
MEMBER     | 50               | 2,000            | Basic NPE
PRO        | 200              | 8,000            | Basic NPE
PREMIUM    | Unlimited        | Unlimited        | Smart chunking
ADMIN      | Unlimited        | Unlimited        | All + exports
```

**Important**:
- Only ADMIN role can export mailing lists
- Only ADMIN role can access system-level metrics
- All other roles can only access their own content and public content
- Usage tracking fields: `monthly_transformations`, `monthly_tokens_used`, `last_reset_date`

**Current Users**:
- dreegle@gmail.com - ADMIN (personal account)
- demo@humanizer.com - FREE (test account, password: testpass123)

**See**: `/Users/tem/humanizer_root/What the Tiered System Actually Implements.me` for full architecture

---

## 🚨 SESSION START PROTOCOL

**At start of EVERY session**:
```
Launch memory-agent and ask for recent work summary
```
This provides context from ChromaDB memory (~1,500 tokens vs reading full handoff docs).

---

## 🚨 CRITICAL RULES

1. **NEVER `metadata`** → use `custom_metadata` (SQLAlchemy reserved)
2. **ALWAYS SQLAlchemy 2.0** (`select()`, async, no `query()`)
3. **ALWAYS Poetry** (`poetry run`, not global Python)
4. **ALWAYS use CSS variables** - Use --bg-*, --text-*, --accent-*
5. **Claude model**: `claude-haiku-4-5-20251001` (Haiku 4.5)
6. **Trailing slash**: FastAPI endpoints need trailing slash
7. **Frontend testing**: Use frontend-tester subagent
8. **npx wrangler**: Never global wrangler install (use npx)
9. **JWT_SECRET**: Set via `wrangler secret put` (not in wrangler.toml vars)
10. **CORS**: Must include production domains in Workers CORS config

---

## 📁 Project Structure

```
/Users/tem/humanizer_root/
├── humanizer/              # Local FastAPI backend
├── frontend/               # Local React frontend
├── cloud-frontend/         # NPE Cloud frontend (deployed to humanizer.com)
│   └── src/
│       ├── components/transformations/  # Allegorical, RoundTrip, Maieutic forms
│       ├── components/quantum/          # TetralemmaViz, DensityMatrixStats
│       ├── components/onboarding/       # LandingTutorial
│       ├── components/help/             # HelpPanel
│       ├── pages/                       # QuantumAnalysis
│       └── lib/cloud-api-client.ts      # API client
├── workers/npe-api/        # NPE Workers API (deployed to api.humanizer.com)
│   ├── src/
│   │   ├── routes/         # auth, transformations, config, quantum-analysis
│   │   ├── services/       # allegorical, round_trip, maieutic
│   │   │   └── quantum-reading/  # density-matrix-simple, embeddings, povm-measurement
│   │   └── middleware/     # auth
│   └── migrations/         # D1 schema + seed data (incl. 0007_quantum_analysis)
└── workers/shared/         # TypeScript types
```

---

## 🏃 Quick Start

### NPE Cloud (Production)
```bash
# Deploy Workers API
cd /Users/tem/humanizer_root/workers/npe-api
npx wrangler deploy

# Deploy Frontend
cd /Users/tem/humanizer_root/cloud-frontend
npm run build
npx wrangler pages deploy dist --project-name=npe-cloud

# Check logs
npx wrangler tail npe-api
```

### Local Humanizer App
```bash
# Backend (port 8000)
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend (port 3001)
cd frontend
npm run dev

# Kill if needed
lsof -ti:8000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

---

## 📊 Current Stats

**Local App**:
- **Conversations**: 2,043 (1,686 ChatGPT + 357 Claude)
- **Messages**: 52,409

**NPE Cloud (humanizer.com)**:
- **Status**: Live and operational
- **Users**: 2 (test@test.com, demo@humanizer.com)
- **Transformations tested**: Allegorical (working)

---

## 🧠 Memory Agent

**Use for ALL memory operations**:
```
Launch memory-agent and [task]
```

**Database**: `chroma_production_db/` (production), `chroma_archive_db/` (historical)
**Latest NPE Memory**: `15e0f687c3e904eee81644763dc046ad19a92764234f01cea5ef488edfcf9f05`

---

## 📖 Key Docs

**🚧 ACTIVE PROJECT - Allegorical Enhancements**:
- `Model_selection_API_key_implementation.txt` - **MASTER PLAN** (comprehensive design doc)
- `ALLEGORICAL_ENHANCEMENTS_TODO.md` - **TODO LIST** (67 tasks, 6 phases)
- `ALLEGORICAL_ENHANCEMENTS_HANDOFF.md` - **SESSION HANDOFF** (continuity guide)
- ChromaDB Memory: `81d03cad...` - Failsafe documentation

**NPE Deployment**:
- `NPE_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `NPE_DEPLOYMENT_FIXES.md` - Package vulnerability fixes
- `NPE_CLOUD_INTEGRATION_SESSION2_HANDOFF.md` - Phase 2 handoff

**Local App**:
- `UNIFIED_CONVERSATIONS_PHASE1_HANDOFF.md` - Conversation unification
- `CLAUDE_ARCHIVE_IMPORT_HANDOFF.md` - Archive import
- `FRONTEND_TESTING_GUIDE.md` - Frontend testing

---

## 🎯 NEW FEATURES (Nov 3 Session)

### ✅ Mailing List System
- **Frontend**: Modal with name/email/interest form
- **Backend**: POST /mailing-list/signup (public), GET /export, GET /export/csv (admin only)
- **Database**: `mailing_list` table (migration 0003)
- **Status**: WORKING - 1 test signup, exports functional

### ✅ Admin Dashboard
- **Access**: https://humanizer.com → Login → ⚙️ Admin button
- **Tabs**: "Mailing List" (view/export) | "Devices" (register/revoke)
- **Components**: AdminDashboard.tsx, MailingListViewer.tsx, DeviceManager.tsx
- **Status**: ✅ FULLY WORKING on production

### ✅ WebAuthn Touch ID Authentication
- **Purpose**: Passwordless admin login using MacBook Touch ID
- **Database**: `webauthn_credentials` table (migration 0006)
- **Libraries**: @simplewebauthn/server 13.2.2, @simplewebauthn/browser 13.0.0
- **Status**: ✅ WORKING - Device registration and login functional
- **Fixed Issues**:
  1. Buffer API → atob/btoa (Workers-compatible)
  2. userID → Uint8Array (v13 breaking change)
  3. registrationInfo.credential structure (v13 nested object)
- **Tested**: First device "Tem's Mac" successfully registered

### ✅ Quantum Reading Analysis
- **Purpose**: Demonstrate how density matrix (ρ) evolves sentence-by-sentence through quantum measurement
- **Database**: `quantum_analysis_sessions`, `quantum_measurements` tables (migration 0007)
- **Backend**:
  - Density matrix: 32×32 simplified (Workers-compatible, no mathjs)
  - Embeddings: Workers AI `@cf/baai/bge-base-en-v1.5` (768d → 32d projection)
  - POVM: Tetralemma measurement via `@cf/meta/llama-3.1-8b-instruct`
  - Automatic retry logic (2 retries with exponential backoff)
- **Frontend UI** (Split-Pane Layout):
  - **Left Pane**: Full narrative with sentence highlighting (current=purple, completed=green, pending=faded)
  - **Right Pane**: Current analysis + collapsible history table
  - **Keyboard Shortcuts**: Right arrow (→), Down arrow (↓), or Enter for next sentence
  - **Equal Height Panes**: Both use calc(100vh - 300px), fit on screen
  - **Components**:
    - NarrativePane: Clickable highlighted sentences, Reset button in header
    - TetralemmaViz: 4-corner probability display (Literal/Metaphorical/Both/Neither)
    - DensityMatrixStats: Purity, entropy, eigenvalues visualization
    - MeasurementHistoryTable: Compact rows, hover/touch to expand
- **Status**: ✅ WORKING - Professional split-pane interface, 70% less vertical space
- **Cost**: ~$0.01-0.02 per 10-sentence analysis

### ✅ Google Analytics & SEO
- **Google Analytics 4**: G-42D2DXX8EC (IP anonymization, secure cookies, GDPR-friendly)
- **Cloudflare Analytics**: Already enabled via domain settings
- **Google Search Console**: Verified via DNS record (persistent)
- **SEO Metadata**: Open Graph, Twitter Cards, keywords, descriptions
- **Status**: ✅ All tracking live on humanizer.com

### ✅ UX Enhancements (Nov 6 Session)
- **Automatic Theme Detection**: Detects system/browser preference on first load
- **Theme Persistence**: Remembers manual overrides in localStorage
- **Smart Auto-Switching**: Respects manual theme changes for 1 hour
- **Responsive Header**: Flex-wrap layout prevents button overflow on mobile
- **Context-Aware Home Link**: "humanizer.com" logo links to landing (logged out) or allegorical (logged in)
- **Status**: ✅ Live on humanizer.com - commits 09dc45f, 7e2b39b

---

## 🚧 ACTIVE PROJECT: Allegorical Transform Enhancements

**Start Date:** November 6, 2025
**Status:** Phase 0 Complete (Planning) - Implementation Not Started
**Estimated Duration:** 12-16 hours across 6 sessions

### Project Goals
1. **Length Control:** User-selectable output length (shorter/same/longer/much_longer) using token multipliers
2. **Model Selection:** Choose from 10+ Cloudflare native models + external APIs (OpenAI, Anthropic, Google)
3. **Secure API Storage:** AES-GCM encrypted API keys for PRO+ users

### Scope & Decisions
- **Service:** Allegorical Transform ONLY (Round-Trip, Maieutic, QR later)
- **Access:** External API keys restricted to PRO, PREMIUM, ADMIN tiers
- **Security:** Server Secret + User ID encryption (JWT_SECRET + user_id)
- **Implementation:** Token multipliers (0.5x, 1x, 2x, 3x input length)

### Implementation Phases (67 tasks)
- **Phase 1:** Database Migration & Security (8 tasks) - Migration 0008, AES-GCM encryption utils
- **Phase 2:** Backend API (10 tasks) - API key endpoints, model selection, allegorical updates
- **Phase 3:** Frontend (8 tasks) - Length/model dropdowns, API key settings modal
- **Phase 4:** LLM Providers (12 tasks) - OpenAI, Anthropic, Google, Cloudflare integrations
- **Phase 5:** Testing (18 tasks) - Security, functionality, UI/UX validation
- **Phase 6:** Deployment (11 tasks) - Production rollout and verification

### Documentation
- **Master Plan:** `/Users/tem/humanizer_root/Model_selection_API_key_implementation.txt`
- **TODO List:** `/Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_TODO.md`
- **Handoff Doc:** `/Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_HANDOFF.md`
- **ChromaDB:** Memory ID `81d03cad3cb96dff6e0d6c7ed138ba6f0365b38154b195253945947f84f25dd3`

### Current LLM Usage (Before Enhancement)
- **All services use:** `@cf/meta/llama-3.1-8b-instruct` (8B params, hardcoded)
  - Allegorical: 5 stages, max_tokens 2048, temp 0.7
  - Round-Trip: Translation, max_tokens 2048, temp 0.3
  - Maieutic: Questions, max_tokens 256, temp 0.8
  - Quantum Reading: POVM, max_tokens 512, temp 0.3

### New Models to Support (Cloudflare 2025)
- Llama 3.1 8B (current baseline)
- Llama 3.3 70B FP8 Fast (2-4x faster, better quality)
- Llama 4 Scout 17B (newest, multimodal MoE)
- GPT-OSS 20B (OpenAI open model)
- Qwen 32B (reasoning)
- DeepSeek R1 Distill 32B (chain-of-thought)

### External APIs (PRO+ only)
- **OpenAI:** gpt-4o, gpt-4o-mini
- **Anthropic:** claude-3-5-sonnet, claude-3-5-haiku
- **Google:** gemini-2.0-flash, gemini-1.5-pro

### Security Architecture
- **Encryption:** AES-GCM (256-bit) via Web Crypto API
- **Key Derivation:** SHA-256(JWT_SECRET + user_id) - unique per user
- **Storage Format:** `base64(iv):base64(encrypted_data)`
- **Access Control:** PRO/PREMIUM/ADMIN tiers only
- **Audit:** Never log keys, never expose in errors

### Database Schema Changes (Migration 0008)
```sql
ALTER TABLE users ADD COLUMN openai_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN anthropic_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN google_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN preferred_model TEXT DEFAULT '@cf/meta/llama-3.1-8b-instruct';
ALTER TABLE users ADD COLUMN preferred_length TEXT DEFAULT 'same'
  CHECK(preferred_length IN ('shorter', 'same', 'longer', 'much_longer'));
ALTER TABLE users ADD COLUMN api_keys_updated_at INTEGER;
```

### Next Session Start
```bash
# 1. Recall context from ChromaDB
Launch memory-agent and recall "allegorical enhancements model selection API keys"

# 2. Review handoff document
cat /Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_HANDOFF.md

# 3. Check TODO list
cat /Users/tem/humanizer_root/ALLEGORICAL_ENHANCEMENTS_TODO.md

# 4. Begin Phase 1.1: Create migration 0008_api_keys_and_model_preferences.sql
```

---

## 🔧 NPE Next Steps

**COMPLETED** ✅:
- ✅ Split-pane Quantum Reading UI (professional, 70% less space)
- ✅ Light/dark mode with theme toggle + automatic detection
- ✅ Scrollable panes with proper overflow handling
- ✅ Keyboard shortcuts (→, ↓, Enter)
- ✅ Automatic retry logic for transient failures
- ✅ Google Analytics 4 + SEO metadata
- ✅ Equal height panes, responsive design
- ✅ Responsive header layout (mobile-friendly)
- ✅ Context-aware home link (logged in/out states)

**🚧 IN PROGRESS - Allegorical Enhancements**:
1. **Phase 1:** Database Migration & Security (NOT STARTED)
   - Create migration 0008 for API keys and preferences
   - Implement AES-GCM encryption utilities
2. **Phase 2:** Backend API endpoints and model routing (NOT STARTED)
3. **Phase 3:** Frontend dropdowns and API key settings (NOT STARTED)
4. **Phase 4:** LLM provider integrations (NOT STARTED)
5. **Phase 5:** Security & functionality testing (NOT STARTED)
6. **Phase 6:** Production deployment (NOT STARTED)

**See:** `ALLEGORICAL_ENHANCEMENTS_HANDOFF.md` for detailed progress and next steps

**SHORT TERM** (After Allegorical Enhancements):
1. **Quantum Reading Testing**:
   - End-to-end testing with longer narratives (10+ sentences)
   - Mobile device testing (iOS Safari, Android Chrome)
   - Cross-browser testing for highlight colors
2. **Other Transformations**:
   - Test Round-Trip and Maieutic transformations thoroughly
   - Fix any UI issues in other forms
3. **Documentation**:
   - User guide for Quantum Reading
   - API documentation
   - Feature overview videos

**MEDIUM TERM**:
4. Quota enforcement middleware (role-based limits)
5. Monthly usage reset cron job
6. User management UI (promote/demote users)
7. Usage analytics dashboard (leverage GA4 data)
8. Rate limiting (KV namespace ready)
9. Additional POVM packs for Quantum Reading (Tone, Ontology, Pragmatics)

**LONG TERM**:
10. Cloudflare Zero Trust integration (when scaling admins)
11. Multi-tenant architecture
12. API versioning
13. Context-specific POVM generation (LLM-analyzed narrative axes)
14. Export/share functionality for Quantum Reading sessions

---

**End of Guide** | Latest memory: `81d03cad3cb96dff6e0d6c7ed138ba6f0365b38154b195253945947f84f25dd3`
