# Persona-Consistent Book Creation Integration Plan

**Created**: 2026-01-24
**Status**: Planning
**Priority**: High - Key feature for launch

---

## Problem Statement

The book creation API has all the building blocks for persona-consistent writing, but they're disconnected:
- Personas can be harvested, analyzed, and saved
- Books can be created from clusters
- Multi-pass rewriting can eliminate forbidden phrases

**Missing**: The persona is never used during book creation. Chapters are composed generically without voice consistency.

---

## User Story

> As a user, I want to:
> 1. Create a persona from my archived writing samples
> 2. Review a composite sample written in that persona's voice
> 3. Save the persona (optionally as my default)
> 4. Use that persona when creating books, ensuring consistent voice throughout

---

## Current State

### What Exists ✅

| Component | Location | Status |
|-----------|----------|--------|
| Persona harvest flow | `unified-aui-service.ts` | Working |
| VoiceAnalyzer | `voice-analyzer.ts` | Working |
| Multi-pass rewriting | `builder.ts` | Working (tested: 0 leaks) |
| Persona storage | `aui-postgres-store.ts` | Working |
| StyleProfile (many per persona) | `aui-postgres-store.ts` | Working |
| Default persona lookup | `getDefaultPersonaProfile()` | Exists, unused |
| Book creation | `createBookFromCluster()` | Working, but persona-blind |

### What's Missing ❌

1. **Persona parameter in book creation** - `BookFromClusterOptions` has no `personaId`
2. **Rewriting integration** - `composeSectionContent()` never calls `rewriteForPersona()`
3. **Default persona wiring** - Never fetched during book creation
4. **Composite sample generation** - No "preview in persona voice" before saving
5. **CLI commands** - No way to manage personas from CLI
6. **User settings** - No persona preferences storage

---

## Implementation Plan

### Phase 1: Wire Persona into Book Creation (Core)

#### 1.1 Extend BookFromClusterOptions

**File**: `packages/core/src/aui/unified-aui-service.ts`

```typescript
interface BookFromClusterOptions {
  // Existing fields...

  // NEW: Persona configuration
  personaId?: string;           // Explicit persona to use
  styleId?: string;             // Specific style within persona
  useDefaultPersona?: boolean;  // Fall back to user's default (default: true)
  userId?: string;              // Required if useDefaultPersona is true
}
```

#### 1.2 Fetch Persona in createBookFromCluster()

**File**: `packages/core/src/aui/unified-aui-service.ts`

```typescript
async createBookFromCluster(clusterId: string, options?: BookFromClusterOptions): Promise<Book> {
  // NEW: Resolve persona
  let persona: PersonaProfile | undefined;

  if (options?.personaId) {
    persona = await this.store?.getPersonaProfile(options.personaId);
  } else if (options?.useDefaultPersona !== false && options?.userId) {
    persona = await this.store?.getDefaultPersonaProfile(options.userId);
  }

  // Optionally fetch specific style
  let style: StyleProfile | undefined;
  if (persona && options?.styleId) {
    style = await this.store?.getStyleProfile(options.styleId);
  } else if (persona) {
    style = await this.store?.getDefaultStyleProfile(persona.id);
  }

  // Pass persona to chapter composition...
}
```

#### 1.3 Apply Persona Rewriting to Chapters

**File**: `packages/core/src/houses/builder.ts`

Modify `composeSectionContent()` to optionally accept a persona and rewrite the output:

```typescript
async composeSectionContent(
  section: NarrativeSection,
  passages: HarvestPassage[],
  options?: {
    persona?: PersonaProfileForRewrite;
    style?: StyleProfile;
    maxRetries?: number;
  }
): Promise<string> {
  // Generate initial content (existing logic)
  const rawContent = await this.generateContent(section, passages);

  // NEW: Apply persona rewriting if provided
  if (options?.persona) {
    const rewritePersona = this.mergePersonaWithStyle(options.persona, options.style);
    const result = await this.rewriteForPersonaWithRetry({
      text: rawContent,
      persona: rewritePersona,
      sourceType: 'book-chapter',
    }, { maxPasses: 3 });

    return result.rewritten;
  }

  return rawContent;
}
```

#### 1.4 Add mergePersonaWithStyle() Helper

```typescript
private mergePersonaWithStyle(
  persona: PersonaProfile,
  style?: StyleProfile
): PersonaProfileForRewrite {
  // If style provided, override persona's styleGuide with style-specific settings
  const styleGuide = style ? {
    forbiddenPhrases: [...persona.styleGuide.forbiddenPhrases, ...style.forbiddenPhrases],
    preferredPatterns: [...persona.styleGuide.preferredPatterns, ...style.preferredPatterns],
    useContractions: style.useContractions,
    useRhetoricalQuestions: style.useRhetoricalQuestions,
    sentenceVariety: style.sentenceVariety,
    paragraphStyle: style.paragraphStyle,
  } : persona.styleGuide;

  return {
    name: persona.name,
    description: persona.description,
    voiceTraits: persona.voiceTraits,
    toneMarkers: persona.toneMarkers,
    formalityRange: persona.formalityRange,
    styleGuide,
    referenceExamples: persona.referenceExamples,
  };
}
```

---

### Phase 2: Composite Sample Preview

#### 2.1 Add generatePersonaSample() Method

**File**: `packages/core/src/aui/unified-aui-service.ts`

```typescript
/**
 * Generate a composite sample demonstrating the persona's voice.
 * Used for review before saving a persona.
 */
async generatePersonaSample(
  harvestId: string,
  options?: { wordCount?: number; topic?: string }
): Promise<{
  sample: string;
  persona: PersonaProfile;
  metrics: {
    forbiddenPhrasesRemoved: number;
    preferredPatternsUsed: number;
    passCount: number;
  };
}> {
  const harvest = this.harvestSessions.get(harvestId);
  if (!harvest) throw new Error('Harvest session not found');

  // Extract traits if not already done
  if (!harvest.analysis) {
    await this.extractPersonaTraits(harvestId);
  }

  // Build temporary persona from analysis
  const tempPersona = this.buildTempPersonaFromAnalysis(harvest);

  // Generate sample content using LLM
  const rawSample = await this.builder.generateSampleContent({
    topic: options?.topic ?? 'a reflection on everyday moments',
    wordCount: options?.wordCount ?? 300,
    voiceGuidance: harvest.analysis!.proposedTraits.voiceTraits.join(', '),
  });

  // Rewrite to match persona
  const result = await this.builder.rewriteForPersonaWithRetry({
    text: rawSample,
    persona: tempPersona,
    sourceType: 'sample-preview',
  });

  return {
    sample: result.rewritten,
    persona: tempPersona,
    metrics: {
      forbiddenPhrasesRemoved: result.changesApplied.filter(c => c.includes('Removed')).length,
      preferredPatternsUsed: result.changesApplied.filter(c => c.includes('Used pattern')).length,
      passCount: result.passCount ?? 1,
    },
  };
}
```

#### 2.2 Add MCP Handler

**File**: `packages/core/src/mcp/handlers/unified-aui.ts`

```typescript
export async function handlePersonaGenerateSample(args: {
  harvestId: string;
  wordCount?: number;
  topic?: string;
}): Promise<MCPResult> {
  const service = getService();
  const result = await service.generatePersonaSample(args.harvestId, {
    wordCount: args.wordCount,
    topic: args.topic,
  });
  return jsonResult({
    sample: result.sample,
    personaName: result.persona.name,
    voiceTraits: result.persona.voiceTraits,
    metrics: result.metrics,
    message: 'Review this sample. If satisfied, call persona_finalize to save.',
  });
}
```

---

### Phase 3: Default Persona Management

#### 3.1 Add setDefaultPersona() Method

**File**: `packages/core/src/aui/unified-aui-service.ts`

```typescript
async setDefaultPersona(userId: string, personaId: string): Promise<void> {
  if (!this.store) throw new Error('Store not configured');

  // Verify persona exists and belongs to user
  const persona = await this.store.getPersonaProfile(personaId);
  if (!persona) throw new Error('Persona not found');
  if (persona.userId && persona.userId !== userId) {
    throw new Error('Persona does not belong to this user');
  }

  // Update persona to be default (store handles clearing previous default)
  await this.store.updatePersonaProfile(personaId, { isDefault: true });
}
```

#### 3.2 Add MCP Handlers

```typescript
// Set default persona
'persona_set_default': handlePersonaSetDefault,

// Get user's available personas for selection
'persona_list_for_user': handlePersonaListForUser,
```

---

### Phase 4: Book Creation with Persona (Full Flow)

#### 4.1 Add createBookWithPersona() Convenience Method

```typescript
/**
 * Create a book with explicit persona consistency.
 * Convenience wrapper that handles persona resolution and rewriting.
 */
async createBookWithPersona(options: {
  userId: string;
  clusterId?: string;
  query?: string;
  personaId?: string;  // Optional: uses default if not provided
  styleId?: string;
  title?: string;
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
}): Promise<Book> {
  // Resolve persona
  const persona = options.personaId
    ? await this.store?.getPersonaProfile(options.personaId)
    : await this.store?.getDefaultPersonaProfile(options.userId);

  if (!persona) {
    throw new Error('No persona specified and no default persona set. Create a persona first.');
  }

  // Get passages (from cluster or query)
  let passages: HarvestPassage[];
  if (options.clusterId) {
    const cluster = await this.getCluster(options.clusterId);
    passages = cluster?.passages ?? [];
  } else if (options.query) {
    const result = await this.harvest({ query: options.query, limit: 50 });
    passages = result.passages;
  } else {
    throw new Error('Either clusterId or query required');
  }

  // Rewrite passages for persona
  const rewrittenPassages = await this.rewritePassagesForPersona(passages, persona);

  // Generate arc and compose book
  const arc = await this.generateArc({
    passages: rewrittenPassages,
    arcType: options.arcType,
  });

  // Create book with persona-consistent chapters
  return this.composeBookFromArc(arc, rewrittenPassages, persona);
}
```

#### 4.2 Add MCP Handler

```typescript
'book_create_with_persona': handleBookCreateWithPersona,
```

---

### Phase 5: CLI Integration

#### 5.1 New CLI Commands

| Command | Description |
|---------|-------------|
| `persona list` | List user's saved personas |
| `persona create` | Start interactive persona harvest |
| `persona set-default <id>` | Set default persona |
| `persona show <id>` | Show persona details |
| `persona sample <id>` | Generate sample in persona voice |
| `book create --persona <id>` | Create book with specific persona |
| `settings persona default` | Show/set default persona |

#### 5.2 User Settings Storage

Add to user preferences (in AUI session or separate settings table):

```typescript
interface UserSettings {
  defaultPersonaId?: string;
  defaultStyleId?: string;
  bookCreationDefaults?: {
    arcType: string;
    maxPassagesPerChapter: number;
  };
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/aui/unified-aui-service.ts` | Add personaId to BookFromClusterOptions, add createBookWithPersona(), generatePersonaSample(), setDefaultPersona() |
| `src/houses/builder.ts` | Modify composeSectionContent() to accept persona, add mergePersonaWithStyle() |
| `src/mcp/handlers/unified-aui.ts` | Add handlers: persona_generate_sample, persona_set_default, book_create_with_persona |
| `src/storage/aui-postgres-store.ts` | Add updatePersonaProfile() if missing |
| CLI (future) | Add persona and settings commands |

---

## Implementation Order

1. **Phase 1.1-1.4**: Wire persona into book creation (CRITICAL PATH)
2. **Phase 3**: Default persona management
3. **Phase 4**: createBookWithPersona() convenience method
4. **Phase 2**: Composite sample preview (polish)
5. **Phase 5**: CLI integration (after core works)

---

## Testing

### Unit Tests
- `rewriteForPersonaWithRetry()` with various persona configs
- `mergePersonaWithStyle()` merging logic
- `createBookWithPersona()` end-to-end

### Integration Test
```typescript
// Full flow test
const harvestId = await aui.startPersonaHarvest(sessionId, { name: 'My Voice' });
await aui.harvestFromArchive(harvestId, { query: 'philosophy consciousness' });
await aui.extractPersonaTraits(harvestId);
const sample = await aui.generatePersonaSample(harvestId);
console.log('Sample:', sample.sample);
const persona = await aui.finalizePersona(harvestId, { setAsDefault: true });
const book = await aui.createBookWithPersona({
  userId,
  query: 'consciousness phenomenology',
  personaId: persona.personaId,
});
// Verify: book chapters should have 0 forbidden phrases
```

---

## Success Criteria

1. ✅ Books created with persona have 0 forbidden phrases
2. ✅ User can set a default persona
3. ✅ Book creation uses default persona when none specified
4. ✅ Composite sample accurately demonstrates persona voice
5. ✅ CLI supports persona management

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1 (Core wiring) | 3-4 hours |
| Phase 2 (Sample preview) | 1-2 hours |
| Phase 3 (Default management) | 1 hour |
| Phase 4 (Convenience method) | 1-2 hours |
| Phase 5 (CLI) | 2-3 hours |
| **Total** | **8-12 hours** |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rewriting slows book creation | Batch processing already parallelized; add progress callbacks |
| LLM inconsistency across chapters | Multi-pass rewriting ensures consistency; add chapter-level checks |
| Large books overwhelm context | Process chapters in batches; use consistent persona prompt caching |
