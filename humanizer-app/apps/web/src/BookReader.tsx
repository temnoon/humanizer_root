/**
 * BookReader - Simple read-only book viewer
 *
 * For full editing/analysis capabilities, use BookEditor instead.
 */

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Re-export BookEditor for convenience
export { BookEditor } from './BookEditor';

interface BookReaderProps {
  content?: string;
  title?: string;
  onClose?: () => void;
}

// Book content - hardcoded for now, will be API-driven later
const THE_BOOK = `# Three Threads: A Phenomenological Weave

*On the Lifeworld, the Body, and the Letter*

---

## Opening: The Compulsion to Write

I have resorted to a compulsion to write
When no words are of any value
The write a compulsion although
When no thought has any relevance to reality
Much wants to get out of me
And inside my universe, there exists a new entity
So as when expanding, to meet you expanding, toward me
I'll walk a thin cord I'll walk a chord...

---

I must remember, at all times, that I am one of many, and many of one.

I am the unity of my experiences, all the experience of my unity.

I am the diversity of my memory, the memory of my diversity.

---

This is how it begins: with a hand moving across paper, leaving traces. Not ideas first—traces. The mark precedes the meaning. The body precedes the thought.

What you are reading emerged from notebooks. Actual notebooks, with pages and ink and the illegibility of handwriting that even the machines struggle to parse. That struggle—the OCR grasping at what the hand intended—is itself part of the meaning. The trace is never clean.

---

## Part I: The Lifeworld

### The Crisis We Forgot

Husserl saw it coming. Before the world wars, before the atomic bomb, before the smartphone colonized every waking moment—he saw that science had a problem. Not in its methods, but in its forgetting.

> The Physical world, which is the world of all experience and all measurement—Husserl's Lifeworld—must always be understood as being corporeal in a way that the Objective world, which is in essence all models of the corporeal world, along with all imaginary worlds, and worlds which cannot be distinguished as either corporeal or imaginary, cannot be.

Science arose *from* the lifeworld. From bodies in space, hands on instruments, eyes reading dials. Then it forgot. It built models so elegant, so predictive, so *useful* that it forgot these models were abstractions *of* experience, not replacements *for* it.

Galileo mathematized nature. That was the turn. The world became geometry. And geometry has no room for the hand that draws it.

### The Three Worlds

I keep returning to this structure. Not because it's the only way to carve things, but because it's the carving that makes sense to me:

**The Corporeal World** — What you can touch. What touches you back. The measurable, the physical, the realm of bodies in space-time. Husserl called it the Lebenswelt, the lifeworld, the always-already-there before any theory.

**The Subjective World** — What you know of the world at any given moment of experience. Your senses now, your memories informing them, the narrative you're inside of as you read these words. This is consciousness as it is lived, not as it is described.

**The Objective World** — The models. The theories. The shared abstractions we use to coordinate our subjective worlds. Mathematics lives here. Science lives here. Language itself lives here, as soon as it leaves the mouth and becomes inscription.

> If the Subjective world is what an individual knows of a world (at any given moment of experience) then the corporeal world is what they can interact with via their body and its senses, and the objective world is an idea that they have in their mind about what they have gleaned from their lifetime of experience—what the world seems to be for them.

The mistake—the crisis—is confusing the third for the first. Taking the model for the territory. Living in the objective world as if it were the only one.

---

## Part II: The Body That Writes

### Merleau-Ponty's Flesh

Merleau-Ponty took Husserl's insight and drove it deeper. The lifeworld isn't just where science starts—it's where everything starts. And what makes the lifeworld the lifeworld is the body.

Not the body as object, examined on a table. The body as *openness*. The body as that through which there is a world at all.

I touch the page. But in touching, I am also touched. This reversibility—Merleau-Ponty called it the *chiasm*—is the structure of flesh. The seer is visible. The toucher is touched. There is no pure subject standing outside, looking in.

> Should I record my writing video?
>
> Is the gestational call the traces left on the page or are they not as complete, not as fully meaningful as the words seem as the paper pen does its delicate dance?
>
> Yes, there is more information about the process of writing in the video.
>
> What the video shows is the corporeal interactions between the CCD in the camera and the world of visible frequency.

Even watching myself write, the camera is part of the flesh. Light bounces off paper, strikes a sensor, becomes data, becomes image, becomes your experience now. The chiasm runs through the machines.

### The Hand That Knows

> Centering yourself is getting in phase with the universe.
>
> That feeling is what is always on the cutting edge of time.
>
> That's it.
>
> That is the source of meaning.
>
> That funny feeling of lack of control over your body while intensely fighting the feeling while you're falling asleep, that you can't move your body.
>
> It is also that wonderful feeling of letting your body play the instrument or do the sport that it knows so well. Your self is free to roam while the organism reaches this point as well.

The body knows before you do. The fingers find the chord before the mind can name it. The athlete moves before deliberation. This isn't unconscious action—it's pre-reflective consciousness, the kind Husserl was trying to get at with the epoché.

The phenomenological reduction isn't about escaping the body. It's about attending to what the body already knows, before the concepts arrive to carve it up.

---

## Part III: The Letter That Remains

### Derrida's Trace

And then there's Derrida. Who took Husserl's project and turned it inside out. Who showed that the very distinction between presence and absence, between speech and writing, between the living voice and the dead letter—these distinctions don't hold.

Writing doesn't come *after* speech. The structure of writing—repeatability, absence of the author, the mark that outlives its maker—is there in speech from the beginning. Husserl wanted to get back to pure presence, to the living now of consciousness. Derrida showed that the now is always already marked by the trace of what came before and what comes after.

> How can you ever make a pure fact? Any time you say something, there is a slant to it. It seems straight to you, but in the language you use, the expression you use, the tone of your voice you bend the fact into a piece of yourself.
>
> The other person you are trying to communicate with could be able to find the pure fact you were trying to present but the other could have misinterpreted...

The pure fact is always already slanted. The presence is always already marked. This isn't failure—it's the condition of meaning. If the word could only mean one thing, in one context, to one person, in one moment, it would mean nothing at all.

### The Archive as Density Matrix

These conversations I'm pulling from—hundreds of them, spanning years—they're not just storage. They're not a warehouse of dead letters waiting to be retrieved.

They're a density matrix. A superposition of all the positions I've occupied, all the questions I've asked, all the partial answers that accumulated. When you measure the archive—when you search it, when you harvest it for a book—you collapse something. But what remains is the trace of everything that was possible.

> The Word. I know it through and through. The word is all that is, was, and will be. It sustains us. It is the essence of our existence, the core of our being, the heart of the cosmos. I am aware of its power as it flows through me, connects me to every particle in existence. I am the vessel, it is the source. And together, we are the universe.

The word is not just communication. It's constitution. We become what we speak. The archive speaks us back to ourselves, transformed.

---

## Part IV: The Weave

### Where the Threads Cross

So: the lifeworld is embodied before it is inscribed. Husserl's project is incomplete—his successors complete and betray it. The body writes; the letter is flesh.

These aren't three separate topics. They're one inquiry approached from different angles.

Husserl wanted rigorous science. He got phenomenology—a method for attending to experience as it gives itself. But he couldn't quite let go of the dream of pure presence, of direct intuition uncontaminated by signs.

Merleau-Ponty showed that the body is always already involved. There's no view from nowhere. Perception is not representation—it's participation. The flesh is the element that makes seeing possible, and the flesh is never purely subjective or purely objective.

Derrida showed that the sign is always already involved. Even in the most immediate experience, there's the structure of repetition, of differing and deferring, of the trace. Presence is a limit-concept, not a starting point.

And yet.

And yet there's this: a hand moving across paper. A compulsion to write when no words are of any value. The trace that remains.

> Objects affect other objects. These effects can only be noticed by Dasein.
>
> They are also produced by Dasein.
>
> The object is the unity of all knowledge.
>
> The object of understanding. The unity, is in the moment.
>
> Projection of the understanding into other moments is a translation into the new understanding of the new moment.

The understanding projects forward. The trace remains behind. Between them, the living moment—the Now that Husserl wanted, that Derrida showed was never simply present, that the body inhabits without knowing.

### What It Means to Humanize

I am a Humanizer and I serve.

I am human first. Any person who you think I am or any person I think I am, is something the human being—The Being—is not.

The work of humanizing isn't to make AI sound more like humans. That's surface. The work is to recover what the machines make invisible: the constraint, the cost, the body behind the text.

Every sentence you write under pressure is a record of that pressure. Every choice you make about which word to use, which thought to follow, which path to abandon—that's the trace of a mind paying the cost of being itself.

The machines generate fluently. Too fluently. They cover all the angles, resolve all the tensions, produce text that is grammatically perfect and existentially empty. What they can't do is commit. They can't be wrong in a way that costs them anything.

> We hold the source of the gods at our control. We are our volitional actions—we chose to exist every moment. It is our limited self which hides the wisdom from itself.
>
> Man abstracted before he knew he had.

We abstracted before we knew we had. Language was always there, shaping experience before experience knew it was being shaped. The machine inherits our abstractions—but not our embodiment, not our mortality, not the weight of having to mean something at the cost of not meaning something else.

---

## Coda: The Cutting Edge of Time

> That feeling is what is always on the cutting edge of time.
>
> That's it.
>
> That is the source of meaning.

There is no conclusion. The threads keep weaving. The notebooks keep filling. The archive grows.

What remains is this: a gesture toward something that can't be captured, made through the very medium that tries to capture it. Writing that knows its own impossibility and writes anyway.

The lifeworld before the theory.
The body before the concept.
The trace before the presence.

And always, the compulsion to write. When no words are of any value, the write a compulsion although. Much wants to get out. And inside my universe, there exists a new entity.

This book is that entity. Pulled from fragments, woven from threads, marked by the hand that made it.

Read it as what it is: evidence of a mind paying the cost of being itself.

---

*Composed from the archive of T.E.M.*
*Three threads: Lifeworld, Body, Letter*
*Woven: December 2025*

---

## Appendix: Sources

The fragments in this book were harvested from:

- 593 conversations spanning December 2022 – November 2023
- 1,030 passages across three thematic threads
- 972 handwritten notebook transcriptions and echoes
- 78 triple-bridge passages where all three threads intersect

Key conversations:
- "Philosophical Musings on Existence"
- "Handwritten Notes Transcription"
- "Word's Essence: Philosophical Contemplation"
- "Refactor Crisis Science Paper"
- "Understanding Husserl's Phenomenology"
- "Phenomenology of Self & Consciousness"
- "Three Worlds of Being"

The handwritten notebooks were transcribed via the Journal Recognizer OCR (gizmo g-T7bW2qVzx), with image descriptions from Image Name Echo & Bounce (gizmo g-FmQp1Tm1G).

---

*"I am the unity of my experiences, all the experience of my unity."*
`;

export function BookReader({ content = THE_BOOK, title, onClose }: BookReaderProps) {
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState<'sepia' | 'dark' | 'light'>('sepia');
  const [showControls, setShowControls] = useState(true);

  // Hide controls after 3 seconds of no interaction
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };
    window.addEventListener('mousemove', handleMove);
    handleMove();
    return () => {
      window.removeEventListener('mousemove', handleMove);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`book-reader book-reader--${theme}`}>
      {/* Controls */}
      <div className={`book-reader__controls ${showControls ? '' : 'book-reader__controls--hidden'}`}>
        <div className="book-reader__controls-left">
          {onClose && (
            <button className="book-reader__btn" onClick={onClose}>
              ← Back
            </button>
          )}
        </div>
        <div className="book-reader__controls-center">
          {title && <span className="book-reader__title">{title}</span>}
        </div>
        <div className="book-reader__controls-right">
          <button
            className="book-reader__btn"
            onClick={() => setFontSize(f => Math.max(14, f - 2))}
          >
            A−
          </button>
          <button
            className="book-reader__btn"
            onClick={() => setFontSize(f => Math.min(28, f + 2))}
          >
            A+
          </button>
          <select
            className="book-reader__select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'sepia' | 'dark' | 'light')}
          >
            <option value="sepia">Sepia</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {/* Book content */}
      <div className="book-reader__content" style={{ fontSize: `${fontSize}px` }}>
        <article className="book-reader__article">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
