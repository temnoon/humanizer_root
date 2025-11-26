# Post-Social Quick Reference Card

## Demo User Credentials
```
Email:    demo@humanizer.com
Password: WeDidn'tKn0w!!
Role:     pro
```

## OAuth Providers (Phase 2)
```
Google:   /auth/oauth/google/login
GitHub:   /auth/oauth/github/login
Discord:  /auth/oauth/discord/login
Facebook: /auth/oauth/facebook/login
Apple:    /auth/oauth/apple/login
```

## Ports
```
npe-api:         localhost:8787  (auth)
post-social-api: localhost:8788  (content)
narrative-studio: localhost:5173 (frontend)
```

## One-Line Commands

### Get JWT Token
```bash
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login -H "Content-Type: application/json" -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}' | jq -r '.token')
```

### Create Post
```bash
curl -X POST http://localhost:8788/api/posts -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"content":"Test post","visibility":"public"}'
```

### List Posts
```bash
curl http://localhost:8788/api/posts -H "Authorization: Bearer $TOKEN" | jq
```

### Check Auth
```bash
curl http://localhost:8787/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

## Start Development

### Terminal 1: npe-api
```bash
cd ~/humanizer_root/workers/npe-api
wrangler dev --port 8787
```

### Terminal 2: post-social-api
```bash
cd ~/humanizer_root/workers/post-social-api
npm run dev
```

### Terminal 3: Frontend (when ready)
```bash
cd ~/humanizer_root/narrative-studio
npm run dev
```

## OAuth Commands

### Check Available Providers
```bash
curl http://localhost:8787/auth/oauth/providers | jq
```

### Login with OAuth (browser)
```bash
open "http://localhost:8787/auth/oauth/github/login"
```

### List Linked Accounts
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/auth/oauth/accounts | jq
```

### Unlink OAuth Provider
```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/auth/oauth/github/unlink
```

## Common Issues

**"Invalid token"**
→ Check JWT_SECRET matches between workers

**"User not found"**
→ Run `./setup-demo-user.sh` in npe-api

**CORS error**
→ Add origin to `src/index.ts` CORS config

**Database error**
→ Run migrations: `npm run migrations:apply`

## Key Files

```
npe-api/
  src/middleware/auth.ts     # JWT generation
  src/routes/auth.ts         # Login endpoint
  setup-demo-user.sh         # Create demo user

post-social-api/
  src/middleware/auth.ts     # JWT validation  
  src/routes/posts.ts        # Posts API
  README.md                  # Full documentation
```

## Architecture

```
Login → npe-api → JWT Token → post-social-api → Content
                                      ↓
                               Validates token
                               Extracts userId
                               Stores/retrieves data
```

---
**Mantra:** One auth system (npe-api), many workers, shared tokens.
