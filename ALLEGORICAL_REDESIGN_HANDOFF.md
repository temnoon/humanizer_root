# Allegorical Panel Redesign - Implementation Handoff

**Date**: November 11, 2025  
**Status**: Design Complete, Ready for Phase 1  
**Estimated Time**: 3-4 hours for Phase 1 (Discovery Tab)

---

## What Was Discovered

### ✅ Current State
- **10 functional panels** in cloud-workbench (all working)
- **Story generation backend** fully deployed and tested (420-line service + 198-line routes)
- **Attribute theory document** comprehensive (22-50% co-variation expected)
- **Custom attribute builder** working in backend and UI (with known DialoguePanel rendering issue)
- **Allegorical panel** currently 450 lines, treats attributes as simple dropdowns

### 🎯 Opportunity
The backend story generation and attribute builder are **complete and working**, but the frontend doesn't expose them effectively. Current UI treats attributes like CSS fonts rather than sophisticated creative tools.

### 🚀 Vision
Redesign Allegorical Panel as a **4-tab interface**:
1. **DISCOVER** - Learn attributes via generated story examples
2. **TRANSFORM** - Transform text with co-variation education (current panel, enhanced)
3. **WORKSPACE** - First-class home for custom attributes
4. **LIBRARY** - Curated attribute combinations

---

## The Core Insight

**From**: Attributes as dropdown form fields  
**To**: Attributes as first-class creative tools  
**Why**: Attribute theory proves they're sophisticated and co-vary naturally (not a bug)  
**How**: Educational-first approach (discover → learn → apply → understand)

---

## Phase 1: Discovery Tab (START HERE)

### What You'll Build
A new tab that lets users generate example stories to understand what attributes "sound like"

### UI Flow
```
┌────────────────────────────────┐
│ DISCOVER Tab                   │
├────────────────────────────────┤
│ [Persona dropdown]             │
│ [Namespace dropdown]           │
│ [Style dropdown]               │
│                                │
│ [Length: short/med/long]       │
│ [Seed (optional): textarea]    │
│ [Generate Story ▶️]            │
│                                │
│ [Generated Story Display]      │
│ - Skeleton (characters, setting) │
│ - Full narrative (markdown)    │
│ - Metadata (time, model, words)│
│ - [Load to Canvas] [Copy]      │
└────────────────────────────────┘
```

### Implementation Checklist

1. **Update API Client** (30 min)
   ```typescript
   // Add to: cloud-workbench/src/core/adapters/api.ts
   
   // Add to interface WorkbenchAPI:
   storyGenerate(input: {
     persona: string;
     namespace: string;
     style: string;
     length: 'short' | 'medium' | 'long';
     seed?: string;
     model?: string;
   }): Promise<StoryGenerationResult>;
   
   getStoryExamples(): Promise<Array<{
     title: string;
     description: string;
     attributes: {...}
   }>>;
   
   // Add implementations to const implementation
   ```

2. **Create DiscoverMode Component** (120 min)
   ```
   File: cloud-workbench/src/features/panels/allegorical/modes/DiscoverMode.tsx
   
   Components needed:
   - AttributeSelectors (3 dropdowns)
   - StoryGenerationForm (length, seed, button)
   - GeneratedStoryDisplay (skeleton + narrative + metadata)
   - LoadingState + ErrorState
   ```

3. **Create Helper Components** (90 min)
   ```
   Files:
   - StoryGenerationForm.tsx (80 lines)
   - GeneratedStoryDisplay.tsx (120 lines)
   - StorySkeletonView.tsx (40 lines)
   ```

4. **Refactor AllegoricalPanel** (60 min)
   ```
   Update: cloud-workbench/src/features/panels/allegorical/AllegoricalPanel.tsx
   
   - Add TabNavigation (Discover | Transform)
   - Render DiscoverMode or TransformMode based on active tab
   - Keep TransformMode logic mostly unchanged
   ```

5. **Test & Deploy** (30 min)
   - Verify story generation works (12-15 second load)
   - Check markdown rendering
   - Test "Load to Canvas" integration
   - Deploy to workbench.humanizer.com

---

## Code Patterns to Follow

### 1. Use Canvas Context
```typescript
const { getActiveText, setText } = useCanvas();
```

### 2. Use Auth Context
```typescript
const { requiresAuth, isAuthenticated } = useAuth();

if (requiresAuth() && !isAuthenticated) {
  setError('Please login');
  return;
}
```

### 3. Standard State Pattern
```typescript
const [result, setResult] = useState<StoryGenerationResult | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### 4. API Call Pattern
```typescript
try {
  const response = await api.storyGenerate({
    persona,
    namespace,
    style,
    length,
    seed
  });
  setResult(response);
} catch (err: any) {
  setError(err.message || 'Generation failed');
  console.error('Error:', err);
} finally {
  setIsLoading(false);
}
```

### 5. Result Display Pattern
```typescript
{result && (
  <div className="prose prose-invert prose-sm max-w-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {result.final_story}
    </ReactMarkdown>
  </div>
)}
```

---

## File Locations (Important)

### Backend (Already Complete ✅)
- Routes: `/Users/tem/humanizer_root/workers/npe-api/src/routes/story-generation.ts`
- Service: `/Users/tem/humanizer_root/workers/npe-api/src/services/story-generation.ts`
- Deployed: https://npe-api.tem-527.workers.dev

### Current Frontend
- API Client: `/Users/tem/humanizer_root/cloud-workbench/src/core/adapters/api.ts`
- Current Panel: `/Users/tem/humanizer_root/cloud-workbench/src/features/panels/allegorical/AllegoricalPanel.tsx`
- Tool Registry: `/Users/tem/humanizer_root/cloud-workbench/src/core/tool-registry.tsx`

### Where You'll Add Code
- New directory: `cloud-workbench/src/features/panels/allegorical/modes/`
- New directory: `cloud-workbench/src/features/panels/allegorical/components/`

---

## API Response Format

Story generation returns:
```json
{
  "story_id": "uuid",
  "final_story": "Full narrative text...",
  "skeleton": {
    "characters": [
      {
        "name": "Eira",
        "role": "Protagonist",
        "motivation": "..."
      }
    ],
    "setting": "...",
    "conflict": "...",
    "stakes": "..."
  },
  "plot_summary": "Opening: ... Rising action: ... Climax: ... Resolution: ...",
  "metadata": {
    "word_count": 577,
    "generation_time_ms": 12363,
    "model_used": "@cf/meta/llama-3.1-8b-instruct"
  }
}
```

---

## Success Criteria for Phase 1

- [ ] API methods `storyGenerate()` and `getStoryExamples()` added to api.ts
- [ ] DiscoverMode.tsx component renders
- [ ] Can select persona/namespace/style
- [ ] "Generate Story" button triggers API call
- [ ] Loading state shows (not instant, takes 12-15 seconds)
- [ ] Story displays with proper markdown formatting
- [ ] Skeleton shows (characters, setting, conflict, stakes)
- [ ] Metadata displays (word count, time, model)
- [ ] "Load to Canvas" button works
- [ ] "Copy" button works
- [ ] No TypeScript errors
- [ ] Tests with 2-3 different attribute combinations
- [ ] UI looks good with dark theme

---

## Rough Component Structure

```
AllegoricalPanel.tsx (refactored, ~100 lines)
├── TabNavigation
├── DiscoverMode (new, ~200 lines)
│   ├── AttributeSelectors
│   ├── StoryGenerationForm (~80 lines)
│   └── GeneratedStoryDisplay (~120 lines)
│       ├── StorySkeletonView
│       └── FullStoryView (markdown)
└── TransformMode (extracted from current, ~350 lines)
    └── (existing code mostly unchanged)
```

---

## Phase 2-4 (After Phase 1 Works)

### Phase 2: Transform Enhancement (2-3 hours)
- Add `PreTransformGuidance` component
- Show expected co-variation % before transform
- Add `CoVariationDisplay` after transform
- Show which dimensions co-varied and why

### Phase 3: Workspace Tab (2-3 hours)  
- Create `WorkspaceMode` with AttributeGallery
- Show all custom attributes as cards
- Display usage count + edit/delete buttons
- Full-page AttributeBuilder (not modal)

### Phase 4: Library Tab (2-3 hours)
- Curate 20+ harmonious + experimental combinations
- Filter by category/rating/tags
- "Generate Example" on library items
- One-click apply to transform

---

## Documentation to Read First

1. **Design Document** (comprehensive): 
   `/Users/tem/humanizer_root/docs/ALLEGORICAL_PANEL_REDESIGN.md`

2. **Attribute Theory** (why this matters):
   `/Users/tem/humanizer_root/docs/attributes_in_allegorical_transformation.md`

3. **Story Generation Docs** (backend details):
   `/Users/tem/humanizer_root/docs/story_generation_implementation.md`

---

## Quick Start Commands

```bash
# Navigate to workbench
cd /Users/tem/humanizer_root/cloud-workbench

# Check current build
npm run build

# View the Allegorical panel source
cat src/features/panels/allegorical/AllegoricalPanel.tsx | head -50

# Check API client
grep -n "storyGenerate" src/core/adapters/api.ts  # Should be empty - you'll add it
```

---

## Key Decisions Made

1. **4 Tabs** (Discover, Transform, Workspace, Library) - Educational-first approach
2. **Story Generation First** - Learn before apply (Bloom's taxonomy)
3. **Embrace Co-Variation** - Not a bug, expected feature (20-50%)
4. **Incremental** - Build Phase 1, test, deploy, then Phase 2
5. **Pedagogy** - UI teaches attribute theory through examples

---

## Questions to Consider

1. Should Phase 1 show all 4 tabs or just Discover + Transform?
   - **Recommendation**: Start with 2 tabs, add others in Phase 3-4

2. Should "Load to Canvas" auto-switch to Transform tab?
   - **Recommendation**: Yes, good UX flow

3. Should we show progress during 12-15 second generation?
   - **Recommendation**: Yes, show "Generating... please wait" + spinner

4. Should generated stories be saved to history?
   - **Recommendation**: Yes, after story generation completes (already handled by backend)

---

## What Could Go Wrong & How to Fix

| Issue | Cause | Fix |
|-------|-------|-----|
| Story generation slow (15+ sec) | Normal latency | Show progress indicator |
| API methods not in api.ts | Not added yet | Add them in Phase 1 step 1 |
| Build errors | TypeScript issues | Check imports, types match schema |
| Stories not displaying | Markdown rendering issue | Verify ReactMarkdown + remark-gfm imported |
| "Load to Canvas" doesn't work | Canvas context not available | Verify useCanvas hook called |
| Auth error on generation | User not logged in | requiresAuth() check prevents this |

---

## Success Looks Like

After Phase 1 (3-4 hours):
- User opens cloud-workbench
- Clicks "Discover" tab in Allegorical Panel
- Selects "holmes_analytical + mythology + standard"
- Clicks "Generate Story"
- Waits 12-15 seconds
- Reads generated 500-word story
- Clicks "Load to Canvas"
- Story appears in Canvas
- User can now transform it in Transform tab
- **User understands what attributes do through example, not theory**

---

## Next Steps (Your Call)

1. **Read** the full design doc (30 min)
2. **Decide** if this direction feels right (Y/N)
3. **Start** Phase 1 (3-4 hours)
4. **Deploy** & test (30 min)
5. **Iterate** on Phase 2-4 as needed

**Recommendation**: This is the right moment to build it. Backend is ready, theory is proven, need is clear.

---

## Support Materials

- **Full Design**: `/Users/tem/humanizer_root/docs/ALLEGORICAL_PANEL_REDESIGN.md` (450 lines, all details)
- **Exploration Report**: `/Users/tem/humanizer_root/docs/EXPLORATION_SUMMARY_NOV11.md` (all findings)
- **Example Panel Code**: Current AllegoricalPanel is your template (450 lines, similar structure)
- **Other Panels**: Round-trip (180 lines), AI Detection (290 lines) - good for reference

---

**You're ready to start Phase 1. The backend is solid. The design is clear. The opportunity is now.**

