# Technical Debt Tracker - NPE API Production Readiness

**Last Updated**: December 5, 2025, 12:00 PM
**Total Items**: 23 (14 previous + 9 new)
**Status**: CRITICAL - Multiple production blockers identified
**Launch Readiness**: NOT READY - See Critical section

---

## Executive Summary

This audit combines the November 11 quantum/V2 implementation analysis with a comprehensive December 5 production readiness scan. The system has **TWO categories of blocking issues**:

1. **Quantum Architecture Issues** (from Nov 11 audit) - 8 items blocking V2 legitimacy
2. **Production Launch Blockers** (new Dec 5 findings) - 9 items blocking safe deployment

### Severity Breakdown

- **CRITICAL (3 items)**: Production blockers that MUST be fixed before launch
- **BLOCKING (8 items)**: Fake quantum operations that invalidate the entire V2 approach
- **HIGH (5 items)**: Security/reliability issues that need immediate attention
- **MEDIUM (5 items)**: Missing features that reduce value proposition
- **LOW (2 items)**: Minor polish items

### Critical Finding - Production Launch Blockers

**CRITICAL-001**: Disabled authentication on `/v2/rho` routes in production
**CRITICAL-002**: Hardcoded demo credentials in public HTML file
**CRITICAL-003**: OAuth redirect using workers.dev domain instead of humanizer.com

---

## PART 1: PRODUCTION LAUNCH BLOCKERS (Dec 5, 2025)

### CRITICAL-001: Authentication Disabled on /v2/rho Routes

**Location**: `/workers/npe-api/src/routes/v2/rho.ts:19-21`
**Type**: Security vulnerability
**Severity**: CRITICAL
**Blocks**: Production launch
**Created**: Local development phase
**Effort**: SMALL (15 minutes)

**Description**:
```typescript
// TODO: Re-enable auth for production deployment
// For local dev, auth is disabled to allow Workbench access
// rhoRoutes.use('/*', requireAuth());
```

The authentication middleware is **commented out** on all V2 rho routes in production code. This means:
- `/v2/rho/construct` - Anyone can construct density matrices
- `/v2/rho/measure` - Anyone can run POVM measurements
- `/v2/rho/inspect` - Anyone can inspect rho states
- `/v2/rho/distance` - Anyone can compute state distances

**Impact**:
- Unauthorized API access
- No quota enforcement on these endpoints
- Potential abuse/DoS attacks
- Violates security model

**Fix**:
```typescript
// Use optionalLocalAuth() for Workbench compatibility while requiring auth in production
rhoRoutes.use('/*', optionalLocalAuth());
```

**Recommendation**: Fix IMMEDIATELY before any production deployment.

---

### CRITICAL-002: Hardcoded Demo Credentials in Public HTML

**Location**: `/workers/npe-api/public/pricing.html:216-217`
**Type**: Security exposure
**Severity**: CRITICAL
**Blocks**: Production launch
**Created**: Testing/development
**Effort**: SMALL (5 minutes)

**Description**:
```html
<input type="email" id="email" placeholder="Email" value="demo@humanizer.com">
<input type="password" id="password" placeholder="Password" value="testpass123">
```

The pricing page (publicly accessible) has **hardcoded credentials** pre-filled in the form.

**Impact**:
- Publicly exposes demo account credentials
- Anyone can log in as demo@humanizer.com
- CLAUDE.md confirms: "demo@humanizer.com is RETIRED (demoted to free tier, exposed password)"
- Security risk if this account still has elevated privileges

**Fix**:
```html
<input type="email" id="email" placeholder="Email" value="">
<input type="password" id="password" placeholder="Password" value="">
```

**Additional Actions**:
1. Verify demo@humanizer.com is truly demoted to FREE tier with zero elevated access
2. Consider deleting the account entirely if no longer needed
3. Audit all public HTML files for similar issues

**Recommendation**: Fix IMMEDIATELY and audit account permissions.

---

### CRITICAL-003: OAuth Redirect Using workers.dev Domain

**Location**: `/workers/npe-api/src/routes/oauth.ts:41-45`
**Type**: Configuration blocker
**Severity**: CRITICAL
**Blocks**: Production OAuth (Google, GitHub, Discord, Facebook, Apple)
**Created**: Initial OAuth implementation
**Effort**: MEDIUM (2-3 hours including DNS setup)

**Description**:
```typescript
// TODO: Change to npe-api.humanizer.com once subdomain is configured
const baseUrl = env.ENVIRONMENT === 'production'
  ? 'https://npe-api.tem-527.workers.dev'
  : 'http://localhost:8787';
```

OAuth callbacks are hardcoded to `workers.dev` domain instead of `npe-api.humanizer.com`.

**Impact**:
- OAuth providers (Google, GitHub, etc.) are configured for workers.dev
- Switching domains breaks OAuth until providers are reconfigured
- Users can't log in with social accounts
- Unprofessional domain in OAuth consent screens

**Fix Steps**:
1. Set up DNS: `npe-api.humanizer.com` → Cloudflare Worker
2. Update wrangler.toml with custom domain route
3. Reconfigure ALL OAuth providers with new redirect URIs:
   - Google: `https://npe-api.humanizer.com/auth/oauth/google/callback`
   - GitHub: `https://npe-api.humanizer.com/auth/oauth/github/callback`
   - Discord: `https://npe-api.humanizer.com/auth/oauth/discord/callback`
   - Facebook: `https://npe-api.humanizer.com/auth/oauth/facebook/callback`
   - Apple: `https://npe-api.humanizer.com/auth/oauth/apple/callback`
4. Update code:
   ```typescript
   const baseUrl = env.ENVIRONMENT === 'production'
     ? 'https://npe-api.humanizer.com'
     : 'http://localhost:8787';
   ```

**Recommendation**: Fix before launch OR disable OAuth login temporarily and launch with email/password only.

---

### HIGH-001: Text Naturalizer Using Placeholder Implementation

**Location**: `/workers/npe-api/src/lib/text-naturalizer.ts:127`
**Type**: Stub implementation
**Severity**: HIGH
**Blocks**: AI Detection quality
**Created**: Computer Humanizer implementation
**Effort**: LARGE (20+ hours for LLM-based approach)

**Description**:
```typescript
/**
 * Enhance burstiness by varying sentence lengths
 * Target: 50-70/100 (human-like variation)
 * Strategy: Mix short (8-12 word) and long (20-30 word) sentences
 * PRESERVES: Paragraph breaks, markdown formatting
 * NOTE: This is a PLACEHOLDER - should be replaced with LLM-based approach for production
 */
export function enhanceBurstiness(text: string, targetScore: number = 60): string {
```

The burstiness enhancement uses **rule-based sentence splitting** instead of LLM-based rewriting.

**Impact**:
- Lower quality AI detection bypass
- Computer Humanizer feature less effective than marketed
- Users may not get promised results

**Fix Options**:
1. **Quick fix** (8 hours): Use Cloudflare AI to rewrite with varied sentence length
2. **Better fix** (20 hours): Implement proper burstiness analysis + targeted rewriting
3. **Honest fix** (1 hour): Document limitation in UI/docs, set user expectations

**Recommendation**: Either implement LLM-based approach OR clearly label as "beta/experimental" feature.

---

### HIGH-002: Admin Cost Estimates Using Rough Guesses

**Location**: `/workers/npe-api/src/routes/admin.ts:717-770`
**Type**: Inaccurate metrics
**Severity**: HIGH
**Blocks**: Business decision-making
**Created**: Admin metrics implementation
**Effort**: MEDIUM (6-8 hours)

**Description**:
```typescript
// Estimate Cloudflare AI costs (rough: $0.01 per 1000 tokens)
const tokensUsed = ...
const aiCostEstimate = (tokensUsed / 1000) * 0.01;

// D1 storage (would need to query actual size, estimate for now)
const d1SizeMB = 50; // Rough estimate
const d1Cost = (d1SizeMB / 1024) * 0.75;
```

Admin dashboard shows **rough cost estimates** with multiple disclaimers:
- "Rough estimate: $0.01/1k tokens"
- "AI costs are rough estimates based on token usage"

**Impact**:
- Business decisions based on inaccurate cost data
- Can't accurately assess profitability
- May miss cost optimization opportunities

**Fix**:
1. Use actual Cloudflare AI pricing from their API
2. Query D1 for actual database size: `SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()`
3. Track R2 storage costs from Cloudflare Analytics API
4. Add disclaimer in UI: "Estimates updated hourly, see Cloudflare dashboard for exact costs"

**Recommendation**: Implement accurate cost tracking OR remove cost section from admin dashboard.

---

### HIGH-003: Console.log Statements Throughout Codebase

**Location**: 77 occurrences across 20 files
**Type**: Debug pollution
**Severity**: HIGH
**Blocks**: Clean production logs
**Created**: Development/debugging
**Effort**: MEDIUM (4-6 hours to audit and clean)

**Description**:
Found 77+ console.log/warn/error statements across routes and services:
- `/src/services/computer-humanizer.ts` - 12 instances
- `/src/services/llm-providers/cloudflare.ts` - 12 instances
- `/src/routes/secure-archive.ts` - 10 instances
- Many others scattered throughout

**Examples**:
```typescript
console.log('[Computer Humanizer] Stage 3: Skipped (no voice samples)');
console.log('[Security] Migrated password for user ${email} to PBKDF2');
console.error('POVM measurement error:', error);
```

**Impact**:
- Cloudflare Workers logs filled with debug output
- Harder to find actual errors
- May expose sensitive information in logs
- Performance impact (minor)

**Fix Strategy**:
1. Keep `console.error()` for actual errors
2. Remove or convert to proper logging:
   ```typescript
   // REMOVE:
   console.log('[Debug] Starting transformation...');

   // KEEP:
   console.error('Transformation failed:', error);

   // CONVERT to env-based:
   if (env.ENVIRONMENT === 'development') {
     console.log('[Debug] Starting transformation...');
   }
   ```

**Recommendation**: Audit all console statements, remove debug logs, keep error logging.

---

### HIGH-004: Hardcoded Axis Parameter in POVM Measurement

**Location**: `/workers/npe-api/src/domain/povm-service.ts:84`
**Type**: Incomplete implementation
**Severity**: HIGH
**Blocks**: Multi-axis POVM measurements
**Created**: POVM service implementation
**Effort**: MEDIUM (8-10 hours)

**Description**:
```typescript
// Note: axis parameter currently not used, hardcoded to literalness
const povmResult = await measureSentenceTetralemma(
  this.ai,
  narrative.text,
  0 // sentence index (0 for narrative-level measurement)
);
```

The `axis` parameter is accepted but **ignored**. All measurements use the "literalness" axis.

**Impact**:
- Users can't measure other POVM axes (persona, namespace, style)
- API lies about functionality (accepts axis param, doesn't use it)
- Limits V2 value proposition

**Fix**:
Need to implement multiple POVM measurement types:
- Literalness (existing)
- Persona axis (formal ↔ casual)
- Namespace axis (technical ↔ colloquial)
- Style axis (direct ↔ metaphorical)

Each requires defining:
1. Tetralemma categories for that axis
2. LLM prompt for measurement
3. Evidence extraction logic

**Recommendation**: Either implement all axes OR remove unused axis parameter from API.

---

### HIGH-005: Database Size Estimation Placeholder

**Location**: `/workers/npe-api/src/routes/admin.ts:726`
**Type**: Hardcoded value
**Severity**: HIGH
**Blocks**: Accurate admin metrics
**Created**: Admin dashboard implementation
**Effort**: SMALL (2 hours)

**Description**:
```typescript
// D1 storage (would need to query actual size, estimate for now)
const d1SizeMB = 50; // Rough estimate
```

Database size is **hardcoded to 50 MB** instead of queried from D1.

**Impact**:
- Admin dashboard shows wrong storage usage
- Can't track database growth
- May miss storage limits

**Fix**:
```typescript
// Query actual D1 database size
const sizeQuery = await c.env.DB.prepare(`
  SELECT
    (page_count * page_size) / (1024.0 * 1024.0) as size_mb
  FROM pragma_page_count(), pragma_page_size()
`).first();
const d1SizeMB = sizeQuery?.size_mb || 0;
```

**Recommendation**: Implement actual size query (2 hours).

---

### MEDIUM-001: Localhost Origins Allowed in Production CORS

**Location**: `/workers/npe-api/src/index.ts:42-44`
**Type**: Security configuration
**Severity**: MEDIUM
**Blocks**: N/A (acceptable for development, tight in production)
**Created**: CORS setup
**Effort**: SMALL (30 minutes)

**Description**:
```typescript
// Allow localhost for development
if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
  return origin;
}
```

CORS allows **any localhost origin** in production.

**Impact**:
- Development convenience maintained
- Slightly looser security (localhost requests accepted)
- Could allow malicious local software to access API

**Fix**:
```typescript
// Only allow localhost in development
if (env.ENVIRONMENT === 'development') {
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin;
  }
}
```

**Recommendation**: Low priority, but tighten for production.

---

### MEDIUM-002: Empty Catch Block in Personal Personas Route

**Location**: `/workers/npe-api/src/routes/personal-personas.ts:318`
**Type**: Silent error handling
**Severity**: MEDIUM
**Blocks**: Error visibility
**Created**: Personal personas implementation
**Effort**: SMALL (15 minutes)

**Description**:
```typescript
const body = await c.req.json().catch(() => ({}));
```

JSON parsing errors are **silently swallowed** and replaced with empty object.

**Impact**:
- Invalid JSON accepted without error
- User gets confusing "missing required fields" instead of "invalid JSON"
- Harder to debug client-side issues

**Fix**:
```typescript
let body;
try {
  body = await c.req.json();
} catch (err) {
  return c.json({ error: 'Invalid JSON in request body' }, 400);
}
```

**Recommendation**: Fix for better error messages.

---

### MEDIUM-003: OAuth State Cleanup Not Automated

**Location**: `/workers/npe-api/src/services/oauth.ts` (cleanupExpiredStates function exists but not called)
**Type**: Missing automation
**Severity**: MEDIUM
**Blocks**: KV storage bloat
**Created**: OAuth implementation
**Effort**: MEDIUM (4-6 hours for scheduled worker)

**Description**:
The `cleanupExpiredStates()` function exists but is never called automatically.

**Impact**:
- KV namespace accumulates expired OAuth state tokens
- Storage bloat over time
- Potential cost increase

**Fix Options**:
1. Add Cron Trigger to wrangler.toml:
   ```toml
   [triggers]
   crons = ["0 */4 * * *"]  # Every 4 hours
   ```
2. Implement scheduled handler in index.ts:
   ```typescript
   export default {
     async scheduled(event, env, ctx) {
       await cleanupExpiredStates(env.KV);
     }
   }
   ```

**Recommendation**: Implement cron cleanup before launch.

---

### MEDIUM-004: TODO Comment on Translation Service Enhancement

**Location**: `/workers/npe-api/src/services/translation.ts:414`
**Type**: Feature gap
**Severity**: MEDIUM
**Blocks**: Advanced translation features
**Created**: Translation service implementation
**Effort**: MEDIUM (6-8 hours)

**Description**:
```typescript
// TODO: Future enhancement - separate commentary support
```

Translation service doesn't support commentary/notes alongside translations.

**Impact**:
- Users can't add translator notes
- Missing feature for professional use cases

**Fix**:
Extend translation API to support:
- Commentary field for translator notes
- Footnotes/annotations
- Alternative translations

**Recommendation**: Track as future enhancement, not blocking.

---

### LOW-001: Inconsistent Error Response Format

**Location**: Multiple routes
**Type**: API inconsistency
**Severity**: LOW
**Blocks**: N/A
**Created**: Various implementations
**Effort**: MEDIUM (8-10 hours to standardize)

**Description**:
Error responses vary across routes:
```typescript
// Some routes:
{ error: 'Message' }

// Others:
{ error: 'Message', details: error.message }

// Others:
{ error: 'Message', hint: 'Suggestion' }

// Others:
{ error: 'Message', upgrade_url: '/pricing', current_tier: 'free' }
```

**Impact**:
- Client code needs multiple error parsing strategies
- Inconsistent user experience

**Fix**:
Standardize on:
```typescript
{
  error: string,           // Required
  details?: string,        // Optional technical details
  hint?: string,          // Optional user-facing suggestion
  code?: string,          // Optional error code (e.g., 'QUOTA_EXCEEDED')
  metadata?: object       // Optional structured data
}
```

**Recommendation**: Low priority polish item.

---

### LOW-002: Wrangler.toml Missing Environment-Specific Secrets Documentation

**Location**: `/workers/npe-api/wrangler.toml:46-49`
**Type**: Documentation gap
**Severity**: LOW
**Blocks**: N/A
**Created**: Configuration
**Effort**: SMALL (30 minutes)

**Description**:
```toml
# Secrets (set via wrangler secret put)
# JWT_SECRET - set via: wrangler secret put JWT_SECRET
# STRIPE_SECRET_KEY - set via: wrangler secret put STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET - set via: wrangler secret put STRIPE_WEBHOOK_SECRET
```

Missing documentation for:
- ALLOW_NEW_SIGNUPS (env var for signup control)
- ADMIN_EMAILS (comma-separated admin whitelist)
- OLLAMA_URL (for local development)

**Fix**:
Add to wrangler.toml:
```toml
# Environment Variables (set via wrangler.toml or dashboard)
# ALLOW_NEW_SIGNUPS='true' - Enable public signups (default: disabled)
# ADMIN_EMAILS='email1@domain.com,email2@domain.com' - Admin whitelist
# OLLAMA_URL='http://localhost:11434' - Local Ollama endpoint (dev only)

# Secrets (set via wrangler secret put)
# JWT_SECRET - JWT signing key (generate with: openssl rand -base64 32)
# STRIPE_SECRET_KEY - Stripe API secret key
# STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
# GOOGLE_CLIENT_SECRET - Google OAuth secret
# GITHUB_CLIENT_SECRET - GitHub OAuth secret
# DISCORD_CLIENT_SECRET - Discord OAuth secret
# FACEBOOK_APP_SECRET - Facebook OAuth secret
# APPLE_PRIVATE_KEY - Apple OAuth private key
```

**Recommendation**: Low priority documentation improvement.

---

## PART 2: QUANTUM/V2 ARCHITECTURE ISSUES (Nov 11, 2025)

[Previous DEBT-001 through DEBT-014 content remains identical to November 11 audit]

### DEBT-001: LLM-Guessed POVM Measurements
**Status**: UNCHANGED - Still using LLM to guess probabilities instead of Born rule
**Severity**: BLOCKING
**Blocks**: Core ML, Cloud Archives

[Content identical to original audit]

### DEBT-002: Density Matrix ρ Not Used for Guidance
**Status**: UNCHANGED - Still computed after transformation, not used during
**Severity**: BLOCKING
**Blocks**: Core ML

[Content identical to original audit]

### DEBT-003: POVM "Measurement" is Content Analysis Masquerading as Physics
**Status**: UNCHANGED - Still calling NLP analysis "quantum measurement"
**Severity**: BLOCKING
**Blocks**: Core ML, academic credibility

[Content identical to original audit]

### DEBT-004: Simplified Density Matrix Uses Diagonal Approximation
**Status**: UNCHANGED - Still using diagonal matrices (no off-diagonal coherences)
**Severity**: BLOCKING (for academic rigor)
**Blocks**: Core ML

[Content identical to original audit]

### DEBT-005: No Actual Projection Operators Defined
**Status**: UNCHANGED - Zero POVM operators defined
**Severity**: BLOCKING
**Blocks**: Core ML

[Content identical to original audit]

### DEBT-006: Round-Trip and Maieutic Have No ρ Tracking
**Status**: UNCHANGED - V2 only covers allegorical
**Severity**: BLOCKING (for V2 completeness)
**Blocks**: Cloud Archives

[Content identical to original audit]

### DEBT-007: Embedding Drift ≠ Quantum State Distance
**Status**: UNCHANGED - Still calling cosine similarity "quantum distance"
**Severity**: BLOCKING (for correctness)
**Blocks**: Core ML

[Content identical to original audit]

### DEBT-008: No Verification That POVM Results Obey Quantum Constraints
**Status**: UNCHANGED - Missing validation of quantum mechanics axioms
**Severity**: BLOCKING
**Blocks**: Core ML

[Content identical to original audit]

### DEBT-009: No User-Facing ρ Inspector UI
**Status**: UNCHANGED - Backend routes exist, no UI
**Severity**: LIMITING
**Blocks**: User adoption

[Content identical to original audit]

### DEBT-010: No Session/Workflow Persistence for V2
**Status**: UNCHANGED - No session persistence
**Severity**: LIMITING
**Blocks**: Cloud Archives

[Content identical to original audit]

### DEBT-011: No Explanation of What ρ Means
**Status**: UNCHANGED - No interpretation in API responses
**Severity**: LIMITING
**Blocks**: User understanding

[Content identical to original audit]

### DEBT-012: Verification System Only Works on Allegorical
**Status**: UNCHANGED - No verification for Round-Trip/Maieutic
**Severity**: LIMITING
**Blocks**: General transformation quality

[Content identical to original audit]

### DEBT-013: Auth Disabled on /v2/rho Routes
**Status**: PROMOTED TO CRITICAL-001 (duplicate of new finding)
**Severity**: CRITICAL
**Blocks**: Production launch

**Note**: This was originally categorized as "COSMETIC" in Nov 11 audit. Upon Dec 5 review, this is actually a **CRITICAL security issue** for production deployment.

### DEBT-014: Inconsistent Error Handling in POVM Measurement
**Status**: UNCHANGED - POVM throws errors, others return fallbacks
**Severity**: COSMETIC
**Blocks**: N/A

[Content identical to original audit]

---

## 3. Summary and Recommendations

### The TWO Critical Problems

#### Problem 1: V2 Quantum Theater (Nov 11 Finding)
V2 is built on **quantum-inspired terminology** without **quantum operations**. We're calling content analysis "POVM measurement" and displaying ρ metrics without using them for guidance.

**Status**: Unresolved, needs strategic decision (see Nov 11 audit recommendations)

#### Problem 2: Production Launch Blockers (Dec 5 Finding)
**CRITICAL ISSUES** that prevent safe production deployment:
1. Authentication disabled on public API routes
2. Hardcoded credentials in public HTML
3. OAuth misconfigured with wrong domain

**Status**: MUST BE FIXED before launch

### Pre-Launch Checklist (REQUIRED)

**Security (CRITICAL - 1 hour total)**:
- [ ] Re-enable auth on /v2/rho routes (15 min)
- [ ] Remove hardcoded credentials from pricing.html (5 min)
- [ ] Verify demo@humanizer.com has zero privileges (15 min)
- [ ] Audit all public HTML files for credentials (25 min)

**OAuth (CRITICAL - 2-3 hours OR disable feature)**:
- [ ] Set up npe-api.humanizer.com DNS
- [ ] Reconfigure all OAuth providers with new URLs
- [ ] Update oauth.ts with production domain
- [ ] Test all OAuth flows
- **OR**: Disable OAuth login temporarily, launch with email/password only

**Admin Dashboard (HIGH - 2 hours)**:
- [ ] Implement actual D1 size query (replaces hardcoded 50MB)
- [ ] Add disclaimer: "Cost estimates are approximate"
- [ ] Consider hiding cost section if estimates remain rough

**Logging Cleanup (HIGH - 4-6 hours)**:
- [ ] Audit all console.log statements
- [ ] Remove debug logs or make env-conditional
- [ ] Keep console.error for actual errors

**API Fixes (MEDIUM - 4 hours)**:
- [ ] Fix POVM axis parameter (remove if unused, implement if needed)
- [ ] Fix empty catch block in personal-personas.ts
- [ ] Set up OAuth state cleanup cron job

### Three Paths Forward (V2 Quantum Decision)

Same three paths as Nov 11 audit:
1. **Honest Rebranding** (8 hours) - RECOMMENDED
2. **Make It Real** (200+ hours) - NOT RECOMMENDED
3. **Hybrid Approach** (40 hours) - VIABLE

**Recommendation**: Fix CRITICAL issues for launch (4-5 hours), defer V2 quantum decision.

---

## 4. Launch Readiness Assessment

### Can We Launch? **NO** (not yet)

**Blocking Issues (4-5 hours to fix)**:
1. CRITICAL-001: Auth disabled on /v2/rho routes (15 min)
2. CRITICAL-002: Hardcoded credentials (30 min)
3. CRITICAL-003: OAuth domain (3 hours OR disable OAuth)

**After Fixes: YES** (with caveats):
- OAuth: Disabled temporarily OR fully configured
- V2 Features: Keep but mark as "Beta/Experimental"
- Quantum Claims: Add disclaimers or remove from marketing
- Cost Dashboard: Show estimates with big disclaimer

### Recommended Launch Path

**Week 1 - Security Fixes (1 day)**:
- Fix CRITICAL-001, CRITICAL-002, CRITICAL-003
- Option A: Configure OAuth properly (3 hours)
- Option B: Disable OAuth, email/password only (30 min)

**Week 2 - Quality Improvements (2-3 days)**:
- Fix HIGH-003 (logging cleanup)
- Fix HIGH-005 (database size query)
- Fix MEDIUM issues (error handling, CORS)

**Week 3 - V2 Decision (strategy meeting)**:
- Review Nov 11 quantum audit
- Choose: Rebrand, Make Real, or Hybrid
- Set timeline for V2 legitimacy fixes

**Week 4 - Launch**:
- Deploy with security fixes
- Monitor error logs closely
- Gather user feedback on V2 features

---

## 5. Success Criteria

**Before Launch (REQUIRED)**:
- [ ] Zero CRITICAL issues remaining
- [ ] Zero hardcoded credentials in codebase
- [ ] All public API routes have authentication
- [ ] OAuth working OR explicitly disabled
- [ ] Demo account has zero elevated privileges

**Before Marketing V2 (RECOMMENDED)**:
- [ ] Zero false claims about quantum mechanics in user-facing docs
- [ ] ρ used for guidance, not just display OR removed from marketing
- [ ] All "quantum" terminology either backed by math OR clearly labeled as "inspired by"
- [ ] Verification system honest about what it checks

---

## 6. Contacts and Resources

**Technical Debt Champion**: TBD
**Security Review**: NEEDED before launch
**Quantum Physics Consultant**: NEEDED (if pursuing Path 2 for V2)

**Related Documents**:
- `/workers/npe-api/docs/MVP_FUNCTIONAL_SPEC.md` - Narrative sessions architecture
- `/workers/npe-api/docs/V1_V2_COMPARISON_AND_STRATEGY.md` - V1 vs V2 decision rationale
- `/workers/shared/STUDIO_TOOLS_FRAMEWORK.md` - Studio tools design
- `/CLAUDE.md` - Project overview and current status

**External References**:
- Cloudflare Workers Security Best Practices
- OWASP API Security Top 10
- OAuth 2.0 Security Best Current Practice

---

**END OF TECHNICAL DEBT AUDIT - December 5, 2025**

**Next Actions**:
1. Fix CRITICAL-001, CRITICAL-002, CRITICAL-003 (4-5 hours)
2. Run security audit on all public files
3. Test OAuth flows or disable feature
4. Schedule V2 strategy meeting
5. Create launch checklist from this document
