# Technical Debt Tracker

**Last Updated**: November 24, 2025
**Total Items**: 9 active + 1 incident report
**Blocking Items**: 2
**Items >30 days**: 4
**Critical Incidents**: 1 (resolved)

---

## 🎯 By Milestone

### Local Development (MVP) ✅
**Status**: Acceptable debt level for single-user prototype
**Items**: 6 (5 cosmetic, 1 limiting)

These items don't block local development and testing. They're tracked for future milestones.

### Transformation Engine
**Status**: No blockers
**Items**: 1 (stub for personifier enhancement)

### Cloud Archives 🔴
**Status**: 2 blocking items
**Items**: 2 (both blocking)

**Critical**: User authentication must be implemented before cloud deployment.

### Discourse Plugin
**Status**: No current debt
**Items**: 0

### Core ML
**Status**: Intentional stubs
**Items**: 2 (documented prototype stubs)

TRM/POVM implementation is using simulation stubs - this is intentional architecture.

---

## 🚦 By Severity

### 🔴 Blocking (2 items)
Critical items preventing milestone completion

1. User authentication hardcoding
2. Database connection single-user assumptions

### 🟡 Limiting (3 items)
Items reducing capability or performance

1. Silent PDF page extraction failures
2. Silent PDF image extraction failures
3. Personifier random sampling instead of similarity

### 🟢 Cosmetic (4 items)
Polish items, not critical

1. MCP quantum reading not implemented
2. Simulated embeddings in reading service
3. Simulated TRM model in reading service
4. PDF export not implemented

---

## 🚨 Critical Incident Reports

### INCIDENT-001: Phase 2A UI Refactor Broke All Transformations [RESOLVED]
- **Date**: November 24, 2025
- **Severity**: CRITICAL (P0) - Complete feature outage
- **Status**: RESOLVED (40 minutes)
- **Type**: Bug / State Management / Architecture
- **Impact**: All transformation tools (Computer Humanizer, Persona, Style, AI Detection, Round-Trip) completely non-functional
- **Root Cause**: State lifting failure during UI refactoring

**What Happened**:
During Phase 2A implementation (Floating Action Bar), the "Run Transformation" button was moved from ToolsPanel to FloatingActionBar without properly migrating the transformation configuration state (selectedType, parameters). This caused FloatingActionBar to pass a React click event object instead of a TransformConfig object to the handleRunTransform handler, resulting in "Error: Unknown transformation type: click" for ALL transformations.

**Technical Details**:
1. FloatingActionBar prop signature was wrong: `onRunTransform: () => void` instead of `(config: TransformConfig) => void`
2. Transformation state (selectedType, parameters) remained in ToolsPanel but FloatingActionBar had no access to it
3. Click handler passed the event object where config object was expected
4. TypeScript didn't catch the error due to flexible React event handler types
5. Work was marked complete without manual testing

**Resolution**:
Lifted transformation state from ToolsPanel to App.tsx:
- Added `selectedTransformType` and `transformParameters` state to App.tsx
- Updated ToolsPanel to accept state as props instead of using local state
- Updated FloatingActionBar to construct complete TransformConfig object from props before calling onRunTransform
- Fixed type signature: `onRunTransform: (config: TransformConfig) => void`

**Files Modified**:
- `/Users/tem/humanizer_root/narrative-studio/src/App.tsx` (added state, passed to children)
- `/Users/tem/humanizer_root/narrative-studio/src/components/panels/ToolsPanel.tsx` (removed local state, accept props)
- `/Users/tem/humanizer_root/narrative-studio/src/components/workspace/FloatingActionBar.tsx` (added handleRun, fixed types)

**Testing Required**:
- [ ] Computer Humanizer transformation
- [ ] Persona transformation
- [ ] Style transformation
- [ ] AI Detection (Lite + GPTZero)
- [ ] Round-Trip translation
- [ ] Parameter passing verification
- [ ] Transform source setting (Original vs Active Buffer)

**Lessons Learned**:
1. **Always map data flow** before moving stateful components
2. **Test critical features immediately** after UI refactors (don't mark work complete without validation)
3. **Use explicit types** for callback props to catch signature mismatches
4. **Manual testing is mandatory** for core user flows, even if TypeScript compiles
5. **Console errors matter** - check browser console during manual testing

**Prevention Measures**:
- Document state dependencies before refactoring
- Create testing checklist for critical features
- Never mark work "complete" without validation
- Add PropTypes or strict TypeScript interfaces for complex callbacks
- Run smoke tests after UI restructuring

---

## 📋 Complete Inventory

### DEBT-001: User Authentication Hardcoded 🔴
- **Location**: `humanizer/api/interest_list.py:49-55`, `documents.py`, `reading.py`
- **Type**: fallback
- **Severity**: 🔴 blocking
- **Blocks**: Cloud Archives
- **Created**: 2025-10-10 (estimated)
- **Effort**: medium (6-8 hours)
- **Description**: Returns hardcoded UUID `00000000-0000-0000-0000-000000000001` instead of actual user auth
- **Why**: MVP single-user mode doesn't need authentication
- **Fix Required**: Implement JWT/session-based auth with proper user management before cloud deployment
- **Impact**: All user-scoped features (interest lists, readings, documents) assume single user

---

### DEBT-002: Silent PDF Page Extraction Failures 🟡
- **Location**: `humanizer/services/parsers/pdf.py:143-145`
- **Type**: silent-error
- **Severity**: 🟡 limiting
- **Blocks**: Transformation Engine (user experience)
- **Created**: 2025-10-17
- **Effort**: small (< 1 hour)
- **Description**: `except Exception: continue` silently skips failed PDF pages without logging
- **Why**: PDF parsing is fragile, one corrupt page shouldn't kill whole document
- **Fix Required**: Add logging before continue: `logger.warning(f"Failed to extract page {page_num}: {e}")`
- **Impact**: Users don't know why PDFs have missing pages

---

### DEBT-003: Silent PDF Image Extraction Failures 🟡
- **Location**: `humanizer/services/parsers/pdf.py:179-181`
- **Type**: silent-error
- **Severity**: 🟡 limiting
- **Blocks**: Transformation Engine (debugging)
- **Created**: 2025-10-17
- **Effort**: small (< 1 hour)
- **Description**: `except Exception: pass` silently fails image extraction without logging
- **Why**: Image extraction often fails on various PDF formats
- **Fix Required**: Add logging: `logger.warning(f"Failed to extract images from {file_path}: {e}")`
- **Impact**: Debugging PDF issues is difficult without visibility

---

### DEBT-004: Database Connection Pooling 🔴
- **Location**: `humanizer/database/connection.py:12`
- **Type**: stub
- **Severity**: 🔴 blocking
- **Blocks**: Cloud Archives (performance)
- **Created**: 2025-10-05 (estimated)
- **Effort**: small (2-3 hours)
- **Description**: Hardcoded DB URL, no connection pooling configuration
- **Why**: Local dev works fine with simple connection
- **Fix Required**: Move to config, implement proper connection pooling for production load
- **Impact**: Won't scale to concurrent cloud users

---

### DEBT-005: Simulated Embeddings in Reading Service 🟢
- **Location**: `humanizer/services/reading.py:84-86`
- **Type**: stub
- **Severity**: 🟢 cosmetic
- **Blocks**: Core ML (full quantum reading)
- **Created**: 2025-10-01 (estimated)
- **Effort**: large (8+ hours)
- **Description**: Uses `_simulate_embedding()` instead of actual sentence-transformers
- **Why**: Intentional - allows API layer testing without ML dependencies
- **Fix Required**: Integrate actual sentence-transformers model
- **Impact**: Readings don't use real semantic embeddings (acceptable for prototype)
- **Note**: This is **intentional architecture** (layer separation), not emergency workaround

---

### DEBT-006: Simulated TRM Model 🟢
- **Location**: `humanizer/services/reading.py:192-194`
- **Type**: stub
- **Severity**: 🟢 cosmetic
- **Blocks**: Core ML (full quantum reading)
- **Created**: 2025-10-01 (estimated)
- **Effort**: large (40+ hours)
- **Description**: Uses `_simulate_trm_step()` instead of actual TRM iteration
- **Why**: Intentional - full TRM implementation is complex research project
- **Fix Required**: Implement complete TRM model with proper quantum mechanics
- **Impact**: Reading iterations are simulated (acceptable for prototype API testing)
- **Note**: This is **intentional architecture**, not band-aid

---

### DEBT-007: MCP Quantum Reading Not Implemented 🟢
- **Location**: `humanizer/services/mcp_client.py:92-99`
- **Type**: stub
- **Severity**: 🟢 cosmetic
- **Blocks**: None (feature not yet needed)
- **Created**: 2025-10-15 (estimated)
- **Effort**: medium (4-6 hours)
- **Description**: Returns `"status": "not_implemented"` placeholder
- **Why**: MCP quantum reading API endpoints not yet built
- **Fix Required**: Implement when library/reading API is fully designed
- **Impact**: MCP tool can't trigger quantum readings (not needed yet)
- **Note**: Good stub pattern - explicitly returns "not implemented" rather than faking

---

### DEBT-008: Personifier Random Sampling 🟡
- **Location**: `humanizer/services/personifier.py:433`
- **Type**: workaround
- **Severity**: 🟡 limiting
- **Blocks**: Transformation Engine (quality)
- **Created**: 2025-09-20 (estimated)
- **Effort**: medium (4-6 hours)
- **Description**: `For now, randomly sample. Could use embedding similarity.`
- **Why**: Embedding similarity requires additional infrastructure
- **Fix Required**: Implement embedding-based similarity for smart sampling
- **Impact**: Personifier samples are random, not semantically similar (reduces quality)

---

### DEBT-009: PDF Export Not Implemented 🟢
- **Location**: `humanizer/services/chatgpt_render.py:707`
- **Type**: stub
- **Severity**: 🟢 cosmetic
- **Blocks**: None (future feature)
- **Created**: 2025-09-15 (estimated)
- **Effort**: large (12+ hours with LaTeX)
- **Description**: `# TODO: Implement PDF export`
- **Why**: Not prioritized yet
- **Fix Required**: Implement PDF rendering pipeline (likely with LaTeX)
- **Impact**: Can't export conversations to PDF (not critical for MVP)

---

## 📊 Trends & Patterns

### Recurring Patterns
1. **User Authentication Assumptions** (3 locations) - Needs systematic fix
2. **Silent Error Handling** (2 locations in PDF parser) - Add logging
3. **Intentional ML Stubs** (2 locations) - Acceptable, well-documented
4. **UI Refactoring Risk** (1 incident) - State management during component restructuring

### Age Distribution
- **Fresh** (< 7 days): 1 incident (UI refactor)
- **Recent** (7-30 days): 1 item
- **Older** (> 30 days): 8 items (normal for early project)

### Effort Distribution
- **Small** (< 2 hours): 3 items - Quick wins available!
- **Medium** (2-8 hours): 3 items
- **Large** (> 8 hours): 3 items - Architectural changes needed

### Incident Analysis
- **Total Incidents**: 1
- **Resolved**: 1 (100%)
- **Average Resolution Time**: 40 minutes
- **Most Common Cause**: State management during refactoring
- **Prevention Success**: Lessons learned documented for future refactors

---

## 🎯 Recommended Prioritization

### Before Cloud Archives Deployment
**Must Fix** (Blocking):
1. DEBT-001: User authentication (6-8 hours)
2. DEBT-004: Database pooling (2-3 hours)

**Should Fix** (Limiting):
1. DEBT-002: PDF page logging (< 1 hour) - Quick win!
2. DEBT-003: PDF image logging (< 1 hour) - Quick win!

### Before Transformation Engine v1.0
**Should Fix**:
1. DEBT-008: Personifier sampling (4-6 hours) - Quality improvement

### Acceptable for Now
- DEBT-005, DEBT-006: Intentional ML stubs
- DEBT-007: MCP stub (feature not needed)
- DEBT-009: PDF export (future feature)

---

## 📝 Notes

### Philosophy
Technical debt is a **conscious trade-off** to ship faster. This tracker ensures we:
1. Know what shortcuts we're taking
2. Understand when they become problems
3. Have a clear path to pay them back
4. Don't let debt accumulate invisibly

### Maintenance
- **Review weekly**: Check for new debt in recent commits
- **Milestone prep**: Audit blockers for upcoming milestone
- **Monthly**: Flag items >30 days for review
- **Post-incident**: Document critical bugs with full context

### UI Refactoring Checklist (Added Nov 24, 2025)
Before moving stateful components:
1. Map all state dependencies and data flows
2. Identify which state needs to be lifted vs passed as props
3. Update prop signatures and TypeScript interfaces
4. Test critical user flows manually after changes
5. Check browser console for errors
6. Never mark work complete without validation

### Incident Response Process
When a critical bug is discovered:
1. Document the incident in "Critical Incident Reports" section
2. Include: date, severity, status, root cause, resolution
3. List all modified files with absolute paths
4. Extract lessons learned and prevention measures
5. Update Trends & Patterns section
6. Create testing checklist if missing

---

**Last Audit**: November 24, 2025
**Next Audit**: Invoke `debt-tracker` agent at session end
