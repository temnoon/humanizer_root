# Humanizer - Development Guide

**Last Updated**: Nov 3, 2025 - FULLY UPGRADED & SECURE ✅
**Status**: 🔒 **TESTING MODE** | All dependencies current, 0 vulnerabilities
**Latest**: Node 22, Wrangler 4, React 19, jose 6 - Full security upgrade complete
**Test Account**: demo@humanizer.com (password: testpass123)

**Security Status**: ✅ **PRODUCTION-READY CRITERIA MET**
- ✅ All dependencies current with no known vulnerabilities
- ✅ Node.js 22.21.1 (LTS until April 2027)
- ✅ `npm audit`: 0 vulnerabilities in both projects
- ✅ esbuild security vulnerability (GHSA-67mh-4wv8-2f99) FIXED

**Memory IDs**:
- Deployment success: `e9962eb11b1ec01abbf55439ccdf311e17f3c2e129572000e85222a3d43d2ac3`
- Registration disabled: `5626607ca0777ee19790a8163163f128669efbd62ba76339af4895aa97c3a462`
- Full upgrade complete: `2433240c63c78f8f3d7ab0dceda3579093b1e159b14cea8552956ae0831f462e`

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
- ✅ Deployment (Cloudflare Workers + Pages, custom domains)
- ✅ Testing (registration, login, allegorical transformation verified)

**NPE Transformations**:
1. **Allegorical**: 5-stage pipeline (Deconstruct → Map → Reconstruct → Stylize → Reflect)
2. **Round-Trip**: 18 languages, semantic drift analysis
3. **Maieutic**: Socratic questioning, 5 depth levels (0-4)

**Config**: 5 personas × 6 namespaces × 5 styles = 150 allegorical combinations

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
│       ├── components/onboarding/       # LandingTutorial
│       ├── components/help/             # HelpPanel
│       └── lib/cloud-api-client.ts      # API client
├── workers/npe-api/        # NPE Workers API (deployed to api.humanizer.com)
│   ├── src/
│   │   ├── routes/         # auth, transformations, config
│   │   ├── services/       # allegorical, round_trip, maieutic
│   │   └── middleware/     # auth (⚠️ JWT fix here)
│   └── migrations/         # D1 schema + seed data
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

**NPE Deployment**:
- `NPE_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `NPE_DEPLOYMENT_FIXES.md` - Package vulnerability fixes
- `NPE_CLOUD_INTEGRATION_SESSION2_HANDOFF.md` - Phase 2 handoff

**Local App**:
- `UNIFIED_CONVERSATIONS_PHASE1_HANDOFF.md` - Conversation unification
- `CLAUDE_ARCHIVE_IMPORT_HANDOFF.md` - Archive import
- `FRONTEND_TESTING_GUIDE.md` - Frontend testing

---

## 🔧 NPE Next Steps

1. ✅ ~~Deploy JWT fix~~ (COMPLETED)
2. ✅ ~~Test registration end-to-end~~ (COMPLETED)
3. ✅ ~~Test allegorical transformation~~ (COMPLETED)
4. Test Round-Trip and Maieutic transformations
5. Add rate limiting (KV namespace ready)
6. Monitor with Cloudflare Analytics
7. Phase 4: Local privacy enhancements (warnings, encryption, audit)
8. User testing and feedback collection

---

**End of Guide** | Full context in memory ID `15e0f687c3e904eee81644763dc046ad19a92764234f01cea5ef488edfcf9f05`
