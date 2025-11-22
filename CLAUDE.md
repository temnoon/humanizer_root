# Humanizer - Development Guide

**Updated**: Nov 22, 2025, Late Evening (Final Session)
**Status**: ✅ Backend Complete | ⚠️ Frontend 70% (3 bugs to fix)
**Signups**: 239 waiting

---

## ✅ COMPLETED (Nov 22 Late Evening - Final Session)

### Phase 1 - PRODUCTION READY ✅
- ✅ Smart sentence splitting (period+quote, domains/URLs)
- ✅ Role-based token limits (admin: 50k, premium: 20k, pro: 10k, member: 5k, free: 2k)
- ✅ Markdown structure preservation (paragraphs, lists, bold, italic, links)
- ✅ Integrated into Persona + Style transformations

### Phase 2 Backend - 100% WORKING ✅
- ✅ Multi-pass position mapping (handles nested markdown: `**bold _italic_**`)
- ✅ `detectWithLiteMarkdown()` returns `highlightedMarkdown` with `<mark>` tags
- ✅ API tests all passing (nested, links, code, multiple types)
- ✅ Frontend integrated (MarkdownRenderer, CSS for `<mark>` tags)

### Phase 2 Frontend - 3 BUGS REMAIN ⚠️
- ✅ Markdown DOES render (bold, italic, headers, paragraphs)
- ❌ Bug 1: Highlights not visible (Lite) - check CSS `.markdown-content mark`
- ❌ Bug 2: Plain text block (GPTZero) - needs markdown wrapper like Lite
- ❌ Bug 3: Detection persists on navigation - need `useEffect` to clear state

**Handoffs**:
- `/tmp/MARKDOWN_COMPLETE_HANDOFF_NOV22_LATE.md` **← START HERE NEXT SESSION**
- `/tmp/MARKDOWN_PRESERVATION_HANDOFF_NOV22.md` (Phase 1 reference)
- `/tmp/MARKDOWN_PHASE2_HANDOFF_NOV22_EVENING.md` (Phase 2 reference)

---

## 🔧 QUICK COMMANDS

### Start Backend (Local with Ollama)
```bash
cd /Users/tem/humanizer_root/workers/npe-api
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler dev --local  # IMPORTANT: --local flag required for Ollama
```

### Verify Ollama Running
```bash
curl http://localhost:11434/api/tags  # Should list qwen3, mistral models
ollama list  # Show installed models
```

### Start Frontend
```bash
cd /Users/tem/humanizer_root/narrative-studio
node archive-server.js &  # Port 3002
npm run dev  # Port 5173
```

---

## 📊 CURRENT STATE

**Working**:
- ✅ Backend (wrangler dev --local on :8787)
- ✅ Frontend (localhost:5173)
- ✅ Archive server (port 3002)
- ✅ AI Detection (Lite + GPTZero Pro)
- ✅ Computer Humanizer (heuristic mode)
- ✅ Ollama (qwen3:latest, qwen3:14b, mistral:7b)
- ✅ Persona Transformation (26 personas) - Ollama working
- ✅ Style Transformation (15 styles) - Ollama working
- ✅ Round-Trip Translation (18 languages) - Ollama working

**Next Session Priorities** (Est. 2 hours to complete):
1. **Debug Lite highlights** (30 min) - Check DevTools for `<mark>` tags, fix CSS
2. **GPTZero markdown** (60 min) - Create `detectWithGPTZeroMarkdown()` wrapper
3. **Fix navigation bug** (15 min) - Clear `transformResult` on `narrative.id` change
4. **Test with Thoreau** (15 min) - Long document validation

**Other Known Issues**:
- ⚠️ Qwen3 sometimes includes thinking process in plain text

**Deprecated in UI** (still in API):
- Namespace Transformation
- Allegorical Projection
- Maieutic Dialogue

---

## 🏗️ TRANSFORMATION APIs

### Available in UI
| Tool | Endpoint | Processing | Markdown |
|------|----------|-----------|----------|
| Computer Humanizer | `/transformations/computer-humanizer` | Heuristic | Strips |
| AI Detection (Lite) | `/ai-detection/lite` | 20-60s | Strips |
| AI Detection (GPTZero) | `/ai-detection/detect` | 800-1000ms | Strips |
| Persona | `/transformations/persona` | 30s (Ollama) | Preserves (Phase 1) |
| Style | `/transformations/style` | 27s (Ollama) | Preserves (Phase 1) |

### Not in UI (Available in API)
| Tool | Endpoint | Processing |
|------|----------|-----------|
| Round-Trip | `/transformations/round-trip` | ~2m 15s (Ollama) |
| Namespace | `/transformations/namespace` | N/A |
| Allegorical | `/transformations/allegorical` | N/A |

**Personas** (26): neutral, advocate, critic, holmes_analytical, watson_chronicler, austen_ironic_observer, dickens_social_critic, tech_optimist, climate_scientist_urgent, reddit_community_member, medium_public_intellectual, etc.

**Styles** (15): standard, academic, poetic, technical, casual, austen_precision, dickens_dramatic, watson_clarity, reddit_casual_prose, medium_narrative_essay, internet_collage, etc.

**Round-Trip Languages** (18): spanish, french, german, italian, portuguese, russian, chinese, japanese, korean, arabic, hebrew, hindi, dutch, swedish, norwegian, danish, polish, czech

---

## 📚 KEY DOCUMENTATION

**Current Session** (Nov 22 Late Evening):
- `/tmp/MARKDOWN_COMPLETE_HANDOFF_NOV22_LATE.md` - **START HERE** - Complete status + 3 bugs to fix
- `/DUAL_DEPLOYMENT_GUIDE.md` - Dual deployment architecture (cloud/local)

**Recent Sessions**:
- Nov 22 AM: Ollama integration + environment detection fix
- Nov 21: 5-phase UX refactor (copy buttons, split pane scrolling)
- Nov 20: GPTZero premium features

---

## 📝 TEST ACCOUNT

- Email: demo@humanizer.com
- Password: testpass123
- Role: admin (can use GPTZero)

---

## 🚀 PRODUCTION

- API: https://npe-api.tem-527.workers.dev
- Frontend: https://humanizer.com
- Signups: 239 waiting

---

## ⚠️ CRITICAL RULES

1. **NO mock data** without explicit disclosure
2. **ALWAYS verify** backend running before frontend changes
3. **ALWAYS explain** architectural decisions upfront
4. **Node 22.21.1** (`nvm use 22`)
5. **Brand**: "humanizer.com" (with .com)
6. **Primary interface**: narrative-studio (localhost:5173)
7. **Archive**: Always local (port 3002) for privacy

---

**End of Guide** | Next: Test markdown preservation, then Phase 2 (AI Detection)
