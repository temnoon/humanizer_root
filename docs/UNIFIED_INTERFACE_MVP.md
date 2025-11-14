# Humanizer Unified Interface - MVP Specification

**Date**: November 14, 2025
**Version**: MVP (Minimum Viable Product)
**Status**: 🎯 Ready for Implementation

---

## Scope: Interface Changes Only (No AUI/Chat)

**Goal**: Combine the best visual/UX elements of humanizer.com and Workbench into a single, clean interface.

**Deferred to Future**: Agentic chat interface (see `future-development/UNIFIED_INTERFACE_FULL_SPEC.md`)

---

## 1. MVP Requirements

### 1.1 Automatic Theme Switching ✅
- System preference detection (light/dark mode)
- Manual toggle (sun/moon icon)
- humanizer.com visual style (CSS variables + gradient branding)
- Smooth transitions

### 1.2 Responsive Layout ✅
**Desktop (≥1024px)**: 3-column grid
```
┌─────────────────────────────────────────┐
│ Header: Logo | Tools | User | Theme    │
├───────┬─────────────────────┬───────────┤
│ Arch- │      Canvas         │   Tool    │
│ ive   │   (Shared Text)     │  Config   │
│  or   │                     │    +      │
│ Hist- │                     │ Results   │
│ ory   │                     │           │
└───────┴─────────────────────┴───────────┘
```

**Tablet (768-1023px)**: 2-column
```
┌─────────────────────────────────────────┐
│ Header (Compact)                        │
├─────────────────────┬───────────────────┤
│      Canvas         │   Tool Panel      │
└─────────────────────┴───────────────────┘
[Archive accessible via slide-in]
```

**Mobile (<768px)**: Symmetric navigation
```
┌─────────────────────────────────┐
│ [☰ Menu] Logo [🔧 Tools]       │
├─────────────────────────────────┤
│         Canvas                  │
│      (Full Width)               │
└─────────────────────────────────┘
```

### 1.3 Navigation Style
- **Desktop**: Top horizontal tabs (humanizer.com style)
- **Mobile**: Symmetric dual-button (☰ left, 🔧 right)
- **Active tool**: Purple background highlight

---

## 2. What We're Keeping from Each Frontend

### From humanizer.com ✅
- Top navigation tabs (obvious, familiar)
- CSS variable theming system
- Automatic light/dark mode
- Full-page view switching
- Gradient brand logo

### From Workbench ✅
- 3-column spatial layout (desktop)
- Shared canvas context (CanvasContext.tsx)
- Tailwind CSS styling
- Tool registry system
- Mobile sliding panels (improved)
- Modern build tooling (Vite, TypeScript, testing)

---

## 3. Key Changes from Current Workbench

### 3.1 Navigation Changes

**Before** (Workbench):
- Tools in right panel (vertical stack)
- Subtle, requires discovery

**After** (MVP):
- Tools in top nav bar (horizontal tabs)
- Obvious, familiar pattern
- Active tool highlighted

### 3.2 Mobile Navigation Changes

**Before** (Workbench - Asymmetric):
```
[≡] Logo
               [🔵 FAB] ← Cryptic blue button bottom-right
```

**After** (MVP - Symmetric):
```
[☰ Menu] Logo [🔧 Tools]  ← Clear, balanced
```

**Benefits**:
- ✅ Symmetric (visually balanced)
- ✅ Both buttons obvious (menu + tools)
- ✅ Consistent mental model
- ❌ Removed confusing FAB

### 3.3 Theme System

**Add from humanizer.com**:
```css
/* CSS Variables for theming */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --accent-purple: #8b5cf6;
  --accent-cyan: #06b6d4;
}

[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
}
```

**Keep from Workbench**:
- Tailwind utility classes for layout
- Responsive breakpoints (md:, lg:)

---

## 4. File Structure

```
cloud-workbench/
├── src/
│   ├── app/
│   │   └── layout/
│   │       └── UnifiedLayout.tsx  ← NEW (replaces WorkbenchLayout)
│   ├── core/
│   │   ├── tool-registry.tsx      ← Keep (3 working tools)
│   │   └── context/
│   │       └── CanvasContext.tsx  ← Keep
│   ├── features/
│   │   ├── panels/                ← Keep (Computer Humanizer, Allegorical, AI Detection)
│   │   ├── canvas/                ← Keep
│   │   └── archive/               ← Keep
│   ├── components/
│   │   └── ui/
│   │       └── ThemeToggle.tsx    ← NEW (sun/moon icon)
│   └── styles/
│       └── theme-variables.css    ← NEW (CSS vars from humanizer.com)
```

---

## 5. Implementation Steps

### Step 1: Theme System (1-2 hours)
1. Create `theme-variables.css` with CSS variables
2. Create `ThemeToggle.tsx` component (sun/moon button)
3. Implement system preference detection
4. Test light/dark mode switching

### Step 2: Navigation Layout (2-3 hours)
1. Create `UnifiedLayout.tsx` with top nav bar
2. Move tool tabs to header (horizontal)
3. Update tool-registry to show in nav
4. Test tool switching

### Step 3: Mobile Navigation (2-3 hours)
1. Add symmetric header buttons (☰ Menu | 🔧 Tools)
2. Update mobile panel slide-in logic
3. Remove bottom-right FAB
4. Test on mobile devices

### Step 4: Styling Polish (1-2 hours)
1. Apply humanizer.com gradient logo
2. Update active tab styling (purple highlight)
3. Ensure consistent spacing
4. Test across screen sizes

### Step 5: Testing & Deployment (1 hour)
1. Test all 3 tools (Computer Humanizer, Allegorical, AI Detection)
2. Test theme switching
3. Test responsive breakpoints
4. Build and deploy

**Total Time**: 7-11 hours (1-2 days)

---

## 6. What's NOT in MVP (Future Development)

❌ **Deferred to Future**:
- Agentic chat interface at bottom
- UI tutorial/highlighting system
- BYOK (Bring Your Own Key)
- Chat ↔ transformations integration
- Voice input/output

**Why**: These are "Maximal Viable Product" features. MVP focuses on clean, working interface first.

**Reference**: See `future-development/UNIFIED_INTERFACE_FULL_SPEC.md` for complete vision.

---

## 7. Success Criteria for MVP

### Must Have ✅
1. ✅ Automatic light/dark mode working
2. ✅ 3-column layout on desktop
3. ✅ 2-column on tablet
4. ✅ Symmetric mobile navigation
5. ✅ Top nav tabs for tools
6. ✅ All 3 tools working (Computer Humanizer, Allegorical, AI Detection)
7. ✅ Responsive at all breakpoints

### Nice to Have 🎯
- Smooth transitions between themes
- Gradient logo animation
- Mobile swipe gestures
- Keyboard shortcuts (Tab, Esc)

### Out of Scope ❌
- Chat interface
- Tutorial system
- BYOK
- Voice features

---

## 8. Design Mockups

### Desktop Layout
```
┌────────────────────────────────────────────────────────────┐
│ humanizer.com  [🖥️ Computer] [🌟 Allegorical] [🔍 AI]     │
│                    user@email.com [☀️] [❓] [Logout]      │
├──────────┬────────────────────────────┬────────────────────┤
│          │                            │                    │
│ 🗄️       │                            │ 🖥️ Computer       │
│ Archive  │       Canvas               │    Humanizer       │
│          │    (Active Text)           │                    │
│ ───────  │                            │ Intensity: [──●─]  │
│          │                            │                    │
│ 📚       │                            │ ☑ LLM polish       │
│ History  │                            │                    │
│          │                            │ [Humanize Text]    │
│          │                            │                    │
│          │                            │ ──────────────     │
│          │                            │ Results:           │
│          │                            │ AI: 71% → 32% ✅   │
└──────────┴────────────────────────────┴────────────────────┘
```

### Mobile Layout
```
┌──────────────────────────┐
│ [☰]  humanizer.com  [🔧]│
├──────────────────────────┤
│                          │
│                          │
│        Canvas            │
│     (Full Width)         │
│                          │
│                          │
│                          │
│                          │
└──────────────────────────┘
```

---

## 9. Technical Decisions

### Styling Approach
**Hybrid**: Tailwind + CSS Variables
- Tailwind for layout, responsive, utilities
- CSS variables for theme colors, spacing
- Best of both worlds

### State Management
**Shared Canvas Context** (keep current approach)
```typescript
<CanvasProvider>
  <Canvas />
  <ToolPanels />
</CanvasProvider>
```

### Routing
**No routing changes** (keep state-based for now)
- Can add React Router later if needed
- MVP doesn't require URL-based routing

---

## 10. Model Configuration Update

### Current Default
```typescript
// workers/npe-api/src/services/ai-service.ts
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
```

### New Default (Requested)
```typescript
const DEFAULT_MODEL = '@cf/meta/llama-3-70b-instruct';
```

**Why Llama 70B**:
- ✅ Faster than expected (Cloudflare optimized)
- ✅ Smarter responses (70B vs 8B parameters)
- ✅ Still free tier on Workers AI
- ✅ Better for complex transformations

**Files to Update**:
1. `workers/npe-api/src/services/ai-service.ts`
2. `workers/npe-api/src/routes/transformations.ts` (if hardcoded)
3. Any tool-specific model configs

---

## 11. Deployment Plan

### Phase 1: Build & Test Locally
```bash
cd /Users/tem/humanizer_root/cloud-workbench
npm run build
npm run preview  # Test production build
```

### Phase 2: Deploy to Cloudflare Pages
```bash
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler pages deploy dist --project-name=workbench --commit-dirty=true
```

### Phase 3: Update Backend Model
```bash
cd /Users/tem/humanizer_root/workers/npe-api
# Update model config
npx wrangler deploy
```

### Phase 4: Test End-to-End
- Visit deployed URL
- Test all 3 tools
- Test theme switching
- Test mobile layout

---

## 12. Rollback Plan

**If issues occur**:
1. Previous workbench deployment: `https://7d97338a.workbench-4ec.pages.dev`
2. Git tag current state: `git tag mvp-attempt-1`
3. Can revert changes: `git reset --hard HEAD~1`

---

## 13. Next Session Checklist

**Start with**:
1. Read `/tmp/SESSION_HANDOFF_NOV_14.md` ⭐ **READ FIRST**
2. Review this MVP spec
3. Check git status (should be clean)
4. Review deployed URLs

**Then begin**:
1. Create `UnifiedLayout.tsx`
2. Implement theme system
3. Update navigation
4. Test and deploy

---

## 14. Files Reference

**Key Files**:
- `/Users/tem/humanizer_root/cloud-workbench/src/app/layout/WorkbenchLayout.tsx` - Current layout (replace with UnifiedLayout)
- `/Users/tem/humanizer_root/cloud-workbench/src/core/tool-registry.tsx` - Tool definitions (update for top nav)
- `/Users/tem/humanizer_root/cloud-frontend/src/App.tsx` - Reference for humanizer.com navigation style
- `/Users/tem/humanizer_root/docs/future-development/UNIFIED_INTERFACE_FULL_SPEC.md` - Full vision (future)

**Documentation**:
- `/tmp/TOOL_TESTING_RESULTS.md` - Today's testing results
- `/tmp/FRONTEND_COMPARISON_REPORT.md` - Detailed comparison analysis
- `/tmp/COMPUTER_HUMANIZER_DEPLOYED_HANDOFF.md` - Computer Humanizer implementation

---

**End of MVP Spec**

**Estimated Time**: 7-11 hours (1-2 days)
**Complexity**: Medium (UI changes only, no new features)
**Risk**: Low (keeping working backend, just changing presentation)
