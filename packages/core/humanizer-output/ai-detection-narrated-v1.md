# Detecting the Machine: AI Writing Tells

I was wrong about almost everything.

October 2025. I'd built what I thought was an AI detector—a system that measured "Subjective Intentional Constraint" through stylistic features. Commitment to claims. Epistemic risk-taking. Anti-smoothing. Bounded viewpoint.

The theory was elegant. Human writers pay a cost for their words. They commit. They take risks. They resist the polish that comes from having nothing at stake. Machines average; humans spike.

Then I ran it against GPTZero, and the numbers told a different story.

---

## The Humiliation

| Detector | Human Text (Gutenberg) | AI Text (All Models) | Accuracy |
|----------|------------------------|----------------------|----------|
| GPTZero | 0.3% AI probability | 79-99.6% AI probability | 98.3% |
| My SIC Metric | 62.1% AI probability | 52-65% AI probability | ~50% |

Fifty percent. Random chance. My detector couldn't tell the difference between Dickens and Claude.

I stared at the numbers for a long time. The elegant theory had produced a coin flip.

---

## Where I Went Wrong

The assumption was simple: AI text would score lower on my metrics because LLMs produce safe, smooth, optimized prose. Less commitment, less risk, more hedging.

The reality was backwards.

> "AI Models: anti_smooth 70.3, commit 79.6, bounded 42.0
> Human Gutenberg: anti_smooth 62.6, commit 74.7, bounded 33.9
>
> Modern LLMs have been trained to *simulate* human stylistic features so effectively that they overshoot."
>
> *— Analysis notes, October 2025*

The AIs weren't less human than humans. They were hyper-human. More decisive, more varied, more intense. They'd been RLHF'd into simulating human qualities so aggressively that they exceeded the originals.

My "AI probability" metric was measuring sophistication. Classic literature is sophisticated. Modern AI output is sophisticated. Indistinguishable.

---

## What GPTZero Knows

GPTZero's secret is burstiness.

Burstiness is the variance in sentence-level perplexity across a document. How unpredictable is this text, and how does that unpredictability fluctuate?

| Source | GPTZero AI% | Burstiness (σ/μ) | Semicolons |
|--------|-------------|------------------|------------|
| Gutenberg (Human) | 0.3% | 0.874 | 1.447% |
| Claude Opus 4.5 | 90.4% | 0.686 | 0.135% |
| GPT-5.2 | 96.6% | 0.597 | 0.292% |
| Llama 3.3 70B | 81.5% | 0.371 | 0.000% |

The correlation was brutal: r = -0.562 between burstiness and AI detection. Lower variance, higher AI probability.

Human writing has natural irregularity. Some sentences are short. Others meander. The mixture is unpredictable. AI writing tends toward statistical uniformity—sentence lengths cluster around optimized means, perplexity stays consistent. The output is *smooth* in a measurable way.

---

## The Semicolon Fingerprint

The strangest finding: semicolons.

Human authors (Gutenberg sample): 1.447% semicolon frequency.
GPT-5.2: 0.292%.
Claude Opus: 0.135%.
Llama family: 0.000%.

Zero. The Llama models had been trained to never use semicolons.

> "Modern LLMs appear to actively avoid semicolons - possibly because they're rare in training data, or because they're seen as 'risky' punctuation that could seem pretentious."
>
> *— Analysis notes, October 2025*

Semicolons are human. Not because humans love them, but because humans occasionally risk them. An AI optimizing for safety avoids anything that might seem affected.

---

## The Tell-Word Dictionary

With my elegant theory demolished, I went empirical. What words do AIs actually overuse?

The list grew into a dictionary:

Em-dashes. "Moreover." "Furthermore." "It's important to note." "It's worth mentioning." "Delve." Certain transitional phrases that appear natural enough in isolation but cluster suspiciously in AI output.

> "Tell-words aren't individually diagnostic. It's the pattern—the simultaneous presence of multiple tells at above-baseline frequency."
>
> *— Technical notes, November 2025*

Each tell-word is a weak signal. Combined, they form a fingerprint. Not proof, but probability.

---

## What Detection Actually Means

The deeper question wasn't how to detect AI. It was why detection mattered.

GPTZero measures statistical signatures. Burstiness, perplexity variance, token predictability. These are surface features—the fingerprints left by the generation process.

What I'd been trying to measure was something else: whether text bears the imprint of a situated mind. Someone paying the cost of being themselves. Not whether the words are statistically unusual, but whether they emerge from a perspective that's anchored somewhere.

> "Traditional detectors measure statistical signatures. Subjective Intentional Constraint measures ONTOLOGICAL signatures—whether text bears imprint of a situated mind paying the cost of being itself."
>
> *— Framework notes, November 2025*

The statistical approach works. It achieves 98% accuracy. But it measures the how, not the what. It catches the machine's process, not its absence of position.

I kept both. The lite-detector for practical screening—tell-words, burstiness, semicolons. The SIC framework for understanding why any of this matters.

---

## The Lesson

I'd built a theory about what makes human writing human. The theory was wrong, but the question wasn't.

The machines got better at mimicking surface features faster than anyone expected. They learned to simulate commitment, to fake bounded viewpoints, to perform anti-smoothing. The statistical signatures shifted.

What didn't shift: the underlying difference between text that emerges from a perspective and text that simulates one. The detector can measure fingerprints. It can't measure presence.

That's a harder problem. Maybe unsolvable. But at least now I know what I'm looking for.

---

*Chapter assembled from development logs, October-November 2025*
