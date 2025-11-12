# Manual Testing Checklist - Admin System & Tools

**Date**: November 12, 2025
**Backend Version**: bc6288a6-d27d-45a7-9d3b-f1773e0096d1
**Frontend**: https://b1a96ffa.npe-cloud.pages.dev

## ADMIN DASHBOARD TESTING

### 1. Site Metrics Tab
- [ ] Login as dreegle@gmail.com
- [ ] Click "Admin" button in navigation
- [ ] Site Metrics tab loads (should be default)
- [ ] 8 metric cards display:
  - [ ] Total Users
  - [ ] Active (24h)
  - [ ] Active (7d)
  - [ ] Active (30d)
  - [ ] Total Transforms
  - [ ] Transforms (24h)
  - [ ] Transforms (7d)
  - [ ] Mailing List
- [ ] Users by Tier section displays (FREE/MEMBER/PRO/PREMIUM/ADMIN)
- [ ] Transformations by Type bar chart displays
- [ ] Daily Activity table displays (last 14 days)
- [ ] Popular Features section displays
- [ ] Quota Usage section displays
- [ ] Auto-refresh works (check in 30 seconds)
- [ ] "Refresh Now" button works

### 2. User Management Tab
- [ ] Click "Users" tab
- [ ] User list table displays
- [ ] Search by email works
- [ ] Filter by tier dropdown works
- [ ] Click "Edit Tier" button
  - [ ] Dropdown appears with tier options
  - [ ] Select new tier
  - [ ] Click "Save"
  - [ ] User tier updates
  - [ ] Click "Cancel" works
- [ ] Click "Reset Quota" button
  - [ ] Confirmation dialog appears
  - [ ] Click "OK" resets quota to 0
  - [ ] User quota updates in table
- [ ] Pagination works (if >50 users)
  - [ ] "Next" button works
  - [ ] "Previous" button works
  - [ ] Page number displays correctly

### 3. Mailing List Tab
- [ ] Click "Mailing List" tab
- [ ] Displays 73 signups
- [ ] "Export CSV" button works
- [ ] CSV downloads with correct data

### 4. Devices Tab
- [ ] Click "Devices" tab
- [ ] WebAuthn devices display
- [ ] "Register Device" works (if testing)
- [ ] "Revoke Device" works (if testing)

## TRANSFORMATION TOOLS TESTING

### 5. "Open Workbench" Button
- [ ] Button visible in navigation (purple-to-cyan gradient)
- [ ] Hover effect works (lifts up, shadow increases)
- [ ] Clicking opens https://workbench.humanizer.com in new tab

### 6. Allegorical Transformation (humanizer.com)
- [ ] Navigate to allegorical form
- [ ] Enter test text: "The quick brown fox jumps over the lazy dog"
- [ ] Select persona: "neutral" or "socratic"
- [ ] Select namespace: "mythology" or "nature"
- [ ] Select style: "standard" or "poetic"
- [ ] Click "Transform"
- [ ] All 6 output fields display:
  - [ ] Deconstruction
  - [ ] Mapping
  - [ ] Reconstruction
  - [ ] Stylization
  - [ ] Reflection
  - [ ] Final Output
- [ ] Copy buttons work
- [ ] Markdown renders correctly

### 7. Round-Trip Translation
- [ ] Navigate to round-trip form
- [ ] Enter test text
- [ ] Select language (e.g., "Japanese")
- [ ] Click "Transform"
- [ ] Original text displays
- [ ] Translated text displays
- [ ] Back-translated text displays
- [ ] Drift analysis displays
- [ ] No errors

### 8. Maieutic Dialogue
- [ ] Navigate to maieutic form
- [ ] Enter test text/question
- [ ] Select depth level (0-4)
- [ ] Click "Transform"
- [ ] Socratic questions display
- [ ] Dialogue format correct
- [ ] No errors

### 9. AI Detection
- [ ] Navigate to AI detection form
- [ ] Enter test text
- [ ] Click "Transform"
- [ ] Detection results display
- [ ] Confidence score shows
- [ ] Tell-words highlighted
- [ ] XSS sanitization working (no script execution)
- [ ] No errors

### 10. Quantum Reading
- [ ] Navigate to quantum reading form
- [ ] Enter short narrative (3-5 sentences)
- [ ] Click "Start Analysis"
- [ ] Split-pane layout displays:
  - [ ] Left: Full narrative with sentence highlighting
  - [ ] Right: Current analysis + history
- [ ] Click first sentence or press →
  - [ ] Tetralemma visualization displays
  - [ ] Density matrix stats display
  - [ ] History table adds row
- [ ] Continue through all sentences
  - [ ] Each sentence highlights purple (current)
  - [ ] Completed sentences show green
  - [ ] Pending sentences faded
- [ ] "Reset" button works
- [ ] No errors

## WORKBENCH TESTING (workbench.humanizer.com)

### 11. Workbench Landing
- [ ] Visit https://workbench.humanizer.com
- [ ] 3-column layout displays (Content | Canvas | Tools)
- [ ] Remote Content tab selected by default
- [ ] Tool Dock shows 10 panels

### 12. Allegorical Panel (Workbench)
- [ ] Click "Allegorical" in Tool Dock
- [ ] Panel opens in right column
- [ ] Enter text in Content Source
- [ ] Select persona, namespace, style
- [ ] Click "Transform"
- [ ] Results display in Canvas
- [ ] No V2 errors
- [ ] Uses V1 API correctly

### 13. Round-Trip Panel (Workbench)
- [ ] Click "Round-Trip" in Tool Dock
- [ ] Panel opens
- [ ] Select language
- [ ] Click "Transform"
- [ ] Results display with drift analysis
- [ ] No errors

### 14. AI Detection Panel (Workbench)
- [ ] Click "AI Detection" in Tool Dock
- [ ] Panel opens
- [ ] Click "Analyze"
- [ ] Results display
- [ ] Tell-words highlighted
- [ ] No errors

### 15. Personalizer Panel (Workbench)
- [ ] Click "Personalizer" in Tool Dock
- [ ] Panel opens
- [ ] 21 global personas load
- [ ] Select persona
- [ ] Click "Transform"
- [ ] Results display
- [ ] No 404 errors

### 16. Maieutic Panel (Workbench)
- [ ] Click "Maieutic" in Tool Dock
- [ ] Panel opens
- [ ] Select depth
- [ ] Click "Transform"
- [ ] Dialogue displays
- [ ] No errors

### 17. Multi-Reading Panel (Workbench)
- [ ] Click "Multi-Reading" in Tool Dock
- [ ] Panel opens
- [ ] Enter narrative
- [ ] Click "Start"
- [ ] Session created (201)
- [ ] Sentence-by-sentence analysis works
- [ ] No errors

### 18. Story Generation Panel (Workbench)
- [ ] Click "Story Generation" in Tool Dock
- [ ] Panel opens
- [ ] Enter prompt/seed
- [ ] Click "Generate"
- [ ] Story generates
- [ ] No errors

## ERRORS TO LOOK FOR

### Common Error Patterns:
1. **Console Errors**:
   - [ ] No 500 errors
   - [ ] No 404 errors
   - [ ] No "Failed to load" errors
   - [ ] No TypeScript errors

2. **Network Errors**:
   - [ ] All API calls return 200/201
   - [ ] No CORS errors
   - [ ] No timeout errors

3. **UI Errors**:
   - [ ] No blank screens
   - [ ] No infinite loading
   - [ ] Buttons are clickable
   - [ ] Forms are submittable

4. **Data Errors**:
   - [ ] Metrics show real data (not all 0s)
   - [ ] User counts match reality
   - [ ] Transformation results are coherent

## REGRESSION TESTING

### Previous Features (should still work):
- [ ] WebAuthn Touch ID login
- [ ] Mailing list signup modal
- [ ] Theme toggle (light/dark)
- [ ] Landing tutorial
- [ ] Help panel
- [ ] Logout

## NOTES

**If you find errors**:
1. Note the exact error message from browser console
2. Note which tool/panel/feature was being used
3. Note the URL where the error occurred
4. Note any request details (Network tab)

**Priority Issues**:
- Admin metrics 500 error (FIXED - needs verification)
- User management not tested yet
- Workbench V2 issues (should be fixed with V1 migration)

---

**Admin Metrics Fix Summary**:
- Changed queries to use actual database tables
- Added error handling for missing tables
- Backend deployed: bc6288a6-d27d-45a7-9d3b-f1773e0096d1
- Ready for testing!
