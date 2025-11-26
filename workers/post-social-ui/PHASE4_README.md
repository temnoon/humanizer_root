# Phase 4: Comment Thread UI - Implementation Files

## Summary

This implements Phase 4 of the Post-Social Node System: displaying curator responses in the comment list and triggering auto-respond when comments are posted.

## Files to Copy

Copy these files to your post-social-ui directory:

1. **ContextPanel.tsx** → `/Users/tem/humanizer_root/workers/post-social-ui/src/components/studio/ContextPanel.tsx`
   - Replaces the existing file
   - Adds `CommentThreadCard` component with curator response display
   - Implements auto-respond trigger when posting comments
   - Shows expandable curator feedback threads

2. **models.ts** → `/Users/tem/humanizer_root/workers/post-social-ui/src/types/models.ts`
   - Replaces the existing file
   - Adds `CuratorResponse` interface
   - Adds `curatorRules` to Node interface
   - Adds `curatorResponse` field to `NarrativeComment`
   - Adds `contextQuote` field to `NarrativeComment`

3. **nodes.ts** → `/Users/tem/humanizer_root/workers/post-social-ui/src/services/nodes.ts`
   - Replaces the existing file
   - Updates `postComment` to handle `contextQuote`
   - Adds `getComment` function
   - Updates `createNode` to accept `curatorRules`

4. **comment-thread-styles.css** → Append to `/Users/tem/humanizer_root/workers/post-social-ui/src/styles/studio.css`
   - Append to the end of studio.css
   - Contains all new styles for comment threads

## What's New

### Comment Thread Card Features:
- Shows comment status (pending/approved/rejected/synthesized) with color coding
- Displays curator evaluation scores (Quality, Relevance, Synthesizable)
- Expandable curator response section with:
  - Response type icon and label (Acknowledged, Clarification Requested, etc.)
  - Full curator response message with avatar
  - Perspective note if available
- "Awaiting curator review" indicator for pending comments

### Auto-Respond Flow:
1. User posts a comment
2. Comment appears immediately with "pending" status
3. "AI Curator is reviewing..." indicator appears
4. Backend curator-agent generates response (if autoRespond is enabled)
5. Comment thread updates with curator response

### UI States:
- Comments stats showing total and curator response count
- Expandable/collapsible curator threads
- Visual distinction for different response types
- Pulse animation for pending states

## Testing

1. Navigate to a narrative
2. Post a comment
3. Watch for auto-respond (if node has autoRespond enabled)
4. Click on curator response header to expand/collapse
5. Check evaluation scores and perspective notes

## Next Steps (Phase 5)

After Phase 4 is deployed, the next priority is:
- **Phase 5: Synthesis Dashboard** - UI for reviewing synthesis tasks, side-by-side diff, approve/reject buttons
