# Post-Social API Worker

Post-social networking backend with **unified authentication** via npe-api.

## Architecture

```
┌─────────────────┐      JWT Token       ┌─────────────────┐
│   npe-api       │  ─────────────────>  │ post-social-api │
│  (Auth Only)    │                       │  (Content)      │
│                 │                       │                 │
│  • Login        │                       │  • Posts        │
│  • Register     │                       │  • Comments     │
│  • JWT Gen      │                       │  • Reactions    │
└─────────────────┘                       └─────────────────┘
```

## Setup

### 1. Install Dependencies
```bash
cd ~/humanizer_root/workers/post-social-api
npm install
```

### 2. Create D1 Database
```bash
# Create database
wrangler d1 create post-social-db

# Copy the database_id from output and update wrangler.toml
# [[d1_databases]]
# database_id = "paste-id-here"

# Apply migrations
wrangler d1 migrations apply post-social-db --remote
```

### 3. Create KV Namespace
```bash
# Create KV namespace
wrangler kv:namespace create "POST_SOCIAL_KV"

# Copy the id from output and update wrangler.toml
# [[kv_namespaces]]
# id = "paste-id-here"
```

### 4. Set JWT Secret
```bash
# CRITICAL: Use the SAME secret as npe-api
# Get the secret from npe-api first:
wrangler secret list --name npe-api

# Then set it here (use exact same value):
wrangler secret put JWT_SECRET --name post-social-api
```

### 5. Local Development
```bash
# Copy environment template
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add JWT_SECRET (same as npe-api)
# nano .dev.vars

# Start local dev server on port 8788
npm run dev
```

## API Endpoints

All endpoints require `Authorization: Bearer <JWT>` header.
Get JWT from npe-api `/auth/login`.

### Posts

**Create Post**
```bash
POST /api/posts
Content-Type: application/json
Authorization: Bearer <token>

{
  "content": "Hello, post-social world!",
  "visibility": "public"  // public | friends | private
}
```

**List My Posts**
```bash
GET /api/posts
Authorization: Bearer <token>
```

**Get Single Post**
```bash
GET /api/posts/:id
Authorization: Bearer <token>
```

**Delete Post**
```bash
DELETE /api/posts/:id
Authorization: Bearer <token>
```

## Authentication Flow

### 1. User logs in via npe-api
```bash
curl -X POST https://npe-api.humanizer.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}'

# Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "demo-user-id",
    "email": "demo@humanizer.com",
    "role": "pro"
  }
}
```

### 2. Use token for post-social API
```bash
TOKEN="eyJhbGc..."

curl -X POST http://localhost:8788/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"My first post!"}'
```

## Database Schema

### posts
```sql
id              TEXT PRIMARY KEY
user_id         TEXT NOT NULL      -- From npe-api JWT
content         TEXT NOT NULL
visibility      TEXT NOT NULL      -- public | friends | private
created_at      INTEGER NOT NULL
updated_at      INTEGER NOT NULL
```

### reactions
```sql
id              TEXT PRIMARY KEY
post_id         TEXT NOT NULL      -- Foreign key to posts
user_id         TEXT NOT NULL      -- From npe-api JWT
type            TEXT NOT NULL      -- like | love | laugh | sad | angry
created_at      INTEGER NOT NULL
```

### comments
```sql
id              TEXT PRIMARY KEY
post_id         TEXT NOT NULL      -- Foreign key to posts
user_id         TEXT NOT NULL      -- From npe-api JWT
content         TEXT NOT NULL
created_at      INTEGER NOT NULL
updated_at      INTEGER NOT NULL
```

## Development

### Local Testing
```bash
# Terminal 1: Start post-social-api
cd ~/humanizer_root/workers/post-social-api
npm run dev

# Terminal 2: Test with demo user
# First, get token from npe-api
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@humanizer.com","password":"WeDidn'\''tKn0w!!"}' \
  | jq -r '.token')

# Create a post
curl -X POST http://localhost:8788/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Testing post-social API!"}'

# List posts
curl http://localhost:8788/api/posts \
  -H "Authorization: Bearer $TOKEN"
```

### Deploy to Production
```bash
npm run deploy
```

## Security Notes

- **JWT Secret**: MUST match npe-api exactly
- **Token Validation**: post-social-api validates but never generates tokens
- **User Data**: email, role, etc. comes from JWT payload
- **Authorization**: All routes check user_id from token matches resource owner

## Adding New Routes

Example: Add a reaction endpoint

```typescript
// src/routes/reactions.ts
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';

const reactionsRoutes = new Hono();

reactionsRoutes.post('/:postId', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const postId = c.req.param('postId');
  const { type } = await c.req.json();
  
  const reactionId = crypto.randomUUID();
  
  await c.env.DB.prepare(
    `INSERT INTO reactions (id, post_id, user_id, type, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(reactionId, postId, auth.userId, type, Date.now()).run();
  
  return c.json({ id: reactionId, type });
});

export default reactionsRoutes;
```

```typescript
// src/index.ts
import reactionsRoutes from './routes/reactions';

app.route('/api/reactions', reactionsRoutes);
```

## Troubleshooting

### "Invalid token" errors
- Check JWT_SECRET matches npe-api exactly
- Token may be expired (7 day limit)
- Format must be `Authorization: Bearer <token>`

### Database errors
- Run migrations: `npm run migrations:apply`
- Check database_id in wrangler.toml
- Verify D1 database exists: `wrangler d1 list`

### CORS errors
- Update origin list in src/index.ts
- Check Authorization header is allowed

---

**Key Point:** This worker **validates** JWT tokens from npe-api but **never generates** them. All authentication goes through npe-api.
