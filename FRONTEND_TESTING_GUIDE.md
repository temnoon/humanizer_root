# Frontend Testing with Chrome DevTools Agent

**Created**: October 17, 2025
**Agent**: `frontend-tester`
**Location**: `.claude/agents/frontend-tester.md`

---

## Overview

The Frontend Tester Agent is a specialized sub-agent that uses Chrome DevTools (via Puppeteer MCP) to automatically test the Humanizer frontend application.

---

## How to Use the Agent

### Method 1: Task Tool (From Main Claude Code Session)

From your main Claude Code conversation, use the Task tool to launch the agent:

```
Hey Claude, please use the Task tool to launch the frontend-tester agent and test the multi-view tabs feature.
```

Claude will then:
1. Launch the frontend-tester agent
2. The agent will navigate to http://localhost:3001
3. Execute tab tests systematically
4. Take screenshots
5. Report back findings

### Method 2: Direct Prompt

You can also directly ask:

```
Please test the frontend using the frontend-tester agent. Focus on the tabs system.
```

### Method 3: Specific Test Request

For targeted testing:

```
Launch the frontend-tester agent and verify:
1. Tab creation works
2. Tab switching maintains state
3. Tabs persist after refresh
```

---

## What the Agent Will Do

### Automatic Actions

1. **Navigate to App**
   - Opens http://localhost:3001
   - Waits for page load

2. **Take Screenshots**
   - Documents initial state
   - Captures after each action
   - Names screenshots descriptively

3. **Test Features**
   - Clicks buttons and elements
   - Fills forms
   - Navigates through UI
   - Verifies state changes

4. **Execute JavaScript**
   - Checks localStorage
   - Verifies app state
   - Looks for errors
   - Validates data structures

5. **Report Findings**
   - Describes what works
   - Reports bugs with evidence
   - Suggests fixes
   - Provides screenshots

---

## Test Priorities (Current Features)

The agent is pre-configured to test these features in priority order:

### 1. Multi-View Tabs (HIGHEST PRIORITY)
Just implemented today, needs thorough testing:

**Tests**:
- Tab bar visibility
- Tab creation (+ button)
- Tab switching (click, Cmd+1-9)
- Tab closing (× button, Cmd+W)
- State isolation between tabs
- Pin/unpin functionality
- Context menu (right-click)
- Persistence after refresh
- Mobile responsiveness

**Example Test Request**:
```
Test the tabs system:
- Create 3 tabs
- Open different conversations in each
- Switch between tabs
- Verify state isolation
- Refresh and check persistence
```

### 2. Working Memory Widget (MEDIUM PRIORITY)
Previously implemented, verify no regressions:

**Tests**:
- Widget visibility (bottom-right)
- Enable/disable tracking
- Auto-tracking conversations
- No duplicate titles
- Click-to-navigate
- Save to interest list
- Button layout (no overflow)

**Example Test Request**:
```
Test the Working Memory widget:
- Enable tracking
- Open several conversations
- Verify unique titles appear
- Click an item to navigate
- Check all buttons are visible
```

### 3. Mobile Responsiveness (MEDIUM PRIORITY)
Test at multiple viewport sizes:

**Tests**:
- 320px (iPhone SE)
- 375px (iPhone 8)
- 768px (iPad)
- 1024px (Desktop)
- Touch targets ≥ 44px
- No overflow issues

**Example Test Request**:
```
Test mobile responsiveness:
- Check layout at 320px, 375px, 768px
- Verify touch targets
- Check for overflow issues
- Test tab bar scrolling
```

### 4. Core Features (LOW PRIORITY)
Basic functionality verification:

**Tests**:
- Sidebar navigation
- Conversation list loading
- Conversation viewer
- Interest lists CRUD
- Settings panel
- Agent prompt (Cmd+K)

---

## Example Test Sessions

### Session 1: Quick Tabs Test

**Your Request**:
```
Test the multi-view tabs quickly - just verify they work
```

**Agent Will**:
1. Navigate to http://localhost:3001
2. Screenshot initial state
3. Click + button to create tab
4. Verify tab appears
5. Switch between tabs
6. Take final screenshot
7. Report: "✅ Tabs working" or "❌ Issue found: [details]"

### Session 2: Comprehensive Tabs Test

**Your Request**:
```
Thoroughly test the tabs system with all features
```

**Agent Will**:
1. Test tab creation
2. Test tab switching (click and keyboard)
3. Test tab closing
4. Test pin/unpin
5. Test context menu
6. Test state isolation (open different conversations)
7. Test persistence (refresh browser)
8. Test mobile responsive (resize viewport)
9. Execute JavaScript to verify localStorage
10. Comprehensive report with screenshots

### Session 3: Regression Test

**Your Request**:
```
Run a full regression test on the frontend
```

**Agent Will**:
1. Test tabs system
2. Test working memory widget
3. Test interest lists
4. Test conversation viewer
5. Test settings panel
6. Report all findings with priority levels

### Session 4: Bug Investigation

**Your Request**:
```
There's a bug where tabs don't restore correctly. Investigate.
```

**Agent Will**:
1. Create several tabs with different content
2. Take screenshot of current state
3. Refresh browser
4. Compare before/after
5. Execute JavaScript to check localStorage
6. Identify the issue
7. Suggest fix

---

## Reading Test Results

The agent will provide structured reports:

### Report Format

```markdown
## Test: Multi-View Tabs Creation
**Date**: 2025-10-17
**URL**: http://localhost:3001
**Status**: ✅ PASS

### What Was Tested
- Tab creation via + button
- Tab visibility in UI
- Tab count in localStorage

### Results
- ✅ Tab bar visible below TopBar
- ✅ + button clickable
- ✅ New tab created successfully
- ✅ Tab count increased in store
- ✅ New tab became active

### Screenshots
- initial-state.png
- tab-created.png
- final-state.png

### Issues Found
None

### Recommendations
Feature working as expected. Ready for production.
```

### Status Indicators
- ✅ **PASS**: Feature works perfectly
- ⚠️ **PARTIAL**: Works but has minor issues
- ❌ **FAIL**: Feature broken or has major issues

### Severity Levels
- **High**: Breaks functionality, needs immediate fix
- **Medium**: Impacts UX, should fix soon
- **Low**: Minor issue, fix when convenient

---

## Advanced Usage

### Testing Specific Selectors

```
Test clicking the element with selector ".tab-new" and verify a new tab appears
```

### Testing JavaScript State

```
Navigate to the app and execute JavaScript to check if the tab store has correct structure
```

### Testing at Specific Viewport

```
Test the tabs at 375px width and take screenshots
```

### Testing Keyboard Shortcuts

Note: Keyboard shortcuts (Cmd+T, Cmd+W, etc.) may not be testable via Puppeteer as they're browser shortcuts. The agent will test click interactions instead.

---

## Prerequisites

### Before Testing

1. **Dev Server Running**
   ```bash
   cd /Users/tem/humanizer_root/frontend
   npm run dev
   ```
   Should be at: http://localhost:3001

2. **Backend Running** (Optional for frontend tests)
   ```bash
   cd /Users/tem/humanizer_root
   poetry run uvicorn humanizer.main:app --reload --port 8000
   ```

3. **Chrome DevTools MCP Server**
   Should be configured in your Claude Code MCP settings

### Verify Setup

Test the agent can connect:
```
Launch frontend-tester agent and navigate to http://localhost:3001, then take a screenshot
```

If you see a screenshot, setup is correct!

---

## Troubleshooting

### Issue: Agent can't connect to Chrome

**Solution**:
1. Verify Chrome DevTools MCP server is running
2. Check MCP settings in Claude Code
3. Try restarting Claude Code

### Issue: Agent can't find elements

**Possible Causes**:
1. Element selector is wrong
2. Page hasn't loaded yet
3. Element is hidden/collapsed

**Solution**: Ask agent to:
- Take screenshot to see page state
- Execute JavaScript to list available elements
- Wait longer for page load

### Issue: Tests fail unexpectedly

**Possible Causes**:
1. Dev server not running
2. Previous test left app in bad state
3. Timing issues (page not loaded)

**Solution**:
1. Refresh browser manually
2. Restart dev server
3. Ask agent to wait longer between actions

---

## Tips for Effective Testing

### 1. Start Simple
Begin with basic tests before complex scenarios:
```
Test that the tab bar appears on page load
```

### 2. Test One Thing at a Time
Focus on specific features:
```
Only test tab creation, not switching
```

### 3. Use Screenshots Liberally
Visual evidence is invaluable:
```
Take screenshots before and after each action
```

### 4. Verify with JavaScript
Confirm state changes:
```
After creating a tab, verify the store has 2 tabs
```

### 5. Test Edge Cases
Try to break things:
```
Try to close the last tab
Try to create 11 tabs (max is 10)
Try to close a pinned tab
```

### 6. Document Everything
Clear test requests get better results:
```
Test tabs:
1. Create 3 tabs
2. Open conversation in tab 1
3. Open different conversation in tab 2
4. Switch to tab 1
5. Verify correct conversation shown
6. Take screenshots at each step
```

---

## Testing Checklist

Use this when requesting comprehensive tests:

### Multi-View Tabs
- [ ] Tab bar visible
- [ ] Create tab with + button
- [ ] Switch tabs by clicking
- [ ] Close tab with × button
- [ ] Pin tab (right-click)
- [ ] Try close pinned tab (should fail)
- [ ] Context menu appears
- [ ] State isolation (different conversations)
- [ ] Persistence after refresh
- [ ] Mobile: touch targets
- [ ] Mobile: horizontal scroll

### Working Memory Widget
- [ ] Widget visible bottom-right
- [ ] Enable tracking button
- [ ] Conversations auto-tracked
- [ ] Unique titles (no duplicates)
- [ ] Click item to navigate
- [ ] Save to list button
- [ ] All buttons visible (no overflow)

### General UI
- [ ] Sidebar opens/closes
- [ ] TopBar visible
- [ ] Conversations load
- [ ] Interest lists work
- [ ] Settings panel opens
- [ ] No console errors

### Responsive
- [ ] 320px layout
- [ ] 375px layout
- [ ] 768px layout
- [ ] 1024px layout
- [ ] Touch targets ≥ 44px
- [ ] No horizontal scroll (except tabs)

---

## Example Test Requests

### Quick Smoke Test
```
Run a quick smoke test on the frontend - verify tabs and working memory work
```

### Comprehensive Test
```
Run a complete test of all frontend features:
1. Tabs system (all operations)
2. Working memory widget
3. Interest lists
4. Conversation viewer
5. Mobile responsive (320px, 768px)
Report all issues found
```

### Feature-Specific Test
```
Test only the tab pinning feature:
1. Create a tab
2. Right-click it
3. Select "Pin Tab"
4. Verify pin indicator appears
5. Try to close it
6. Verify it can't be closed
7. Unpin it
8. Verify it can now be closed
```

### Bug Investigation
```
Investigate this bug:
"When I create 3 tabs and refresh, only 2 tabs appear"

Steps to reproduce:
1. Create 3 tabs
2. Open different conversations in each
3. Take screenshot
4. Refresh page
5. Take screenshot
6. Compare tab counts
7. Check localStorage
8. Report findings
```

### Performance Test
```
Test performance with many tabs:
1. Create 10 tabs (max limit)
2. Switch between them rapidly
3. Check for lag or issues
4. Try to create 11th tab
5. Verify warning appears
```

---

## Agent Limitations

The frontend-tester agent **CAN**:
- Navigate to URLs
- Click elements
- Fill forms
- Take screenshots
- Execute JavaScript
- Verify state
- Report issues

The frontend-tester agent **CANNOT**:
- Modify code
- Start/stop servers
- Test native keyboard shortcuts (Cmd+K, etc.)
- Access system clipboard
- Test file uploads
- Test downloads

For limitations, test manually or modify test approach.

---

## Best Practices

1. **Keep Servers Running**: Don't stop dev server during tests
2. **Clear State**: Refresh browser between test sessions if needed
3. **Be Specific**: Clear test requests get better results
4. **Review Screenshots**: Always check screenshots in agent reports
5. **Iterate**: If a test fails, refine and retry
6. **Document Issues**: Create GitHub issues for bugs found
7. **Test After Changes**: Run tests after every significant change

---

## Getting Help

If you need assistance with the testing agent:

1. **Check Prerequisites**: Ensure servers are running
2. **Review Agent File**: See `.claude/agents/frontend-tester.md`
3. **Test Simple First**: Start with basic navigation
4. **Check Screenshots**: Visual evidence helps debug
5. **Ask Claude**: "Why did this test fail?" with details

---

## Summary

You now have a specialized frontend testing agent that can:
- Automatically test your React application
- Take screenshots for visual verification
- Execute JavaScript to verify state
- Report issues clearly
- Suggest fixes

**To use it**:
```
Launch the frontend-tester agent and test the multi-view tabs feature
```

The agent will handle the rest! 🧪

---

**Happy Testing!** 🚀
