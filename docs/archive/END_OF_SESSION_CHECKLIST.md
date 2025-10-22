# End of Session Checklist

**Purpose**: Prevent context-loss issues by ensuring clean session endings
**Use**: Run through this checklist at the end of EVERY development session

---

## ⚠️ Why This Matters

**Without this checklist, you risk**:
- Losing hours of uncommitted work
- Creating conflicting documentation
- Leaving unclear "what's next" guidance
- Wasting next session's time reconstructing context

**With this checklist, you ensure**:
- All work is safely committed
- Documentation is consistent and clear
- Next session can start immediately
- No time wasted on archaeology

---

## 📋 The Checklist

### 1. Code Status ✅

- [ ] **All servers still running?**
  ```bash
  lsof -i :8000 :3001  # Backend and Frontend
  ```

- [ ] **All tests passing?**
  ```bash
  poetry run pytest  # If you have tests
  ```

- [ ] **No syntax errors?**
  ```bash
  # Try importing your modules
  poetry run python -c "import humanizer.main"
  ```

- [ ] **No obvious bugs introduced?**
  - Try the main user flows
  - Check browser console for errors
  - Verify API responses

---

### 2. Git Hygiene 🌳

- [ ] **Check git status**
  ```bash
  git status
  ```

- [ ] **Are there untracked files?**
  ```bash
  git status | grep "^??"
  ```

- [ ] **Stage all intended files**
  ```bash
  git add <files>
  # OR for everything:
  git add .
  ```

- [ ] **Commit with clear message**
  ```bash
  git commit -m "feat: Clear description of what was accomplished

  - Bullet point list of changes
  - Another change
  - Key files modified

  🚀 Generated with Claude Code
  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [ ] **Verify commit worked**
  ```bash
  git log -1 --stat  # See what was committed
  ```

**🚨 CRITICAL**: Don't end session with untracked files containing working code!

---

### 3. Documentation Cleanup 📚

- [ ] **Count documentation files**
  ```bash
  ls -1 *.md | wc -l
  ```

- [ ] **Too many? (>10 in root is too many)**
  ```bash
  # Archive session notes
  mkdir -p docs/sessions/$(date +%Y%m%d)
  mv SESSION_*.md NEXT_SESSION_*.md docs/sessions/$(date +%Y%m%d)/
  ```

- [ ] **Update CLAUDE.md**
  - Reflect current system state
  - Update "What's Working" section
  - Update "Next Session Priorities"
  - Remove outdated information

- [ ] **Create/Update NEXT_SESSION.md**
  - Single source of truth for "what's next"
  - 3-5 concrete action items
  - Include server start commands
  - Include verification steps

- [ ] **Delete contradictory docs**
  - If multiple docs say different things, keep one, archive others

---

### 4. Context Preservation 🧠

- [ ] **Write session summary**
  Create `docs/sessions/YYYYMMDD/SESSION_SUMMARY.md`:
  ```markdown
  # Session Summary - [Date]

  ## Duration
  [X] hours

  ## What Was Accomplished
  - Item 1
  - Item 2
  - Item 3

  ## Files Modified
  - path/to/file1.py (why)
  - path/to/file2.tsx (why)

  ## What's Next
  - Priority 1
  - Priority 2

  ## Known Issues
  - Issue 1 (and where to look)
  - Issue 2 (and workaround)
  ```

- [ ] **List modified files with purpose**
  ```bash
  git diff --name-status HEAD~1 HEAD
  ```

- [ ] **Note any weird behavior**
  - Workarounds you had to use
  - Bugs you couldn't fix
  - Technical debt you incurred

- [ ] **Save any useful commands**
  - Database queries you ran
  - Curl commands that work
  - Search patterns that found things

---

### 5. Environment Snapshot 📸

- [ ] **Record versions**
  ```bash
  poetry show | grep -E "^(fastapi|pydantic|sqlalchemy)" > .versions.txt
  cd frontend && npm list --depth=0 > ../.npm-versions.txt
  ```

- [ ] **Record database state**
  ```bash
  psql -d humanizer_dev -c "\dt" > .db-tables.txt
  psql -d humanizer_dev -c "SELECT 'conversations', COUNT(*) FROM conversations UNION SELECT 'messages', COUNT(*) FROM messages;" > .db-counts.txt
  ```

- [ ] **Record server PIDs** (if leaving them running)
  ```bash
  lsof -i :8000 :3001 > .server-pids.txt
  ```

---

### 6. Next Session Prep 🚀

- [ ] **Create NEXT_SESSION.md** (if doesn't exist)
  ```markdown
  # Next Session - Start Here

  **Date**: [Today's date]
  **Status**: [Brief status]

  ## Quick Start

  ### Check Servers
  \`\`\`bash
  curl http://localhost:8000/health  # Backend
  open http://localhost:3001         # Frontend
  \`\`\`

  ### Start Servers (if needed)
  \`\`\`bash
  # Terminal 1: Backend
  poetry run uvicorn humanizer.main:app --reload --port 8000

  # Terminal 2: Frontend
  cd frontend && npm run dev
  \`\`\`

  ## Priority Tasks

  ### 1. [Most important task] ([time estimate])
  - Concrete action
  - File to look at
  - Command to run

  ### 2. [Second task] ([time estimate])
  - Concrete action

  ### 3. [Third task] ([time estimate])
  - Concrete action

  ## Verification

  - [ ] Backend responding
  - [ ] Frontend loading
  - [ ] Key feature working

  ---

  **Last Updated**: [Today's date]
  **Ready for**: [What you can start with]
  ```

- [ ] **List concrete first actions**
  - Not "fix the system"
  - But "Open file X, find function Y, change Z"

- [ ] **Include verification commands**
  - How to know if system is working
  - What to test first

---

### 7. Communication 💬

- [ ] **If working with user, send**:
  - What you accomplished
  - What's ready to test
  - What's the best next session would do
  - Any blockers or decisions needed

- [ ] **If solo work, note**:
  - Your mental model of the problem
  - Why you made key decisions
  - What you're uncertain about

---

## 🎯 Minimum Viable Session End

**If you're truly out of time, AT MINIMUM do these 3**:

1. ✅ **Commit everything**
   ```bash
   git add . && git commit -m "WIP: [brief description]"
   ```

2. ✅ **Update CLAUDE.md with current state**
   - What's working
   - What's broken
   - What to do next

3. ✅ **Create NEXT_SESSION.md with 3 priorities**
   - Priority 1
   - Priority 2
   - Priority 3

**These 3 things take 5 minutes and save hours later.**

---

## 🚨 Red Flags

**End session immediately and run checklist if**:

- Claude output contains "I've run out of context"
- Token counter shows >180k/200k used
- You've been working >2 hours without a commit
- You have >20 untracked files in root
- You're not sure what you just changed
- You're about to "just try one more thing"

---

## ✅ Session End Complete

**When all checked**:

- [ ] Git is clean (or intentionally has WIP)
- [ ] Documentation is organized
- [ ] NEXT_SESSION.md exists and is clear
- [ ] No critical work is only in memory/context
- [ ] You could start next session RIGHT NOW and know what to do

---

**Time to complete**:
- Full checklist: ~15 minutes
- Minimum viable: ~5 minutes

**Time saved next session**:
- 30-60 minutes (no archaeology needed)

**Use this EVERY session!**
