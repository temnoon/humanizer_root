# Session Persistence Test Suite

**Phase 8 - Session History & Buffer System**
**Date**: November 22, 2025
**Branch**: `feature/session-history-and-buffers`

---

## Prerequisites

1. Backend running: `cd narrative-studio && node archive-server.js`
2. Frontend running: `npm run dev` (port 5173)
3. Clean test environment: Delete `~/.humanizer/sessions/*.json` before starting

---

## Test 1: Basic Session Creation and Reload

**Goal**: Verify session persists across page reloads

### Steps:
1. Open http://localhost:5173
2. Load a narrative from archive (click any message)
3. Click "Computer Humanizer" → Run transformation
4. **Verify**: Session auto-created with 2 buffers (Original | Computer Humanizer)
5. **Verify**: BufferTabs appear in workspace
6. **Verify**: Session appears in "Sessions" tab (left panel)
7. Note the session name and timestamp
8. **Hard reload**: Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
9. **Verify**: Session still exists in Sessions tab
10. Click the session to load it
11. **Verify**: Both buffers restore correctly
12. **Verify**: Content matches pre-reload state
13. **Check file**: `ls -lah ~/.humanizer/sessions/` → Should see 1 JSON file

### Expected Results:
- ✅ Session file created: `~/.humanizer/sessions/session-<timestamp>.json`
- ✅ File size: ~1-5 KB (depending on text length)
- ✅ Session name persists
- ✅ Buffer count: 2
- ✅ Active buffer ID persists
- ✅ View mode persists (split by default)

### Pass Criteria:
- [ ] Session file exists on disk
- [ ] Session appears in UI after reload
- [ ] All buffers restore with correct content
- [ ] Active buffer remains selected
- [ ] View mode unchanged

---

## Test 2: Large Session with 50+ Buffers

**Goal**: Verify performance with extensive transformation chains

### Steps:
1. Start fresh: Delete `~/.humanizer/sessions/*.json`
2. Open http://localhost:5173
3. Load a long narrative (e.g., Walden excerpt from Thoreau)
4. Run **10 transformations** in sequence:
   - Computer Humanizer
   - Persona: Austen
   - Style: Academic
   - Persona: Dickens
   - Style: Poetic
   - Persona: Watson
   - Style: Casual
   - Persona: Holmes
   - Style: Technical
   - Persona: Neutral
5. **Verify**: 11 buffers total (Original + 10 transformations)
6. **Verify**: All buffers appear in BufferTabs
7. Switch to each buffer and verify content
8. Note: Time to load session (should be < 1 second)
9. Hard reload page
10. Load session from Sessions tab
11. **Verify**: All 11 buffers restore
12. **Verify**: Load time still < 2 seconds
13. **Check file size**: `ls -lh ~/.humanizer/sessions/` → Should see file size

### Expected Results:
- ✅ Session file: 50-200 KB (depending on text)
- ✅ All 11 buffers present
- ✅ Transformation chain intact (sourceBufferId links preserved)
- ✅ Load time acceptable (< 2 seconds)
- ✅ No memory issues or UI freezing

### Pass Criteria:
- [ ] 11 buffers restore correctly
- [ ] No buffers missing
- [ ] Content integrity maintained
- [ ] Load time < 2 seconds
- [ ] UI responsive after load

---

## Test 3: Edit History Persistence

**Goal**: Verify user edits persist across sessions

### Steps:
1. Create new session (Computer Humanizer on any text)
2. Click "Original" buffer tab
3. Edit the original text (add "EDITED:" prefix)
4. **Verify**: Buffer tab shows "*" indicator (edited flag)
5. Wait 6 seconds (auto-save debounce)
6. **Check console**: Should see "✓ Auto-saved session: session-<id>"
7. Hard reload page
8. Load session from Sessions tab
9. Click "Original" buffer tab
10. **Verify**: Text still has "EDITED:" prefix
11. **Verify**: "*" indicator still present
12. **Check session file**: `cat ~/.humanizer/sessions/session-*.json`
13. **Verify**: JSON contains `"isEdited": true` for buffer-0
14. **Verify**: JSON contains `"userEdits": [...]` array with edit entry

### Expected Results:
- ✅ Edit persists after reload
- ✅ `isEdited` flag = true
- ✅ `userEdits` array contains 1+ entries
- ✅ Edit entry has: timestamp, type, position, oldText, newText
- ✅ "*" indicator shows in UI

### Pass Criteria:
- [ ] Edited text persists
- [ ] isEdited flag true
- [ ] userEdits array populated
- [ ] Edit metadata correct
- [ ] "*" indicator visible

---

## Test 4: Corrupted JSON Handling

**Goal**: Verify graceful degradation with invalid session files

### Steps:
1. Create a session normally
2. Note the session ID (e.g., `session-1732345678901`)
3. Close browser or hard reload
4. **Manually corrupt the file**:
   ```bash
   echo "{ INVALID JSON" > ~/.humanizer/sessions/session-1732345678901.json
   ```
5. Open http://localhost:5173
6. Click "Sessions" tab
7. **Verify**: Error handling occurs (no crash)
8. **Check behavior**: Session should either:
   - Not appear in list (filtered out), OR
   - Show with error indicator, OR
   - Show error message in UI
9. **Verify**: Other valid sessions still load
10. **Check console**: Should see error logged (not thrown)

### Current Behavior (Before Fix):
- ❌ Backend crashes on `JSON.parse()` (line 1278 in archive-server.js)
- ❌ Frontend shows generic error
- ❌ No recovery mechanism

### Expected Behavior (After Fix):
- ✅ Backend catches parse error
- ✅ Logs warning with filename
- ✅ Skips corrupted file
- ✅ Returns other valid sessions
- ✅ Frontend shows user-friendly error

### Pass Criteria:
- [ ] No server crash
- [ ] Corrupted session skipped
- [ ] Other sessions load normally
- [ ] Error logged to console
- [ ] User-friendly error message (optional)

---

## Test 5: Concurrent Save Scenarios

**Goal**: Verify auto-save handles rapid edits correctly

### Steps:
1. Create session with transformation
2. Rapidly edit text in active buffer (type fast for 10 seconds)
3. **Verify**: Only 1 auto-save after typing stops
4. **Check console**: Should see single "✓ Auto-saved" message ~5 seconds after last keystroke
5. Edit again, wait 2 seconds, edit again, wait 2 seconds
6. **Verify**: Debounce resets each time (only 1 save after last edit)
7. Make 10 edits in rapid succession
8. Wait 6 seconds
9. Reload page
10. **Verify**: All edits persisted
11. **Verify**: Only final state saved (not intermediate states)

### Expected Results:
- ✅ Debounce works (5-second delay)
- ✅ Multiple rapid edits = 1 save
- ✅ Final state always persisted
- ✅ No duplicate saves
- ✅ No lost edits

### Pass Criteria:
- [ ] Auto-save debounces correctly
- [ ] Final edits always persist
- [ ] No excessive saves
- [ ] No data loss
- [ ] Console shows expected save count

---

## Test 6: Session File Integrity

**Goal**: Validate session JSON structure and data types

### Steps:
1. Create session with 3 transformations
2. Edit 2 buffers (add text, delete text)
3. Wait for auto-save
4. **Inspect file**:
   ```bash
   cat ~/.humanizer/sessions/session-*.json | jq '.'
   ```
5. **Verify structure**:
   - `sessionId`: string
   - `name`: string
   - `created`: ISO 8601 timestamp
   - `updated`: ISO 8601 timestamp
   - `sourceArchive`: string
   - `sourceMessageId`: string or null
   - `buffers`: array of SessionBuffer objects
   - `activeBufferId`: string
   - `viewMode`: one of ['split', 'single-original', 'single-transformed']
6. **Verify each buffer**:
   - `bufferId`: string (unique)
   - `type`: one of ['original', 'transformation', 'analysis', 'edited']
   - `displayName`: string
   - `sourceBufferId`: string or undefined
   - `tool`: string or undefined
   - `text`: string or undefined
   - `resultText`: string or undefined
   - `userEdits`: array or undefined
   - `isEdited`: boolean
   - `created`: ISO 8601 timestamp
7. **Verify edit objects** (if present):
   - `timestamp`: ISO 8601
   - `type`: one of ['replace', 'insert', 'delete']
   - `position`: { start: number, end: number }
   - `oldText`: string
   - `newText`: string

### Expected Results:
- ✅ Valid JSON (no syntax errors)
- ✅ All required fields present
- ✅ Correct data types
- ✅ ISO 8601 timestamps
- ✅ Buffer IDs unique

### Pass Criteria:
- [ ] JSON parses without errors
- [ ] All fields have correct types
- [ ] Timestamps are valid ISO 8601
- [ ] No missing required fields
- [ ] Buffer IDs are unique

---

## Test 7: Multi-Session Management

**Goal**: Verify multiple sessions can coexist and load independently

### Steps:
1. Create Session A: Humanizer transformation
2. Create Session B: Persona transformation (different source text)
3. Create Session C: Style transformation (different source text)
4. **Verify**: 3 sessions appear in Sessions tab
5. **Verify**: Each session has unique ID
6. **Verify**: 3 JSON files in `~/.humanizer/sessions/`
7. Load Session A → Verify correct buffers
8. Load Session B → Verify different buffers
9. Load Session C → Verify different buffers
10. Hard reload page
11. **Verify**: All 3 sessions still present
12. Load each session → Verify isolation (no data mixing)

### Expected Results:
- ✅ 3 independent sessions
- ✅ No data overlap between sessions
- ✅ Correct session loaded each time
- ✅ All sessions persist across reload

### Pass Criteria:
- [ ] 3 sessions created
- [ ] Each session loads correctly
- [ ] No data mixing between sessions
- [ ] All persist after reload
- [ ] Sessions sorted by updated timestamp

---

## Test 8: Session Limits (Tier-Based)

**Goal**: Verify tier-based session limits enforce correctly

### Steps:
1. **Test Free Tier** (limit: 10 sessions):
   - Create 10 sessions (use rapid transformations)
   - **Verify**: 10th session succeeds
   - Try to create 11th session
   - **Verify**: Error message: "Session limit reached: 10"
   - **Verify**: 11th session NOT created
   - Delete 1 session
   - Create new session
   - **Verify**: Now succeeds (under limit)

2. **Test Pro Tier** (limit: 100 sessions):
   - Update user tier to "pro" (in SessionContext or user state)
   - **Verify**: Limit increases to 100
   - **Note**: Don't actually create 100 sessions (time-consuming)
   - Verify limit display in UI shows "100"

3. **Test Premium Tier** (limit: 1000 sessions):
   - Update user tier to "premium"
   - **Verify**: Limit increases to 1000

### Expected Results:
- ✅ Free tier: 10 session max
- ✅ Pro tier: 100 session max
- ✅ Premium tier: 1000 session max
- ✅ Error message when limit reached
- ✅ Can create session after deleting one

### Pass Criteria:
- [ ] Free tier limit enforced
- [ ] Error message clear
- [ ] No session created beyond limit
- [ ] Deletion unblocks creation
- [ ] Tier upgrade increases limit

---

## Test 9: Session Timestamps Accuracy

**Goal**: Verify created/updated timestamps are accurate

### Steps:
1. Note current time: `date`
2. Create session
3. **Verify**: `created` timestamp ≈ current time (within 1 second)
4. Wait 10 seconds
5. Edit buffer text
6. Wait 6 seconds (auto-save)
7. **Check session file**: `cat ~/.humanizer/sessions/session-*.json | jq '.updated'`
8. **Verify**: `updated` timestamp > `created` timestamp
9. **Verify**: `updated` timestamp ≈ time of edit + 5 seconds

### Expected Results:
- ✅ `created` timestamp accurate
- ✅ `updated` timestamp updates on save
- ✅ Timestamps in ISO 8601 format
- ✅ Timestamps increase monotonically

### Pass Criteria:
- [ ] Created timestamp accurate
- [ ] Updated timestamp updates
- [ ] Timestamps valid ISO 8601
- [ ] Updated > created

---

## Test 10: Load Time Benchmarks

**Goal**: Measure session load performance

### Steps:
1. Create small session (2 buffers, 500 chars each)
2. Reload page
3. **Time loading**: Open DevTools → Network tab → Reload
4. **Measure**: Time from page load to session rendered
5. **Target**: < 500ms

6. Create medium session (10 buffers, 2000 chars each)
7. Reload page
8. **Measure**: Load time
9. **Target**: < 1 second

10. Create large session (20 buffers, 5000 chars each)
11. Reload page
12. **Measure**: Load time
13. **Target**: < 2 seconds

### Expected Results:
- ✅ Small session: < 500ms
- ✅ Medium session: < 1s
- ✅ Large session: < 2s
- ✅ No UI freezing
- ✅ Progressive rendering (buffers appear as loaded)

### Pass Criteria:
- [ ] Load times meet targets
- [ ] UI remains responsive
- [ ] No crashes or errors
- [ ] Memory usage reasonable

---

## Summary Checklist

**Core Functionality**:
- [ ] Test 1: Basic creation and reload
- [ ] Test 2: Large sessions (50+ buffers)
- [ ] Test 3: Edit history persistence

**Error Handling**:
- [ ] Test 4: Corrupted JSON handling
- [ ] Test 5: Concurrent save scenarios

**Data Integrity**:
- [ ] Test 6: JSON structure validation
- [ ] Test 7: Multi-session management
- [ ] Test 8: Tier-based limits

**Performance**:
- [ ] Test 9: Timestamp accuracy
- [ ] Test 10: Load time benchmarks

---

## Known Issues (Pre-Phase 8)

1. **No corrupted file handling** → Backend crashes on invalid JSON
2. **No backup before overwrite** → Data loss risk on save errors
3. **No retry logic** → Failed loads permanent until page reload
4. **No manual refresh** → Must reload page to see new sessions
5. **No session file size display** → Users can't see storage usage
6. **No last-saved indicator** → Users don't know when auto-save occurred

---

**End of Test Suite** | Generated: November 22, 2025
