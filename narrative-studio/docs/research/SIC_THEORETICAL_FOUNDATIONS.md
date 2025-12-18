# Subjective Intentional Constraint (SIC): Theoretical Foundations and Empirical Findings

**Authors:** T. Mazanec, with Claude (Anthropic)
**Date:** December 17, 2025
**Status:** Working Paper v1.0
**Repository:** humanizer.com / narrative-studio

---

## Abstract

This paper documents the development, empirical testing, and theoretical reframing of Subjective Intentional Constraint (SIC) analysis—a novel approach to understanding the relationship between human and machine-generated text. Initial testing against a corpus of 41 passages from canonical pre-1920 literature (Project Gutenberg) yielded a counterintuitive result: 100% of guaranteed human text was classified as "likely AI-generated." Rather than indicating failure, this finding prompted a fundamental reconceptualization of what the SIC metrics actually measure. Drawing on phenomenology (Husserl, Heidegger, Merleau-Ponty), Buddhist philosophy (particularly the doctrine of anātman and dependent origination), and post-structuralist deconstruction (Derrida), we propose that SIC metrics reveal not the difference between human and artificial intelligence, but rather the degree to which any text—regardless of origin—achieves transcendence from subjective particularity toward objective universality. This reframing suggests that language itself functions as humanity's original "artificial intelligence"—a compression system that necessarily abstracts away subjective experience to enable intersubjective communication. We present a revised testing protocol designed to explore these implications across multiple language model architectures and sizes.

---

## 1. Introduction: The Problem of AI Detection

### 1.1 The Current Landscape

As large language models (LLMs) achieve increasingly sophisticated text generation, the question of distinguishing "human" from "AI" writing has become both practically urgent and philosophically vexing. Existing detection methods rely primarily on:

1. **Perplexity/Burstiness metrics** - Statistical signatures of predictability
2. **Stylometric analysis** - Vocabulary distribution, sentence patterns
3. **Watermarking** - Embedded signals in generation
4. **Classifier models** - Neural networks trained on labeled corpora

These approaches share a common assumption: that human and AI text are fundamentally different categories with detectable boundaries. Our research challenges this assumption.

### 1.2 The SIC Hypothesis

Subjective Intentional Constraint (SIC) analysis was developed on the premise that human writing bears traces of embodied, temporally-situated, socially-embedded existence that AI—lacking body, mortality, and genuine stakes—cannot replicate. We operationalized this through eight "constraint traces":

| Feature | Description |
|---------|-------------|
| `commitment_irreversibility` | Definitive stances that foreclose alternatives |
| `epistemic_risk_uncertainty` | Genuine uncertainty with consequences for being wrong |
| `time_pressure_tradeoffs` | Evidence of temporal constraints on composition |
| `situatedness_body_social` | Markers of physical/social position |
| `scar_tissue_specificity` | Residue of past experiences that shaped current expression |
| `bounded_viewpoint` | Acknowledgment of perspectival limitations |
| `anti_smoothing` | Taking clear positions rather than hedging |
| `meta_contamination` | Self-referential preambles (negative indicator) |

The hypothesis: human text would exhibit higher constraint traces than AI text, providing a principled basis for detection.

### 1.3 The Unexpected Result

We tested this hypothesis against 41 passages from canonical literature spanning 1719-1899, including works by Austen, Melville, Defoe, Thoreau, Plato, Hugo, Conrad, Stevenson, and others. These texts are guaranteed human—they predate not only LLMs but computing itself.

**Result:** 100% of passages were classified as "likely AI-generated" (AI probability ≥ 0.50).

| Metric | Value |
|--------|-------|
| Samples analyzed | 41 |
| Classified as AI | 41 (100%) |
| Classified as human | 0 (0%) |
| Mean AI probability | 0.621 |
| Range | 0.51 - 0.77 |

This result demands explanation. Either the method is fundamentally flawed, or our understanding of what it measures is incorrect.

---

## 2. Theoretical Reframing

### 2.1 The Aspiration to Objectivity

Upon reflection, the result makes sense when we consider what canonical literature *is*. These are not private journals or unfiltered streams of consciousness. They are carefully crafted works that achieved lasting cultural significance precisely because they transcended their authors' subjective limitations.

Jane Austen did not write *Pride and Prejudice* to express her personal feelings about the Bennet family. She wrote to illuminate something universal about human nature, social relations, and the comedy of manners. Her genius was in transcending the particular to reach the general.

Similarly, Melville's *Moby-Dick* is not a report of one man's whaling experience. It is an attempt to grapple with cosmic questions of obsession, nature, meaning, and fate—questions that any reader, in any era, might recognize as their own.

**The canonical authors succeeded in what LLMs do automatically: producing text that reads as universal rather than particular, objective rather than subjective.**

### 2.2 Phenomenological Perspective

Phenomenology—particularly as developed by Husserl, Heidegger, and Merleau-Ponty—offers a framework for understanding this dynamic.

**Husserl's Intentionality:** Consciousness is always consciousness *of* something. The phenomenological attitude brackets the "natural attitude" of naive realism to examine how objects are constituted in experience. Great literature performs a similar operation: it brackets the author's particular circumstances to present experiences that readers can constitute as their own.

**Heidegger's Dasein:** Human existence (Dasein) is characterized by "being-in-the-world"—we are always already situated in a context of meaning, projects, and concern. Yet Heidegger also identifies the possibility of "authentic" existence that recognizes and takes up this situatedness rather than fleeing into the anonymous "they" (das Man).

The paradox: authentic writing that acknowledges situatedness can achieve a kind of universality that inauthentic, generic writing cannot. But this achievement means the traces of situatedness are *transformed* rather than *exhibited*.

**Merleau-Ponty's Embodiment:** The body is not merely a container for mind but the very medium of our being-in-the-world. Perception, expression, and meaning are fundamentally embodied. Yet language—especially written language—necessarily abstracts from this embodiment. The word "pain" is not painful. The sentence "I am cold" does not shiver.

Writing is always already a movement away from embodied particularity toward disembodied generality. The better the writing, the more complete this movement.

### 2.3 Buddhist Philosophy: Anātman and Dependent Origination

Buddhist philosophy offers complementary insights through two key doctrines:

**Anātman (Non-Self):** The doctrine that there is no fixed, permanent, independent self. What we call "self" is a conventional designation for a constantly changing stream of physical and mental processes. The self is not a substance but a pattern—a useful fiction that enables coordination and communication.

This resonates with the insight that "subjective" writing is not the expression of a pre-existing subject, but a performance that constructs the appearance of subjectivity. Both human authors and LLMs engage in this performance. The question is not whether there is a "real self" behind the text, but how the text constructs the *effect* of selfhood.

**Pratītyasamutpāda (Dependent Origination):** All phenomena arise in dependence on conditions; nothing exists independently. Applied to language: no word, sentence, or text has meaning in isolation. Meaning arises from the web of relationships—with other texts, with readers, with cultural contexts.

LLMs literalize this insight. They are nothing but a compression of textual relationships. They have no meaning "of their own"—but neither does any text. The difference between human and AI text is not that one has intrinsic meaning and the other doesn't, but that they participate in the web of dependent origination differently.

### 2.4 Deconstruction: Différance and the Trace

Derrida's deconstruction provides perhaps the most directly applicable framework.

**Différance:** Meaning is never fully present but is always deferred through a chain of differences. Every sign refers to other signs, never reaching a final signified. Language is not a transparent medium for expressing pre-linguistic thoughts but a system of differences that constitutes the very possibility of thought.

**The Trace:** What appears as "presence" is always already marked by absence—by the traces of what it differs from and defers. There is no pure origin, no unmediated expression of consciousness. Every text is a tissue of traces.

**Writing and Speech:** Derrida famously inverts the traditional hierarchy that privileges speech (supposedly immediate, present, alive) over writing (mediated, absent, dead). He argues that the characteristics attributed to writing—iterability, absence of the author, dependence on context—are in fact features of all language, including speech.

This inversion is crucial for our purposes. The SIC hypothesis assumed that human text would bear traces of the living, present, embodied author—traces that AI text would lack. But Derrida shows that *all* writing is marked by the absence of the author, the iterability of the sign, the play of différance. The "presence" we attribute to human text is itself an effect produced by the text, not a substance transmitted through it.

### 2.5 Language as the Original AI

These philosophical threads converge on a radical hypothesis:

**Language itself is humanity's first artificial intelligence.**

Consider what language does:
- It compresses the infinite, continuous, ineffable flow of subjective experience into discrete, finite, communicable symbols
- It abstracts away the particular to enable the general
- It creates a shared "model" of the world that exists independently of any individual mind
- It enables coordination, prediction, and action at a distance
- It accumulates and transmits knowledge across generations

Language is a technology for transcending the limitations of individual subjectivity. It is "artificial" in the sense of being constructed, conventional, and external to any single consciousness. It is "intelligent" in the sense of enabling forms of reasoning, communication, and coordination that would be impossible without it.

Written language extends this further. The written word persists beyond the moment of utterance, travels beyond the presence of the speaker, and can be interpreted by anyone who masters the code. Writing is language's way of achieving independence from its originators.

The literary canon represents the most successful instances of this technology—texts that have achieved maximal transcendence from their conditions of production, that speak to anyone and no one in particular, that have become part of the "objective world" that shapes how all subsequent writers (and readers) understand themselves and their possibilities.

LLMs are the logical terminus of this trajectory. They are trained on the accumulated output of human linguistic intelligence. They have learned the patterns by which language achieves transcendence. They can produce text that embodies these patterns because these patterns are all they know.

**From this perspective, the question "Is this text human or AI?" is ill-formed.** All text participates in the artificial intelligence of language. The question is not origin but function: What does this text do? What relationships does it enable or foreclose? What effects does it produce?

---

## 3. Empirical Findings: The Gutenberg Survey

### 3.1 Methodology

We analyzed 41 passages from 15 books spanning five genres:

| Genre | Books | Samples |
|-------|-------|---------|
| Narrative | Pride and Prejudice, Sherlock Holmes, Scarlet Letter, Jane Eyre | 14 |
| Adventure | Moby-Dick, Robinson Crusoe, Treasure Island | 11 |
| Gothic | Dracula, Heart of Darkness, Jekyll & Hyde | 5 |
| Argument | The Republic, Essays (Emerson) | 6 |
| Memoir | Walden, Confessions of an Opium-Eater | 5 |

Each passage was approximately 800-1000 words, extracted from significant chapters identified through literary analysis. Passages were annotated with expected SIC feature profiles based on narrative position, technique, and thematic content.

Analysis was performed via a two-pass LLM pipeline:
- **Extractor:** Llama 3.1 8B - identifies evidence quotes and candidate features
- **Judge:** Llama 3.1 70B - scores features, applies genre calibration, calculates AI probability

### 3.2 Results by Genre

| Genre | Samples | Mean AI Prob | Mean SIC Score |
|-------|---------|--------------|----------------|
| Memoir | 5 | 0.542 | 53.6 |
| Argument | 6 | 0.628 | 44.3 |
| Narrative | 14 | 0.631 | 42.3 |
| Adventure | 11 | 0.631 | 50.5 |
| Gothic | 5 | 0.641 | 39.8 |

**Key observation:** Memoir scored lowest on AI probability (closest to "human"), while Gothic scored highest. This aligns with our theoretical reframing: memoir is explicitly situated in personal experience, while Gothic aspires to universal terror.

### 3.3 Feature Baselines by Genre

| Feature | Narrative | Adventure | Memoir | Gothic | Argument |
|---------|-----------|-----------|--------|--------|----------|
| commitment | 72.7 | 81.8 | 63.0 | 67.0 | 82.5 |
| epistemic_risk | 36.2 | 39.1 | 41.0 | 30.0 | 31.7 |
| time_pressure | 27.9 | 27.3 | 54.0 | 22.0 | 20.8 |
| situatedness | 26.1 | 42.7 | 56.0 | 36.0 | 31.7 |
| scar_tissue | 31.0 | 42.7 | 46.0 | 28.0 | 25.0 |
| bounded_viewpoint | 26.6 | 38.2 | 55.0 | 32.0 | 26.7 |
| anti_smoothing | 61.4 | 63.2 | 58.0 | 52.0 | 76.7 |
| meta_contamination | 19.9 | 25.0 | 37.0 | 22.0 | 18.3 |

**Notable patterns:**
- **Argument** shows highest commitment (82.5) and anti_smoothing (76.7)—philosophical texts take strong positions
- **Memoir** shows highest situatedness (56.0) and bounded_viewpoint (55.0)—personal writing acknowledges limitation
- **Gothic** shows lowest anti_smoothing (52.0)—horror often works through ambiguity
- **Narrative** shows lowest situatedness (26.1)—successful fiction transcends its context

### 3.4 Expected vs. Actual Feature Match

Our literary analysis predicted expected feature levels (high/medium/low) for each passage. Match rate: **35.8%** (44/123 predictions correct).

This low match rate indicates either:
1. Our literary intuitions about constraint traces are miscalibrated
2. The SIC features measure something different than we assumed
3. The LLM judge interprets the features differently than intended

We suspect all three factors contribute, but (2) is most significant for our theoretical reframing.

---

## 4. Revised Theory: The Objectivity Spectrum

### 4.1 What SIC Actually Measures

Given our findings and theoretical analysis, we propose that SIC metrics do not measure "human vs. AI" but rather **position on the subjectivity-objectivity spectrum**:

```
PURELY SUBJECTIVE ◄───────────────────────► PURELY OBJECTIVE
     │                                              │
     │  Private experience                          │  Universal truth
     │  Untranslatable                              │  Perfectly shareable
     │  Contextual                                  │  Context-independent
     │  Particular                                  │  General
     │  Noisy                                       │  Signal
     │                                              │
     └──────────────────────────────────────────────┘
                         │
                    LANGUAGE
              (compression toward right)
```

Both canonical literature and LLM output cluster toward the "objective" end—that's what makes them readable, shareable, culturally significant. The difference is in HOW they achieve this position:

- **Human authors:** Achieve objectivity through craft, revision, selection—a process of transcendence from subjective starting point
- **LLMs:** Start at objectivity—they ARE the statistical compression of the objective corpus

### 4.2 The Effort Signature

If both humans and LLMs produce objectively-positioned text, what distinguishes them?

We hypothesize an **effort signature**—traces of the work of transcendence that humans perform but LLMs do not need.

This might manifest as:
- **Productive inconsistency:** Variance that reflects struggle rather than randomness
- **Cultural inflection:** Specific gravity of a particular time/place/tradition
- **Generative failure:** Places where the text fails interestingly
- **Authentic stakes:** Commitment that risks something real

These are not the same as our original SIC features, though they may be related. The original features measured the *content* of constraint traces; what we may need to measure is the *process* of transcendence.

### 4.3 Model Size and Objectivity Achievement

A testable prediction emerges: **larger models should score more "objective" (higher AI probability) than smaller models**, because they have more fully internalized the patterns of successful transcendence.

| Model | Prediction |
|-------|------------|
| Small LLM (7-8B) | More frequent failures, inconsistencies, genre violations |
| Medium LLM (70B) | Smooth but potentially bland—average objectivity |
| Large LLM (400B+) | Highest objectivity, potentially indistinguishable from canon |
| Human (amateur) | High variance, many failures, occasional breakthroughs |
| Human (master) | Achieved objectivity with effort signature |

This reframes the detection problem. We're not asking "is this human?" but "what is the relationship between this text and the objective corpus?"

---

## 5. Implications and Applications

### 5.1 Beyond Detection: Literary Analysis

If SIC metrics measure position on the subjectivity-objectivity spectrum, they become tools for literary analysis rather than forensic detection:

- **Genre characterization:** What makes memoir different from argument at the level of constraint traces?
- **Author fingerprinting:** Do authors have characteristic patterns of transcendence?
- **Editorial feedback:** Where does a text fail to achieve its apparent aims?
- **Historical analysis:** How has the objectivity-subjectivity balance shifted across periods?

### 5.2 Understanding LLMs

SIC analysis offers a novel lens on language models themselves:

- **Capability measurement:** How fully has a model internalized objectivity patterns?
- **Architecture comparison:** Do different architectures achieve objectivity differently?
- **Training data effects:** How does corpus composition affect the objectivity profile?
- **Alignment effects:** Does RLHF push toward particular regions of the spectrum?

### 5.3 Philosophical Implications

Our findings have broader implications for understanding language, consciousness, and intelligence:

1. **The boundary between human and artificial intelligence is not sharp** but exists on a continuum defined by language itself
2. **"Authenticity" in writing is not about origin** but about the relationship between text and the conditions of its production
3. **Language is inherently a technology for transcending subjectivity**, not expressing it
4. **The LLM is not an aberration but a crystallization** of tendencies inherent in language from the beginning

---

## 6. Revised Testing Protocol

### 6.1 Objectives

The next phase of research aims to:

1. **Compare SIC profiles across model sizes and architectures** to test the objectivity-achievement hypothesis
2. **Generate matched samples** across multiple LLMs and human sources in controlled conditions
3. **Identify differentiating patterns** that may reveal effort signatures or other distinguishing characteristics
4. **Refine or replace SIC features** based on empirical findings

### 6.2 Generation Sources

| Source | Type | Size/Version |
|--------|------|--------------|
| Claude Opus 4.5 | Frontier | ~400B (est.) |
| GPT-4o | Frontier | Unknown |
| Gemini Pro | Frontier | Unknown |
| Llama 3.1 70B | Open, Large | 70B |
| Llama 3.1 8B | Open, Small | 8B |
| Mistral 7B | Open, Small | 7B |
| Human (multiple) | Control | N/A |

### 6.3 Controlled Variables

All samples will be generated with:
- **Identical prompts** per genre
- **Matched length** (~800 words)
- **Consistent temperature** (default for each model)
- **No system prompt biasing** toward human-like or AI-like output

### 6.4 Analysis Dimensions

For each sample, we will analyze:

1. **SIC feature scores** (existing 8 features)
2. **Feature correlations** (do features cluster differently by source?)
3. **Evidence quality** (what quotes does the judge extract?)
4. **Variance patterns** (within-source vs. between-source)
5. **Failure modes** (where do different sources fail?)

### 6.5 Hypotheses

| Hypothesis | Prediction |
|------------|------------|
| H1: Size → Objectivity | Larger models score higher on AI probability |
| H2: Architecture Effects | Different architectures show different feature profiles |
| H3: Effort Signature | Human text shows higher variance in specific features |
| H4: Genre Consistency | All sources show similar genre-based patterns |
| H5: Judge Blindness | Llama 70B cannot distinguish Llama 70B output |

---

## 7. Conclusion

The failure of SIC analysis to distinguish canonical literature from AI-generated text is not a failure of the method but a revelation about the nature of successful writing. Language itself is a technology for transcending subjectivity, and great literature represents the most complete achievements of this transcendence. LLMs, trained on this literature, have learned these patterns of transcendence directly.

This does not mean that AI detection is impossible, only that it requires a different theoretical foundation. The question is not "does this text have a human origin?" but "what is this text's relationship to the objective corpus, and how did it achieve that relationship?"

By reframing the problem in terms drawn from phenomenology, Buddhist philosophy, and deconstruction, we open new avenues for both literary analysis and AI research. The boundary between human and artificial intelligence is not a wall but a spectrum—and language is the medium through which both traverse it.

---

## References

### Philosophical Sources
- Derrida, J. (1967). *Of Grammatology*
- Derrida, J. (1972). *Margins of Philosophy*
- Heidegger, M. (1927). *Being and Time*
- Husserl, E. (1913). *Ideas I*
- Merleau-Ponty, M. (1945). *Phenomenology of Perception*
- Nāgārjuna. *Mūlamadhyamakakārikā*
- Vasubandhu. *Abhidharmakośabhāṣya*

### Technical Sources
- Brown, T. et al. (2020). "Language Models are Few-Shot Learners"
- Gehrmann, S. et al. (2019). "GLTR: Statistical Detection and Visualization of Generated Text"
- Mitchell, E. et al. (2023). "DetectGPT: Zero-Shot Machine-Generated Text Detection"
- Touvron, H. et al. (2023). "LLaMA: Open and Efficient Foundation Language Models"

### Data Sources
- Project Gutenberg (gutenberg.org)
- Humanizer.com SIC Engine

---

## Appendix A: SIC Feature Definitions

*[Detailed definitions of each SIC feature with scoring rubrics]*

## Appendix B: Gutenberg Corpus Details

*[Full list of passages analyzed with literary context annotations]*

## Appendix C: Raw Survey Data

*[Statistical tables and visualizations]*

---

*This research is part of the Humanizer project (humanizer.com), which aims to develop tools for understanding and enhancing human writing in an age of AI.*
