# LLM Benchmarks: A Comparative Study

I asked fifteen prompts to eleven models and got stories instead of metrics.

The benchmark was supposed to measure writing quality. What it measured was something else: the fingerprints each model leaves in its prose. The assumptions baked into training. The convergences that reveal what machines think humans sound like.

---

## The Setup

Fifteen creative writing prompts, each designed to elicit personal narrative. "Describe a time you overcame a language barrier." "Write about a skill you learned late in life." Prompts that require perspective, specificity, lived detail.

Eleven models:
- Frontier: Claude Opus 4.5, GPT-5.2, Gemini 3 Pro
- Open-source large: Llama 3.1 70B, Llama 3.3 70B, GPT-OSS 120B
- Open-source small: Llama 3.1 8B, Llama 4 Scout 17B, DeepSeek R1 32B

The results weren't what I expected.

---

## The Montreal Convergence

Four out of eleven models set their language barrier story in Montreal.

Not Paris. Not Tokyo. Not any of the dozens of plausible locations. Montreal—specifically, a scenario involving learned French from American schools meeting Québécois French on the ground.

> "Montreal is the statistical outlier. Paris and Tokyo are within plausible ranges."
>
> *— Analysis notes, November 2025*

The convergence pointed to something in the training data. A disproportionate representation of Montreal language barrier narratives. Or maybe a shared bias toward scenarios that feel authentically bilingual without requiring deep cultural knowledge.

Whatever the cause, it became a detection signal. Montreal plus "I studied French" plus translation app resolution equals 65% AI probability on that prompt alone.

---

## The Fingerprints

Each model left distinct traces.

**Claude Opus 4.5**: Literary titles like "The Silence Between Us." Cultural nuance—distinguishing Parisian from Québécois accents. Resolution through internal realization rather than helper characters. The tell: a bakery scene where an elderly woman corrects pronunciation.

**GPT-5.2**: Precise word count adherence (765 words when asked for 750-800). Infrastructure focus—ticket machines, bus systems, airport desks. The tell: "Centre-ville?" as a desperate question.

**Gemini 3 Pro**: Working-class settings. Strong metaphors ("cultural paint vs structural beam"). Heavy dialogue. The tell: describing Quebec as "America Lite."

**The Llama family**: "I still remember..." openings across all variants. Paris market bias. Translation app reliance. The tell: generic market flower purchase scene.

**DeepSeek R1 32B**: Vague geography, unnamed cities. Generic crisis scenarios. Older helper archetype. The tell: "Language is a bridge" as a conclusion.

---

## Detection Rates

When I ran the outputs through GPTZero:

| Model | Detection Rate | Convergence Rate |
|-------|----------------|------------------|
| GPT-5.2 | 96.6% | 100% (all detectable) |
| Gemini 3 Pro | 96.7% | 100% |
| DeepSeek R1 32B | 95.8% | 100% |
| Claude Opus 4.5 | 90.4% | 93% |
| Llama 3.1 70B | 84.7% | 87% |
| Llama 3.1 8B | 79.0% | 67% |

The frontier models were easier to detect. Higher polish, more uniform statistics. The open-source models showed more variance—not because they were better, but because they were less consistent.

---

## What the Numbers Mean

The benchmark revealed two things.

First: convergence is a detection signal. When multiple models produce the same specific detail (Montreal, bakery pronunciation corrections, "language is a bridge"), that detail becomes diagnostic. Not because it's unrealistic—real people write about Montreal—but because the clustering is statistical evidence of shared training bias.

Second: quality and detectability don't correlate simply. Claude's outputs were often the most literary, the most nuanced. They were also distinctively Claude. The model's strengths became its tells.

---

## The Prose Signatures

Beyond specific details, each model had prose-level signatures.

Opus wrote with subordination—complex sentences with embedded clauses. GPT-5.2 produced parallel structures, balanced clauses, rhythmic consistency. Gemini favored dialogue, giving characters more speech. Llama models showed lower variance, sentences clustering around similar lengths.

> "Llama Family Signature: Generic introspection, market convergence."
>
> *— Analysis notes, November 2025*

The signatures weren't bugs. They were optimization targets made visible. Each model had been trained on different corpora, fine-tuned with different preferences. Those preferences showed.

---

## What I Learned

The benchmark started as a quality assessment. Which model writes best?

It ended as something different. Each model writes distinctively. The question isn't which is best; it's which is appropriate. Claude for literary nuance. GPT for structured clarity. Gemini for dialogue-heavy scenarios. Llama for contexts where variation matters more than polish.

And: every model leaves fingerprints. The fingerprints reveal training assumptions, bias distributions, optimization targets. Reading model output carefully teaches you not just what the model can do, but what it's been taught to want.

The stories were more interesting than the metrics.

---

*Chapter assembled from benchmark analysis, November 2025*
