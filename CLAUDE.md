# Humanizer - Development Guide

**Last Updated**: Nov 12, 2025, 3:30 PM - ⚠️ **CONVERSATION ARCHIVE 98% COMPLETE**
**Status**: ✅ All features working EXCEPT images not rendering (needs debug)
**Latest**: Node 22.21.1, Wrangler 4.47.0, React 19, Vite 7.2
**Test Account**: demo@humanizer.com (password: testpass123, role: PRO)
**Production API**: https://npe-api.tem-527.workers.dev (Version: 444dbdfb) ✅
**Humanizer.com**: https://b1a96ffa.npe-cloud.pages.dev
**Workbench**: https://e3b34275.workbench-4ec.pages.dev ✅

## ⚠️ CONVERSATION ARCHIVE - DEBUGGING IMAGES (Nov 12, 3:30 PM)

**Status**: 98% Complete - Images not rendering, extensive debugging added

**What Works** ✅:
- Folder upload (drag-and-drop & button with webkitdirectory)
- Conversation formatting in Canvas (beautiful markdown)
- Media files hidden from list (clean UI)
- Encrypted data protection (no garbage in Canvas)
- Environment-aware archive (local vs cloud)

**What's Broken** ❌:
- Images show as `[Image: file-XXX]` placeholders instead of actual images
- Added extensive console logging to diagnose

**Debug Next Session**:
1. Load conversation with browser console open (F12)
2. Check these logs:
   - `Found X image files` - should be > 0
   - `✅ Mapped image: file-XXX` - should appear per image
   - `📷 Message has X image placeholders` - should match
   - `✅ Replaced placeholder` - should appear per image
3. Look for warnings to identify root cause:
   - `⚠️ Could not extract file-id from...`
   - `⚠️ No data URL found for...`
   - `⚠️ Images found but imageMap is empty`

**Likely Issues**:
- parent_file_id mismatch
- file_role not set correctly
- File-ID extraction regex failure
- Placeholder format mismatch

**Handoff**: `/tmp/CONVERSATION_ARCHIVE_DEBUG_HANDOFF.md`

---

## 🎯 ARCHITECTURE OVERVIEW

**3-Tier Privacy Model**:
1. **Archive (Zero-Knowledge)** - Uploaded conversations/files, encrypted, we can't read
2. **Active Workspace (Server-Side)** - Current transformations, for features (search, filter)
3. **Optional "Archive Transformation"** - User moves old work to encrypted storage

**What's Auditably True**:
- ✅ "Archive files are zero-knowledge encrypted" (AES-256-GCM, client-side)
- ✅ "Password never transmitted" (PBKDF2 key derivation, 100k iterations)
- ✅ "Metadata visible for browsing" (title, date, message count)
- ✅ "Content encrypted and unreadable" (messages, images, all file content)
- ✅ "We cannot decrypt your files" (no keys stored server-side)

---

## 🚀 PRODUCTION URLS

- **API**: https://npe-api.tem-527.workers.dev (api.humanizer.com)
- **Frontend**: https://humanizer.com (npe-cloud.pages.dev)
- **Workbench**: https://workbench.humanizer.com (workbench-4ec.pages.dev)
- **Archive**: Left panel in workbench (🗄️ Archive tab)

**Signups**: 73 organic users ready for launch!

---

## 🔧 QUICK COMMANDS

### Deploy Backend
```bash
cd /Users/tem/humanizer_root/workers/npe-api
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler deploy
```

### Deploy Workbench
```bash
cd /Users/tem/humanizer_root/cloud-workbench
npm run build
npx wrangler pages deploy dist --project-name=workbench --commit-dirty=true
```

### Apply Migration
```bash
cd /Users/tem/humanizer_root/workers/npe-api
npx wrangler d1 execute npe-production-db --remote --file=migrations/0016_conversation_files.sql
```

### Check Logs
```bash
npx wrangler tail npe-api
```

---

## 🐛 ACTIVE BUGS

**NONE** - All blocking bugs resolved! 🎉

---

## 🔧 KNOWN ISSUES (Non-Blocking)

1. 📱 **Mobile UI**: Button overflow in header, responsive panes need work (cosmetic)
2. 🎨 **Theme Detection**: No auto-sensing light/dark mode yet (nice-to-have)
3. 📦 **Custom Domain Cache**: workbench.humanizer.com may show stale version
4. ❌ **Migration 0013 Failed**: narrative_id column conflict (future feature)

---

## ✅ RECENTLY RESOLVED

- ~~Admin Metrics 500 Error~~: Fixed SQL queries (Nov 12, 9AM) ✅
- ~~V2 Fake Quantum Science~~: Removed dishonest terminology (Nov 12, 5:30 AM) ✅
- ~~Workbench Broken~~: All 7 panels working with V1 (Nov 12, 5:30 AM) ✅
- ~~Personalizer 404~~: Fixed frontend + backend (Nov 12, 5:30 AM) ✅
- ~~WebAuthn Issues~~: v13 compatibility fixed (Nov 8) ✅
- ~~XSS Vulnerability~~: DOMPurify sanitization (Nov 8) ✅
- ~~Password Hashing~~: PBKDF2 with 100k iterations (Nov 8) ✅

---

## 📚 CRITICAL DOCUMENTS

**Latest Handoff** ⭐:
- `/tmp/CONVERSATION_ARCHIVE_HANDOFF.md` (Nov 12, 3PM) - This session

**Previous Handoffs**:
- `/tmp/ADMIN_DEPLOYMENT_HANDOFF.md` (Nov 12, 7AM) - Admin system
- `/tmp/WORKBENCH_V1_FIXES_HANDOFF.md` (Nov 12, 5:30 AM) - Workbench fixes
- `/tmp/QUANTUM_REALITY_CHECK_HANDOFF.md` (Nov 12, 4AM) - V2 discovery

**Technical Debt**: `workers/npe-api/TECHNICAL_DEBT.md` (6,000+ words)
**MVP Spec**: `docs/MVP_FUNCTIONAL_SPEC.md` (678 lines)
**V1/V2 Comparison**: `docs/V1_V2_COMPARISON_AND_STRATEGY.md`

---

## 📊 CHROMADB MEMORIES (Recent Sessions)

Store new memories:
```
Launch memory-agent and store "[description]" with tags: "session,date,feature"
```

Recall:
```
Launch memory-agent and recall "[topic]" from [timeframe]
```

**Latest**:
- Conversation Archive System (Nov 12, 3PM) - This session
- Admin System Deployment (Nov 12, 7AM)
- Workbench V1 Fixes (Nov 12, 5:30 AM)
- Quantum Reality Check (Nov 12, 4AM)
- Narrative Sessions Architecture (Nov 12, 2AM)

---

## 🚨 CRITICAL RULES

1. **NEVER `metadata`** → use `custom_metadata` (SQLAlchemy reserved)
2. **ALWAYS SQLAlchemy 2.0** (`select()`, async, no `query()`)
3. **ALWAYS Poetry** (`poetry run`, not global Python)
4. **ALWAYS CSS variables** - Use --bg-*, --text-*, --accent-*
5. **Claude model**: `claude-haiku-4-5-20251001` (Haiku 4.5)
6. **Trailing slash**: FastAPI endpoints need trailing slash
7. **npx wrangler**: Never global wrangler (use npx)
8. **JWT_SECRET**: Set via `wrangler secret put` (not in wrangler.toml)
9. **CORS**: Must include production domains in Workers config
10. **Node 22**: Always use Node 22.21.1 (use nvm)

---

## 🎯 NEXT SESSION TODO

1. **Deploy Workbench** (10 min):
   ```bash
   cd /Users/tem/humanizer_root/cloud-workbench
   npm run build  # Should succeed now
   npx wrangler pages deploy dist --project-name=workbench
   ```

2. **Test Folder Upload** (15 min):
   - Upload ChatGPT export folder
   - Verify: HTML skipped, images encrypted, metadata displayed
   - Check: Provider badge, message count, first message preview

3. **Build ConversationViewer** (2-3 hours):
   - Reuse Canvas.tsx rendering (markdown, LaTeX, tables)
   - Add: Decrypt images on load, create object URLs
   - Replace: `[Image: file-XXX]` → `<img src={objectURL}>`

4. **Integration** (1 hour):
   - If file_role === 'conversation': Show ConversationViewer
   - Else: Load to Canvas as text

---

**End of Guide** | Ready for next session! 🚀
