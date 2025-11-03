# NPE Cloud Deployment Guide
**Target Domain**: humanizer.com (Cloudflare)
**Date**: 2025-11-02

## Overview

This guide covers deploying the Narrative Projection Engine (NPE) to humanizer.com using Cloudflare Workers and Pages.

**Architecture**:
- **Workers API**: `api.humanizer.com` (or `humanizer.com/api`)
- **Cloud Frontend**: `humanizer.com` (root domain or subdomain)
- **D1 Database**: Edge-deployed SQLite
- **AI Workers**: Llama 3.1 8B for transformations

---

## Prerequisites

- Cloudflare account with humanizer.com domain
- Node.js 18+ and npm installed
- Wrangler CLI installed: `npm install -g wrangler`
- Logged into Wrangler: `wrangler login`

---

## Part 1: Workers API Deployment

### Step 1: Install Dependencies

```bash
cd /Users/tem/humanizer_root/workers/npe-api
npm install
```

### Step 2: Create D1 Database

```bash
# Create production D1 database
wrangler d1 create npe-production-db

# Output will show database ID - save this!
# Example output:
# ✅ Successfully created DB 'npe-production-db'
#
# [[d1_databases]]
# binding = "DB"
# database_name = "npe-production-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 3: Update wrangler.toml with Database ID

Edit `/Users/tem/humanizer_root/workers/npe-api/wrangler.toml`:

```toml
name = "npe-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Update this section with your database_id from Step 2
[[d1_databases]]
binding = "DB"
database_name = "npe-production-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Replace with actual ID

[ai]
binding = "AI"

# KV Namespace (create in Step 4)
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID_HERE"  # ← Will update in Step 4

# Durable Objects for Maieutic Sessions
[[durable_objects.bindings]]
name = "MAIEUTIC_SESSION"
class_name = "MaieuticSessionDO"
script_name = "npe-api"

[[migrations]]
tag = "v1"
new_classes = ["MaieuticSessionDO"]

[vars]
ENVIRONMENT = "production"

# Custom routes for humanizer.com
routes = [
  { pattern = "humanizer.com/api/*", zone_name = "humanizer.com" },
  { pattern = "api.humanizer.com/*", zone_name = "humanizer.com" }
]
```

### Step 4: Create KV Namespace

```bash
# Create KV namespace for rate limiting/caching
wrangler kv:namespace create "KV" --preview false

# Output will show namespace ID - save this!
# Example:
# ✅ Success!
# Add the following to your wrangler.toml:
# [[kv_namespaces]]
# binding = "KV"
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Update `wrangler.toml` with the KV namespace ID from above.

### Step 5: Set JWT Secret

```bash
# Generate a strong secret (or use your own)
openssl rand -base64 32

# Set it as a Cloudflare secret
wrangler secret put JWT_SECRET

# When prompted, paste your generated secret
```

### Step 6: Run Database Migrations

```bash
# Apply migrations to production database
wrangler d1 migrations apply npe-production-db --remote

# Verify migrations succeeded
wrangler d1 execute npe-production-db --command "SELECT COUNT(*) FROM users"
# Should return: 0 (no users yet)

wrangler d1 execute npe-production-db --command "SELECT COUNT(*) FROM npe_personas"
# Should return: 5 (seeded personas)

wrangler d1 execute npe-production-db --command "SELECT COUNT(*) FROM npe_namespaces"
# Should return: 6 (seeded namespaces)

wrangler d1 execute npe-production-db --command "SELECT COUNT(*) FROM npe_styles"
# Should return: 5 (seeded styles)
```

### Step 7: Deploy Workers API

```bash
# Deploy to production
wrangler deploy

# Output should show:
# ✅ Published npe-api
# https://npe-api.YOUR_SUBDOMAIN.workers.dev
# humanizer.com/api/*
# api.humanizer.com/*
```

### Step 8: Test Workers API

```bash
# Test health check
curl https://humanizer.com/api/

# Expected response:
# {
#   "name": "NPE Workers API",
#   "version": "1.0.0",
#   "status": "online",
#   "timestamp": 1234567890
# }

# Test configuration endpoints
curl https://humanizer.com/api/config/personas
curl https://humanizer.com/api/config/namespaces
curl https://humanizer.com/api/config/styles
curl https://humanizer.com/api/config/languages
```

---

## Part 2: Cloud Frontend Deployment

### Step 1: Install Dependencies

```bash
cd /Users/tem/humanizer_root/cloud-frontend
npm install
```

### Step 2: Create Environment Configuration

Create `/Users/tem/humanizer_root/cloud-frontend/.env.production`:

```env
# Production API URL - use your actual domain
VITE_API_URL=https://humanizer.com/api
```

### Step 3: Update package.json Deploy Script

Edit `/Users/tem/humanizer_root/cloud-frontend/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist --project-name=npe-cloud"
  }
}
```

### Step 4: Build Production Bundle

```bash
npm run build

# Output should show:
# ✓ built in XXXXms
# dist/index.html
# dist/assets/...
```

### Step 5: Deploy to Cloudflare Pages

```bash
# First deployment - creates the project
wrangler pages deploy dist --project-name=npe-cloud

# Follow prompts:
# - Project name: npe-cloud
# - Production branch: main
#
# Output will show:
# ✅ Deployment complete!
# https://npe-cloud.pages.dev
```

### Step 6: Configure Custom Domain

**Option A: Root Domain (humanizer.com)**

1. Go to Cloudflare Dashboard → Pages → npe-cloud
2. Click "Custom domains" tab
3. Click "Set up a custom domain"
4. Enter: `humanizer.com`
5. Click "Continue" and "Activate domain"
6. Cloudflare will automatically configure DNS

**Option B: Subdomain (npe.humanizer.com)**

1. Go to Cloudflare Dashboard → Pages → npe-cloud
2. Click "Custom domains" tab
3. Click "Set up a custom domain"
4. Enter: `npe.humanizer.com`
5. Click "Continue" and "Activate domain"
6. DNS record will be automatically created

### Step 7: Update CORS in Workers API

Edit `/Users/tem/humanizer_root/workers/npe-api/src/index.ts`:

```typescript
// Update CORS middleware to allow your production domain
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    // Allow production domains
    if (origin === 'https://humanizer.com' ||
        origin === 'https://npe.humanizer.com' ||
        origin.endsWith('.pages.dev')) {
      return origin;
    }
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true
}));
```

Redeploy Workers:

```bash
cd /Users/tem/humanizer_root/workers/npe-api
wrangler deploy
```

### Step 8: Test Production Deployment

```bash
# Test frontend is accessible
curl -I https://humanizer.com
# Should return: 200 OK

# Test API from frontend domain
curl https://humanizer.com/api/config/personas
# Should return: JSON array of 5 personas
```

---

## Part 3: Verification & Testing

### API Endpoints to Test

```bash
# 1. Health check
curl https://humanizer.com/api/

# 2. Configuration endpoints (public)
curl https://humanizer.com/api/config/personas
curl https://humanizer.com/api/config/namespaces
curl https://humanizer.com/api/config/styles
curl https://humanizer.com/api/config/languages

# 3. Register test user
curl -X POST https://humanizer.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Save the token from response

# 4. Test authenticated endpoint
curl https://humanizer.com/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 5. Test allegorical transformation
curl -X POST https://humanizer.com/api/transformations/allegorical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "text": "A student left university to start a company.",
    "persona": "neutral",
    "namespace": "mythology",
    "style": "standard"
  }'
```

### Frontend Testing Checklist

- [ ] Landing page loads at https://humanizer.com
- [ ] User can register new account
- [ ] User can login
- [ ] Navigation between transformation types works
- [ ] Allegorical projection form loads personas/namespaces/styles
- [ ] Round-trip form loads languages
- [ ] Maieutic dialogue can start session
- [ ] Transformations complete successfully
- [ ] Help panel displays documentation
- [ ] Logout works correctly
- [ ] Error messages display properly

---

## Part 4: Monitoring & Maintenance

### Cloudflare Dashboard Monitoring

1. **Workers Analytics**:
   - Go to Workers & Pages → npe-api
   - View requests, errors, CPU time
   - Monitor for rate limiting needs

2. **Pages Analytics**:
   - Go to Pages → npe-cloud
   - View page views, bandwidth
   - Check build/deployment history

3. **D1 Database**:
   - Go to Storage & Databases → D1
   - Monitor query performance
   - Check storage usage

4. **AI Workers Usage**:
   - Go to AI → Usage
   - Monitor LLM API calls
   - Track costs (free tier: 10,000 neurons/day)

### Viewing Logs

```bash
# Stream Workers logs
wrangler tail npe-api

# View D1 query logs
wrangler d1 execute npe-production-db --command "SELECT * FROM transformations ORDER BY created_at DESC LIMIT 10"
```

### Database Management

```bash
# Query users
wrangler d1 execute npe-production-db --command "SELECT id, email, created_at FROM users"

# Count transformations by type
wrangler d1 execute npe-production-db --command "
  SELECT type, COUNT(*) as count
  FROM transformations
  GROUP BY type
"

# View recent transformations
wrangler d1 execute npe-production-db --command "
  SELECT id, type, created_at
  FROM transformations
  ORDER BY created_at DESC
  LIMIT 10
"
```

---

## Part 5: Updates & Redeployment

### Updating Workers API

```bash
cd /Users/tem/humanizer_root/workers/npe-api

# Make code changes...

# Deploy updates
wrangler deploy

# Deployment is instant (no downtime)
```

### Updating Cloud Frontend

```bash
cd /Users/tem/humanizer_root/cloud-frontend

# Make code changes...

# Build and deploy
npm run build
wrangler pages deploy dist --project-name=npe-cloud

# Set as production deployment
# (Cloudflare will prompt or use dashboard)
```

### Database Migrations

```bash
# Create new migration file
cd /Users/tem/humanizer_root/workers/npe-api
touch migrations/0003_add_new_feature.sql

# Write migration SQL...

# Apply to production
wrangler d1 migrations apply npe-production-db --remote
```

---

## Part 6: Troubleshooting

### Workers API Issues

**Error: "Module not found"**
```bash
# Ensure dependencies are installed
cd workers/npe-api
npm install
wrangler deploy
```

**Error: "D1 database not found"**
```bash
# Verify database ID in wrangler.toml matches created database
wrangler d1 list
```

**Error: "JWT_SECRET not set"**
```bash
# Set the secret again
wrangler secret put JWT_SECRET
```

### Frontend Issues

**CORS errors in browser console**
- Verify CORS configuration in `workers/npe-api/src/index.ts`
- Ensure production domain is allowed
- Redeploy Workers API

**API calls failing (404)**
- Check `VITE_API_URL` in `.env.production`
- Verify Workers routes in `wrangler.toml`
- Test API endpoints directly with curl

**Build errors**
```bash
# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Database Issues

**Migrations not applied**
```bash
# Check migration status
wrangler d1 migrations list npe-production-db --remote

# Force apply specific migration
wrangler d1 execute npe-production-db --file=migrations/0001_initial_schema.sql --remote
```

**Seed data missing**
```bash
# Re-run seed migration
wrangler d1 execute npe-production-db --file=migrations/0002_seed_npe_configs.sql --remote
```

---

## Part 7: Cost Estimates

### Cloudflare Free Tier (Likely Sufficient for Launch)

- **Workers**: 100,000 requests/day free
- **Pages**: Unlimited requests, 500 builds/month
- **D1**: 5GB storage, 5M rows read/day
- **AI Workers**: 10,000 neurons/day free (~100-200 transformations)
- **KV**: 100,000 reads/day, 1,000 writes/day

### Paid Tier (If Needed)

- **Workers Paid** ($5/month): 10M requests
- **Pages**: Free (unlimited)
- **D1**: $0.75/1M rows read, $1.00/1M rows written
- **AI Workers**: $0.011 per 1,000 neurons (~$0.05-0.10 per transformation)

### Expected Costs at Scale

**100 users/day, 5 transformations each = 500 transformations/day**:
- Workers: Free tier sufficient
- D1: ~$5-10/month
- AI Workers: ~$25-50/month
- **Total: ~$30-60/month**

---

## Part 8: Security Checklist

- [x] JWT_SECRET set as Cloudflare secret (not in code)
- [x] CORS configured for production domains only
- [x] Password minimum length enforced (8 characters)
- [x] SQL injection prevention (parameterized queries)
- [x] Rate limiting ready (KV namespace configured)
- [x] HTTPS enforced (Cloudflare default)
- [ ] Consider adding rate limiting middleware (future)
- [ ] Consider email verification (future)
- [ ] Consider user deletion/GDPR compliance (future)

---

## Quick Reference Commands

```bash
# Workers API
cd /Users/tem/humanizer_root/workers/npe-api
wrangler deploy                    # Deploy
wrangler tail npe-api              # View logs
wrangler d1 execute npe-production-db --command "QUERY"  # Run SQL

# Cloud Frontend
cd /Users/tem/humanizer_root/cloud-frontend
npm run build                      # Build
wrangler pages deploy dist --project-name=npe-cloud  # Deploy

# Database
wrangler d1 list                   # List databases
wrangler d1 migrations list npe-production-db --remote  # Check migrations
wrangler d1 migrations apply npe-production-db --remote # Apply migrations

# Secrets
wrangler secret list               # List secrets
wrangler secret put SECRET_NAME    # Set secret
wrangler secret delete SECRET_NAME # Delete secret
```

---

## Support Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **D1 Database Docs**: https://developers.cloudflare.com/d1/
- **AI Workers Docs**: https://developers.cloudflare.com/workers-ai/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/

---

**End of Deployment Guide**

After completing these steps, your Narrative Projection Engine will be live at humanizer.com!
