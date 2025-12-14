# Subjective Intentional Constraint: A Phenomenological Framework for AI Detection and Text Humanization

## Executive Summary for Future Assistants

This document describes a **novel approach to AI-generated text detection and remediation** developed through Edward's humanizer.com project. The core concept—**Subjective Intentional Constraint**—represents a fundamentally different axis from existing detection methods (burstiness, perplexity, complexity metrics). 

**Critical terminology note**: Always use the full term "Subjective Intentional Constraint" or abbreviate carefully with context. There may be other uses of "SIC" in AI detection literature referring to conventional statistical measures. Our concept is phenomenological, not statistical, and must not be confused with those approaches.

---

## Part I: The Core Insight

### Why We Call It "Slop" When It Is So Neat

The folk term "slop" for AI-generated text is philosophically precise despite its apparent imprecision. LLM output is rejected not because it is *low quality* but because it is *too complete relative to no lived stake*.

**The paradox**: AI text is often grammatically perfect, rhetorically balanced, and stylistically coherent—yet readers experience it as hollow. This neatness is the tell, not the exoneration.

**The diagnosis**: LLM text lacks **Subjective Intentional Constraint**—the phenomenological condition under which human language is produced by agents acting under:
- Time pressure
- Uncertainty  
- Irreversible commitment
- Asymmetric consequences
- Competing values that cannot all be satisfied

### The Phenomenological Foundation

Drawing on Husserlian phenomenology:

**Intentionality** is not merely "aboutness"—it is the structure of a consciousness that is always *reaching toward* what it doesn't yet fully possess. Human consciousness operates with:
- **Retention**: the just-past still resonating in present awareness
- **Protention**: the anticipated future already casting shadows on the present
- **Horizon**: meaning is never fully given; objects are presented perspectivally, incompletely

**Human writing happens inside this temporal flow.** A sentence is a bet placed before knowing the outcome. Every commitment forecloses alternatives. The text carries traces of having-to-decide-before-knowing.

**LLMs have no protention.** They are not anticipating—they are sampling. They were trained on the completed archive of human expression. They face no future they must survive. They incur no cost for saying one thing rather than another.

### The Three Worlds Framework (Edward's Model)

- **Objective World**: Symbols, norms, genres, collective imagination, averaged voice—the sedimented forms of culture
- **Corporeal World**: The lived act of reading/writing, embodied engagement with text
- **Subjective World**: Lived stakes, personal risk, irreversible choice, embarrassment, hesitation that costs something

**LLMs operate exclusively in the Objective World.** They are excellent at reconstructing intention-shaped artifacts from collective cultural sediment. But they have no access to the Subjective World—no lived stakes, no irreversible choices, no consequences.

**Subjective Intentional Constraint traces belong only to the Subjective World.** This is why they cannot be faked cheaply—simulating them requires maintaining fictional constraints across an entire narrative, which LLMs are optimized *not* to do.

---

## Part II: How This Differs from Existing Detection

### What Current Detectors Measure

Traditional AI detection asks: *"Does this text look statistically likely under a known model?"*

Methods include:
- **Perplexity/burstiness**: Human text shows more statistical irregularity
- **Token distribution anomalies**: Model-generated text has characteristic probability signatures
- **DetectGPT**: Uses probability curvature to identify model outputs
- **Watermarking**: Embedding provenance metadata

**These methods are becoming less reliable** as models improve and converge on human-like surface statistics.

### What Subjective Intentional Constraint Measures

Our framework asks: *"Does this text bear the imprint of subjective limitation?"*

This is not statistical—it is **ontological**. We detect the presence or absence of:
- A situated mind
- A constraint-bound viewpoint
- An asymmetric relationship to knowledge
- Emotional or epistemic cost

**Key insight**: LLMs can simulate *content* about uncertainty, hesitation, or commitment. But humans produce text that is *shaped by* these conditions—the constraint is enacted in the structure, not described in the content.

### Why This Is Harder to Game

Existing detectors can be fooled by:
- Adding artificial noise
- Varying sentence length
- Introducing deliberate errors

Subjective Intentional Constraint features are **hard to simulate** because:
- They require maintaining constraints across an entire narrative
- They accumulate historically (paragraph 7's awkwardness results from paragraph 3's overcorrection)
- They involve *not doing things* that LLMs are optimized to do (resolving tension, completing coverage, harmonizing conflict)

---

## Part III: The Scoring Model

### Definition

**Subjective Intentional Constraint** = evidence, in text, that an agent is writing under finite constraint: irreversible time, partial knowledge, competing values, and consequence.

### Scoring Formula

```
SubjectiveIntentionalConstraint(Text) = Σ(wₖ · sₖ) - Σ(vⱼ · rⱼ)
```

Where:
- `sₖ` = positive signals (constraint traces), normalized 0-1
- `rⱼ` = negative signals (constraint erasers), normalized 0-1
- `wₖ`, `vⱼ` = weights
- Final score reported as 0-100

### Positive Features (What Raises the Score)

**P1. Irreversibility / Commitment (weight: 0.22)**
- "I decided / I did / I will / I can't undo / it cost"
- Concrete commitments, not hedged possibilities
- Consequences acknowledged

**P2. Temporal Pressure & Sequencing (weight: 0.14)**
- Urgency, deadlines, "before I could," "in the moment"
- Time asymmetry: later reinterpretation, earlier blindness
- Compression under stress

**P3. Epistemic Incompleteness—Lived, Not Hedged (weight: 0.16)**
- Being wrong, surprises, misreadings
- "I didn't see it then"
- Not merely "maybe/perhaps" sprinkled decoratively

**P4. Value Tradeoffs & Sacrifice (weight: 0.18)**
- Explicit "X over Y" with acknowledged loss
- Moral tension that *remains* tension
- Something given up, not just considered

**P5. Scar Tissue / Residue (weight: 0.18)**
- Defensiveness, embarrassment, lingering regret
- Awkwardness that persists (not polished away)
- "I shouldn't have"—and the text still carries the mark

**P6. Situated Embodiment & Stakes (weight: 0.12)**
- Body, place, social risk, consequences, friction
- Not mere sensory description—stakes anchored in situation
- What could go wrong, and for whom

### Negative Features (What Lowers the Score)

**N1. Resolution Without Cost (weight: 0.30)**
- Conflict introduced → instantly harmonized
- Hard problems → summarized into reassurance
- Tension acknowledged then dissolved

**N2. Manager Voice / Expository Smoothing (weight: 0.25)**
- "In conclusion / it is important / this suggests"
- Generic meta-explanations replacing lived progression
- The narrator explains rather than enacts

**N3. Symmetry & Coverage Obsession (weight: 0.25)**
- Enumerating all sides, all caveats, all perspectives
- "No urgency, no exclusion": everything included, nothing chosen
- Balance as avoidance of commitment

**N4. Generic Human Facsimile (weight: 0.20)**
- Stock empathy lines; motivational filler
- Ornamental vividness not tethered to stakes
- "Human-flavored" but without irreversible commitments

### The Diagnostic 2D Map

Combine Subjective Intentional Constraint score with a **Neatness Index** (grammaticality, rhetorical closure, low contradiction, resolved stakes):

```
                    High Neatness
                         │
    "Neat Slop"          │         "Polished Human"
    (LLM zone)           │         (Expert craft with scars)
                         │
Low SIC ─────────────────┼───────────────── High SIC
                         │
    "Messy Low-Craft"    │         "Raw Human"
    (Struggling human)   │         (Diary, live draft, authentic)
                         │
                    Low Neatness
```

**This map is diagnostic, not just classificatory.** It tells writers where they are and suggests remediation paths.

---

## Part IV: Implementation Architecture

### Scoring Pipeline

1. **Segment text** into 8-15 sentence chunks (~200-400 words)

2. **Extract evidence** for each segment:
   - Commitment Events: {quote, who, action, irreversible?, consequence?}
   - Uncertainty Events: {quote, what was unknown, how it mattered}
   - Tradeoff Events: {quote, valueA, valueB, sacrifice described?}
   - Scar Tissue: {quote, residue type, why it persists}
   - Stakes Anchors: {quote, place/body/social cost, specificity}
   - Smoothing instances: {quote, what tension got flattened}
   - Manager Voice: {quote, meta-exposition replacing lived sequence}
   - Symmetry Dumps: {quote, list-like coverage behavior}
   - Facsimile: {quote, generic flourish without tether}

3. **Score each dimension** (0-4 scale):
   - 0 = absent
   - 1 = faint / decorative
   - 2 = present but generic
   - 3 = strong and specific
   - 4 = strong, specific, and structurally load-bearing

4. **Aggregate**:
   - Mean score = overall Subjective Intentional Constraint
   - Variance = constraint consistency
   - Minimum = weakest point (where LLM-ness leaks)

### Quick Heuristics (Implementable Without LLM)

**Irreversibility lexicon**: commit, decide, cannot undo, regret, cost, consequence, irreversible, never again...

**Temporal compression markers**: suddenly, before I could, too late, in that moment, afterward...

**Epistemic reversal patterns**: "I thought X but Y", "I assumed", "turns out"

**Tradeoff markers**: rather than, instead of, had to choose, at the expense of

**Manager voice markers**: in conclusion, it is important to note, overall, this suggests, key takeaway

**Symmetry markers**: on the one hand/on the other hand, balanced, nuanced, various perspectives + enumerated lists

---

## Part V: Connection to Humanizer.com Project

### The Profile Factory

Edward's humanizer.com includes a "profile factory" that extracts personas and styles from source texts (e.g., literary works) for use in transforming other texts. The Subjective Intentional Constraint framework emerged from analyzing why some transformations succeeded and others failed.

**Key discovery**: The Alice in Wonderland transformations failed when they extracted *tone and era* rather than *cognitive mechanics*. Alice's persona isn't witty or satirical—it's **literal-minded, reasoning moment-by-moment, sincere in a world where language is broken**.

### Persona vs. Style (Clarified)

- **Persona** = how cognition operates (epistemic mode, how authority is treated, how ambiguity is handled)
- **Style** = how language is realized on the surface (sentence structure, vocabulary, dialogue patterns)

**Profiles should encode:**
- Cognitive mechanics (how thinking happens)
- Narrative stance (distance, sincerity)
- Language operations (not vocabulary but structure)

**Profiles should NOT encode:**
- Plot facts, named characters, settings
- Authorial opinions or satire targets
- Era markers ("Victorian tone")
- Rhetorical ornament

### Vetting Source Texts

Not all texts are suitable for profile extraction. Good sources show:
- Repeated cognitive patterns (not one-off events)
- Separable persona and style layers
- Mechanisms that generalize across content

Warning signs:
- Satire that requires historical context
- Irony that depends on shared assumptions
- Surface ornament without underlying cognitive structure

### The Remediation Goal

Detection alone is insufficient. The humanizer.com vision includes **introducing Subjective Intentional Constraint into low-score text**:

- Restoring temporal asymmetry (text should feel like it's *arriving* at something)
- Adding cognitive cost (something traded off, left unsaid, imperfectly resolved)
- Creating subjective horizon (narrator oriented toward something not fully visible)

This is not "adding noise"—it's **restoring the structure of directedness under limit**.

---

## Part VI: Theoretical Lineage

### Phenomenological Sources
- **Husserl**: Intentionality, horizon structure, temporal flow (retention/protention)
- **Heidegger**: Thrownness, being-toward-future, finitude
- **Merleau-Ponty**: Embodied cognition, situated perception

### Narrative and Voice Theory
- **Bakhtin**: Dialogism, heteroglossia, voice as social action
- **Ricoeur**: Narrative identity, selfhood through emplotment
- **Bruner**: Narrative as mode of thought

### Cognitive Science
- **Enactivism**: Meaning as action-oriented coordination
- **Participatory sense-making**: Meaning in agent-environment coupling

### What This Framework Adds

Previous work in stylometry and AI detection focuses on statistical signatures. This framework operationalizes *phenomenological* insights:

- We detect not "how likely are tokens" but "what kinds of social/phenomenological moves does this text make, avoid, or over-supply"
- We test for ontological plausibility, not token likelihood
- We measure whether a mind seems to be paying the cost of being itself

---

## Part VII: Key Quotes and Formulations

**The core thesis:**
> "LLM-generated language is perceived as 'slop' not due to low quality, but due to the absence of Subjective Intentional Constraint. Human narrative is shaped by finitude—time pressure, uncertainty, and irreversible commitment—while LLMs operate exclusively within the Objective World of completed cultural forms. This results in text that is stylistically coherent yet phenomenologically uninhabited."

**Shorter formulation:**
> "Neat language without intention is experienced as slop."

**On detection:**
> "Burstiness detects statistics. Subjective Intentional Constraint analysis detects whether a mind seems to be paying the cost of being itself."

**On what LLMs lack:**
> "LLMs are very good at simulating styles. They are much worse at simulating being someone while not knowing everything."

**On remediation:**
> "You are not 'humanizing AI' in the sentimental sense. You are reintroducing finitude into narrative systems that have escaped it."

---

## Appendix: Terminology Disambiguation

**CRITICAL**: The term "Subjective Intentional Constraint" is novel to this framework. There may exist other uses of the abbreviation "SIC" in AI detection literature referring to conventional statistical or information-theoretic measures. 

**Our concept is fundamentally different:**
- It is phenomenological, not statistical
- It measures traces of lived constraint, not token distributions
- It is grounded in Husserlian intentionality, not information theory

When discussing this framework, prefer the full term "Subjective Intentional Constraint" to avoid conflation with unrelated concepts.

---

*Document created: December 2025*
*Project: humanizer.com*
*Primary developer: Edward Bernstein (aka Tem Noon)*
*Framework developed through collaborative analysis with multiple AI assistants*