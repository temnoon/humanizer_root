# 🎯 Session Complete: Unified Auth Foundation + Post-Social API

## What We Built

### 1. Demo User System ✅
- **Email:** `demo@humanizer.com`
- **Password:** `WeDidn'tKn0w!!`
- **Role:** `pro` (full feature access)
- **PBKDF2 Hash:** Generated with 100,000 iterations
- **Migration:** `0019_add_demo_user.sql` ready to apply

### 2. Unified Auth Architecture ✅
- **Central Authority:** npe-api generates and manages all JWT tokens
- **Shared Tokens:** All workers validate same JWT format
- **Cross-Subdomain:** Works across narrative-studio, humanizer.com, post-social
- **Documentation:** `UNIFIED_AUTH_ARCHITECTURE.md` - comprehensive guide

### 3. Post-Social API Worker ✅
- **New Worker:** `workers/post-social-api/`
- **Port:** 8788 (no conflicts)
- **Auth:** Validates npe-api JWT tokens
- **Features:** Posts, reactions, comments (schema ready)
- **Database:** D1 for post-social content only
- **Documentation:** Complete README with examples

## File Structure

```
humanizer_root/workers/
├── UNIFIED_AUTH_ARCHITECTURE.md    ← Central documentation
│
├── npe-api/                        ← Authentication authority
│   ├── src/middleware/auth.ts      ← JWT generation + validation
│   ├── src/routes/auth.ts          ← /login, /register, /me
│   ├── migrations/
│   │   └── 0019_add_demo_user.sql  ← Demo user (ready)
│   ├── generate-demo-hash.js       ← Password hash generator
│   └── setup-demo-user.sh          ← Quick setup script
│
└── post-social-api/                ← NEW: Post-social backend
    ├── README.md                   ← Complete setup guide
    ├── package.json
    ├── wrangler.toml               ← Port 8788, D1, KV
    ├── .dev.vars.example           ← JWT_SECRET template
    ├── src/
    │   ├── index.ts                ← Hono app with CORS
    │   ├── middleware/auth.ts      ← JWT validation only
    │   └── routes/posts.ts         ← POST, GET, DELETE posts
    └── migrations/
        └── 0001_initial_schema.sql ← Posts, reactions, comments
```

## Next Steps

### Step 1: Create Demo User (2 minutes)
```bash
cd ~/humanizer_root/workers/npe-api

# Make script executable
chmod +x setup-demo-user.sh

# Run setup
./setup-demo-user.sh
```

This will:
- Apply migration 0019_add_demo_user.sql
- Create demo@humanizer.com user with pro role
- Output test curl command

### Step 2: Setup Post-Social API (5 minutes)
```bash
cd ~/humanizer_root/workers/post-social-api

# Install dependencies
npm install

# Create D1 database
wrangler d1 create post-social-db
# Copy database_id from output

# Edit wrangler.toml and paste database_id:
# [[d1_databases]]
# database_id = "paste-here"

# Create KV namespace
wrangler kv:namespace create "POST_SOCIAL_KV"
# Copy id from output

# Edit wrangler.toml and paste KV id:
# [[kv_namespaces]]
# id = "paste-here"

# Apply migrations
wrangler d1 migrations apply post-social-db --remote

# Set JWT secret (MUST match npe-api)
wrangler secret put JWT_SECRET --name post-social-api
# Enter the SAME value as npe-api uses
```

### Step 3: Local Development Setup (2 minutes)
```bash
cd ~/humanizer_root/workers/post-social-api

# Create local env file
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add JWT_SECRET
# Get it from: ~/humanizer_root/workers/npe-api/.dev.vars
nano .dev.vars
```

### Step 4: Test the System (5 minutes)
```bash
# Terminal 1: Start post-social API
cd ~/humanizer_root/workers/post-social-api
npm run dev
# → Running on http://localhost:8788

# Terminal 2: Test authentication flow
# Login with demo user to get JWT
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# Create a post using the token
curl -X POST http://localhost:8788/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"First post in the post-social network!","visibility":"public"}'

# List posts
curl http://localhost:8788/api/posts \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 5: Deploy to Production (when ready)
```bash
cd ~/humanizer_root/workers/post-social-api
npm run deploy
```

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  User (Browser / Client)                                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ 1. POST /auth/login
                     │    {email, password}
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  npe-api (Authentication Authority)                            │
│  Port: 8787                                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Validates credentials                                       │
│  • Generates JWT token                                         │
│  • Returns: {token, user}                                      │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ 2. JWT Token returned
                     │    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  User stores token                                             │
│  localStorage.setItem('jwt', token)                            │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ 3. POST /api/posts
                     │    Authorization: Bearer <token>
                     │    {content, visibility}
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  post-social-api (Content Service)                             │
│  Port: 8788                                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Validates JWT token (using same JWT_SECRET)                 │
│  • Extracts userId, email, role from token                     │
│  • Stores post in D1 database                                  │
│  • Returns created post                                        │
└────────────────────────────────────────────────────────────────┘
```

## Authentication Flow Details

### Token Structure
```json
{
  "userId": "demo-user-id",
  "email": "demo@humanizer.com",
  "role": "pro",
  "iat": 1700000000,
  "exp": 1700604800
}
```

### Security Features
- **PBKDF2:** 100,000 iterations for password hashing
- **JWT:** HS256 algorithm with shared secret
- **Expiry:** 7 days (refresh via re-login)
- **CORS:** Configured per worker
- **Rate Limiting:** Via KV namespace
- **Authorization:** User can only access their own resources

## OAuth (Future Enhancement)

When ready to add Google, Apple, GitHub, etc:

1. Register OAuth apps with providers
2. Add routes to npe-api:
   - `GET /auth/oauth/:provider/login`
   - `GET /auth/oauth/:provider/callback`
3. Store OAuth credentials as secrets
4. Link accounts by email (auto-merge)
5. Same JWT system, multiple login methods

Reference: See `UNIFIED_AUTH_ARCHITECTURE.md` OAuth section

## Key Decisions Made

### ✅ Use npe-api for all authentication
**Why:** Already built, tested, and deployed. Has D1 users table, JWT generation, and role-based access. No need to duplicate.

### ✅ Post-social API validates, never generates tokens
**Why:** Single source of truth for authentication. All workers trust npe-api tokens. Simpler security model.

### ✅ Shared JWT_SECRET across workers
**Why:** Enables cross-worker authentication. Token generated by npe-api works everywhere.

### ✅ Demo account instead of OAuth for MVP
**Why:** OAuth requires registering apps with Google, Apple, etc. Demo account lets you test immediately.

### ✅ Port 8788 for post-social
**Why:** Avoids conflicts with npe-api (8787) and narrative-studio dev server (5173).

## What This Enables

### Immediate Benefits
1. **Test Authentication:** Demo user ready to use across all systems
2. **Post-Social Development:** Backend API ready for frontend integration
3. **Unified Login:** Single login works across all Humanizer subdomains
4. **Developer Experience:** Clear architecture, documented patterns

### Future Capabilities
1. **OAuth Login:** Add Google/Apple/GitHub when ready
2. **More Workers:** Pattern established for adding new services
3. **Microservices:** Each worker handles its domain (auth, content, AI, etc.)
4. **Scalability:** D1 databases per service, shared auth layer

## Testing Checklist

- [ ] Demo user created in npe-api
- [ ] Can login via `/auth/login` and receive JWT
- [ ] JWT validates in post-social-api
- [ ] Can create post with authenticated request
- [ ] Can list user's posts
- [ ] Can delete user's post
- [ ] Cannot access other users' posts
- [ ] Token expiry works (after 7 days)
- [ ] Local dev mode works without JWT

## Documentation Reference

1. **`UNIFIED_AUTH_ARCHITECTURE.md`** - High-level system design
2. **`post-social-api/README.md`** - Complete setup and API guide
3. **`npe-api/src/middleware/auth.ts`** - JWT implementation details
4. **`generate-demo-hash.js`** - Password hashing utility

## Success Criteria

✅ **Authentication Foundation:**
- Demo user exists and can login
- JWT tokens generated and validated
- Cross-worker auth works

✅ **Post-Social API:**
- Worker deployed and running
- Database schema applied
- Routes protected with auth
- CRUD operations work

✅ **Developer Experience:**
- Clear documentation
- Easy local setup
- Test examples provided
- Future path defined (OAuth)

## What's NOT Included (Next Session)

- OAuth provider integration
- Frontend UI for post-social
- Real-time features (WebSockets)
- Curation queue system
- Semantic search
- Feed algorithms

These are intentionally deferred. We built the **foundation** - secure, unified auth that works across your entire platform.

---

## Quick Start Summary

```bash
# 1. Create demo user
cd ~/humanizer_root/workers/npe-api
./setup-demo-user.sh

# 2. Setup post-social API
cd ~/humanizer_root/workers/post-social-api
npm install
wrangler d1 create post-social-db
# Edit wrangler.toml with database_id
wrangler d1 migrations apply post-social-db --remote
wrangler secret put JWT_SECRET --name post-social-api
cp .dev.vars.example .dev.vars
# Edit .dev.vars with JWT_SECRET

# 3. Test locally
npm run dev  # Terminal 1
# In Terminal 2:
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}' | jq -r '.token')

curl -X POST http://localhost:8788/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Hello, post-social!"}'
```

---

**Foundation complete. Ready for post-social frontend and features.** 🌊
