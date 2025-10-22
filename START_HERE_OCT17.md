# 🚀 START HERE - Humanizer Project

**Last Updated**: October 17, 2025
**Status**: ✅ Production Ready | Mobile Responsive | Bug-Free

---

## 📖 Essential Reading

### **Start Here** (in order)
1. **CLAUDE.md** - Main development guide (UPDATED Oct 17)
   - Latest session work (mobile + bug fixes)
   - Project structure
   - Critical rules
   - Quick commands

2. **HANDOFF_OCT17.md** - Latest session details
   - Mobile responsiveness complete
   - Working Memory bug fixes
   - Testing instructions
   - Next priorities

3. **ADVANCED_FEATURES_PLAN.md** - Upcoming features
   - Context-aware lists (5-8 hours)
   - Multi-view tabs (11-15 hours)
   - Mobile enhancements

4. **FUTURE_ENHANCEMENTS.md** - Long-term roadmap
   - Advanced features
   - Time estimates
   - Priority rankings

---

## ✅ What's Working Right Now

### Frontend (React + TypeScript + Vite)
✅ **1,686 conversations** loaded from ChatGPT archive
✅ **Interest Lists** - Create, view, delete, click-to-open
✅ **Working Memory Widget** - Auto-track activity, save to lists
✅ **AUI (Agentic UI)** - 21 tools, GUI actions, persistent conversations
✅ **Settings Panel** - Configure working memory, features
✅ **Mobile Responsive** - 320px to 1440px+ fully tested

### Backend (FastAPI + PostgreSQL)
✅ **62 API endpoints** operational
✅ **32 database tables** fully migrated
✅ **Agent conversations** persist across sessions
✅ **ChromaDB** for agent memory (MCP integration)

---

## 🏃 Quick Start

### Run the App
```bash
# Terminal 1: Backend
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev  # http://localhost:3001
```

### Run Tests
```bash
# Frontend build (check for errors)
cd frontend && npm run build

# Backend tests (if needed)
cd /Users/tem/humanizer_root
poetry run pytest
```

---

## 🎯 Next Session Priorities

### **Option A: Context-Aware Lists** (Recommended - 5-8 hours)
Show interest list conversations in sidebar
**Why**: High user value, medium complexity
**Start**: See ADVANCED_FEATURES_PLAN.md lines 10-85

### **Option B: Multi-View Tabs** (11-15 hours)
Work with multiple contexts simultaneously
**Why**: Power-user feature, high impact
**Start**: See ADVANCED_FEATURES_PLAN.md lines 87-162

### **Option C: Performance** (Variable time)
Bundle size reduction, lazy loading
**Why**: App loads fast but could be faster
**Start**: See FUTURE_ENHANCEMENTS.md

---

## 🐛 Known Issues

**None** - All reported bugs fixed Oct 17:
- ✅ Working Memory button overflow (fixed)
- ✅ Duplicate conversation titles (fixed)
- ✅ Mobile responsiveness (complete)

---

## 📂 Key Directories

```
/Users/tem/humanizer_root/
├── CLAUDE.md               ← Main guide
├── HANDOFF_OCT17.md        ← Latest session
├── ADVANCED_FEATURES_PLAN.md
├── FUTURE_ENHANCEMENTS.md
├── frontend/
│   ├── src/
│   │   ├── components/     ← All UI components
│   │   ├── hooks/          ← Custom React hooks
│   │   ├── store/          ← Zustand state management
│   │   ├── types/          ← TypeScript types
│   │   └── lib/            ← API client, utilities
│   └── package.json
├── humanizer/
│   ├── api/                ← FastAPI routes (62 endpoints)
│   ├── services/           ← Business logic
│   ├── models/             ← SQLAlchemy + Pydantic
│   └── ml/                 ← TRM core
└── docs/
    └── archive/            ← Old session docs
```

---

## 🔧 Common Commands

```bash
# Frontend
cd frontend
npm run dev          # Dev server
npm run build        # Production build
npm run preview      # Preview build

# Backend
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload
poetry run alembic upgrade head     # Database migrations
poetry run pytest                   # Run tests

# Git
git status
git add .
git commit -m "message"
git push origin dev-TRM
```

---

## 💡 Quick Tips

1. **Always read HANDOFF_OCT17.md** before starting
2. **Check CLAUDE.md** for critical rules
3. **Test on mobile** - Use Chrome DevTools (Cmd+Shift+M)
4. **Build before committing** - `npm run build` should succeed
5. **Update CLAUDE.md** when adding features
6. **Create handoff doc** at end of session

---

## 🎓 Architecture Quick Ref

### State Management
- **Zustand** for complex state (ephemeral lists, settings)
- **localStorage** for settings persistence
- **sessionStorage** for ephemeral lists
- **React useState** for component-local state

### API Communication
- **api-client.ts** - 62 typed methods
- **gui-actions.ts** - AUI GUI action executor
- All endpoints under `/api/*`

### Styling
- **CSS Modules** - Component-scoped styles
- **CSS Variables** - Theme system (--bg-*, --text-*, --accent-*)
- **Mobile-first** - Use breakpoints.css variables

---

**Ready to code!** 🎉

Pick a priority above or ask the user what they need.
