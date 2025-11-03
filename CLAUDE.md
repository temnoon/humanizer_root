# Humanizer - Development Guide

**Last Updated**: Nov 3, 2025 - WebAuthn Fixed! ✅
**Status**: ✅ **READY FOR USER TESTING** | Device registration endpoint working
**Latest**: Node 22, Wrangler 4, React 19, @simplewebauthn 13.2.2
**Admin Account**: dreegle@gmail.com (personal account)
**Test Account**: demo@humanizer.com (password: testpass123, role: free)
**Admin URL**: https://7409c5d6.npe-cloud.pages.dev (use this for admin access)

**Security Status**: ✅ **PRODUCTION-READY CRITERIA MET**
- ✅ All dependencies current with no known vulnerabilities
- ✅ Node.js 22.21.1 (LTS until April 2027)
- ✅ `npm audit`: 0 vulnerabilities in both projects
- ✅ esbuild security vulnerability (GHSA-67mh-4wv8-2f99) FIXED

**Memory IDs**:
- WebAuthn fixed: `b9c3221f4fefbfee8e13e9299c5cf86e0ac66eeb1013a928fb3a2ee68ea6d8c9` (Nov 3, 2025)
- Previous sessions: Full upgrade `2433240c63c78f8f3d7ab0dceda3579093b1e159b14cea8552956ae0831f462e`

**✅ WEBAUTHN FIX COMPLETED**:
- **Issue**: SimpleWebAuthn v13 breaking change - userID must be Uint8Array (not string)
- **Solution**: Added stringToUint8Array() helper using TextEncoder
- **Status**: Fixed and deployed (Version: 9f064dc3-7630-474e-8a44-221a95f71883)
- **Next**: User should test device registration at admin dashboard
- **Commit**: 665052b "fix: Convert userID to Uint8Array for SimpleWebAuthn v13 compatibility"

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
- 🚧 Phase 6: WebAuthn Touch ID auth (DEBUGGING - 500 error on device registration)
- ✅ Deployment (Cloudflare Workers + Pages, custom domains)

**NPE Transformations**:
1. **Allegorical**: 5-stage pipeline (Deconstruct → Map → Reconstruct → Stylize → Reflect)
2. **Round-Trip**: 18 languages, semantic drift analysis
3. **Maieutic**: Socratic questioning, 5 depth levels (0-4)

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

## 🎯 NEW FEATURES (Nov 3 Session)

### ✅ Mailing List System
- **Frontend**: Modal with name/email/interest form
- **Backend**: POST /mailing-list/signup (public), GET /export, GET /export/csv (admin only)
- **Database**: `mailing_list` table (migration 0003)
- **Status**: WORKING - 1 test signup, exports functional

### ✅ Admin Dashboard
- **Access**: https://7409c5d6.npe-cloud.pages.dev → Login → ⚙️ Admin button
- **Tabs**: "Mailing List" (view/export) | "Devices" (register/revoke)
- **Components**: AdminDashboard.tsx, MailingListViewer.tsx, DeviceManager.tsx
- **Status**: WORKING except device registration

### 🚧 WebAuthn Touch ID Authentication
- **Purpose**: Passwordless admin login using MacBook Touch ID
- **Database**: `webauthn_credentials` table (migration 0006)
- **Libraries**: @simplewebauthn/server 13.2.2, @simplewebauthn/browser 13.0.0
- **Status**: DEBUGGING - Registration endpoint returns 500 error
- **Fixed**: Buffer API replaced with atob/btoa (Workers-compatible)
- **Next**: Get detailed error from /webauthn/register-challenge response

---

## 🔧 NPE Next Steps

**IMMEDIATE** (Blocking - Resume Next Session):
1. 🚧 Fix WebAuthn device registration 500 error
2. Test Touch ID login end-to-end
3. Document WebAuthn flow in user guide

**SHORT TERM**:
4. Test Round-Trip and Maieutic transformations
5. Fix admin button not showing on main humanizer.com domain
6. Add rate limiting (KV namespace ready)

**LONG TERM**:
7. Quota enforcement middleware (role-based limits)
8. Monthly usage reset cron job
9. User management UI (promote/demote users)
10. Cloudflare Zero Trust (when scaling admins)

---

**End of Guide** | Latest memory: `9f4d61c87a48d1a53acacacbb26129d950581886df2d5bafea61fe7d29baa340`
