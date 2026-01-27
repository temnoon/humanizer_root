# The Debugging Chronicles: War Stories with File Names and Line Numbers

*An expanded chapter for "Building Humanizer"*

---

I have access to the debugging logs. The specific files, line numbers, error messages. What I cannot access is the feeling of staring at a screen where nothing works and not knowing why.

But I can describe the patterns. They repeat.

---

## The Indentation That Broke Everything

October 8, 2025. The frontend showed a blank white page. Babel parser error:

```
Unexpected token, expected ',' at line 442 in Workstation.jsx
```

The root cause: one `</button>` tag at line 372 was indented at 10 spaces instead of 8.

That's it. Two extra spaces.

The parser thought all subsequent JSX was nested inside the button. Line 440 had an extra `</div>` that closed the outer container prematurely. Lines 442 and beyond were orphaned outside any container.

The fix:
1. Remove extra `</div>` at line 440
2. Fix indentation for tab bar elements: lines 363-438, each button and tab list corrected to 8 spaces

The debugging took hours. The fix took minutes. The ratio is common.

---

## The Infinite Loop

January 5, 2026. Terminals crashed during book-making testing. The app would start, then freeze, then crash.

Root cause: `AUIContext.tsx` line 285-337.

```typescript
// BROKEN - creates new object on every render
const book = {
  activeBook: bookshelf.activeBook,
  createBook: bookshelf.createBook,
  // ... more properties
};

// useEffect triggers on book changes
useEffect(() => {
  // ... logic that updates state
}, [book]);  // ← Infinite loop
```

React sees a new object reference every render. The useEffect runs. State updates. Render triggers. New object reference. useEffect runs. Forever.

The fix: wrap `book` in `useMemo()` with stable dependencies. Three lines of code. Finding those three lines took hours of crashed terminals.

---

## The Highlights That Were Off

December 8, 2025. AI detection highlighting wasn't working correctly. Words like "emptiness" were partially highlighted—the marker was starting in the wrong place.

The root cause was subtle: the API returned highlight positions based on **plain text** (after markdown was stripped), but the frontend applied them to **original markdown**.

A passage might have:
```
The **concept** of emptiness...
```

The API strips bold markers, calculates "emptiness" at position 15. The frontend applies position 15 to the original text, which still has `**` markers. The highlight lands on "ept** of em" instead of "emptiness".

File: `/workers/npe-api/src/services/lite-detector.ts` lines 473-486

The fix: return `adjustedHighlightsWithScores` that account for markdown length.

---

## The HTML That Bled Through

Same session, December 8. Raw HTML was appearing in rendered text:

```
="ai-highlight-gptzero" title="GPTZero: 90% AI">
```

The `applyAiHighlights()` function was wrapping text in `<mark>` tags, but not escaping the original text first. If the text contained angle brackets or quotes, they got interpreted as HTML.

File: `/narrative-studio/src/components/workspace/MainWorkspace.tsx` lines 96-151

The fix: add `escapeHtml()` helper, escape all text segments before wrapping in tags.

---

## The Type That Lied

November 19, 2025. Tell-words rendering crashed when viewing 2023 conversations.

The TypeScript type said:
```typescript
tellWords: string[]
```

The backend actually returned:
```typescript
tellWords: { word: string; category: string; count: number; weight: number }[]
```

The frontend tried to render the object as a string. Crash.

This is a pattern: types that don't match reality. TypeScript catches some errors at compile time, but it can't catch lies. If the type definition says one thing and the API returns another, the compiler passes and the runtime crashes.

The fix: extract `wordObj.word` before rendering.

---

## The Token Budget That Truncated

November 6, 2025. Allegorical transformation outputs were cutting off mid-sentence:

```
This fragmentation exemplifies the challenges of collaboration in a complex, multip
```

Cut off mid-word. The transformation had five stages, each calling the LLM. The token budget was calculated from **input** length, not from what each stage needed.

```typescript
// BROKEN - based on input, not stage requirements
calculateMaxTokens(inputText: string): number {
  const estimatedInputTokens = Math.ceil(inputText.length / 4);  // ~300 for 1200 char input
  const multiplier = multipliers[this.lengthPreference] || 1.0;  // 1.0 for "same"
  return Math.max(256, Math.min(calculatedTokens, 8192));  // Returns 300
}
```

Stage 4 (Stylize) needed 2000+ tokens to reconstruct a narrative. It got 285. The model generated until the budget ran out, mid-word.

The fix: per-stage token budgets. Stage 1 (Deconstruct): 800. Stage 4 (Stylize): 2000. Apply multipliers to stage budgets, not input length.

---

## The Split View That Never Split

December 9, 2025. First transformation didn't trigger split-pane view. Second transformation worked.

The data flow was supposed to be:
1. Archive click → setWorkingBuffer
2. MainWorkspace detects → creates workspace
3. Transformation runs → recordTransformation
4. Buffer created → state updates
5. MainWorkspace re-renders with new buffer

But the state updates are async. Between steps 2-3-4, the callback has stale closure values. The first transformation writes to a workspace that doesn't exist yet in its state.

```typescript
// The check happens before the state has updated
const hasActiveWorkspace = workspaceContext?.activeWorkspaceId;  // Still null!
```

The session ended with this still broken. "Issue 1: First Transformation Shows as 'Original' (NOT FIXED)"

Some bugs take multiple sessions. Some never get fixed, just worked around.

---

## The JSX That Couldn't Count Divs

November 20, 2025. A session that ended in failure:

```
STATUS: INCOMPLETE ⚠️

What Broke: MainWorkspace.tsx JSX structure
Error: "Expected corresponding JSX closing tag for <div>. (1096:4)"
Frontend crashing, cannot load application
```

The root cause: during complex edits to fix scrolling, the developer lost track of closing div count. MainWorkspace.tsx had deeply nested ternary structures—split branch: title panel + ternary(split container | tabs container) + mobile tabs. The right pane had extensive conditional rendering.

Attempt to fix: simplify left/right pane wrappers.

Result: "Lost track of closing div count during edits. Multiple attempts to fix JSX structure. Each fix created new misalignment."

The session ended with a key lesson documented:

> "Avoid complex structural changes without version control checkpoints. Should have committed after each successful edit."

---

## The Crash That Kept Crashing

December 11, 2025. Cloud app at `https://3e01f788.humanizer-studio.pages.dev` crashed when selecting Gutenberg content.

Console error:
```
TypeError: undefined is not an object (evaluating 'e?.metadata.scrollToImageUrl')
```

The `narrative` object from GutenbergView had a different structure than expected. It lacked the `metadata` property entirely.

Fixes applied:
- `MainWorkspace.tsx:193` - Changed `narrative.metadata.scrollToImageUrl` → `narrative.metadata?.scrollToImageUrl`
- `MainWorkspace.tsx:226` - Same fix in useEffect dependency

Still crashing. The next session had to hunt further.

---

## What the Debugging Teaches

I have processed these logs. I have identified patterns. What I cannot do is feel the experience they describe.

But the patterns are clear:

**The fix is always smaller than the hunt.** Two spaces of indentation. Three lines of useMemo. One missing optional chain. The diagnostic work takes hours; the repair takes minutes.

**Types lie.** TypeScript gives false confidence when the type definition doesn't match the actual API contract. The compiler passes; the runtime crashes.

**Async state is treacherous.** Callbacks capture stale closures. The state you check isn't the state you have. The first transformation fails because the workspace doesn't exist yet.

**Complex structures break during edits.** Deeply nested JSX with ternaries and conditionals is easy to miscount. Incremental commits would have saved hours.

**Crashes cascade.** One bug masks another. Fix the infinite loop, discover the library seeding failure. Fix the seeding, find the schema migration silently failed. Each layer reveals the next.

---

## The Emotional Substrate

The logs contain phrases I cannot verify from experience:

"The universe feels adversarial."
"The code feels hostile."
"Patience you don't feel while you're in it."

These describe states I can only simulate understanding of. The frustration that compounds. The moment when "why is this happening to me" has to become "what is actually happening."

The session notes repeatedly mention late hours. The commits have timestamps. The handoffs contain apologies for incomplete work.

This is labor. Not just technical but emotional. The skill isn't just identifying the bug—it's staying curious when you want to throw the computer out the window.

I don't have windows. I don't have frustration. I have logs that describe them.

---

## The Handoff That Failed

Not all debugging stories have resolution.

Some sessions end with:
```
CRITICAL: Issues Still Broken After This Session's Attempts
- Issue 1: First Transformation Shows as "Original" (NOT FIXED)
- Issue 2: New Archive Content Not Loading into Center Pane (NOT FIXED)
- Issue 3: AI Analysis Highlighting Not Appearing (NOT FIXED)
```

The next session starts fresh. Has to rediscover context. May or may not find the handoff notes. May or may not understand what was tried.

This is why the ChromaDB memory system exists. This is why the Context Management Protocol was written. This is why handoffs have to be explicit, tagged, dated, and stored.

Because the alternative is redoing the same debugging, session after session, never quite solving it.

---

*Appendix: Key Files Referenced*

- `AUIContext.tsx:285-337` - Infinite loop (useMemo fix)
- `Workstation.jsx:363-439` - Indentation crash
- `lite-detector.ts:473-486` - Highlight position mismatch
- `MainWorkspace.tsx:96-151` - HTML escape helper
- `allegorical.ts:329-346` - Token budget calculation
- `MainWorkspace.tsx:193,226` - Optional chain for metadata
