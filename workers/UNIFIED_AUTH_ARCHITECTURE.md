# Unified Auth Architecture

## Overview

All Humanizer subdomains share a single authentication system via the `npe-api` worker:
- **narrative-studio.humanizer.com** - Narrative transformation workbench
- **humanizer.com** - Main application  
- **post-social.humanizer.com** - Post-social networking (planned)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  npe-api Worker (Authentication Authority)          │
│  • JWT token generation/verification                │
│  • User database (D1)                               │
│  • Email/password login                             │
│  • OAuth providers (future)                         │
└─────────────────────────────────────────────────────┘
                          │
                          │ JWT Tokens
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  narrative-  │  │  humanizer   │  │ post-social  │
│  studio      │  │  main app    │  │  worker      │
│  (frontend)  │  │  (frontend)  │  │  (backend)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Authentication Flow

### 1. User Login
```
Frontend → POST /auth/login (npe-api)
         → Receives JWT token
         → Stores in localStorage/cookie
```

### 2. API Request with Auth
```
Frontend → POST /api/posts (post-social-api)
         → Includes: Authorization: Bearer <JWT>
         
post-social-api:
  → Validates JWT using shared secret
  → Extracts user info (userId, email, role)
  → Processes request
```

### 3. Token Structure
```json
{
  "userId": "demo-user-id",
  "email": "demo@humanizer.com",
  "role": "pro",
  "iat": 1700000000,
  "exp": 1700604800
}
```

## Setup: Demo User

### Method 1: Run Script (Recommended)
```bash
cd /Users/tem/humanizer_root/workers/npe-api
node generate-demo-hash.js
```

This will output SQL that you can run directly via wrangler:
```bash
wrangler d1 execute npe-production-db --remote --command="INSERT INTO users ..."
```

### Method 2: Use Registration API
```bash
curl -X POST https://npe-api.humanizer.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@humanizer.com",
    "password": "WeDidn'\''tKn0w!!"
  }'
```

Note: Registration is disabled in production. Use local dev or Method 1.

### Method 3: Manual Migration
```bash
cd /Users/tem/humanizer_root/workers/npe-api
# Generate hash first
node generate-demo-hash.js > hash.txt
# Edit migrations/0019_add_demo_user.sql with the hash
wrangler d1 migrations apply npe-production-db --remote
```

## Demo Credentials

```
Email: demo@humanizer.com
Password: WeDidn'tKn0w!!
Role: pro (full feature access)
```

## User Roles

- `free` - Basic access, monthly quotas
- `member` - Standard features
- `pro` - Full features, higher quotas
- `premium` - All features, unlimited
- `admin` - System administration

## JWT Secret Management

### Production
```bash
# Set via wrangler
wrangler secret put JWT_SECRET --name npe-api
```

### Local Development
```bash
# Add to workers/npe-api/.dev.vars
JWT_SECRET=your-development-secret-key-here
```

### Important: Same secret across workers
All workers that validate JWT tokens must use the **same JWT_SECRET**:
- npe-api (generates tokens)
- post-social-api (validates tokens)
- Any future workers

## Creating New Workers with Auth

### 1. Install Dependencies
```json
{
  "dependencies": {
    "hono": "^4.x",
    "jose": "^5.x"
  }
}
```

### 2. JWT Validation Function
```typescript
import * as jose from 'jose';

export async function verifyToken(token: string, secret: string) {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}
```

### 3. Auth Middleware
```typescript
export function requireAuth() {
  return async (c: Context, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing authorization' }, 401);
    }
    
    const token = authHeader.substring(7);
    const auth = await verifyToken(token, c.env.JWT_SECRET);
    
    if (!auth) {
      return c.json({ error: 'Invalid token' }, 401);
    }
    
    c.set('auth', auth);
    await next();
  };
}
```

### 4. Protected Route
```typescript
app.post('/api/posts', requireAuth(), async (c) => {
  const auth = c.get('auth');
  // auth.userId, auth.email, auth.role available
  
  // Your logic here
});
```

## OAuth (Future)

When ready to add OAuth providers:

### 1. Register Apps
- Google Cloud Console
- GitHub OAuth Apps  
- Apple Developer
- Facebook Developers
- Discord Developer Portal

### 2. Add Routes to npe-api
```
GET  /auth/oauth/:provider/login
GET  /auth/oauth/:provider/callback
POST /auth/oauth/:provider/link
```

### 3. Store Provider Credentials
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
# ... etc for each provider
```

### 4. Account Linking
Users can link multiple OAuth providers to one account. All share same JWT/userId.

## Security Notes

- JWT tokens expire after 7 days
- Passwords use PBKDF2 with 100,000 iterations
- Tokens in Authorization header (not cookies for API)
- Frontend stores tokens in localStorage
- CORS configured per worker
- Rate limiting via KV namespace

## Testing

### Local Dev Mode
npe-api has optional local auth that skips JWT validation:
```typescript
// In .dev.vars
ENVIRONMENT=development

// Automatically uses test user:
{
  userId: 'test-user-local',
  email: 'local@test.com',
  role: 'pro'
}
```

### Production Testing
Use demo account with real JWT:
```bash
# 1. Login
TOKEN=$(curl -s -X POST https://npe-api.humanizer.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}' \
  | jq -r '.token')

# 2. Test protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://npe-api.humanizer.com/auth/me
```

## Troubleshooting

### "Invalid token" errors
- Check JWT_SECRET is same across workers
- Token may be expired (7 day limit)
- Token format must be `Bearer <token>`

### "User not found" errors  
- Demo user not created yet
- Run generate-demo-hash.js
- Check D1 database

### CORS errors
- Add origin to worker CORS config
- Check Authorization header allowed

## Files Reference

```
humanizer_root/workers/
├── npe-api/
│   ├── src/
│   │   ├── middleware/auth.ts         # JWT & auth logic
│   │   └── routes/auth.ts             # Login/register endpoints
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql    # Users table
│   │   ├── 0004_add_user_roles_and_quotas.sql
│   │   └── 0019_add_demo_user.sql     # Demo user (generated)
│   ├── generate-demo-hash.js          # Password hash generator
│   ├── wrangler.toml                  # D1, KV, R2 bindings
│   └── .dev.vars                      # JWT_SECRET for local dev
│
└── post-social-api/                   # (to be created)
    ├── src/
    │   ├── middleware/auth.ts         # JWT validator (no generation)
    │   └── routes/posts.ts            # Post-social routes
    └── wrangler.toml                  # Uses same JWT_SECRET
```

---

**Summary:** One authentication system (npe-api), many workers, shared JWT secret. Simple, secure, unified.
