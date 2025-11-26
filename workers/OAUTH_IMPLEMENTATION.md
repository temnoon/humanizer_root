# OAuth Implementation - Phase 2 Complete

## Overview

Added social login support to npe-api with 5 OAuth providers. Users can now sign up and log in using Google, GitHub, Discord, Facebook, or Apple accounts. All providers share the unified JWT authentication system.

## Files Created/Modified

### New Files

```
npe-api/
├── migrations/
│   └── 0020_oauth_accounts.sql       # OAuth tables
├── src/
│   ├── config/
│   │   └── oauth-providers.ts        # Provider configurations
│   ├── services/
│   │   └── oauth.ts                  # OAuth business logic
│   └── routes/
│       └── oauth.ts                  # OAuth endpoints
```

### Modified Files

```
npe-api/
├── src/index.ts                      # Added OAuth routes
├── .dev.vars                         # OAuth credential placeholders
shared/
└── types.ts                          # OAuth types + Env vars
```

## Database Schema

```sql
-- OAuth accounts table
CREATE TABLE oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,  -- google, github, discord, facebook, apple
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_username TEXT,
    provider_avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(provider, provider_user_id)
);

-- OAuth state for CSRF protection
CREATE TABLE oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    redirect_uri TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Users table addition
ALTER TABLE users ADD COLUMN auth_method TEXT DEFAULT 'password';
-- Values: password, oauth, webauthn, mixed
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/oauth/providers` | List available providers |
| GET | `/auth/oauth/:provider/login` | Initiate OAuth flow |
| GET | `/auth/oauth/:provider/callback` | OAuth callback (GET) |
| POST | `/auth/oauth/:provider/callback` | OAuth callback (POST, Apple) |

### Protected Endpoints (Require JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/oauth/:provider/link` | Link OAuth to existing account |
| GET | `/auth/oauth/accounts` | List linked OAuth accounts |
| DELETE | `/auth/oauth/:provider/unlink` | Unlink OAuth account |

## OAuth Flow

### Sign Up / Login Flow

```
1. User clicks "Login with Google"
      ↓
2. GET /auth/oauth/google/login
      ↓
3. Redirect to Google authorization page
      ↓
4. User authorizes, Google redirects back
      ↓
5. GET /auth/oauth/google/callback?code=xxx&state=xxx
      ↓
6. Exchange code for tokens
      ↓
7. Fetch user info from Google
      ↓
8. Create user (or login existing) → Return JWT
```

### Account Linking Flow

```
1. Authenticated user wants to add GitHub
      ↓
2. POST /auth/oauth/github/link (with JWT)
      ↓
3. Returns { authUrl: "https://github.com/..." }
      ↓
4. User navigates to authUrl, authorizes
      ↓
5. GitHub redirects to callback
      ↓
6. Link GitHub to existing user account
```

## Configuration

### Provider Setup

#### Google
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `https://npe-api.humanizer.com/auth/oauth/google/callback`
4. Copy Client ID and Secret

#### GitHub
1. Go to https://github.com/settings/developers
2. Create new OAuth App
3. Authorization callback URL: `https://npe-api.humanizer.com/auth/oauth/github/callback`
4. Copy Client ID and Secret

#### Discord
1. Go to https://discord.com/developers/applications
2. Create Application → OAuth2 → Add Redirect
3. Redirect: `https://npe-api.humanizer.com/auth/oauth/discord/callback`
4. Copy Client ID and Secret

#### Facebook
1. Go to https://developers.facebook.com/apps
2. Create App → Facebook Login
3. Valid OAuth Redirect URIs: `https://npe-api.humanizer.com/auth/oauth/facebook/callback`
4. Copy App ID and Secret

#### Apple
1. Go to https://developer.apple.com/account/resources/identifiers
2. Create App ID and Services ID
3. Configure Sign In with Apple
4. Return URL: `https://npe-api.humanizer.com/auth/oauth/apple/callback`
5. Generate Client Secret (JWT signed with your key)

### Setting Secrets

```bash
# Local development - add to .dev.vars
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Production - use wrangler secrets
wrangler secret put GOOGLE_CLIENT_ID --name npe-api
wrangler secret put GOOGLE_CLIENT_SECRET --name npe-api
```

## Usage Examples

### List Available Providers

```bash
curl https://npe-api.humanizer.com/auth/oauth/providers
```

Response:
```json
{
  "providers": [
    { "provider": "google", "name": "Google", "available": true },
    { "provider": "github", "name": "GitHub", "available": true },
    { "provider": "discord", "name": "Discord", "available": false },
    { "provider": "facebook", "name": "Facebook", "available": false },
    { "provider": "apple", "name": "Apple", "available": false }
  ]
}
```

### Initiate Login

```bash
# Browser redirect
open "https://npe-api.humanizer.com/auth/oauth/google/login"

# With custom redirect after auth
open "https://npe-api.humanizer.com/auth/oauth/google/login?redirect=https://humanizer.com/dashboard"
```

### Get Linked Accounts

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://npe-api.humanizer.com/auth/oauth/accounts
```

Response:
```json
{
  "accounts": [
    {
      "provider": "google",
      "providerEmail": "user@gmail.com",
      "providerUsername": "User Name",
      "linkedAt": 1700000000000
    }
  ]
}
```

### Unlink Account

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://npe-api.humanizer.com/auth/oauth/google/unlink
```

## Security Features

1. **CSRF Protection**: State parameter with 10-minute expiry
2. **One-time Use**: State tokens deleted after use
3. **Secure Token Storage**: OAuth tokens encrypted at rest
4. **No Password Required**: OAuth-only users have `password_hash = 'OAUTH_ONLY'`
5. **Unlink Protection**: Cannot unlink last auth method

## Integration with Existing Auth

- **Password + OAuth**: Users can have both (auth_method = 'mixed')
- **OAuth Only**: New users via OAuth have no password
- **Add Password Later**: Users can add password to OAuth account
- **Same JWT**: OAuth login produces same JWT as password login

## Post-Social Integration

post-social-api automatically works with OAuth logins:
- Same JWT tokens work across all workers
- User ID consistent regardless of auth method
- No changes needed to post-social-api

## Next Steps

### Immediate (To Test)
1. Apply migration: `wrangler d1 migrations apply npe-production-db --remote`
2. Configure at least one provider (recommend GitHub - easiest)
3. Test login flow

### Future Enhancements
- Token refresh for long-lived sessions
- Provider-specific profile sync
- Social graph features (find friends)
- Account recovery via OAuth

## Troubleshooting

### "OAuth provider X is not configured"
→ Add CLIENT_ID and CLIENT_SECRET for that provider

### "Invalid or expired state"
→ State tokens expire after 10 minutes, try again

### "Email not provided"
→ User denied email permission, prompt to retry with email scope

### "Cannot unlink the only authentication method"
→ Add password or link another provider first

---

**Status**: Phase 2 OAuth Implementation ✅ Complete  
**Next**: Phase 3 Curation Queue (Llama Guard → Llama-3 → Embeddings)
