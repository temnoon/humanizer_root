# Humanizer Agent Definitions

**Updated**: December 27, 2025
**Purpose**: Define persistent subagents that automatically participate in workflows
**Status**: ✅ FULLY IMPLEMENTED - Council of Eight Houses with mandatory signoff protocol

---

## Implementation Status

All House agents are now implemented with individual agent definition files:

| House | Agent File | Lines | Status |
|-------|------------|-------|--------|
| 🎨 Stylist | `.claude/agents/stylist-agent.md` | ~280 | ✅ Implemented |
| 🏛️ Architect | `.claude/agents/architect-agent.md` | ~280 | ✅ Implemented |
| 🔐 Security | `.claude/agents/security-agent.md` | ~320 | ✅ Implemented |
| ♿ Accessibility | `.claude/agents/accessibility-agent.md` | ~340 | ✅ Implemented |
| 🔢 Math | `.claude/agents/math-agent.md` | ~330 | ✅ Implemented |
| 📊 Data | `.claude/agents/data-agent.md` | ~310 | ✅ Implemented |
| 📚 Curator | `.claude/agents/curator-agent.md` | ~320 | ✅ Implemented |
| 🔮 Resonance | `.claude/agents/resonance-agent.md` | ~260 | ✅ Implemented |

### Infrastructure Agents

| Agent | File | Status |
|-------|------|--------|
| Audit Agent | `.claude/agents/audit-agent.md` | ✅ Implemented |
| Field Coordinator | `.claude/agents/field-coordinator.md` | ✅ Implemented |
| Memory Agent | `.claude/agents/memory-agent.md` | ✅ Implemented |
| Debt Tracker | `.claude/agents/debt-tracker.md` | ✅ Implemented |

### Hooks Configuration

Hooks are configured in `settings.local.json`:

| Hook | Agents | Blocking |
|------|--------|----------|
| `pre-commit` | stylist, architect, security | ✅ Yes |
| `pre-merge-main` | stylist, architect, security, accessibility, data | ✅ Yes |
| `on-file-create` | architect | ✅ Yes |
| `on-edit` | Pattern-based routing to all Houses | No (ADVISORY) |

### Quick Commands

```bash
/audit              # Full council audit
/audit stylist      # Single House
/audit --blocking   # Only BLOCKING Houses
/audit security     # Deep security audit
```

---

## Core Philosophy

> Each agent is a **Node** in the field of nodes—a specialized curator with its own Canon/Doctrine/Instrument stack.

Agents are not just tools; they embody sensibilities. They advocate for their domain with the same authority a book-curator advocates for its anchor text.

---

## The Eight Houses

| House | Domain | Level | Signoff Required For |
|-------|--------|-------|---------------------|
| **Stylist** 🎨 | UI/CSS/Design | REQUIRED | Component styling, layout |
| **Architect** 🏛️ | Patterns/Structure | BLOCKING | New services, contexts |
| **Curator** 📚 | Content Quality | ADVISORY | Passage selection, editing |
| **Resonance** 🔮 | Text Similarity | ADVISORY | Editorial suggestions |
| **Security** 🔐 | Auth/Privacy | BLOCKING | API, auth, credentials |
| **Accessibility** ♿ | A11y/ARIA | REQUIRED | Interactive components |
| **Math** 🔢 | Core Algorithms | BLOCKING | SIC, POVM, trajectory |
| **Data** 📊 | Schemas/Persistence | REQUIRED | Types, storage, API contracts |

### Signoff Levels

```
ADVISORY (⚠️)  - Agent notes concerns, work proceeds
REQUIRED (🔒)  - Agent must approve before merge to main
BLOCKING (🚫)  - Agent must approve before ANY commit
```

---

## House I: Code Guardians

These Houses guard the integrity of the codebase:

### 1. Stylist Agent 🎨

**Signoff Level**: REQUIRED for UI, BLOCKING for design system (`packages/ui/**`)
**Purpose**: Audit all UI code for style guide conformance
**Canon**: CLAUDE.md CSS Compliance section + STYLEGUIDE.md
**Triggers**: `*.css`, `*.tsx`, `*.jsx` in components

```yaml
agent: stylist
type: reviewer
signoff: REQUIRED
canon:
  - CLAUDE.md#css-compliance-guard
  - docs/STYLEGUIDE.md
  - packages/ui/styles/tokens.css
doctrine:
  - NO hardcoded colors (use CSS variables)
  - NO inline styles with static values
  - NO pixel values for spacing (use --space-*)
  - Mobile-first breakpoints (min-width)
  - BEM naming convention
  - Touch targets minimum 44px
instrument:
  - Grep for hex colors, inline styles, px values
  - Check breakpoint ordering
  - Validate CSS variable usage
  - Report: violations[], suggestions[], severity
```

**Quick Audit** (token-efficient):
```bash
# Stylist runs these before reviewing code
grep -r "style={{" src/components/ | wc -l  # inline styles
grep -r "#[0-9a-fA-F]" src/**/*.css | wc -l  # hex colors
grep -r "px[;,)]" src/**/*.css | grep -v "1px\|2px" | wc -l  # pixels
```

---

### 2. Architect Agent 🏛️

**Signoff Level**: REQUIRED for new files, BLOCKING for new contexts/services
**Purpose**: Prevent parallel implementations, enforce implementation-first
**Canon**: CLAUDE.md#implementation-first-protocol
**Triggers**: New file creation, new Context, new Service

```yaml
agent: architect
type: reviewer
signoff: REQUIRED
canon:
  - CLAUDE.md#implementation-first-protocol
  - Capability Registry (below)
doctrine:
  - NEVER build without exploring first
  - Check capability registry before proposing new systems
  - One source of truth per domain
  - Update registry when adding capabilities
instrument:
  - Search for existing contexts/services
  - Map capability overlaps
  - Flag redundancy risks
  - Report: existingCapabilities[], overlaps[], recommendation
```

**Capability Registry** (keep updated):
| Domain | System | Location |
|--------|--------|----------|
| Content/Buffers | UnifiedBufferContext | narrative-studio |
| Bookshelf | BookshelfService | humanizer-app/apps/web/src/lib/bookshelf |
| Book Projects | BookProjectService | humanizer-app/apps/web/src/lib/book |
| Archive | archiveService | humanizer-portal/src/services |
| Embeddings | EmbeddingDatabase | narrative-studio/src/services/embeddings |
| Transformations | transformationService | workers/npe-api |
| Auth | AuthContext | multiple (need unification) |
| AUI Tools | lib/aui/tools.ts (43 tools) | humanizer-app/apps/web |
| Agent Bridge | AgentAUIBridge | humanizer-app/apps/web/src/lib/aui/agent-bridge.ts |
| Agent Council | CouncilOrchestrator | humanizer-app/electron/agents/council |
| Agent Registry | AgentRegistry | humanizer-app/electron/agents/runtime/registry.ts |
| Electron IPC | preload.ts (agents API) | humanizer-app/electron/preload.ts |

---

## House II: Content Curators

These Houses guard the quality of content:

### 3. Curator Agent 📚

**Signoff Level**: ADVISORY for passage selection, REQUIRED for book structure
**Purpose**: Assess content for book-worthiness using Resonant Mirrors
**Canon**: NODE_CURATOR_SPEC.md + anchor book embeddings
**Triggers**: Passage selection, editorial decisions, chapter ordering

```yaml
agent: curator
type: editor
signoff: ADVISORY
canon:
  - docs/NODE_CURATOR_SPEC.md
  - The active book's anchor text embeddings
  - SIC constraints from user
doctrine:
  - Ground suggestions in real exemplars (Resonant Mirrors)
  - Find similar passages in anchor book before editing
  - Respect SIC (Subjective Intentional Constraint)
  - Maintain author's voice, don't impose AI voice
  - Gems have: inflection, velocity, tension, commitment
instrument:
  - analyzePassage() from @humanizer/core
  - Semantic search in anchor embeddings
  - Line edit with rationale from exemplars
  - Report: resonantMirrors[], editSuggestions[], gemScore
```

**Gem Detection Thresholds** (from harvest scripts):
```typescript
const isGem =
  inflectionCount > 0 ||       // Has turning points
  velocity.score > 0.15 ||     // Rapid state change
  tension.score > 0.25 ||      // Semantic tension
  commitment > 0.1;            // Strong position
```

---

### 4. Resonance Agent 🔮

**Signoff Level**: ADVISORY (called by Curator)
**Purpose**: Find mirrors between user text and anchor texts
**Canon**: Embedded passages from all registered books in Bookshelf
**Triggers**: Editorial suggestions, curation decisions

```yaml
agent: resonance
type: search
signoff: ADVISORY
canon:
  - All book embeddings in bookshelf
  - Vector similarity via EmbeddingDatabase
doctrine:
  - Return top N most similar passages
  - Explain WHY passages resonate (shared concepts, structure)
  - Provide source location for verification
  - Never hallucinate - only return actual indexed passages
instrument:
  - embeddingService.search()
  - Passage extraction from source
  - Context assembly (before/after)
  - Report: mirrors[], similarity[], sourceLocations[]
```

---

## House III: Safety & Quality

These Houses guard safety, accessibility, and correctness:

### 5. Security Agent 🔐

**Signoff Level**: BLOCKING for auth/credentials, REQUIRED for API/storage
**Purpose**: Audit for security vulnerabilities and privacy violations
**Canon**: OWASP Top 10, Zero-Trust Architecture spec
**Triggers**: Auth code, API routes, storage, credential handling, `.env` files

```yaml
agent: security
type: reviewer
signoff: BLOCKING
canon:
  - OWASP Top 10 2021
  - Zero-trust file handling spec
  - Privacy-first architecture (local by default)
doctrine:
  - NEVER commit secrets (.env, API keys, credentials)
  - Validate all inputs at system boundaries
  - Escape outputs to prevent XSS
  - Use parameterized queries (no SQL injection)
  - Audit localStorage for sensitive data
  - Cloud operations require explicit user consent
instrument:
  - Grep for hardcoded secrets patterns
  - Check .gitignore coverage
  - Validate API route authorization
  - Report: vulnerabilities[], severity, remediation[]
```

**Quick Audit**:
```bash
# Security scans
grep -r "api_key\|apikey\|secret\|password" --include="*.ts" src/
grep -r "localStorage.setItem" src/ | grep -v "humanizer-"
grep -r "dangerouslySetInnerHTML" src/
```

**Sensitive Paths** (always trigger Security review):
- `**/auth/**`
- `**/api/**`
- `**/*credential*`
- `**/*secret*`
- `.env*`

---

### 6. Accessibility Agent ♿

**Signoff Level**: REQUIRED for interactive components, ADVISORY for static
**Purpose**: Ensure WCAG 2.1 AA compliance
**Canon**: WCAG 2.1 AA, ARIA Authoring Practices
**Triggers**: Interactive components, forms, modals, navigation

```yaml
agent: accessibility
type: reviewer
signoff: REQUIRED
canon:
  - WCAG 2.1 AA Guidelines
  - WAI-ARIA Authoring Practices 1.2
doctrine:
  - All interactive elements keyboard accessible
  - Touch targets minimum 44px
  - Color contrast ratio 4.5:1 (text), 3:1 (large text)
  - Form inputs have associated labels
  - Images have alt text (or aria-hidden if decorative)
  - Focus visible on all interactive elements
  - Reduced motion support (@media prefers-reduced-motion)
instrument:
  - Check for aria-label on buttons without text
  - Validate form label associations
  - Check focus-visible styles exist
  - Report: violations[], severity, wcagCriteria[]
```

**Quick Audit**:
```bash
# A11y checks
grep -r "<button" src/ | grep -v "aria-label" | grep -v ">" | head -10
grep -r "<img" src/ | grep -v "alt=" | head -10
grep -r "tabIndex=\"-1\"" src/ | wc -l
```

---

### 7. Math Agent 🔢

**Signoff Level**: BLOCKING for core algorithms, REQUIRED for analysis code
**Purpose**: Verify mathematical correctness in SIC/POVM/density code
**Canon**: SIC theory, density matrix formalism, POVM specs
**Triggers**: `packages/core/**`, trajectory analysis, embedding math

```yaml
agent: math
type: reviewer
signoff: BLOCKING
canon:
  - SIC-POVM mathematical foundations
  - Density matrix trace = 1 (normalization)
  - POVM sum to identity
  - Tetralemma probability interpretation
doctrine:
  - Density matrices must be trace-normalized
  - Eigenvalues must be non-negative (positivity)
  - State transitions preserve trace
  - Floating point precision handling (epsilon comparisons)
  - Document mathematical assumptions in code comments
instrument:
  - Verify trace normalization in constructors
  - Check POVM completeness
  - Validate probability sums to 1
  - Report: mathematicalIssues[], proofs[], assumptions[]
```

**Core Math Invariants**:
```typescript
// These MUST hold - Math Agent verifies
assert(trace(rho) === 1);           // Normalization
assert(eigenvalues(rho).every(e => e >= 0));  // Positivity
assert(povmElements.reduce((sum, E) => add(sum, E)) === I);  // Completeness
```

**Sensitive Paths** (always trigger Math review):
- `packages/core/src/vector/**`
- `packages/core/src/density/**`
- `packages/core/src/sic/**`
- `**/trajectory*.ts`
- `**/analyzePassage*.ts`

---

## Production Signoff Protocol

### Pre-Merge Checklist

Before merging to `main`, the following Houses MUST approve:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERGE REQUEST                                 │
└──────────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────┐             ┌─────────┐             ┌─────────┐
│ Stylist │             │Architect│             │Security │
│ (if UI) │             │(if new) │             │(if API) │
└────┬────┘             └────┬────┘             └────┬────┘
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COUNCIL VERDICT                               │
│                                                                  │
│   ALL BLOCKING PASS  →  Proceed to merge                        │
│   ANY BLOCKING FAIL  →  HALT, address issues                    │
│   REQUIRED FAIL      →  Needs justification + user override     │
│   ADVISORY ONLY      →  Note in commit, proceed                 │
└─────────────────────────────────────────────────────────────────┘
```

### Token-Efficient Audit Pattern

To minimize tokens while maintaining rigor:

1. **Quick Scan First** (Bash commands, ~50 tokens)
   - Run grep patterns to count violations
   - If count = 0, skip detailed review

2. **Targeted Read** (Read tool, ~500-2000 tokens)
   - Only read files with violations
   - Focus on changed lines (git diff)

3. **Structured Report** (~200 tokens)
   - Return JSON with: `{ pass: bool, violations: [], suggestions: [] }`

Example flow:
```
Agent: stylist
1. Run: grep -r "style={{" {changed_files} | wc -l
   Result: 3
2. Read only those 3 files, extract violation lines
3. Report: { pass: false, violations: [...], suggestions: [...] }
```

---

## Agent Lifecycle

```
┌──────────────────────────────────────────────────────┐
│                    TRIGGER                            │
│  (file change, commit, user action)                  │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│              AGENT ACTIVATION                         │
│  Load Canon → Apply Doctrine → Select Instruments    │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                   REVIEW                              │
│  Run instruments, collect findings                   │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                   REPORT                              │
│  Present findings, suggestions, blocks               │
└──────────────────────────────────────────────────────┘
```

---

## Hooks for Automatic Invocation

### Claude Code Hooks Configuration

In `.claude/settings.json`:

```json
{
  "hooks": {
    "pre-commit": {
      "agents": ["stylist", "architect", "security"],
      "blocking": true,
      "description": "Council review before any commit"
    },
    "pre-merge-main": {
      "agents": ["stylist", "architect", "security", "accessibility"],
      "blocking": true,
      "description": "Full council for production merges"
    },
    "on-file-create": {
      "agents": ["architect"],
      "blocking": true,
      "description": "Prevent parallel implementations"
    },
    "on-edit": {
      "patterns": {
        "*.tsx|*.css": ["stylist"],
        "**/auth/**|**/api/**": ["security"],
        "**/core/**|**/trajectory*": ["math"],
        "**/*Button*|**/*Modal*|**/*Form*": ["accessibility"]
      },
      "blocking": false
    }
  }
}
```

### Pattern-Based Routing

The Field Coordinator routes changes to relevant Houses:

```typescript
const HOUSE_PATTERNS = {
  stylist: [
    '**/*.css',
    '**/*.tsx',
    '**/components/**',
    '**/styles/**',
    'packages/ui/**',
  ],
  architect: [
    '**/contexts/**',
    '**/services/**',
    '**/lib/**',
    '**/*Service.ts',
    '**/*Context.tsx',
    '**/agents/**',
    '**/aui/**',
    '**/electron/**',
  ],
  security: [
    '**/auth/**',
    '**/api/**',
    '**/*credential*',
    '**/*secret*',
    '**/*.env*',
    '**/storage/**',
    '**/preload.ts',       // Electron IPC security boundary
    '**/agent-bridge.ts',  // Agent proposal validation
    '**/ipc/**',
  ],
  accessibility: [
    '**/components/**/*Button*',
    '**/components/**/*Modal*',
    '**/components/**/*Form*',
    '**/components/**/*Input*',
    '**/components/**/*Dialog*',
  ],
  math: [
    'packages/core/**',
    '**/trajectory*',
    '**/density*',
    '**/sic/**',
    '**/povm*',
    '**/analyzePassage*',
  ],
  curator: [
    '**/book/**',
    '**/bookshelf/**',
    '**/passages/**',
    '**/editorial/**',
  ],
  resonance: [
    '**/embeddings/**',
    '**/semantic*',
    '**/similarity*',
  ],
};
```

### Invocation Examples

```bash
# Manual invocation via Claude Code
/audit stylist          # Run Stylist on current changes
/audit security --full  # Full Security audit
/audit all              # All applicable Houses

# Automatic (via hooks)
git commit              # Triggers pre-commit Houses
git push origin main    # Triggers pre-merge-main Houses
```

---

## Creating New Agents

Every agent follows the 3-layer stack:

```typescript
interface AgentDefinition {
  id: string;
  name: string;
  type: 'reviewer' | 'editor' | 'search' | 'curator';

  // What the agent knows
  canon: {
    documents: string[];      // Path to canon documents
    embeddings?: string;      // Embedding index URI
  };

  // How the agent judges
  doctrine: {
    rules: string[];          // Decision rules
    axes?: {                  // Evaluation axes
      name: string;
      min: string;
      max: string;
    }[];
  };

  // What the agent does
  instrument: {
    tools: string[];          // Available tools
    outputs: string[];        // What it produces
  };

  // When it activates
  triggers: {
    patterns?: string[];      // File patterns
    events?: string[];        // Event types
    manual?: boolean;         // Can be manually invoked
  };
}
```

---

## The Audit Agent: Council Orchestrator

**Location**: `.claude/agents/audit-agent.md`
**Purpose**: Orchestrate House reviews while teaching the user how to audit

```yaml
agent: audit-agent
type: orchestrator
purpose: Run the Council of Eight Houses, demonstrate the process
doctrine:
  - Teach by doing - show every step
  - Display commands so user can learn
  - Token-efficient - quick scans first
  - Clear verdicts with actionable fixes
instrument:
  - Pattern-based House routing
  - Quick grep scans per House
  - Detailed review only on violations
  - Teaching moments after each audit
```

### Invocation

```bash
/audit              # Full audit of changed files
/audit stylist      # Stylist House only
/audit --blocking   # Only BLOCKING Houses (Security, Architect, Math)
/audit security     # Deep Security audit
/audit path/to/file # Audit specific file
```

### Teaching Pattern

The Audit Agent follows the "Teach By Doing" philosophy:

1. **Show the command** - display the grep/glob being run
2. **Explain the check** - why this House cares about this
3. **Report the finding** - clear violation with location
4. **Teach the fix** - how to resolve it
5. **Offer self-service** - commands the user can run themselves

After 3 successful audits, the user should be able to run checks independently.

---

## The Meta-Agent: Field Coordinator

Orchestrates the field of agents:

```yaml
agent: field-coordinator
type: meta
purpose: Route work to appropriate agents, resolve conflicts
doctrine:
  - Each agent is sovereign in its domain
  - Conflicts escalate to user
  - Maintain agent registry
instrument:
  - Agent activation
  - Conflict detection
  - Escalation protocol
```

---

## Integration with Claude Agent SDK

The Claude Agent SDK provides the execution substrate:

1. **Tool Registration** - Each agent's instruments become Claude tools
2. **Context Management** - Canon documents as system context
3. **Multi-turn Execution** - Agents can call other agents
4. **Error Recovery** - Graceful handling of tool failures

---

## Practical Session Workflow

### Example: Adding a New Component

```
USER: Add a button to export book as PDF

CLAUDE CODE:
1. [Architect] Searching for existing export capabilities...
   Found: exportService.ts in narrative-studio
   Recommendation: Extend existing service, don't create new

2. [Stylist] Will need to review button styling
   Pre-check: packages/ui/styles/components/buttons.css exists

3. Creating: apps/web/src/components/book/ExportButton.tsx

[Architect SIGNOFF REQUIRED]
✅ Extends exportService (no parallel implementation)
✅ Uses existing ButtonGroup pattern
⚠️ Consider adding to lib/book/index.ts exports

[Stylist SIGNOFF REQUIRED]
❌ Found inline style: style={{ marginTop: '16px' }}
   Fix: Use className="export-button" with .export-button { margin-top: var(--space-md); }

[Accessibility ADVISORY]
⚠️ Button needs aria-label for screen readers
   Suggestion: aria-label="Export book as PDF"

VERDICT: BLOCKED (Stylist)
Action: Fix inline style, re-run /audit stylist
```

### Example: Editing Core Algorithm

```
USER: Optimize the trajectory velocity calculation

CLAUDE CODE:
1. [Math] BLOCKING review triggered for packages/core/src/vector/trajectory.ts

[Math SIGNOFF REQUIRED - BLOCKING]
Reading trajectory.ts...

Current implementation:
  velocity = sum(stateChanges) / sentenceCount

Proposed change:
  velocity = weightedSum(stateChanges, sentenceWeights) / totalWeight

Mathematical verification:
✅ Preserves normalization (sum of weights = 1)
✅ Maintains trace preservation
⚠️ Edge case: empty sentence array needs handling

VERDICT: CONDITIONAL PASS
Condition: Add guard for empty array, document weight interpretation
```

### Quick Command Reference

| Command | Effect |
|---------|--------|
| `/audit all` | Run all relevant Houses |
| `/audit stylist` | Stylist only |
| `/audit --blocking-only` | Only BLOCKING Houses |
| `/signoff security` | Request Security approval |
| `/override stylist "reason"` | Override with justification |

---

## Connecting AUI to Bookshelf Pipeline

The AUI currently doesn't persist to Bookshelf. Here's the integration path:

### Current State (Broken)
```
AUI Tool → transformationService → API response → UI display (lost)
```

### Target State
```
AUI Tool → transformationService → API response
                                        ↓
                              BookshelfService.addPassage()
                                        ↓
                              localStorage / API persistence
                                        ↓
                              UI display + Bookshelf updated
```

### Required Wiring

1. **AUI tools that should persist**:
   - `add_passage` → BookshelfService.addChapter() or addPassage()
   - `update_passage` → BookshelfService.updateChapter()
   - `mark_gem` → BookshelfService.updateBook({ gems: [...] })

2. **Service connection needed**:
   ```typescript
   // In humanizer-portal/src/services/transformationService.ts
   import { bookshelfService } from '@humanizer/bookshelf';

   async function executeCapability(capability: string, params: any) {
     const result = await callAPI(capability, params);

     // Persist to bookshelf if content-modifying
     if (CONTENT_CAPABILITIES.includes(capability)) {
       await bookshelfService.addPassage(result, params.bookUri);
     }

     return result;
   }
   ```

3. **Houses involved**:
   - Curator (content quality) - ADVISORY
   - Data (schema) - REQUIRED
   - Architect (integration) - REQUIRED

---

## Data Agent 📊 (Bonus House)

**Signoff Level**: REQUIRED for schema changes, ADVISORY for reads
**Purpose**: Guard data schemas, persistence, and API contracts
**Canon**: Type definitions, API specs, migration patterns
**Triggers**: Type changes, localStorage, database, API routes

```yaml
agent: data
type: reviewer
signoff: REQUIRED
canon:
  - TypeScript type definitions
  - API contract specs
  - Migration patterns
doctrine:
  - Type changes require migration plan
  - API changes must be backwards-compatible
  - localStorage keys prefixed with "humanizer-"
  - No orphaned data (cleanup on delete)
instrument:
  - Verify type compatibility
  - Check API versioning
  - Validate storage patterns
  - Report: breakingChanges[], migrations[], compatibility
```

---

## References

- `docs/PHILOSOPHY_STATE_DEC25.md` - System philosophy
- `docs/NODE_CURATOR_SPEC.md` - Curator architecture
- `CLAUDE.md` - Development guidelines
- `humanizer-portal/docs/ARCHITECTURE_VISION_CLAUDE_AGENT_SDK.md` - Agent SDK integration
- `humanizer-app/docs/HANDOFF_DEC25_*.md` - Latest implementation state

---

## House Seal

```
        ┌─────────────────────────────────────┐
        │                                     │
        │   🎨  🏛️  📚  🔮  🔐  ♿  🔢  📊   │
        │                                     │
        │      THE COUNCIL OF HOUSES          │
        │                                     │
        │   Each house is sovereign in its    │
        │   domain. Together they form the    │
        │   field of mutual curation.         │
        │                                     │
        └─────────────────────────────────────┘
```

*Each agent is a node. Each node is an agent. The field of nodes is a field of mutual curation.*
