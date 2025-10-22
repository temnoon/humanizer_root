# Subagents vs Tools: Architecture & Best Practices

**Date**: October 17, 2025
**Context**: Understanding Claude Code's agent architecture

---

## 🎯 Core Distinction

### Tools
**Definition**: Direct function calls available in the current agent's session

**Characteristics**:
- ✅ Execute immediately with parameters
- ✅ Return results synchronously to the current agent
- ✅ Part of the agent's context/capabilities
- ✅ Can be called multiple times in a conversation
- ✅ Results are directly accessible to the agent

**Examples**:
- `Bash` - Execute shell commands
- `Read` - Read files from disk
- `Write` - Write files to disk
- `Grep` - Search file contents
- `mcp__chrome-devtools__puppeteer_navigate` - Navigate browser
- `mcp__chromadb-memory__store_memory` - Store memories

**Usage Pattern**:
```
Agent thinks: "I need to read a file"
Agent calls: Read tool with file path
Tool returns: File contents immediately
Agent continues: Uses the file contents in response
```

---

### Subagents
**Definition**: Separate AI agent instances launched to perform specialized tasks

**Characteristics**:
- ✅ Independent AI instances with their own context
- ✅ Have specialized prompts/instructions
- ✅ Can have different tool access than main agent
- ✅ Run autonomously until task completion
- ✅ Return a final report/summary when done
- ✅ Cannot be "conversed with" - they run and report back

**Examples**:
- `frontend-tester` - Specialized for browser testing
- `Explore` - Specialized for codebase exploration
- `general-purpose` - Multi-purpose task executor

**Usage Pattern**:
```
User asks: "Test the frontend tabs feature"
Main agent thinks: "This is a frontend testing task"
Main agent launches: frontend-tester subagent via Task tool
Subagent receives: Testing instructions and context
Subagent executes: Tests autonomously using its tools
Subagent returns: Comprehensive test report
Main agent presents: The report to the user
```

---

## 🏗️ Architectural Differences

### Tool Architecture

```
┌─────────────────────────────────────┐
│         Main Agent (Claude)         │
│                                     │
│  Has access to:                    │
│  • Bash                             │
│  • Read/Write/Edit                  │
│  • Grep/Glob                        │
│  • MCP Tools (ChromaDB, Chrome, etc)│
│                                     │
│  Calls tools directly →             │
│  Results come back immediately      │
└─────────────────────────────────────┘
```

### Subagent Architecture

```
┌─────────────────────────────────────┐
│         Main Agent (Claude)         │
│  • Orchestrates work                │
│  • Delegates specialized tasks      │
│  • Receives final reports           │
└──────────────┬──────────────────────┘
               │
               │ Launches via Task tool
               │
               ▼
┌─────────────────────────────────────┐
│    Subagent (frontend-tester)       │
│                                     │
│  Has access to:                    │
│  • Chrome DevTools MCP              │
│  • Bash (limited)                   │
│  • Read (for verification)          │
│                                     │
│  Has specialized knowledge:         │
│  • App structure                    │
│  • Test priorities                  │
│  • Reporting format                 │
│                                     │
│  Executes autonomously →            │
│  Returns comprehensive report       │
└─────────────────────────────────────┘
```

---

## 🎓 When to Use Each

### Use Tools When:
1. **Single, direct operation needed**
   - Read a file
   - Execute a command
   - Search for text
   - Navigate browser to a URL

2. **Immediate result needed**
   - Quick file operations
   - Simple bash commands
   - Direct API calls

3. **Iterative work in same context**
   - Building a feature step-by-step
   - Debugging with multiple reads/edits
   - Exploring code interactively

**Example**: "Read the App.tsx file and check line 150"
→ Main agent uses Read tool directly

---

### Use Subagents When:
1. **Complex, multi-step task**
   - Comprehensive testing
   - Codebase exploration
   - Multi-file refactoring

2. **Specialized domain knowledge needed**
   - Frontend testing (knows test priorities)
   - Code review (knows best practices)
   - Security audit (knows vulnerabilities)

3. **Autonomous execution desired**
   - Long-running tests
   - Systematic code search
   - Documentation generation

4. **Context isolation beneficial**
   - Keep main conversation focused
   - Avoid cluttering main context
   - Specialized tool access

**Example**: "Test the entire tabs system comprehensively"
→ Main agent launches frontend-tester subagent

---

## 💡 Key Insight: Tool Access Separation

### The Problem
If the main agent has access to ALL tools (including Chrome DevTools), it:
- Clutters the main agent's context
- Wastes token budget on unused capabilities
- Makes the agent's prompt longer and less focused

### The Solution
**Specialized Subagents with Scoped Tool Access**

```
Main Agent Context:
- Development tools (Read, Write, Edit, Bash)
- Memory tools (ChromaDB)
- Orchestration tools (Task)
- ❌ NOT Chrome DevTools (only subagent uses it)

Frontend-Tester Subagent Context:
- Chrome DevTools (puppeteer_navigate, click, etc.)
- Limited Read (for verification)
- Limited Bash (for simple checks)
- ❌ NOT Write/Edit (testing, not modifying)
```

**Benefits**:
- ✅ Main agent context stays clean and focused
- ✅ Subagent has exactly what it needs
- ✅ Clear separation of concerns
- ✅ Better token efficiency
- ✅ Easier to maintain and update

---

## 🔧 Can We Remove Chrome DevTools from Main Agent?

### Current Situation
**Chrome DevTools MCP server** is configured at the Claude Code level and is available to all agents (main and subagents) that run in the same Claude Code instance.

### What We Want
**Main agent**: Should NOT use Chrome DevTools directly
**Frontend-tester subagent**: Should have Chrome DevTools access

### Can We Achieve This?

#### Option 1: Configuration-Based Filtering ❓
**Theoretical**: MCP servers could support per-agent tool filtering
**Reality**: Current MCP implementation (as of Oct 2025) does not support this
**Conclusion**: Cannot configure different MCP tools for different agents

#### Option 2: Architectural Best Practice ✅
**Approach**: Main agent simply doesn't use Chrome DevTools tools
**Implementation**:
- Document in CLAUDE.md: "Use frontend-tester subagent for testing"
- Main agent knows to delegate browser testing
- Subagent has Chrome DevTools in its context

**Conclusion**: This is what we've implemented

#### Option 3: Manual Context Management ❌
**Approach**: Remove Chrome DevTools from main agent's prompt
**Reality**: MCP tools are automatically available, not prompt-controlled
**Conclusion**: Not feasible with current architecture

---

## ✅ Our Implementation

### What We Did

1. **Created Specialized Subagent**
   - File: `.claude/agents/frontend-tester.md`
   - Purpose: Frontend testing only
   - Tools: Chrome DevTools, Read, Bash
   - Knowledge: App structure, test priorities

2. **Documented Best Practice**
   - CLAUDE.md: "Use frontend-tester subagent for testing"
   - Critical Rule #11: "Frontend testing: Use frontend-tester subagent"
   - Clear instructions on when/how to use it

3. **Architectural Separation**
   - Main agent: Development and orchestration
   - Subagent: Browser testing and verification
   - Clear delegation pattern

### What This Achieves

**Functionally**: Main agent doesn't use Chrome DevTools directly
- ❌ Main agent won't call `puppeteer_navigate` itself
- ✅ Main agent will launch frontend-tester subagent
- ✅ Subagent uses Chrome DevTools
- ✅ Main agent receives test report

**Contextually**: Reduces cognitive load
- Main agent focuses on development
- Subagent focuses on testing
- Clear separation of concerns

**Practically**: Best we can do with current MCP architecture
- Chrome DevTools tools technically available to both
- Main agent just doesn't use them (by design/documentation)
- Future MCP versions might support per-agent tool filtering

---

## 📊 Comparison Table

| Aspect | Tools | Subagents |
|--------|-------|-----------|
| **Execution** | Direct, immediate | Launched, autonomous |
| **Context** | Same as main agent | Independent context |
| **Communication** | Synchronous results | Final report only |
| **Specialization** | General capabilities | Domain-specific |
| **Tool Access** | Shares main agent's tools | Can have different tools |
| **State** | Main agent's state | Independent state |
| **Prompt** | Main agent's prompt | Custom specialized prompt |
| **Use Case** | Single operations | Complex tasks |
| **Example** | Read a file | Test entire feature |

---

## 🎯 Best Practices

### For Main Agents
1. **Delegate specialized work** to subagents
2. **Use tools directly** for simple operations
3. **Document delegation patterns** clearly
4. **Orchestrate** rather than execute everything

### For Subagents
1. **Have specialized knowledge** in their prompt
2. **Be autonomous** - don't need interaction
3. **Provide comprehensive reports** as final output
4. **Know their tool capabilities** explicitly

### For Users
1. **Ask main agent to delegate** testing to subagent
2. **Use subagents for** comprehensive tasks
3. **Use direct requests for** simple operations
4. **Understand the benefits** of specialization

---

## 📝 Example Workflows

### Workflow 1: Direct Tool Use (Simple)
```
User: "Read App.tsx and check line 154"

Main Agent:
1. Uses Read tool with file path and line number
2. Returns the code at line 154
3. User sees result immediately

Total time: <1 second
Context: Main agent only
```

### Workflow 2: Subagent Delegation (Complex)
```
User: "Test the multi-view tabs system comprehensively"

Main Agent:
1. Recognizes this is a testing task
2. Launches frontend-tester subagent via Task tool
3. Passes testing instructions to subagent

Frontend-Tester Subagent:
1. Navigates to http://localhost:3001
2. Takes initial screenshot
3. Tests tab creation (click +)
4. Tests tab switching
5. Tests tab closing
6. Tests persistence
7. Verifies localStorage state
8. Takes screenshots at each step
9. Generates comprehensive report

Main Agent:
1. Receives subagent's report
2. Presents findings to user

Total time: ~2-3 minutes
Context: Main + subagent
Result: Comprehensive test report with evidence
```

### Workflow 3: Hybrid (Best of Both)
```
User: "Implement a new feature and test it"

Main Agent:
1. Uses Write/Edit tools to create code
2. Uses Bash to run build
3. Launches frontend-tester subagent to test
4. Receives test report
5. Uses Edit tool to fix issues found
6. Launches subagent again to verify fix

Result: Code written and verified working
```

---

## 🔮 Future Possibilities

### If MCP Adds Per-Agent Tool Filtering

```yaml
# Hypothetical .claude/agents/frontend-tester.yaml
name: frontend-tester
tools:
  allowed:
    - mcp__chrome-devtools__*
    - Bash (limited)
    - Read (limited)
  denied:
    - Write
    - Edit
    - Git*

# Hypothetical .claude/agents/main.yaml
name: main
tools:
  allowed:
    - Bash
    - Read
    - Write
    - Edit
    - Git*
    - mcp__chromadb-memory__*
  denied:
    - mcp__chrome-devtools__*  # Only for subagents
```

**Benefits**:
- True tool access separation
- Enforced at configuration level
- Cannot accidentally use wrong tools
- Smaller context for each agent

**Status**: Not available as of Oct 2025, but would be valuable future enhancement

---

## 🎓 Key Takeaways

1. **Tools = Direct Operations**
   - Immediate execution
   - Same context as main agent
   - Simple, focused tasks

2. **Subagents = Specialized Workers**
   - Independent execution
   - Domain expertise
   - Complex, multi-step tasks

3. **Separation is Architectural**
   - Main agent orchestrates
   - Subagents specialize
   - Clear delegation patterns

4. **Best Practice: Document & Delegate**
   - Document when to use subagents
   - Main agent knows to delegate
   - Subagent has specialized knowledge

5. **Current Limitation: Tool Access Shared**
   - MCP tools available to all agents
   - Separation is by convention, not enforcement
   - Works well in practice with clear documentation

6. **Frontend Testing Pattern**
   - Main agent: Development work
   - Subagent: Browser testing
   - Clean separation achieved

---

## 🚀 Conclusion

**Subagents** and **Tools** serve different purposes in Claude Code's architecture:

- **Tools** are for direct, immediate operations within the current context
- **Subagents** are for complex, specialized tasks that benefit from independence

**Our frontend-tester subagent** is a perfect example:
- Main agent focuses on development
- Subagent focuses on testing
- Clear delegation pattern
- Comprehensive, automated testing
- Clean separation of concerns

**While we cannot (currently) remove Chrome DevTools MCP from the main agent's available tools**, we've achieved functional separation through:
- Documentation (CLAUDE.md)
- Architectural best practices (delegation pattern)
- Specialized subagent with testing knowledge

This is the **best approach available** with current Claude Code architecture and provides excellent results in practice.

---

**End of Document**
