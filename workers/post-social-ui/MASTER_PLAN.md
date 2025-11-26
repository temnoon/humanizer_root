# Post-Social UI Development Plan - Master Summary

## Current Status

You now have **two paths forward**, documented in detail:

### Path 1: Proper Frontend (Long-term)
**Location:** `/Users/tem/humanizer_root/workers/post-social-ui/`

**Status:** ✅ Phase 1 Foundation Bootstrapped
- Project structure defined
- Design system created (`theme.ts` with all colors, spacing, typography)
- CSS architecture laid out (separation of concerns)
- Build system configured (SolidJS + Vite + TypeScript)

**Documents:**
- `README.md` - Overview and status
- `BOOTSTRAP.md` - Complete setup instructions
- `SOURCE_FILES_PART1.md` - Config and styles code

**Next Steps:**
1. Run through BOOTSTRAP.md locally
2. `npm install`
3. Implement component library (Button, Input, Card, etc.)
4. Build pages (Dashboard, PostDetail, Search)
5. Deploy to Cloudflare Pages

**Timeline:** ~3-5 weeks for full implementation

---

### Path 2: Quick Fix (Short-term)
**Location:** `/Users/tem/humanizer_root/workers/post-social-frontend/`

**Status:** ⚠️ Needs Markdown Support
- Current frontend works but doesn't render markdown/LaTeX
- Your Noether's Theorem post displays as plain text
- No line breaks, no formatting

**Document:**
- `STEP2_MARKDOWN_FIX.md` - Minimal changes to add markdown + LaTeX rendering

**Implementation:** ~30 minutes
1. Add marked.js and KaTeX CDN links
2. Add `renderContent()` function
3. Update `displayPost()` to use it
4. Add markdown-specific CSS
5. Deploy

**Result:** Posts render properly for testing backend features

---

## Recommended Approach

### Parallel Development

**Week 1-2: Quick Fixes + Backend**
- ✅ Apply markdown fix (Step 2)
- ✅ Continue backend Phase 6 (Curator Chat)
- ✅ Continue backend Phase 7 (Advanced features)
- Test synthesis with properly formatted posts

**Week 3-5: New Frontend**
- ✅ Bootstrap proper frontend (Step 1)
- Implement component library
- Build core pages
- Achieve feature parity
- Deploy alongside old frontend

**Week 6: Cutover**
- A/B test both frontends
- Gradual traffic migration
- Deprecate monolithic frontend

### Why This Works

1. **Unblocked Testing:** Markdown fix lets you test backend immediately
2. **No Wasted Work:** Building proper frontend while backend matures
3. **Low Risk:** Old frontend stays online during transition
4. **Best Outcome:** World-class frontend that matches your vision

---

## Philosophy Alignment

The new frontend architecture embodies your phenomenological principles:

### Synthesis Over Engagement
- No like counters, no follower counts
- Version history shows evolution of ideas
- Synthesis indicators, not viral metrics

### Understanding Over Virality
- Semantic search discovers meaning
- Related content by similarity, not popularity
- Tags organize concepts, not chase trends

### Authentic Discourse
- Privacy-first (local-first architecture ready)
- Focus on content, not performer identity
- Discussion transforms content (Git for ideas)

### Professional Standards
- Separation of concerns (CSS in .css files)
- Configuration centralized (no magic numbers)
- Component architecture (maintainable, scalable)
- Type safety (TypeScript throughout)

---

## Key Architectural Decisions

### What We're Avoiding (Narrative Studio Lessons)

❌ **Inline styles everywhere** → CSS in separate files
❌ **Helper functions duplicating CSS** → CSS variables
❌ **Complex nested JSX** → Component isolation
❌ **Inconsistent patterns** → Design system
❌ **Magic numbers in components** → Config files
❌ **Configuration scattered** → Centralized theme

### What We're Building

✅ **Three-panel layout** - Like Narrative Studio's successful design
✅ **Resizable panels** - With localStorage persistence
✅ **Tab system** - Quick context switching
✅ **Light/Dark themes** - Seamless toggle
✅ **Design system** - All values in `theme.ts`
✅ **CSS variables** - Generated from theme
✅ **Component library** - Reusable primitives
✅ **Type safety** - TypeScript + SolidJS

---

## Implementation Checklist

### Step 1: Phase 1 Foundation ✅
- [x] Create project structure
- [x] Design system (`config/theme.ts`)
- [x] CSS architecture (`styles/*.css`)
- [x] TypeScript configuration
- [x] Vite build setup
- [x] Documentation complete

### Step 2: Quick Markdown Fix ⏳
- [ ] Add CDN scripts (marked.js, KaTeX)
- [ ] Create `renderContent()` function
- [ ] Update post display logic
- [ ] Add markdown CSS styles
- [ ] Deploy and test

### Step 3: Component Library
- [ ] Button (primary, secondary, ghost)
- [ ] Input (text, textarea)
- [ ] Card (with variants)
- [ ] Modal/Dialog
- [ ] Toast notifications
- [ ] Avatar
- [ ] Badge
- [ ] Spinner/Loading states

### Step 4: Layout Components
- [ ] AppShell (main wrapper)
- [ ] Header (navigation)
- [ ] Panel (resizable primitive)
- [ ] TabPanel (tab container)
- [ ] Sidebar

### Step 5: Feature Components
- [ ] Post components (Card, Detail, Composer, Meta)
- [ ] Comment components (List, Item, Composer)
- [ ] Synthesis components (Status, VersionHistory, Diff, Approval)
- [ ] Search components (Bar, Results, Filters, TagBrowser)

### Step 6: Pages
- [ ] Dashboard (feed with composer)
- [ ] PostDetailPage (with comments, versions)
- [ ] SearchPage (semantic search interface)
- [ ] ProfilePage
- [ ] SettingsPage

### Step 7: Services & State
- [ ] API client (`services/api.ts`)
- [ ] Auth service (`services/auth.ts`)
- [ ] Post operations (`services/posts.ts`)
- [ ] Search service (`services/search.ts`)
- [ ] State stores (auth, posts, UI)

### Step 8: Polish
- [ ] Keyboard shortcuts
- [ ] Accessibility audit
- [ ] Mobile responsive
- [ ] Performance optimization
- [ ] Animation polish

---

## Decision Point

**What do you want to prioritize now?**

**Option A:** Apply markdown fix (30 min) → Continue backend development
- Fastest path to testing synthesis features
- Current UI works fine for development
- Rebuild frontend in parallel over next few weeks

**Option B:** Start building new frontend now
- Longer before you can test backend
- But sets proper foundation from the start
- More satisfying architecturally

**Option C:** Hybrid - Quick fix now, new frontend in parallel
- Best of both worlds
- Unblocked on both tracks
- Recommended approach

**Your call!** What feels right for where you are in the project?
