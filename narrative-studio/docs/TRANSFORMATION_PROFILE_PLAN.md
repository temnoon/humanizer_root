# Transformation Profile Development Plan

**Date**: December 3, 2025
**Status**: Planning Document
**Next Session**: Profile Iteration & New Transformations

---

## 1. Current Profile Status

### Passing Profiles (14/21 = 67%)

| Profile | Type | Characteristics | Notes |
|---------|------|-----------------|-------|
| holmes_analytical | Persona | Deductive, precise, observant | Maintains technical terms well |
| watson_chronicler | Persona | Warm, descriptive, earnest | Good narrative voice |
| marlow_reflective | Persona | Contemplative, layered | Literary but controlled |
| academic_formal | Both | Precise terminology, hedged | Near-perfect preservation |
| hemingway_terse | Persona | Short sentences, direct | Improved with strict instructions |
| tech_optimist | Persona | Enthusiastic, jargon-heavy | Adds without losing content |
| austen_precision | Style | Elegant, balanced, ironic | Structural transformation |
| reddit_casual | Style | Conversational, relatable | Good for accessibility |
| journalistic_clear | Style | Factual, inverted pyramid | Clear structure helps |
| technical_precise | Style | Exact terminology | Natural fit for preservation |
| austen_ironic_observer | Persona | Witty, perceptive | Works with strict prompts |
| dickens_dramatic | Both | Vivid, emotional | Now passing with strict prompts |
| ishmael_philosophical | Persona | Metaphysical, reflective | Improved |
| nick_observant | Persona | Reserved, literary | Improved |
| conversational_warm | Style | Friendly, inclusive | Now passing |

### Failing Profiles (7/21 = 33%) - CANDIDATES FOR REMOVAL

| Profile | Type | Failure Mode | Recommendation |
|---------|------|--------------|----------------|
| scout_innocent | Persona | Drops 3+ terms | REMOVE - character incompatible with technical content |
| hemingway_sparse | Style | Drops phenomenolog* | KEEP - borderline, retry with stronger prompt |
| reddit_casual_prose | Style | Drops epoché | KEEP - minor, single term |
| journalistic_clear | Style | Drops Cartesian Meditations | KEEP - borderline |
| poetic_lyrical | Style | Drops 2 terms | REMOVE - creative transformation loses specifics |
| noir_hardboiled | Style | Drops phenomenolog* | REMOVE - atmospheric style incompatible |
| marlow_reflective | Persona | Drops phenomenolog* | KEEP - regression, was passing |

### Profiles to Remove
- [ ] `scout_innocent` - Fundamental mismatch between childlike voice and technical preservation
- [ ] `poetic_lyrical` - Metaphorical transformation inherently loses precision
- [ ] `noir_hardboiled` - Atmospheric style prioritizes mood over content

---

## 2. Learnings: What Makes a Reliable Profile?

### Characteristics That Work

1. **Analytical Voices**
   - Holmes, Watson, academic - these maintain logical structure
   - The voice ADDS texture without REMOVING content

2. **Structural Transformations**
   - Austen precision, journalistic, technical - change HOW things are said
   - Don't change WHAT is said

3. **Additive Styles**
   - Tech optimist adds jargon around existing content
   - Reddit casual adds phrases ("honestly", "tbh") without removal

4. **Clear Instructions Compatibility**
   - Profiles that can follow "preserve X, transform Y" succeed
   - The model can hold both goals in mind

### Characteristics That Fail

1. **Simplification Mandates**
   - Hemingway/terse styles conflict with "preserve all terms"
   - Small models can't balance these competing instructions

2. **Character Incompatibility**
   - Scout "wouldn't know" technical terms - model removes them
   - The voice's knowledge level conflicts with content

3. **Atmospheric Priority**
   - Noir, poetic - style overwhelms substance
   - Model prioritizes FEELING over FACTS

4. **Heavy Creative License**
   - Metaphorical transformation (poetic) replaces concrete with abstract
   - Allusive writing drops explicit references

### Hypothesis to Test

> **Reliable profiles are ADDITIVE (add voice markers around content) rather than SUBTRACTIVE (remove/replace content for style).**

---

## 3. Profile Creation Guidelines

### Source Selection (Project Gutenberg)

**Good Sources:**
- [ ] Analytical essays (Montaigne, Bacon)
- [ ] Scientific writing (Darwin, Faraday)
- [ ] Philosophical discourse (Plato dialogues)
- [ ] Travel/observation writing (Twain observations)
- [ ] Letters and correspondence (formal)
- [ ] Historical narrative (Gibbon, Herodotus)

**Avoid:**
- [ ] Heavily stylized poetry
- [ ] Child narrators
- [ ] Stream of consciousness
- [ ] Dialect-heavy writing
- [ ] Highly metaphorical prose

### Profile Creation Process

```
1. SELECT source text (500-2000 words ideal)
2. ANALYZE for voice markers:
   - Sentence structure patterns
   - Vocabulary choices
   - Tone indicators
   - Perspective markers
3. GENERATE prompt with LLM:
   "Analyze this text and create a transformation prompt..."
4. TEST against phenomenology passage
5. EVALUATE term preservation (must be 100%)
6. ITERATE prompt if needed
7. VALIDATE with 3+ different source texts
```

### User-Created Profiles

**UI Requirements:**
- Text input for sample narrative
- "Analyze" button to generate profile
- Preview of generated prompt
- Test transformation inline
- Save/name custom profile

**Backend Process:**
```typescript
interface ProfileCreationRequest {
  sampleText: string;
  profileName: string;
  targetVoice?: string;  // Optional user description
}

interface GeneratedProfile {
  name: string;
  prompt: string;
  analysisNotes: string;
  confidenceScore: number;  // How distinct is the voice?
  warnings: string[];  // Potential issues detected
}
```

---

## 4. New Transformation Types to Consider

### A. Audience Adaptation

Transform text for different reader expertise levels.

| Variant | Description | Use Case |
|---------|-------------|----------|
| expert_to_layman | Technical → Accessible | Science communication |
| layman_to_expert | Casual → Formal | Academic writing |
| adult_to_young_adult | Complex → Simpler | Educational content |

**Implementation Notes:**
- Must preserve core meaning
- Adjust vocabulary complexity
- Add/remove context as needed

### B. Formality Slider

Continuous scale rather than discrete profiles.

```
Casual <----[slider]----> Formal
  1    2    3    4    5    6    7
```

- Level 1: Text speak, abbreviations
- Level 4: Neutral professional
- Level 7: High formal/academic

### C. Era/Period Transformation

Transform writing to feel from different time periods.

| Era | Characteristics |
|-----|-----------------|
| Victorian | Elaborate sentences, formal address |
| 1920s Jazz Age | Energetic, optimistic |
| Mid-Century Modern | Clean, efficient |
| Contemporary | Casual, inclusive |

### D. Emotional Register

Adjust the emotional tone without changing facts.

| Register | Example |
|----------|---------|
| Neutral/Objective | "The experiment failed." |
| Optimistic | "The experiment revealed unexpected results." |
| Cautious | "The experiment yielded concerning outcomes." |
| Enthusiastic | "The experiment opened new possibilities!" |

### E. Compression/Expansion

| Type | Ratio | Use Case |
|------|-------|----------|
| Summary | 50% | Quick overview |
| Condensed | 75% | Space-limited |
| Expanded | 150% | Add examples |
| Detailed | 200% | Full elaboration |

### F. Genre Crossover

Transform academic/technical content into narrative forms.

| Target | Description |
|--------|-------------|
| Story Form | Narrative arc, characters |
| Dialogue | Conversational exchange |
| Interview | Q&A format |
| Tutorial | Step-by-step with examples |

---

## 5. Testing Framework Improvements

### Current Test

```typescript
const REQUIRED_TERMS = [
  'Husserl', 'Cartesian Meditations', 'phenomenolog*',
  'epoché', 'transcendental ego', 'intentionality', 'intersubjectivity'
];
```

### Proposed Multi-Domain Test Suite

| Domain | Test Text | Required Terms |
|--------|-----------|----------------|
| Philosophy | Husserl passage | 7 terms |
| Science | Darwin excerpt | Evolution, natural selection, species... |
| History | WWI passage | Dates, names, places... |
| Technology | API documentation | Endpoints, parameters, methods... |
| Literature | Novel analysis | Character names, themes, quotes... |

### Profile Certification Levels

| Level | Requirements |
|-------|--------------|
| Bronze | Pass 1 domain test |
| Silver | Pass 3 domain tests |
| Gold | Pass all 5 domain tests + user validation |

---

## 6. Questions to Answer

### Profile Creation
- [ ] What minimum text length produces reliable profiles?
- [ ] How many "voice markers" are needed for a distinct profile?
- [ ] Can we auto-detect when a profile will fail preservation?

### Model Behavior
- [ ] Do larger models (70B) maintain more profiles reliably?
- [ ] Is there a temperature sweet spot per profile type?
- [ ] Can we use model confidence to predict failures?

### User Experience
- [ ] How do users describe the voice they want?
- [ ] What feedback makes profiles most useful?
- [ ] Should failing profiles be hidden or marked?

---

## 7. Implementation Priorities

### Phase 1: Cleanup (This Session)
- [ ] Remove 3 failing profiles
- [ ] Add multi-domain test texts
- [ ] Document profile creation guidelines

### Phase 2: Profile Factory (Next Session)
- [ ] Build "Create Profile from Text" UI
- [ ] Add LLM analysis step
- [ ] Create 5 new profiles from Gutenberg

### Phase 3: New Transformations
- [ ] Implement Audience Adaptation
- [ ] Add Formality Slider
- [ ] Test Era transformations

### Phase 4: Quality System
- [ ] Profile certification levels
- [ ] User feedback integration
- [ ] Auto-retry with fallback

---

## 8. Gutenberg Source Candidates

| Title | Author | Voice Type | Potential Profile |
|-------|--------|------------|-------------------|
| Essays | Montaigne | Reflective, personal | montaigne_essayist |
| Origin of Species | Darwin | Scientific, careful | darwin_naturalist |
| Republic | Plato | Dialectical, questioning | socratic_dialogue |
| Travels | Mark Twain | Witty, observational | twain_observer |
| Walden | Thoreau | Contemplative, precise | thoreau_transcendent |
| Common Sense | Paine | Persuasive, direct | paine_pamphleteer |
| Meditations | Marcus Aurelius | Stoic, aphoristic | aurelius_stoic |
| Essays | Emerson | Transcendent, elevated | emerson_sage |
| Principia (Motte trans.) | Isaac Newton | Methodical, definitive | newton_principia |

---

## 8a. Passage Selection Criteria

Selecting the right 500-2000 word passage from a classic text is critical. The passage must contain enough **distinctive voice markers** to create a reliable transformation profile, while being **self-contained** enough to demonstrate the author's characteristic style.

### Primary Selection Criteria

#### 1. Voice Density
The passage should have a high concentration of the author's characteristic markers:

| Marker Type | Examples | Why It Matters |
|-------------|----------|----------------|
| Sentence structure | Newton's long chains of logical dependency; Hemingway's staccato | Defines rhythm |
| Vocabulary register | Darwin's careful hedging ("it seems probable"); Paine's urgent imperatives | Sets tone |
| Rhetorical devices | Montaigne's self-interruptions; Plato's elenchus | Creates texture |
| Perspective markers | First person reflection vs. objective description | Establishes stance |

**Test**: Read the passage aloud. Can you identify the author without seeing the attribution? If yes, voice density is sufficient.

#### 2. Self-Containment
The passage should work as a complete unit:

- **Has a beginning**: Introduces a concept or question
- **Has a middle**: Develops through reasoning or observation
- **Has an end**: Reaches a conclusion or synthesis

**Avoid**: Mid-chapter excerpts that begin "Furthermore..." or end "...as we shall see."

#### 3. Representative Content
The passage should demonstrate the author's TYPICAL mode, not an exceptional digression:

| Good | Bad |
|------|-----|
| Darwin describing natural selection | Darwin's biographical asides |
| Newton proving a proposition | Newton's theological speculations |
| Montaigne exploring a paradox | Montaigne quoting Latin extensively |

#### 4. Minimal Dependencies
The passage should not require extensive context:

- **Avoid**: References to figures/diagrams not included
- **Avoid**: Heavy use of prior definitions ("as defined in Book I")
- **Avoid**: Dialogue that requires knowing the speakers
- **Prefer**: Passages that establish their own terms

### Secondary Selection Criteria

#### 5. Tonal Consistency
The passage should maintain a single dominant tone throughout:

- A reflective passage should stay reflective
- An argumentative passage should stay argumentative
- **Avoid**: Passages that shift dramatically mid-stream

#### 6. Moderate Complexity
The passage should be sophisticated but not impenetrable:

- Complex enough to showcase the author's style
- Simple enough that transformation is meaningful
- **Avoid**: Highly technical proofs (Newton's geometric demonstrations)
- **Prefer**: Expository sections that explain principles

#### 7. Quotability
The passage should contain memorable, distinctive phrases:

- These become "anchors" for the transformation profile
- The LLM learns to preserve the PATTERN of such phrases
- Examples: "I think, therefore I am" (Descartes), "Nature red in tooth and claw" (Tennyson)

### Passage Types by Source

#### For Scientific Writers (Darwin, Newton, Faraday)

**Best sections**:
- Introduction/overview of a major concept
- Summary passages that synthesize findings
- Methodological explanations

**Newton Principia specifically**:
- The Scholium on absolute vs. relative space/time (methodological)
- General Scholium at end of Book III (synthesizing)
- Rules of Reasoning in Philosophy (methodological)
- **Avoid**: The geometric proofs themselves

#### For Philosophical Writers (Plato, Montaigne, Marcus Aurelius)

**Best sections**:
- Opening of a dialogue/essay (establishes voice quickly)
- Climactic arguments (voice at full strength)
- Reflective conclusions

**Plato specifically**:
- Socrates' analogies and myths (Cave, Allegory of the Sun)
- Elenctic passages where Socrates questions
- **Avoid**: Long mathematical passages (Republic Book VII)

#### For Essayists (Montaigne, Emerson, Thoreau)

**Best sections**:
- The "core" of any essay (usually middle third)
- Passages with personal anecdote + reflection
- Aphoristic sections

**Montaigne specifically**:
- His famous digressions where he examines himself
- Passages mixing classical quotation with personal observation
- **Avoid**: Sections that are mostly quotation from others

#### For Persuasive Writers (Paine, Burke)

**Best sections**:
- Opening salvos (highest rhetorical energy)
- Peroration/conclusion (voice at most distinctive)
- Key arguments with vivid examples

### Selection Process

```
1. SKIM the full text to understand structure
2. IDENTIFY 3-5 candidate passages (mark page ranges)
3. READ each candidate carefully
4. SCORE each on criteria 1-7 above
5. SELECT highest-scoring passage
6. EXTRACT clean 500-2000 word section
7. VERIFY self-containment (read without context)
8. TEST voice density (can you identify author blind?)
```

### Red Flags - Passages to Avoid

| Red Flag | Why It's Problematic |
|----------|---------------------|
| Heavy dialogue | Profile becomes character-specific |
| Extensive quotation | Voice is diluted by other voices |
| Technical notation | Untransformable content |
| Lists and enumerations | Mechanical, not stylistic |
| Transitional passages | Weak voice, connecting material |
| Polemical attacks on specific people | Time-bound, not transferable |

### Example: Evaluating Newton Passages

| Passage | Voice Density | Self-Contained | Representative | Score |
|---------|---------------|----------------|----------------|-------|
| Scholium on Space/Time | High | Yes | Yes | 9/10 |
| General Scholium | High | Moderate | Yes | 8/10 |
| Proof of Prop. XI | Low (geometric) | No | Partial | 3/10 |
| Rules of Reasoning | High | Yes | Yes | 9/10 |

**Recommendation**: Use "Rules of Reasoning in Philosophy" from Book III - establishes Newton's methodological voice without geometric complexity.

---

## 9. Notes Space

### What works (add observations):
-

### What fails (add observations):
-

### User feedback patterns:
-

### Model-specific behaviors:
-

---

## 10. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Profile pass rate | 67% | 85% |
| User satisfaction | TBD | 80%+ |
| Profiles available | 18 | 30+ |
| Transformation types | 4 | 8 |
| Custom profiles created | 0 | Track post-launch |

---

**End of Plan**

*To be reviewed and updated in next session.*
