# Building the Studio: React, TypeScript, Three Panels

The interface argument started with a whiteboard.

December 2025. I'd drawn three rectangles: Find, Focus, Transform. Left panel for search and navigation. Center panel for content. Right panel for tools. The argument was about whether this was obvious or arbitrary.

It's both, of course. But I didn't know that yet.

---

## The Metaphor

Every interface is a metaphor. A metaphor for how work should happen, how attention should flow, what deserves screen space.

The three-panel layout came from looking at how I actually worked. Search for something. Read it. Do something with it. Three activities, three spaces. The panels made the workflow visible.

> "The Studio is THE interface paradigm. 3-panel layout: Find | Focus | Transform."
>
> *— Architecture notes, December 2025*

But visibility wasn't enough. The panels had to talk to each other. Click a search result—it loads in Focus. Select text in Focus—Transform panel activates. The workspace is a conversation between regions.

---

## React and Its Discontents

I chose React because I knew it. TypeScript because I'd been burned by JavaScript's type flexibility one too many times. The stack was familiar, not optimal.

The first version was a mess. State scattered across components. Props drilling through five layers. Every change rippled in ways I couldn't predict.

Context solved some of it. UnifiedBufferContext became the spine—everything content-related flowed through it. SessionContext for history. AuthContext for identity. The contexts talked to each other through carefully designed interfaces.

> "The essential Human is the user sitting at the keyboard. The archive is their past. The tools are their transformation. The workspace is where they meet themselves."
>
> *— Design notes, December 2025*

That quote came from a late-night session when I was trying to explain why the interface decisions mattered. The studio isn't just a tool. It's the place where you encounter your own writing.

---

## The Buffer System

Content lives in buffers. Each buffer is a workspace unit—a document, a selection, a transformation in progress.

The buffer system went through three iterations before it worked. First version: too simple, couldn't handle multiple selections. Second version: too complex, state management became a nightmare. Third version: buffers as persistent entities with their own lifecycle, coordinated through the context.

Buffers can be:
- **Draft**: In-progress writing
- **Selection**: Content pulled from archive
- **Transform**: Output from persona/style application
- **Staged**: Ready for book assembly

The type system enforces these distinctions. A transform buffer knows its source buffer and transformation parameters. A staged buffer knows its chapter assignment.

---

## The Panel Architecture

Mobile killed the first design.

Three panels work on a laptop screen. On a phone, they don't. The panels needed to collapse into something usable on a small screen without losing the workflow.

The solution: bottom sheets.

> "On mobile (<768px), side panels become bottom sheets:
> - Collapsed state: 60px peek height
> - Partial state: 40vh
> - Expanded state: 100vh - header"
>
> *— Responsive design spec, December 2025*

The panels don't disappear; they stack vertically and reveal through gesture. Swipe up to expand Find. Tap to collapse it. The three-panel metaphor survives, adapted to touch.

---

## CSS Variables and Theme Hell

Colors were a disaster.

I'd hardcoded hex values everywhere. `#666` for text. `#fff` for background. The code worked until I tried to add dark mode. Then everything broke.

The fix took longer than it should have. 1,379 inline style violations across 50+ files. Each one needed to become a CSS variable with fallback.

```css
/* Before */
color: #666;

/* After */
color: var(--text-secondary, #666);
```

The variables live in `:root` for light mode and `[data-theme='dark']` for dark. Theme switching became a single attribute change on the document element.

Should have done it from the start. Didn't. Paid for it later.

---

## What the Interface Does

The studio shapes how you think about your archive.

When you search in the left panel, you're browsing your past. The results aren't documents—they're moments. Conversations, drafts, fragments. The interface surfaces them by similarity, not date.

When you load content in the center panel, you're focusing. The text expands, demands attention. The side panels dim slightly. The architecture says: this is what matters now.

When you apply a transformation in the right panel, you're acting. The persona shifts the text. The style reshapes it. You watch your words become something adjacent to themselves.

The three panels aren't arbitrary. They're a theory about how writing works: find, focus, transform. The interface makes the theory tangible.

---

## What I'd Do Differently

The tech choices were fine. React, TypeScript, CSS variables—all reasonable.

What I'd change is the order. Start with the design tokens. Start with the theme system. Start with the responsive breakpoints. Build the foundation before the rooms.

I built features first and foundations later. The features worked; the foundations required retrofitting. Nothing broke irreparably, but the archaeological layers show.

Every codebase is a record of learning. This one records learning the hard way about CSS compliance and mobile-first design.

---

*Chapter assembled from development logs, November-December 2025*
