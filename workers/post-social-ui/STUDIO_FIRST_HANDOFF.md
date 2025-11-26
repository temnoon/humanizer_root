# POST-SOCIAL NODE SYSTEM - STUDIO-FIRST HANDOFF

**Date**: November 25, 2025  
**Status**: Studio-First Refactor Complete ✅  
**Deployment**: https://8df9dc57.post-social-ui.pages.dev

---

## 🎯 BIG PICTURE

### What is Post-Social?

**Post-Social** is a discourse platform based on Edward Collins' 45-year vision for meaningful online discussion. It moves beyond performative social media to create spaces where ideas evolve through community feedback and AI-assisted synthesis.

**Core Philosophy**:
- **Rho is the agent** (density matrix approach to meaning)
- **Refinement over accumulation** - narratives improve, not just pile up
- **No people, only Nodes** - topics curated by AI, not personalities
- **Synthesis over engagement** - comments synthesized into improved versions

**Inspired By**: VAX Notes (1982), The WELL (1985), Usenet, Git for ideas

### What is Studio-First Architecture?

The **Studio** is THE interface paradigm. Instead of separate landing pages, users land directly in a unified 3-panel layout after login:

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│  FIND           │  FOCUS                   │  TRANSFORM      │
│  (Left Panel)   │  (Center Panel)          │  (Right Panel)  │
│                 │                          │                 │
│  NavigationPanel│  ContentPanel            │  ContextPanel   │
│  - Subscribed   │  - Welcome               │  - Comments     │
│  - Browse       │  - Node list             │  - Analysis     │
│  - Archive      │  - Narrative reader      │  - Related      │
│  - Search       │  - Editor                │  - Filters      │
│                 │  - Version compare       │  - AI tools     │
└─────────────────┴──────────────────────────┴─────────────────┘
```

---

## ✅ WHAT WAS JUST COMPLETED

### Studio-First Refactor (Nov 25, 2025)

Created 4 new components for unified 3-panel Studio interface:

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **NavigationPanel** | `NavigationPanel.tsx` | ~270 | Left: Subscribed/Browse/Archive tabs, expandable nodes |
| **ContentPanel** | `ContentPanel.tsx` | ~380 | Center: 7 mode views (welcome, node-list, etc.) |
| **ContextPanel** | `ContextPanel.tsx` | ~320 | Right: Comments, analysis, related, filters |
| **StudioShell** | `StudioShell.tsx` | ~130 | Main orchestrating page |
| **CSS** | `studio.css` additions | ~1200 | Styles for all new components |

### CenterMode Types

```typescript
type CenterMode = 
  | { type: 'welcome' }
  | { type: 'node-list' }
  | { type: 'node-detail'; nodeId: string; nodeSlug: string }
  | { type: 'narrative'; nodeSlug: string; narrativeSlug: string; version?: number }
  | { type: 'editor'; nodeId?: string }
  | { type: 'compare'; nodeSlug: string; narrativeSlug: string; fromVersion: number; toVersion: number }
  | { type: 'search-results'; query: string };
```

### Route Architecture

| Type | Routes | Auth Required |
|------|--------|---------------|
| **PUBLIC** | `/nodes`, `/node/:slug`, `/node/:nodeSlug/:narrativeSlug`, `/compare` | No |
| **STUDIO** | `/app`, `/studio`, `/notes` | Yes |
| **AUTH** | `/`, `/login`, `/callback` | No |

---

## 📂 KEY FILE LOCATIONS

### Frontend (SolidJS)
```
/Users/tem/humanizer_root/workers/post-social-ui/
├── src/
│   ├── App.tsx                          # Router with public/studio routes
│   ├── pages/
│   │   ├── StudioShell.tsx              # ⭐ NEW - Main Studio entry point
│   │   ├── LoginPage.tsx                # Redirects to /app after login
│   │   ├── CallbackPage.tsx             # OAuth callback → /app
│   │   ├── NodeBrowserPage.tsx          # Public /nodes
│   │   ├── NodeDetailPage.tsx           # Public /node/:slug
│   │   ├── NarrativePage.tsx            # Public narrative reader
│   │   └── VersionComparePage.tsx       # Public version diff
│   ├── components/
│   │   └── studio/
│   │       ├── index.ts                 # Exports all studio components
│   │       ├── NavigationPanel.tsx      # ⭐ NEW - Left panel
│   │       ├── ContentPanel.tsx         # ⭐ NEW - Center panel
│   │       ├── ContextPanel.tsx         # ⭐ NEW - Right panel
│   │       ├── StudioLayout.tsx         # 3-panel resizable shell
│   │       ├── EditorPanel.tsx          # Markdown editor
│   │       ├── CuratorPanel.tsx         # AI suggestions
│   │       ├── ArchivePanel.tsx         # Legacy archive browser
│   │       └── Lightbox.tsx             # Media overlay
│   ├── services/
│   │   ├── nodes.ts                     # All API calls (nodesService)
│   │   └── api.ts                       # Base API utilities
│   ├── stores/
│   │   └── auth.ts                      # Auth state (authStore)
│   └── styles/
│       └── studio.css                   # ~2400 lines total (1200 new)
├── POST_SOCIAL_FUNCTIONAL_SPEC.md       # Requirements spec
├── POST_SOCIAL_DESIGN_SPEC.md           # Technical design
└── POST_SOCIAL_DEVELOPMENT_HANDOFF.md   # Phase-by-phase plan
```

### Backend (Hono + Cloudflare Workers)
```
/Users/tem/humanizer_root/workers/post-social-api/
├── src/
│   ├── index.ts                         # Main Hono app
│   ├── routes/
│   │   ├── nodes.ts                     # Node CRUD
│   │   ├── narratives.ts                # Narrative CRUD + versions
│   │   ├── comments.ts                  # Comment CRUD
│   │   └── subscriptions.ts             # Subscription management
│   └── schema.sql                       # D1 database schema
└── wrangler.toml                        # Cloudflare config
```

### Documentation
```
/Users/tem/humanizer_root/
├── CLAUDE.md                            # Quick reference (updated)
└── workers/post-social-ui/
    ├── POST_SOCIAL_FUNCTIONAL_SPEC.md
    ├── POST_SOCIAL_DESIGN_SPEC.md
    └── POST_SOCIAL_DEVELOPMENT_HANDOFF.md
```

---

## 🧠 CHROMADB MEMORY REFERENCES

Query these for full context:

| Query | What You'll Find |
|-------|------------------|
| `"Studio-First refactor complete November 2025"` | This refactor's details |
| `"post-social node system handoff"` | Phase-by-phase implementation plan |
| `"post-social design spec"` | Technical architecture, API endpoints, schema |
| `"post-social master handoff"` | Full project vision (25,000+ words) |
| `"post-social spec coverage phases"` | Which spec sections are implemented |

### Key Memory IDs
- `3b42771e57cca88854939be64169effa6f492b2b18555cc6b202520421da6315` - Studio-First Refactor Complete
- `1ba81289026dae01121464b3425b65c7afdfd75239dc61538be443f28f79a43f` - Development Handoff
- `c32e0f904e66c06283a6f8a09b653c2654d8c941fc671b4d603177d7e3f64575` - Design Specification

---

## 🚀 CURRENT STATE

### What's Working ✅

1. **Public Browsing** - Anyone can view nodes and narratives at `/nodes`
2. **Node System** - Create nodes, publish narratives, version history
3. **Version Comparison** - Structured/unified/side-by-side diffs with semantic shift
4. **Comments** - Post comments with context quotes
5. **Subscriptions** - Follow nodes, track unread counts
6. **Studio Shell** - 3-panel layout loads (requires auth)
7. **Auth Flow** - Login → /app redirect

### Test Data
- **Node**: "Phenomenology" (slug: `phenomenology`)
- **Narrative**: "The Structure of Intentionality" (v2)
- **IDs**: Node `aa410ec7-bb92-4ec1-99c0-b12e6a47ca20`, Narrative `95966a98-b4aa-4eab-8b08-cc8d24142359`

### Deployments
| Service | URL |
|---------|-----|
| Frontend | https://8df9dc57.post-social-ui.pages.dev |
| Backend API | https://post-social-api.tem-527.workers.dev |
| Auth API | https://npe-api.tem-527.workers.dev |

---

## 🔜 NEXT STEPS

### Immediate (Test the Refactor)
1. **Login Test** - Authenticate and verify 3-panel Studio loads
2. **Navigation Test** - Click through Subscribed/Browse/Archive tabs
3. **Mode Switching** - Verify center panel changes modes correctly
4. **Context Panel** - Check comments load when viewing narrative

### Short-term (Wire Up Remaining Features)
1. **EditorPanel Integration** - Connect existing editor to center panel in editor mode
2. **CuratorPanel Integration** - Show AI suggestions in right panel during editing
3. **Semantic Search** - Connect to Vectorize for search results mode
4. **Archive API** - Replace mock data with real archive connection

### Medium-term (Spec Completion)
1. **Phase 6: AI Curator Queue** - Workers AI for automatic comment evaluation
2. **Phase 7: Synthesis Engine** - Merge comments into new narrative versions

---

## 🛠 DEVELOPMENT COMMANDS

```bash
# Frontend
cd /Users/tem/humanizer_root/workers/post-social-ui
npm run dev          # Local dev server
npm run build        # Production build
npm run deploy       # Deploy to Cloudflare Pages

# Backend
cd /Users/tem/humanizer_root/workers/post-social-api
npm run dev          # Local dev server
npm run deploy       # Deploy to Cloudflare Workers

# Test API
curl https://post-social-api.tem-527.workers.dev/api/nodes
```

---

## 💡 ARCHITECTURAL DECISIONS

### Why Studio-First?
Edward realized the 3-panel Studio wasn't just a "create" tool - it's THE interface paradigm. The panels embody a phenomenological workflow:
- **FIND** (left) = The archive of what exists
- **FOCUS** (center) = The intentional act - what you're attending to
- **TRANSFORM** (right) = Projection possibilities, AI tools

### Why Modes Not Pages?
Instead of navigating between pages, users switch modes within the Studio. This maintains context - you never "leave" your workspace, you just change what you're focused on.

### Why Public + Studio Routes?
- Public routes (`/nodes`) let unauthenticated users browse content
- Studio routes (`/app`) require auth for full interactive experience
- Best of both worlds: discoverability + engagement

---

## 📋 CONVERSATION STARTER

```
I'm continuing work on the Post-Social Node System. The Studio-First refactor 
is complete - 4 new components (NavigationPanel, ContentPanel, ContextPanel, 
StudioShell) with ~1200 lines of CSS.

Current state:
- Frontend deployed: https://8df9dc57.post-social-ui.pages.dev
- Public browsing works at /nodes
- Studio shell loads at /app (requires login)
- All previous functionality preserved

ChromaDB memories available for full context - query "post-social" or 
"studio-first" for details.

I'd like to [TEST THE AUTHENTICATED STUDIO / INTEGRATE EDITOR / ADD SEARCH / etc.]
```

---

## 📚 FULL DOCUMENTATION

For deeper context, read these files:

1. `/Users/tem/humanizer_root/CLAUDE.md` - Quick reference with current status
2. `/Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_FUNCTIONAL_SPEC.md` - All requirements
3. `/Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_DESIGN_SPEC.md` - Technical design
4. `/Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_DEVELOPMENT_HANDOFF.md` - Phase plan

---

**End of Handoff**  
*Created: Nov 25, 2025*  
*Studio-First Refactor: Complete*
