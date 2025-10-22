# MCP Permissions Experiment - Session Notes

**Date**: October 17, 2025
**Session**: Multi-View Tabs + MCP Architecture Investigation
**Status**: Experiment in progress, awaiting next session test

---

## 🎯 Research Question

**Can the main agent reduce context size by removing unused MCP tools while subagents retain access?**

### Goals
1. Reduce main agent token budget usage
2. Keep specialized tools available to subagents
3. Maintain clear separation of concerns (development vs testing)

---

## 🏗️ MCP Architecture Discovered

### Three Configuration Layers

1. **Global MCP Servers** (`~/.claude/mcp_servers.json`)
   - Defines available MCP servers for entire Claude Code instance
   - Servers: chrome-devtools, chromadb-memory, humanizer, etc.
   - Cannot be disabled per-agent

2. **Project MCP Servers** (`~/.config/claude-code/mcp.json`)
   - Project-specific MCP servers
   - Example: humanizer MCP server for this project
   - Also available to all agents in project

3. **Project Permissions** (`.claude/settings.local.json`)
   - Controls which tools require permission
   - Three lists: `allow`, `ask`, `deny`
   - **This is the key control point**

### Permission Lists

```json
{
  "permissions": {
    "allow": [  // Tools available immediately, in active context
      "Read",
      "Write",
      "Bash(git:*)",
      // ... etc
    ],
    "ask": [    // Tools available but require permission prompt
      "mcp__chrome-devtools__*"
    ],
    "deny": [   // Tools blocked (unknown if removed from context)
      // empty for now
    ]
  }
}
```

---

## 🧪 Experiment Timeline

### Test 1: Chrome DevTools in "ask" List

**Date**: Oct 17, 2025 (this session)

**Action**: Moved all Chrome DevTools tools from `allow` → `ask`

**Hypothesis**:
- Main agent would need permission prompts
- Subagent would also need prompts (inherit permissions)

**Test Method**:
```
Launch frontend-tester subagent
Navigate to http://localhost:3001
Take screenshot
```

**Results**:
- ✅ Subagent had FULL, IMMEDIATE access
- ✅ No permission prompts appeared
- ✅ Both navigate and screenshot worked instantly
- ✅ Successfully captured app screenshot

**Conclusion**: **Subagents have independent MCP tool access!**
- Moving tools to "ask" doesn't affect subagents
- Subagents can use tools freely regardless of main agent restrictions

**Implications**:
- Main agent: Would see permission prompt if trying to use Chrome DevTools
- Subagent: Can use Chrome DevTools freely
- Question remaining: Does "ask" actually reduce main agent context?

---

### Test 2: Chrome DevTools in "deny" List (PENDING)

**Scheduled**: Next context session (fresh token budget needed)

**Action**: Move Chrome DevTools from `ask` → `deny`

**Hypothesis**:
- Main agent will be completely blocked from Chrome DevTools
- Subagent will still have full access (based on Test 1 results)
- Main agent context will be reduced (tokens saved)

**Test Method**:
```
1. Edit .claude/settings.local.json:
   - Move mcp__chrome-devtools__* to "deny" list

2. Verify main agent cannot use tools:
   - Try to use puppeteer_navigate (should fail)

3. Launch subagent and verify access:
   - frontend-tester can still navigate and screenshot

4. Check if context actually reduced:
   - Observe token usage difference
```

**Expected Results**:
- ❌ Main agent: Blocked from Chrome DevTools
- ✅ Subagent: Full access to Chrome DevTools
- ✅ Context savings: Tools not in main agent's function list

**If successful**: Proves we can have specialized tool access per agent type

**If unsuccessful**: Need alternative approach (e.g., separate agent configurations)

---

## 📊 Current Configuration

### settings.local.json State

```json
{
  "permissions": {
    "allow": [
      // Development tools
      "Bash(git:*)",
      "Read",
      "Write",
      "Edit",

      // Memory tools
      "mcp__chromadb-memory__*",

      // Humanizer MCP tools
      "mcp__humanizer__*",

      // NOT Chrome DevTools (moved to ask)
    ],
    "ask": [
      // Chrome DevTools (testing tools)
      "mcp__chrome-devtools__puppeteer_navigate",
      "mcp__chrome-devtools__puppeteer_screenshot",
      "mcp__chrome-devtools__puppeteer_click",
      "mcp__chrome-devtools__puppeteer_fill",
      "mcp__chrome-devtools__puppeteer_select",
      "mcp__chrome-devtools__puppeteer_hover",
      "mcp__chrome-devtools__puppeteer_evaluate"
    ],
    "deny": []
  }
}
```

**Rationale**:
- Main agent focuses on development (Read, Write, Edit, Git, Memory)
- Testing tools in "ask" to reduce context (hypothesis)
- Subagents handle browser testing with full access (proven)

---

## 🎯 Benefits of This Architecture

### If Tests Succeed

1. **Context Optimization**
   - Main agent: Smaller function list, more token budget for code
   - Subagent: Specialized tools when needed
   - Clear separation of concerns

2. **Specialized Agents**
   - Main agent: Development and orchestration
   - Frontend-tester: Browser testing with Chrome DevTools
   - Future agents: Could have other specialized tool sets

3. **Clean Delegation Pattern**
   ```
   User: "Test the tabs feature"
   Main agent: "I'll delegate to frontend-tester"
   Subagent: Uses Chrome DevTools to test
   Main agent: Presents test results
   ```

4. **Scalability**
   - Easy to add new specialized subagents
   - Each can have domain-specific tools
   - Main agent stays focused and lean

---

## 🔬 Three Scenarios Analysis

### Scenario 1: Tool Permissions Inherited
```
Main: ask/deny → Subagent: ask/deny (same restrictions)
```
**If true**: Subagents can't bypass main agent restrictions
**Test 1 result**: ❌ This is NOT true

### Scenario 2: Subagents Have Full Access
```
Main: ask/deny → Subagent: full access (regardless)
```
**If true**: Subagents always have all MCP tools
**Test 1 result**: ✅ This appears TRUE (proven with "ask")
**Test 2 will verify**: Does this hold with "deny"?

### Scenario 3: Per-Agent Configuration
```
.claude/agents/frontend-tester.json:
{
  "permissions": { "allow": ["mcp__chrome-devtools__*"] }
}
```
**If true**: Each agent can have custom permissions
**Reality**: No evidence this exists in current Claude Code architecture
**Conclusion**: Not available, but would be ideal future enhancement

---

## 💡 Key Insights

### Architectural Pattern Discovered

**Main Agent** (Executive/Orchestrator):
- Development tools: Read, Write, Edit, Bash
- Memory tools: ChromaDB
- Orchestration tools: Task (to launch subagents)
- ❌ NOT testing tools (Chrome DevTools)

**Subagent** (Specialized Worker):
- Domain-specific tools: Chrome DevTools for testing
- Specialized knowledge: App structure, test priorities
- Independent execution: Autonomous testing, comprehensive reports
- ✅ Full tool access regardless of main agent restrictions

### Token Budget Optimization

**Theory**: Moving tools to "ask" or "deny" removes them from main agent context
**Question**: Does this actually reduce token usage?
**Next**: Test with "deny" to verify context savings

### Why This Matters

Current session: ~123,000 tokens used (out of 200,000)
- MCP tool definitions take tokens
- Removing unused tools = more tokens for actual work
- Main agent rarely needs Chrome DevTools directly
- Subagent handles all browser testing

**Potential Savings**: If "deny" removes tools from context:
- Chrome DevTools: ~7 tools × ~50 tokens each = ~350 tokens saved per request
- Compounding: Over 100s of requests in long sessions
- Result: More capacity for code, reasoning, planning

---

## 📝 Action Items

### For This Session
- ✅ Created ChromaDB memory documenting experiment
- ✅ Updated CLAUDE.md with MCP permissions section
- ✅ Added todo for Test 2 (deny scenario)
- ✅ Documented architecture in SUBAGENTS_VS_TOOLS.md

### For Next Session
- [ ] **Test Option A**: Move Chrome DevTools to "deny" list
- [ ] Verify main agent cannot use Chrome DevTools
- [ ] Verify subagent still has full access
- [ ] Measure token usage difference (if observable)
- [ ] Document findings in ChromaDB memory
- [ ] Update CLAUDE.md with final architecture

### Future Considerations
- [ ] Document best practices for MCP permissions
- [ ] Create guide for adding new specialized subagents
- [ ] Test other MCP tools (e.g., Playwright, Super Shell)
- [ ] Investigate if per-agent permissions possible in future

---

## 🎓 Lessons Learned

1. **Subagents are independent**
   - Not just different prompts
   - Have different tool access patterns
   - Can bypass main agent restrictions

2. **Permissions are sophisticated**
   - Three-tier system (global, project, permissions)
   - Allow/ask/deny provide granular control
   - Project-level control is key

3. **Architecture enables specialization**
   - Main agent: Generalist
   - Subagents: Specialists
   - Clean separation via delegation

4. **Documentation is critical**
   - Complex architecture needs explanation
   - CLAUDE.md guides future sessions
   - ChromaDB memories preserve discoveries

---

## 📚 Related Documents

- **SUBAGENTS_VS_TOOLS.md** - Architecture explanation
- **CLAUDE.md** - Updated with MCP permissions section
- **FRONTEND_TESTING_GUIDE.md** - How to use testing subagent
- **.claude/agents/frontend-tester.md** - Subagent definition
- **.claude/settings.local.json** - Current permissions config

---

## 🔮 Future Vision

If this architecture proves successful:

```
Main Agent (Lean)
├─ Development tools only
├─ Delegates specialized work
└─ Orchestrates multiple subagents

Subagent: frontend-tester
├─ Chrome DevTools
└─ Browser testing

Subagent: code-reviewer (future)
├─ Static analysis tools
└─ Code quality checking

Subagent: db-manager (future)
├─ PostgreSQL direct access
└─ Database operations

Subagent: deployment (future)
├─ Docker, SSH tools
└─ Production deployment
```

**Result**: Efficient, specialized, scalable agent architecture

---

**Status**: Awaiting Test 2 (deny scenario) in next session

**Last Updated**: Oct 17, 2025
