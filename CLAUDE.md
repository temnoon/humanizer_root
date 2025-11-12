# Humanizer - Development Guide

**Last Updated**: Nov 12, 2025, 3:00 PM - ✅ **CONVERSATION ARCHIVE BUILT**
**Status**: ✅ Folder upload complete, needs deployment & ConversationViewer
**Latest**: Node 22.21.1, Wrangler 4.47.0, React 19, Vite 7.2
**Test Account**: demo@humanizer.com (password: testpass123, role: PRO)
**Production API**: https://npe-api.tem-527.workers.dev (Version: 12f26984) ✅
**Humanizer.com**: https://b1a96ffa.npe-cloud.pages.dev
**Workbench**: https://workbench.humanizer.com (pending deployment)

## ✅ CONVERSATION ARCHIVE SYSTEM (Nov 12, 3PM)

**COMPLETE**: Encrypted conversation archive with folder upload for ChatGPT/Claude exports

**Features Built**:
- 📁 Folder upload (webkitdirectory) - Select entire ChatGPT export folders
- 🔍 Auto-parser - Detects ChatGPT vs Claude format, extracts metadata
- 🔒 Zero-knowledge - All files (JSON + images) encrypted client-side (AES-256-GCM)
- 🔗 Parent-child linking - Images linked to conversations via parent_file_id
- 🎨 Beautiful UI - Provider badges, message counts, first message preview
- 🗑️ HTML filtering - Skips .html files automatically (saves space)

**Database Schema** (3 migrations):
- 0014: Base encrypted archive (encrypted_files, user_encryption_settings, R2)
- 0015: Conversation metadata (title, provider, message_count, has_images, first_message)
- 0016: File relationships (parent_file_id, file_role, relative_path)

**Status**:
- ✅ Backend deployed (Version 12f26984-20fe-4ef4-9ff7-9b0db831443b)
- ⏳ Frontend: Build errors fixed, ready to deploy
- ⏳ Next: Deploy workbench, build ConversationViewer with encrypted images

**Files Created** (~1,500 lines):
- `cloud-workbench/src/lib/conversation-parser.ts` (280 lines)
- `cloud-workbench/src/features/panels/archive/*.tsx` (4 components, ~900 lines)
- `workers/npe-api/migrations/001{4,5,6}_*.sql` (3 migrations)

**Testing Checklist**: `/tmp/CONVERSATION_ARCHIVE_HANDOFF.md`

**Next Session**:
1. Build/deploy workbench: `npm run build && npx wrangler pages deploy`
2. Test folder upload with real ChatGPT export
3. Build ConversationViewer (reuse Canvas.tsx rendering + decrypt images)

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
