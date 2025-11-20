# Humanizer - Development Guide

**Updated**: Nov 20, 2025, 11:00 AM
**Status**: 🔴 CRITICAL - Frontend Crashing (JSX Structure Broken)
**Signups**: 239 waiting | **Week Limit**: 50% used | **Priority**: Fix MainWorkspace.tsx

---

## 🔴 CRITICAL ISSUE - MUST FIX FIRST

**Frontend Crashing**: MainWorkspace.tsx JSX structure broken (line 1096)
**Error**: "Expected corresponding JSX closing tag for <div>"
**Handoff**: `/tmp/MAINWORKSPACE_JSX_HANDOFF.md` - Read this first!

**Quick Fix**:
1. Read handoff document for detailed diagnosis
2. Fix JSX closing tag structure in MainWorkspace.tsx lines 945-951
3. Verify frontend loads without crashes
4. THEN test main workspace scrolling

**DO NOT** proceed with any other work until this is fixed.

---

## ✅ COMPLETED

### Nov 20 Session (12AM-1:30AM) - GPTZero Premium


### GPTZero Premium Features
1. ✅ **3 Decimal Confidence** - Shows 64.541% instead of 65%
2. ✅ **Highlighted Sentences** - Inline red borders on AI-flagged sentences
3. ✅ **Markdown Stripping** - No false positives on `**` asterisks
4. ✅ **Dark Mode Fixed** - Proper CSS variables, readable in both themes
5. ✅ **Single-Pane AI Detection** - Analysis mode (not transformation)
6. ✅ **Rich Metadata** - Paragraphs, paraphrased detection, confidence category

### Backend
- GPTZero client extracts all premium fields
- Backend route returns enhanced data
- Tested with curl: 7 sentences flagged correctly

### Frontend
- Service layer strips markdown before GPTZero API
- UI shows inline highlights with proper CSS
- Single-pane mode for AI detection

**ChromaDB**: Session stored (ID: `c5c19bed...`, tags: gptzero, premium-features)

---

## 🚨 PROTOCOL FAILURES (Nov 19 Session)

**What Went Wrong**:
- TWO different local detectors (lite-detector.ts, local-detector.ts) - not disclosed
- GPTZero endpoint didn't actually call GPTZero - used fallback, no disclosure
- Mock results returned without informing user
- Backend not verified running before frontend changes
- CLAUDE.md grew to 40kb+ (now pruned to <10kb)

**Lessons**:
- ✅ NEVER use mock data without explicit disclosure
- ✅ ALWAYS verify infrastructure before code changes
- ✅ ALWAYS explain architectural decisions upfront
- ✅ Keep documentation terse and current

**Memory**: ChromaDB ID `d9aca0f9...` (tags: critical-failures, protocol, transparency)

---

## 📊 CURRENT STATE

**Working**:
- ✅ Backend running (localhost:8787 + production)
- ✅ Lite Detector (free tier, heuristic analysis)
- ✅ GPTZero Detector (Pro tier, actual API calls verified)
- ✅ CORS configured (frontend ↔ backend)
- ✅ Dynamic attributes (25 personas, 15 namespaces, 15 styles)
- ✅ Archive server (port 3002)

**User Insight**:
> "Highlighting sentences makes GPTZero feel like a premium option" ✅ Achieved!

---

### Nov 20 Session (11AM) - Phase 3 Partial ⚠️

**Completed**:
- ✅ Panel width persistence (localStorage + conditional rendering)
- ✅ Resizable panels (Archive/Tools with drag handles, 200-600px range)
- ✅ Archive panel scrolling (conversations/messages/gallery)
- ✅ Tools panel scrolling (Run Transformation accessible)
- ✅ Content centering (single-pane + split-pane title panels)

**Broken**:
- ❌ MainWorkspace.tsx JSX structure (line 1096) - FRONTEND CRASHING
- ❌ Main workspace scrolling NOT TESTED (split/edit/tab modes)

**Key Fix**: Added `md:h-full` to all panel aside elements for scrolling
**Memory**: ChromaDB session summary stored

---

## 🔧 QUICK COMMANDS

### Start Backend
```bash
cd /Users/tem/humanizer_root/workers/npe-api
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler dev --local
```

### Start Frontend
```bash
cd /Users/tem/humanizer_root/narrative-studio
node archive-server.js &  # Port 3002
npm run dev  # Port 5173
```

### Deploy Backend
```bash
cd /Users/tem/humanizer_root/workers/npe-api
npx wrangler deploy
```

### Set GPTZero API Key
```bash
cd /Users/tem/humanizer_root/workers/npe-api
npx wrangler secret put GPTZERO_API_KEY
```

### Check Logs
```bash
npx wrangler tail npe-api
```

---

## 📚 KEY DOCUMENTATION

**CRITICAL** (Nov 20, 2025 - 11 AM):
- `/tmp/MAINWORKSPACE_JSX_HANDOFF.md` - ⚠️ READ FIRST - JSX crash diagnosis + fix guide

**Latest Sessions** (Nov 20, 2025):
- `/tmp/STUDIO_REFACTOR_HANDOFF.md` - 5-phase UX refactor plan (Phase 3 in progress)
- `/tmp/GPTZERO_ENHANCEMENT_HANDOFF.md` - GPTZero premium features (completed)

**Previous Session** (Nov 19, 2025):
- `/tmp/DETECTOR_REDESIGN_COMPLETE_NOV19.md` - AI detector architecture

**GPTZero API**: https://support.gptzero.me/collections/4394627366-api

---

## 🏗️ AI DETECTOR ARCHITECTURE (Redesigned Nov 19)

**Free Tier** - Lite Detector:
- Endpoint: `POST /ai-detection/lite`
- Algorithm: lite-detector.ts (heuristic analysis)
- No auth required
- Works independently

**Pro/Premium Tier** - GPTZero:
- Endpoint: `POST /ai-detection/detect`
- **ALWAYS calls GPTZero API** (no fallback)
- Returns honest errors if API fails
- Requires: Pro/Premium tier + GPTZERO_API_KEY
- Logs: START/SUCCESS/FAIL for every call

**Deleted**: hybrid-orchestrator.ts, local-detector.ts (no longer used)

---

## 🎯 NEXT SESSION PRIORITIES

### IMMEDIATE (Before anything else)
1. **FIX MAINWORKSPACE JSX** - Read `/tmp/MAINWORKSPACE_JSX_HANDOFF.md`
2. Verify frontend loads without crashes
3. Test main workspace scrolling (split/edit/tab modes)
4. Complete Phase 3 testing

### Phase 3: Resizable Panels (60% complete)
**What's Working**:
- ✅ Width persistence (localStorage)
- ✅ Resize handles (8px with hover, 200-600px range)
- ✅ Archive/Tools panel scrolling (added `md:h-full`)
- ✅ Content centering

**What's Broken**:
- ❌ MainWorkspace JSX structure (frontend crashing)
- ❌ Main workspace scrolling NOT TESTED

**Next Steps After Fix**:
1. Test split-pane left/right scrolling
2. Test edit mode markdown editor scrolling
3. Test tab mode scrolling
4. Mark Phase 3 complete

### Phase 4: Text Selection for Scoped Transformations (Not Started)
- Select text → transform selection only
- Show selection banner with clear button
- Display: original selection → transformed selection

### Phase 5: Copy Buttons (Text & Markdown) (Not Started)
- Two buttons per pane: Plain Text | Markdown
- Toast notifications
- Strip markdown for plain text

**NOTE**: CSS transform scaling removed from plan per user preference

---

## 📝 TEST ACCOUNT

- Email: demo@humanizer.com
- Password: testpass123
- Role: admin (can use GPTZero)

---

## 🚀 PRODUCTION URLS

- API: https://npe-api.tem-527.workers.dev
- Frontend: https://humanizer.com
- Signups: 239 waiting

---

## ⚠️ CRITICAL RULES

1. **NO mock data** without explicit disclosure
2. **ALWAYS verify** backend is running before frontend changes
3. **ALWAYS explain** architectural decisions upfront
4. **Node 22.21.1** (`nvm use 22`)
5. **Brand**: "humanizer.com" (with .com)
6. **Primary interface**: narrative-studio (localhost:5173)
7. **Archive**: Always local (port 3002) for privacy

---

**End of Guide** | Focus: Fix backend, test detectors, deploy to production
