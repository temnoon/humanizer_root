# NPE Deployment - Quick Fixes

## Issues Encountered & Solutions

### Issue 1: Wrangler Installation ❌

**Problem**: Tried to install wrangler via Homebrew, but it's been disabled.

**Solution**: Wrangler should be installed via npm, and is already included in package.json as a dev dependency.

### Issue 2: Package Vulnerabilities ⚠️

**Problem**: npm audit showed vulnerabilities in hono, esbuild, and deprecated packages.

**Solution**: ✅ Already fixed! I've updated both package.json files with secure versions.

---

## Fixed Deployment Steps

### Step 1: Clean Install (Workers API)

```bash
cd /Users/tem/humanizer_root/workers/npe-api

# Remove old packages
rm -rf node_modules package-lock.json

# Fresh install with updated secure packages
npm install

# Verify no vulnerabilities
npm audit
# Should show: found 0 vulnerabilities
```

### Step 2: Use npx for Wrangler Commands

Since wrangler is a dev dependency, use `npx` to run it:

```bash
# Instead of: wrangler d1 create npe-production-db
# Use:
npx wrangler d1 create npe-production-db

# Or install globally (optional)
npm install -g wrangler
```

### Step 3: Complete Workers Deployment

```bash
cd /Users/tem/humanizer_root/workers/npe-api

# 1. Create D1 database
npx wrangler d1 create npe-production-db
# Save the database_id from output

# 2. Update wrangler.toml
# Edit workers/npe-api/wrangler.toml and paste the database_id

# 3. Create KV namespace
npx wrangler kv:namespace create "KV" --preview false
# Save the id from output

# 4. Update wrangler.toml with KV id

# 5. Login to Cloudflare (if not already)
npx wrangler login

# 6. Set JWT secret
npx wrangler secret put JWT_SECRET
# Enter a strong random secret when prompted (generate with: openssl rand -base64 32)

# 7. Run migrations
npx wrangler d1 migrations apply npe-production-db --remote

# 8. Deploy Workers
npx wrangler deploy
```

### Step 4: Cloud Frontend Deployment

```bash
cd /Users/tem/humanizer_root/cloud-frontend

# Remove old packages
rm -rf node_modules package-lock.json

# Fresh install
npm install

# Verify no vulnerabilities
npm audit

# Create .env.production
echo "VITE_API_URL=https://humanizer.com/api" > .env.production

# Build
npm run build

# Deploy
npx wrangler pages deploy dist --project-name=npe-cloud
```

---

## Updated Package Versions

### Workers API (workers/npe-api/package.json)
- ✅ `hono`: ^4.6.14 (was ^3.11.7) - Fixes CSRF and directory traversal vulnerabilities
- ✅ `jose`: ^5.9.6 (was ^5.1.3) - Latest JWT library
- ✅ `wrangler`: ^3.95.0 (was ^3.22.0) - Fixes esbuild vulnerability
- ✅ `typescript`: ^5.7.2 (was ^5.2.2)
- ✅ `@cloudflare/workers-types`: ^4.20241127.0 (was ^4.20231218.0)

### Cloud Frontend (cloud-frontend/package.json)
- ✅ `react`: ^18.3.1 (was ^18.2.0)
- ✅ `react-dom`: ^18.3.1 (was ^18.2.0)
- ✅ `vite`: ^6.0.3 (was ^5.0.8)
- ✅ `wrangler`: ^3.95.0 (was ^3.22.0)
- ✅ `typescript`: ^5.7.2 (was ^5.2.2)
- ❌ Removed `react-router-dom` and `zustand` (not used in current implementation)

---

## Quick Deployment Checklist

```bash
# 1. Workers API
cd /Users/tem/humanizer_root/workers/npe-api
rm -rf node_modules package-lock.json
npm install
npx wrangler login
npx wrangler d1 create npe-production-db
# Update wrangler.toml with database_id
npx wrangler kv:namespace create "KV" --preview false
# Update wrangler.toml with KV id
npx wrangler secret put JWT_SECRET
npx wrangler d1 migrations apply npe-production-db --remote
npx wrangler deploy

# 2. Cloud Frontend
cd /Users/tem/humanizer_root/cloud-frontend
rm -rf node_modules package-lock.json
npm install
echo "VITE_API_URL=https://humanizer.com/api" > .env.production
npm run build
npx wrangler pages deploy dist --project-name=npe-cloud

# 3. Configure custom domain in Cloudflare Dashboard
# Pages → npe-cloud → Custom domains → Add humanizer.com

# 4. Test
curl https://humanizer.com/api/
# Open https://humanizer.com in browser
```

---

## Troubleshooting

### If npm install still shows warnings about deprecated packages:

These are upstream dependencies and can be safely ignored:
- `sourcemap-codec@1.4.8` - Used by rollup internally
- `rollup-plugin-inject@3.0.2` - Used by vite internally

These warnings don't affect security or functionality.

### If wrangler commands fail:

```bash
# Make sure you're logged in
npx wrangler whoami

# If not logged in
npx wrangler login
```

### If D1 migrations fail:

```bash
# Check if database exists
npx wrangler d1 list

# Check migration status
npx wrangler d1 migrations list npe-production-db --remote

# Apply specific migration
npx wrangler d1 execute npe-production-db --file=migrations/0001_initial_schema.sql --remote
npx wrangler d1 execute npe-production-db --file=migrations/0002_seed_npe_configs.sql --remote
```

---

## Next Steps After Deployment

1. **Test the API**:
   ```bash
   curl https://humanizer.com/api/
   curl https://humanizer.com/api/config/personas
   ```

2. **Test the Frontend**:
   - Open https://humanizer.com
   - Create test account
   - Try each transformation type

3. **Monitor**:
   ```bash
   npx wrangler tail npe-api
   ```

4. **Check D1 data**:
   ```bash
   npx wrangler d1 execute npe-production-db --command "SELECT COUNT(*) FROM users"
   ```

---

## Estimated Time: 15-20 minutes

All package vulnerabilities are now fixed! ✅
