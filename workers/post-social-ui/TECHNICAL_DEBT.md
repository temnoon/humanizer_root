# Technical Debt Tracker - Post-Social UI

**Last Updated**: December 5, 2025
**Total Items**: 18
**Status**: Pre-Launch Audit

---

## Executive Summary

This codebase is reasonably clean for a pre-launch product. Most issues are intentional stubs for future features or acceptable MVP trade-offs. However, there are **3 Critical** items that should be addressed before public launch, primarily related to error handling and user experience.

**Priority Counts**:
- Critical (Red): 3 items
- High (Orange): 5 items
- Medium (Yellow): 7 items
- Low (Green): 3 items

---

## Critical Issues (MUST FIX BEFORE LAUNCH)

### DEBT-001: Alert/Confirm Usage Instead of UI Components
**Location**: Multiple files
- `/src/pages/NarrativeStudioPage.tsx:72,92`
- `/src/pages/StudioPage.tsx:67,83`
- `/src/pages/SiteAdminPage.tsx:516,538,546,551,563`
- `/src/pages/BookEditorPage.tsx:281`
- `/src/components/studio/CloudArchiveBrowser.tsx:272,281,290,342`
- `/src/components/admin/NodeAdminDashboard.tsx:145,148,158,162,172,176`

**Type**: User Experience Debt
**Severity**: Critical (Red)
**Impact**: Unprofessional user experience; breaks SPA flow; not accessible

**Description**:
Native browser `alert()` and `confirm()` dialogs are used throughout the app instead of proper modal components. This creates a jarring experience inconsistent with modern SPAs.

**Why It Exists**:
Quick prototyping - alerts are faster than building modal components during development.

**Fix Required**:
- Create reusable Modal/Dialog components
- Replace all `alert()` calls with toast notifications or modals
- Replace all `confirm()` calls with confirmation modals
- Estimated effort: 4-6 hours

**Example Bad Code**:
```typescript
alert('Please select a Node to publish to'); // Line 72, NarrativeStudioPage.tsx
if (!confirm(`Delete user ${email}? This cannot be undone.`)) return; // Line 551, SiteAdminPage.tsx
```

---

### DEBT-002: JWT Token Decoding Without Error Handling
**Location**: `/src/stores/auth.ts:93`

**Type**: Security/Stability Risk
**Severity**: Critical (Red)
**Impact**: App crash on malformed tokens; potential security vulnerability

**Description**:
JWT token is decoded using `atob(token.split('.')[1])` wrapped in try/catch, but errors are silently logged without proper user feedback or fallback behavior. If a token is malformed (e.g., from localStorage corruption), the user gets stuck.

**Code**:
```typescript
try {
  const payload = JSON.parse(atob(token.split('.')[1]));
  // ... use payload
} catch (e) {
  console.error('Failed to decode token:', e);
  // No logout, no user notification, token remains set
}
```

**Fix Required**:
- Add proper error handling: if token decode fails, force logout
- Show user notification: "Session expired, please log in again"
- Consider using a JWT library instead of manual decoding
- Estimated effort: 1-2 hours

---

### DEBT-003: Inconsistent API Base URL Patterns
**Location**: Multiple files
- `/src/config/constants.ts:9-10` - Uses `VITE_API_URL` and `VITE_AUTH_URL`
- `/src/services/curator-chat.ts:38` - Uses `VITE_API_BASE_URL` (different var name)
- `/src/services/working-texts.ts:31` - Uses `VITE_API_BASE_URL` (different var name)
- `/src/components/studio/StudioToolsPanel.tsx:45-46` - Manual localhost detection

**Type**: Configuration Debt
**Severity**: Critical (Red)
**Impact**: Services may call wrong endpoints; difficult to configure environments

**Description**:
Different services use different environment variable names for the same purpose:
- `constants.ts` uses `VITE_API_URL`
- `curator-chat.ts` uses `VITE_API_BASE_URL`
- `working-texts.ts` uses `VITE_API_BASE_URL`
- `StudioToolsPanel.tsx` has hardcoded localhost logic

Fallback URLs also differ (localhost:8788 vs localhost:8787).

**Fix Required**:
- Standardize on ONE env var name across entire codebase
- Create a single `getApiUrl()` utility function
- Update all services to use the centralized config
- Add `.env.example` file with all required variables
- Estimated effort: 2-3 hours

---

## High Priority Issues (Should Fix Before Launch)

### DEBT-004: Backup Files Committed to Repository
**Location**:
- `/src/types/models.ts.bak`
- `/src/components/studio/ContextPanel.tsx.bak`
- `/src/services/nodes.ts.bak`
- `/src/types/models_replaced.ts`
- `/src/components/studio/ContextPanel_replaced.tsx`
- `/src/services/nodes_replaced.ts`

**Type**: Repository Hygiene
**Severity**: High (Orange)
**Impact**: Confusion about which files are active; increases repo size

**Fix Required**:
- Delete all `.bak` and `_replaced` files
- Add `*.bak` and `*_replaced.*` to `.gitignore`
- Estimated effort: 15 minutes

---

### DEBT-005: Console.log Statements in Production Code
**Location**: Multiple files
- `/src/stores/auth.ts:54,104`
- `/src/services/credential-manager.ts:66,113,154,171`
- `/src/services/bookCache.ts:73,93,120,145`
- `/src/services/gutenberg.ts:120`
- `/src/pages/NarrativeStudioPage.tsx:91,129`
- `/src/pages/StudioPage.tsx:82,92,98`

**Type**: Debug Pollution
**Severity**: High (Orange)
**Impact**: Exposes internal logic in production; potential security leak; noise in user console

**Fix Required**:
- Replace with proper logging service (can be no-op in production)
- Or use build-time stripping via Vite configuration
- Keep error logs, remove debug logs
- Estimated effort: 2-3 hours

---

### DEBT-006: Incomplete Features Presented as "Coming Soon"
**Location**:
- `/src/pages/PostDetailPage.tsx:107,118` - Comments and related posts
- `/src/config/constants.ts:55-56` - Disabled feature flags (realTimeUpdates, aiCurator)

**Type**: Feature Completeness
**Severity**: High (Orange)
**Impact**: Sets user expectations that may not be met soon

**Description**:
Two placeholders tell users features are "coming soon":
1. "Comment system coming soon" (line 118)
2. "Posts with similar tags will appear here (feature coming soon)" (line 107)

Additionally, feature flags show planned but unimplemented features:
- `realTimeUpdates: false` - Future WebSocket support
- `aiCurator: false` - Future AI responds to comments

**Decision Required**:
- Option A: Remove placeholder text entirely (cleaner)
- Option B: Commit to timeline and implement before launch
- Option C: Be honest: "Planned for Q1 2026"

**Estimated effort**: 30 mins (for removal) or 40+ hours (for implementation)

---

### DEBT-007: Draft Storage Only in localStorage
**Location**:
- `/src/pages/NarrativeStudioPage.tsx:60,86,121`
- `/src/pages/StudioPage.tsx:55-56`
- `/src/components/studio/EditorPanel.tsx:153,264`

**Type**: Data Persistence
**Severity**: High (Orange)
**Impact**: Drafts lost if user clears browser data or switches devices

**Description**:
All draft content is stored in `localStorage` with inline comments saying "In future: save to server as draft". This is acceptable for MVP but risky for users with important drafts.

**Fix Required**:
- For launch: Add clear warning that drafts are local only
- Post-launch: Implement server-side draft storage
- Consider auto-sync every 30 seconds when logged in
- Estimated effort: 1 hour (warning), 8-12 hours (server impl)

---

### DEBT-008: No .env File or Environment Documentation
**Location**: Root directory (missing file)

**Type**: Developer Experience
**Severity**: High (Orange)
**Impact**: New developers don't know what env vars to set; deployment issues

**Fix Required**:
- Create `.env.example` with all required variables:
  ```
  VITE_API_URL=https://post-social-api.tem-527.workers.dev
  VITE_AUTH_URL=https://npe-api.tem-527.workers.dev
  ```
- Update README.md with setup instructions
- Estimated effort: 30 minutes

---

## Medium Priority Issues (Address Post-Launch)

### DEBT-009: TODO Comment - Node Selection Modal Missing
**Location**: `/src/pages/NarrativeStudioPage.tsx:71`

**Type**: Incomplete Feature
**Severity**: Medium (Yellow)
**Impact**: Users shown generic alert instead of node picker

**Code**:
```typescript
if (!token || !targetNodeId) {
  // TODO: Show node selection modal
  alert('Please select a Node to publish to');
  return;
}
```

**Fix Required**:
- Build node selection modal component
- Estimated effort: 3-4 hours

---

### DEBT-010: Commented Future Features in StudioPage
**Location**: `/src/pages/StudioPage.tsx:56,91,97`

**Type**: Documentation Debt
**Severity**: Medium (Yellow)
**Impact**: Code clutter; unclear timeline

**Code**:
```typescript
// In future: save to server as draft (line 56)
// In future: intelligently apply suggestion to content (line 91)
// In future: AI-assisted comment synthesis (line 97)
```

**Fix Required**:
- Move to GitHub Issues or project roadmap
- Remove inline comments
- Estimated effort: 30 minutes

---

### DEBT-011: Fake Cache Response in Gutenberg Service
**Location**: `/src/services/gutenberg/index.ts:209`

**Type**: Misleading Code
**Severity**: Medium (Yellow)
**Impact**: Comment says "fake response" which sounds concerning

**Code**:
```typescript
// Store in cache as fake response
this.cache.set(cacheKey, {
  data: { count: 1, next: null, previous: null, results: [data] },
  timestamp: Date.now()
});
```

**Actual Issue**: The comment is misleading. It's not fake data - it's wrapping a single book result in the expected list format. Should say "wrap single result".

**Fix Required**:
- Update comment: "Wrap single book result in list format for cache consistency"
- Estimated effort: 2 minutes

---

### DEBT-012: Multiple Storage Key Formats
**Location**:
- `/src/config/constants.ts:43-49` - Uses `post-social:` prefix
- `/src/stores/theme.ts:16` - Uses different key format
- `/src/pages/StudioPage.tsx:55` - Uses `studio-draft` (no prefix)

**Type**: Data Organization
**Severity**: Medium (Yellow)
**Impact**: Inconsistent localStorage namespace; potential key collisions

**Fix Required**:
- Standardize all keys to use `STORAGE_KEYS` constants
- Add missing keys to constants file
- Estimated effort: 1 hour

---

### DEBT-013: Silent Error Handling in API Calls
**Location**: Multiple service files
- `/src/services/api.ts:39`
- `/src/services/secure-archive.ts:81,240,306,340,381,398`
- `/src/services/transformations.ts:189,209,235,260,285,308`

**Type**: Error Handling Pattern
**Severity**: Medium (Yellow)
**Impact**: Swallowed error details; debugging difficulty

**Code Pattern**:
```typescript
const error = await response.json().catch(() => ({}));
```

**Issue**: If `.json()` fails, returns empty object, hiding parse errors.

**Fix Required**:
- Log parse failures before returning empty object
- Or propagate original error
- Estimated effort: 2 hours

---

### DEBT-014: Hardcoded Localhost Detection
**Location**: `/src/components/studio/StudioToolsPanel.tsx:45-46`

**Type**: Environment Detection
**Severity**: Medium (Yellow)
**Impact**: Won't work with custom dev domains or Docker

**Code**:
```typescript
if (hostname === 'localhost' || hostname === '127.0.0.1') {
  return 'http://localhost:8787';
}
```

**Fix Required**:
- Use environment variable instead
- Estimated effort: 15 minutes (after DEBT-003 is fixed)

---

### DEBT-015: Port Mismatches Between Services
**Location**:
- `/src/services/curator-chat.ts:38` - Defaults to `:8788`
- `/src/services/working-texts.ts:31` - Defaults to `:8788`
- `/src/components/studio/StudioToolsPanel.tsx:46` - Defaults to `:8787`

**Type**: Configuration Inconsistency
**Severity**: Medium (Yellow)
**Impact**: Services may fail to connect in local dev

**Fix Required**:
- Verify which port is correct (probably 8787 based on CLAUDE.md)
- Standardize all fallbacks
- Estimated effort: 15 minutes

---

### DEBT-016: Minimal README
**Location**: `/README.md`

**Type**: Documentation Gap
**Severity**: Medium (Yellow)
**Impact**: Onboarding friction; no architecture docs

**Current State**: Generic Vite+Solid template README (29 lines)

**Fix Required**:
- Document: Architecture overview, setup steps, env vars, deployment
- Add link to studio-first pattern doc
- Include API endpoint documentation
- Estimated effort: 2-3 hours

---

## Low Priority Issues (Nice to Have)

### DEBT-017: Lack of Input Validation Constants Usage
**Location**: `/src/config/constants.ts:12-27` defines limits, but not consistently enforced

**Type**: Code Quality
**Severity**: Low (Green)
**Impact**: Risk of inconsistent validation

**Fix Required**:
- Audit all forms to ensure they use LIMITS constants
- Add validation helpers that reference constants
- Estimated effort: 3-4 hours

---

### DEBT-018: Theme Storage Uses Different Key Format
**Location**: `/src/stores/theme.ts:16`

**Type**: Minor Inconsistency
**Severity**: Low (Green)
**Impact**: None functionally; aesthetic issue

**Code**:
```typescript
const STORAGE_KEY = 'theme';
```

**Fix Required**:
- Update to use `STORAGE_KEYS.theme` from constants
- Estimated effort: 10 minutes

---

## Cleanup Tasks (Not Blocking)

### CLEANUP-001: Remove Development Comments
Many files have helpful development comments that should be cleaned:
- `/src/services/credential-manager.ts` - Has extensive error logging comments
- `/src/services/bookCache.ts` - Cache management TODOs in comments
- Various "In future" comments throughout

**Estimated effort**: 1 hour

---

## Summary by Category

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| UX Issues | 1 | 1 | 0 | 0 | 0 |
| Security | 1 | 1 | 0 | 0 | 0 |
| Configuration | 4 | 1 | 1 | 2 | 0 |
| Error Handling | 1 | 0 | 0 | 1 | 0 |
| Feature Incomplete | 2 | 0 | 1 | 1 | 0 |
| Data Persistence | 1 | 0 | 1 | 0 | 0 |
| Code Hygiene | 3 | 0 | 1 | 1 | 1 |
| Documentation | 2 | 0 | 1 | 1 | 0 |
| Validation | 1 | 0 | 0 | 0 | 1 |
| Repository | 1 | 0 | 1 | 0 | 0 |
| Consistency | 1 | 0 | 0 | 1 | 0 |

---

## Launch Readiness Checklist

**MUST FIX (Est. 7-11 hours)**:
- [ ] DEBT-001: Replace all alerts/confirms with proper UI components (4-6h)
- [ ] DEBT-002: Fix JWT token error handling (1-2h)
- [ ] DEBT-003: Standardize API URL configuration (2-3h)

**SHOULD FIX (Est. 5-8 hours)**:
- [ ] DEBT-004: Remove backup files from repo (15m)
- [ ] DEBT-005: Clean console.log statements (2-3h)
- [ ] DEBT-006: Remove or implement "coming soon" features (30m)
- [ ] DEBT-007: Add draft storage warning (1h)
- [ ] DEBT-008: Create .env.example and docs (30m)

**Total Pre-Launch Work**: ~12-19 hours

---

## Positive Notes

The codebase demonstrates several GOOD practices:
- Clean separation of concerns (services, components, stores)
- Centralized configuration in constants.ts
- Proper TypeScript typing throughout
- No inline styles or magic numbers in most places
- Good component composition
- Proper use of SolidJS patterns
- No security antipatterns (XSS, SQL injection vectors, etc.)
- Reasonable error boundaries

**Overall Grade**: B+ (would be A- after critical fixes)

---

## Next Actions

1. **Immediate** (before any launch):
   - Fix DEBT-001, DEBT-002, DEBT-003

2. **This Week**:
   - Fix DEBT-004 through DEBT-008

3. **Post-Launch Sprint**:
   - Address medium priority items
   - Implement server-side draft storage
   - Build proper notification system

4. **Ongoing**:
   - Monitor for new debt
   - Review this doc monthly
   - Keep "future" comments to minimum

---

**Document End** | Generated: 2025-12-05 | Next Review: Before production deploy
