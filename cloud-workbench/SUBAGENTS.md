# Workbench M4 - Specialized Subagent Guide

**Purpose**: Define specialized subagents to optimize multi-session workflow and minimize detail loss during context handoffs.

**Project**: Cloud Workbench M4 - NPE Integration (37-47.5 hours across multiple sessions)

---

## Quick Reference

When you need to invoke a subagent for this project:

```
Launch {subagent-name} and {task description}
```

**Available Subagents** (in priority order):
1. **transformation-panel-builder** - Accelerate Phase 3 panel creation
2. **test-generator** - Maintain test coverage
3. **api-adapter-specialist** - Handle dual backend complexity
4. **integration-tester** - E2E workflow validation
5. **handoff-maintainer** - Keep documentation current
6. **context-compressor** - Summarize when approaching token limit

---

## 1. Transformation Panel Builder (HIGH PRIORITY)

### When to Use
- Building any of the 5 transformation panels (Phase 3)
- Creating new tool panels that follow the established pattern
- Need to accelerate panel development

### Capabilities
- Generates complete panel component following established patterns
- Creates matching test suite (10+ tests)
- Implements proper TypeScript types
- Handles loading states, errors, and edge cases
- Integrates with CanvasContext and API adapter

### Invocation Template
```
Launch transformation-panel-builder and create {PanelName} with the following specs:

Type: {allegorical|round-trip|ai-detection|personalizer|maieutic}
Config Fields: {list specific form fields}
API Endpoint: {endpoint path}
Response Shape: {TypeScript interface}
Special Features: {any unique requirements}

Follow the established pattern:
- useCanvas().getActiveText() for input
- Markdown rendering for output with react-markdown
- "Load to Canvas" callback via setText()
- Auto-save to transformation_history
- Error handling with user-friendly messages
- Loading states during API calls

Include 10-15 unit tests covering:
- Rendering with canvas text
- Form validation
- API success/error cases
- Result display
- Canvas integration
```

### Expected Output
- Complete component file (~250-350 lines)
- Test file (~200 lines, 10-15 tests)
- Updated tool-registry.tsx entry
- Integration verification

### Example
```
Launch transformation-panel-builder and create AllegoricalPanel with:

Type: allegorical
Config Fields: persona (dropdown), namespace (dropdown), style (dropdown), model (optional), length_preference (dropdown)
API Endpoint: POST /transformations/allegorical
Response: { transformation_id, final_projection, reflection, stages: { deconstruct, map, reconstruct, stylize } }
Special Features: 5-stage progress indicator, collapsible stage sections

Follow established pattern with 12 tests covering all stages.
```

---

## 2. Test Generator (HIGH PRIORITY)

### When to Use
- After creating any new component
- Modifying existing components that lack tests
- Need to reach 90%+ coverage target
- Discovered edge cases that need testing

### Capabilities
- Analyzes component/context structure
- Generates comprehensive test suites
- Follows established testing patterns
- Covers unit + integration scenarios
- Maintains consistency with existing tests

### Invocation Template
```
Launch test-generator and create tests for {ComponentPath}:

Component Type: {context|component|hook|utility}
Current Coverage: {percentage if known}
Critical Paths: {list important user flows}
Edge Cases: {list known edge cases}

Follow test patterns from src/core/context/CanvasContext.test.tsx:
- Describe blocks for logical grouping
- Clear test names describing behavior
- Proper mocking (window.getSelection, API calls, etc.)
- Integration scenarios testing full workflows
- Error handling and edge cases

Target: {number} tests achieving >90% coverage
```

### Expected Output
- Complete test file (~200-300 lines)
- Coverage report showing improvement
- Integration test scenarios
- Documentation of what's tested

### Example
```
Launch test-generator and create tests for src/features/panels/allegorical/AllegoricalPanel.tsx:

Component Type: component
Current Coverage: 0%
Critical Paths:
- User selects config → transforms → displays results
- User loads result back to canvas
- Error handling for API failures
Edge Cases:
- Empty text input
- Very long text (>10k chars)
- Network timeout

Target: 15 tests covering rendering, user interactions, API integration, error states
```

---

## 3. API Adapter Specialist (MEDIUM PRIORITY)

### When to Use
- Implementing dual backend support (Phase 1)
- Adding new API endpoints to adapter
- Debugging local vs remote API differences
- Need to update TypeScript types from Workers

### Capabilities
- Implements both local and remote API methods
- Handles TypeScript type definitions
- Auth injection for remote API
- Request/response validation with Zod
- Error handling for both backends

### Invocation Template
```
Launch api-adapter-specialist and implement {EndpointName}:

Endpoint: {HTTP method} {path}
Purpose: {what this endpoint does}

Local Implementation:
- Base URL: http://localhost:8000
- Auth: None
- Special handling: {any local-specific logic}

Remote Implementation:
- Base URL: https://api.humanizer.com
- Auth: Bearer token from AuthContext
- Special handling: {any remote-specific logic}

Request Type: {TypeScript interface}
Response Type: {TypeScript interface}
Error Cases: {list possible errors}

Validation: Use Zod schemas from workers/shared if available
```

### Expected Output
- Updated src/core/adapters/api.ts with both implementations
- TypeScript types defined or imported
- Zod validation schemas
- Error handling for common cases
- Documentation comments

---

## 4. Integration Tester (MEDIUM PRIORITY)

### When to Use
- Completing a major phase
- Need to verify end-to-end workflows
- Before committing significant changes
- Debugging cross-component issues

### Capabilities
- Tests complete user workflows
- Verifies data flow across components
- Identifies integration breaks
- Suggests fixes for failures
- Documents passing scenarios

### Invocation Template
```
Launch integration-tester and verify workflow: {WorkflowName}

Steps:
1. {Step 1 description}
2. {Step 2 description}
3. {Step 3 description}
...

Success Criteria:
- {Criterion 1}
- {Criterion 2}
...

Test Against:
- Local API (http://localhost:8000)
- Remote API (https://api.humanizer.com)
- Both authenticated and unauthenticated states

Report:
- Which steps pass/fail
- Error messages encountered
- Suggested fixes for failures
- Performance metrics if relevant
```

### Example
```
Launch integration-tester and verify workflow: Archive to Allegorical Transformation

Steps:
1. Load message from Archive Browser
2. Click "Load to Canvas" button
3. Text appears in Canvas center pane
4. Select Allegorical tool in right panel
5. Configure: persona=neutral, namespace=mythology, style=standard
6. Click "Transform"
7. Wait for 5-stage progress
8. Results display with markdown rendering
9. Click "Load to Canvas" on final_projection
10. Verify Canvas updated with transformed text

Success Criteria:
- All steps complete without errors
- Text flows correctly through each step
- Results saved to transformation_history
- No console errors
- Transform completes in <10 seconds

Test against both local and remote APIs.
```

---

## 5. Handoff Maintainer (LOW PRIORITY, HIGH IMPORTANCE)

### When to Use
- End of every work session
- Made significant progress on a phase
- Discovered important insights/decisions
- Need to prepare for context switch

### Capabilities
- Updates handoff document with current state
- Maintains file manifest accuracy
- Documents decisions and blockers
- Updates progress percentages
- Ensures continuity for next session

### Invocation Template
```
Launch handoff-maintainer and update /tmp/workbench_m4_integration_handoff.md:

This Session:
- Completed: {list completed tasks}
- Modified Files: {list files changed}
- Created Files: {list files created}
- Tests Added: {count and status}

Progress:
- Phase {N}: {percentage}% complete
- Overall: {percentage}% complete ({X} of 19 tasks)

Insights:
- {Important decision made}
- {Pattern discovered}
- {Technical challenge solved}

Blockers/Decisions Needed:
- {Any blocking issues}
- {Decisions for next session}

Next Session Should:
1. {Priority 1}
2. {Priority 2}
3. {Priority 3}

Maintain these sections:
- Current Task Status (updated)
- File Manifest (add new files)
- Next Steps (rewrite for current state)
- Known Issues (add any discovered)
```

---

## 6. Context Compressor (CRITICAL FOR LONG SESSIONS)

### When to Use
- Approaching 150k+ tokens
- Need to prepare for context switch
- End of work day/session
- Before major phase transition

### Capabilities
- Summarizes session progress concisely
- Stores critical details in ChromaDB
- Identifies what next session needs
- Compresses technical decisions
- Preserves essential context

### Invocation Template
```
Launch context-compressor and compress current session:

Current Token Count: {count}
Session Duration: {hours}
Phase: {current phase}

Summarize:
1. What was completed (files, tests, features)
2. What architectural decisions were made
3. What patterns were established
4. What blockers exist
5. What next session must know

Store in ChromaDB with:
- Tags: workbench, m4, phase-{N}, session-{date}
- Type: session-summary
- Include: file paths, test counts, progress %

Critical for Next Session:
- Start with: {specific file or task}
- Remember: {critical decision}
- Watch out for: {potential issue}

Format as concise bullet points optimized for memory retrieval.
```

---

## Subagent Usage Patterns

### Pattern 1: Phase Completion
```bash
# 1. Run integration tests
Launch integration-tester and verify {phase-name} workflows

# 2. Update documentation
Launch handoff-maintainer and update with {phase} completion

# 3. Compress for next session
Launch context-compressor and prepare for Phase {N+1}
```

### Pattern 2: Building New Feature
```bash
# 1. Generate component
Launch transformation-panel-builder and create {PanelName}

# 2. Generate tests
Launch test-generator and create tests for {PanelName}

# 3. Verify integration
Launch integration-tester and verify {feature} workflow
```

### Pattern 3: Session End
```bash
# 1. Update handoff
Launch handoff-maintainer and update with session progress

# 2. Compress context
Launch context-compressor and prepare for next session

# 3. Commit changes
git commit -m "feat(workbench): {summary}"
```

---

## Measuring Subagent Effectiveness

### Success Metrics
- **Reduced Handoff Loss**: <5% detail loss between sessions
- **Faster Development**: 30% faster panel creation vs manual
- **Test Coverage**: Maintained >90% throughout project
- **Integration Quality**: <10% failure rate on first integration test
- **Documentation Currency**: Handoff updated within 5min of session end

### Tracking
- Document which subagent used for which task
- Compare estimated vs actual time saved
- Track test coverage before/after test-generator
- Measure handoff quality (can next session start immediately?)

---

## When NOT to Use Subagents

**Use direct implementation instead when**:
- Task is trivial (<30 lines of code)
- You're in the middle of debugging
- Need to explore/experiment
- Subagent overhead > implementation time
- Teaching moment (want to understand pattern)

**Rule of Thumb**: If the task takes <15 minutes manually, don't use a subagent.

---

## Emergency Recovery Protocol

**If context is lost or session continuity breaks**:

1. **Memory Recovery**:
   ```
   Launch memory-agent and recall "workbench m4 npe integration"
   ```

2. **Handoff Review**:
   ```
   Read /tmp/workbench_m4_integration_handoff.md
   ```

3. **Test Verification**:
   ```bash
   pnpm test:run  # Should show all previous tests passing
   ```

4. **Context Reconstruction**:
   ```
   Launch context-compressor and reconstruct from:
   - ChromaDB memory (query: "workbench m4")
   - Git log (last 5 commits)
   - Test files (what's tested = what's built)
   - Handoff document
   ```

5. **Continue**:
   Check todo list, proceed with highest priority pending task

---

**End of Subagent Guide** | Last Updated: Nov 9, 2025 | Session: M4 Phase 1
