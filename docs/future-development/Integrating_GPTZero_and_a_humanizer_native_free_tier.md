Love it. Let’s do both in a single pass so you can drop this straight into `workers/`.

---

## 1. Cloudflare Worker endpoint for GPTZero

### High-level design

- Route: `POST /api/gptzero/detect`
- Input: JSON `{ text: string }` (you can later extend to `{ text, userId }` etc.)
- Behavior:
  1. Validate input + length.
  2. Count words.
  3. Enforce a simple **per-user monthly quota** (e.g. 50k words / month in KV or D1).
  4. If under quota, forward to **GPTZero API** (`https://api.gptzero.me/v2/predict/text`) with your API key.
  5. Return:
     - document classification (HUMAN_ONLY / MIXED / AI_ONLY)
     - probabilities
     - confidence category
     - sentence highlights
     - word count used & remaining quota
- Storage:
  - Use **KV** (simplest) keyed by `usage:<userId>:<YYYY-MM>` with value = total words so far this month.

You can hard-wire `userId` initially (e.g. your email or CF Access subject) and later connect it to your real auth.

### Example Worker (TypeScript)

Assume:

- Binding `GPTZERO_API_KEY` in `wrangler.toml`
- Binding `USAGE_KV` as a KV namespace for quotas

```ts
// workers/gptzero-detector.ts

export interface Env {
  GPTZERO_API_KEY: string;
  USAGE_KV: KVNamespace;
}

interface GptZeroResponse {
  documents: Array<{
    id: string;
    document_classification: string; // "HUMAN_ONLY" | "MIXED" | "AI_ONLY"
    class_probabilities: {
      human: number;
      ai: number;
      mixed: number;
    };
    predicted_class: string;
    confidence_category: string; // "high" | "medium" | "low"
    // ... plus other fields GPTZero returns (highlights, per-sentence, etc.)
    // we'll just pass them through transparently
    [key: string]: unknown;
  }>;
}

type DetectRequest = {
  text: string;
  // optional: userId to scope quotas
  userId?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/gptzero/detect" && request.method === "POST") {
      try {
        const body = (await request.json()) as DetectRequest;

        if (!body?.text || typeof body.text !== "string") {
          return json({ error: "Missing 'text' string in request body" }, 400);
        }

        const text = body.text.trim();
        if (!text) {
          return json({ error: "Text is empty" }, 400);
        }

        // Simple word count (split on whitespace)
        const wordCount = text.split(/\s+/).length;

        // GPTZero can handle large docs, but you may still want a hard cap
        const MAX_WORDS = 20000; // ~20k words
        if (wordCount > MAX_WORDS) {
          return json(
            {
              error: "Text too long",
              maxWords: MAX_WORDS,
              wordCount,
            },
            413
          );
        }

        // ---- Quota handling ----
        // For now, infer a userId from supplied field or a fallback
        const userId = body.userId || "default-user"; // replace with real auth in production

        const now = new Date();
        const yearMonth = `${now.getUTCFullYear()}-${String(
          now.getUTCMonth() + 1
        ).padStart(2, "0")}`; // e.g. "2025-11"

        const quotaKey = `usage:${userId}:${yearMonth}`;

        const existing = await env.USAGE_KV.get(quotaKey);
        const usedSoFar = existing ? parseInt(existing, 10) || 0 : 0;

        // Example quota: 50k words / month / user
        const MONTHLY_QUOTA = 50000;

        if (usedSoFar + wordCount > MONTHLY_QUOTA) {
          return json(
            {
              error: "Monthly GPTZero quota exceeded for this user",
              quotaWords: MONTHLY_QUOTA,
              usedWords: usedSoFar,
              attemptedWords: wordCount,
            },
            429
          );
        }

        // ---- Call GPTZero API ----
        const gptZeroRes = await fetch(
          "https://api.gptzero.me/v2/predict/text",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.GPTZERO_API_KEY,
            },
            body: JSON.stringify({
              document: {
                text,
              },
            }),
          }
        );

        if (!gptZeroRes.ok) {
          const textBody = await gptZeroRes.text().catch(() => "");
          return json(
            {
              error: "GPTZero API error",
              status: gptZeroRes.status,
              body: textBody,
            },
            502
          );
        }

        const data = (await gptZeroRes.json()) as GptZeroResponse;

        // Update quota AFTER a successful call
        const newTotal = usedSoFar + wordCount;
        await env.USAGE_KV.put(quotaKey, String(newTotal), {
          expirationTtl: 60 * 60 * 24 * 60, // 60 days, just to auto-clean
        });

        // Shape a clean response for your frontend
        const doc = data.documents?.[0];
        const result = {
          wordCount,
          quota: {
            monthlyLimit: MONTHLY_QUOTA,
            usedSoFar: newTotal,
            remaining: Math.max(0, MONTHLY_QUOTA - newTotal),
            period: yearMonth,
          },
          classification: doc?.document_classification ?? null,
          predictedClass: doc?.predicted_class ?? null,
          probabilities: doc?.class_probabilities ?? null,
          confidence: doc?.confidence_category ?? null,
          // pass through the rest of GPTZero’s fields for richer UI:
          raw: doc ?? data,
        };

        return json(result, 200);
      } catch (err: any) {
        return json(
          {
            error: "Unexpected server error",
            message: err?.message ?? String(err),
          },
          500
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// Helper to return JSON responses
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
```

### Minimal `wrangler.toml` fragment

```toml
name = "humanizer-gptzero-api"
main = "workers/gptzero-detector.ts"
compatibility_date = "2025-11-17"

[vars]
# (no GPTZERO_API_KEY here if you prefer wrangler secret)
# GPTZERO_API_KEY = "..."

[kv_namespaces]
  binding = "USAGE_KV"
  id = "xxxxxxxxxxxxxxxxxxxxxxx"
```

And then:

```bash
wrangler kv:namespace create USAGE_KV
wrangler secret put GPTZERO_API_KEY
wrangler dev
```

On the front-end, your Narrative Studio can now do:

```ts
const res = await fetch("/api/gptzero/detect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, userId }),
});

const data = await res.json();
// show data.classification, data.probabilities, data.confidence, data.raw.highlight_sentence_for_ai, etc.
```

---

## 2. Cost table for your likely scenarios

Let’s map plausible usage patterns onto their word-based pricing (approximate; you can adjust numbers later).

### Assumptions

- Users mostly paste **500–1000 word** chunks (short essays / posts / excerpts).
- You only send to GPTZero when:
  - User explicitly clicks “AI Detector”  
  - Or an educator / editor runs a batch.

I’ll give three scenarios:

---

### Scenario A — Private MVP / dogfooding

- 20 internal users (you, a few friends, maybe one pilot client).
- Each runs **10 checks/month** at **800 words** average.

Word volume:

- 20 × 10 × 800 = **160,000 words/month**

Suggested tier:

- Fits comfortably in **300k words**.
- GPTZero: **$45/month** plan.

You’re using ~53% of that tier, so lots of room for spikes.

---

### Scenario B — Small paid pilot (first real clients)

Say:

- 100 active users (mix of individual writers + 1–2 small orgs)
- Each runs **10 checks/month** at **800 words**.

Word volume:

- 100 × 10 × 800 = **800,000 words/month**

Suggested tier:

- This fits under **1M words**.
- GPTZero 1M plan: **$135/month**.
- Effective cost per 1k words ≈ **$0.135**.

You could even start with the **300k plan** if you:
- soft-limit free users more aggressively, and  
- keep pilot clients to smaller volumes.

But if the pilot goes well you’ll want the 1M tier quickly.

---

### Scenario C — Early “open beta” with guardrails

Suppose:

- 500 users with accounts
- 200 are “active” in a given month
- Each active user averages **10 checks/month** at **800 words**.

Word volume:

- 200 × 10 × 800 = **1,600,000 words/month**

Suggested tier:

- **2M words** → **$250/month**.
- Effective cost ≈ **$0.125 / 1k words**.

At this point, you’d probably:

- Keep a **per-user monthly cap** (like the 50k in the Worker above, configurable by plan).  
- Maybe reserve unlimited / higher caps for premium Humanizer tiers.

---

### Scenario D — “It’s happening” (heavier org usage)

Imagine:

- 1,000 active users/month
- Each: **10 checks** × 800 words = 8,000 words
- Total: **8M words/month**

Plan:

- 10M tier: **$1,000/month**, with ~25% headroom.

At that usage:

- Cost per 1k words ≈ **$0.125** (8M words on the 10M plan)
- For a **$29/mo Humanizer Pro** with even 500 subs, your GPTZero cost is a small fraction of MRR.

---

### How this informs your pricing

A simple way to reason about it:

- At the **2M words / $250** level:  
  - Cost per **10-check bundle** of 800-word texts is:
    - 10 × 800 = 8,000 words → 8,000 / 1,000 × $0.125 ≈ **$1** in raw GPTZero cost.  
  - If a paying user is $20–$30 / month, that’s easy to absorb.

- You can also reserve GPTZero for:
  - Higher-tier plans
  - Or “credits” that are explicitly counted in your UI (“You have 30 detector runs left this month”).

That way your GPTZero bill grows roughly linearly with revenue, not with free-tier churn.

---

If you’d like, next step I can:

- Tailor the **quota numbers + plan thresholds** to your actual user tiers (Free / Member / Pro / Org).  
- Or expand the Worker to also support **batch file uploads** once you’re ready to offer that feature.


------------------------

Here’s a design sketch for a “good-enough” home-grown detector + Humanizer that you can run on Workers with just JS/TS and LLM APIs.

I’ll break it into two sibling modules:

1. **AI Suspect Detector** – heuristic + light-ML + LLM-assisted judge  
2. **AI Humanizer** – multi-pass rewrite that adds human “texture” + optional style alignment  

No code, but concrete passes, data structures, and useful packages.

---

## 0. Overall shape

**Runtime:**  
- Cloudflare Worker (so: ES modules, no native deps, pure JS packages only).  
- Heavy ML either:
  - via **Cloudflare AI** or OpenAI API (perplexity proxy, embeddings, rewrite), or  
  - via small on-device models with `@xenova/transformers` (if you’re okay with slower cold starts).

**Common data structures:**

```ts
type TextSlice = {
  id: string;           // sentence or paragraph id
  text: string;
  start: number;        // char offsets in original string
  end: number;
};

type DetectionFeatures = {
  lexical: { /* burstiness, avg length, etc. */ };
  phraseHits: { phrase: string; sliceId: string; score: number }[];
  repetition: { sliceId: string; ngram: string; count: number }[];
  llmSignals?: { sliceId: string; aiProbability: number; rationale?: string };
};

type DetectionVerdict = {
  overallScore: number;          // 0–1 “AI-likeness”
  category: "likely_human" | "mixed" | "likely_ai";
  slices: Array<{
    sliceId: string;
    aiScore: number;
    reasons: string[];
  }>;
};
```

Both the Detector and Humanizer operate on `TextSlice[]`.

---

## 1. AI Suspect Detector

Think of this as a “triage” tool, not a courtroom. You want:

- **Cheap heuristics** that run entirely in the Worker.
- **Optional LLM refinement** when you can afford an API call.
- A **score + highlighted spans**, not a verdict of guilt.

### 1.1 Preprocessing pass

Goals: sentence segmentation, tokenization, basic stats.

Packages you can use:

- `sentence-splitter` or `sbd` — sentence boundary detection (or roll your own regex if needed).
- `wink-tokenizer` or `compromise` — simple tokenization / POS tags.
- `natural` — n-grams, TF-IDF, etc.

Steps:

1. **Sentence splitting** → `TextSlice[]` at sentence level, grouped into paragraphs.
2. For each sentence:
   - word count
   - character count
   - punctuation marks
3. For whole document:
   - type–token ratio (unique words / total words)
   - distribution of sentence lengths (min, max, mean, variance).

You’ll use these for burstiness and repetition later.

---

### 1.2 Heuristic features

#### (a) Burstiness & “flatness”

Heuristic proxies for perplexity without a full LM:

- Low variance in **sentence length** (nearly all 18–24 words) → AI-ish.
- Overuse of generic discourse markers:
  - “In conclusion”, “Overall”, “Additionally”, “However,” starting many sentences.
- Very low **lexical diversity** but high **fluency** → suspicious.

Add a “burstiness score” per sentence:

- `burstiness = |sentenceLength - meanSentenceLength| / stdDevSentenceLength`  
- Texts with **very low global std dev** get a global penalty (“flat style”).
- Sentences with extremely high consistency in structure (e.g., “X is Y. X is also Z. X is furthermore W.”) get flagged.

#### (b) 200 common AI tell phrases

Maintain a JSON list of ~200 phrases / constructions you want to flag, e.g.:

- “As an AI language model…”
- “In today’s fast-paced world…”
- “It is important to note that…”
- “On the other hand,” (when used excessively)
- “… in conclusion,” “overall,” “ultimately,” as boilerplate openers.
- Your own empirically discovered ChatGPT / Claude “fingerprints”.

Implementation details:

- Store as `{ phrase: string; weight: number; }[]`.
- Use **case-insensitive, punctuation-agnostic** search.
- For fuzziness, use a library like `fastest-levenshtein` and treat distance < 2 as a hit.
- Count hits per sentence and per doc.

#### (c) Repetition & n-grams

Use `natural` or your own map:

- Build **4-gram** token sequences across the doc.
- Flag n-grams that occur 3+ times.
- Also detect repeated **sentence templates**:
  - e.g., same first 3 words across many sentences, or same ending clause.

These are classic “AI patterning” signatures.

#### (d) Structural regularities

Capture:

- Too many paragraphs of similar length (e.g., 5 sentences each).
- Overly neat list structures without variation (“First… Second… Third…”).

All of these features are simple counts you can compute in the Worker.

---

### 1.3 Optional model-based features (cheap edge models)

If you want an on-platform LM without external API:

- Use `@xenova/transformers` (pure JS) with:
  - A small **masked language model** (e.g. `bert-base-uncased`) to approximate perplexity:
    - For each sentence, mask 10–15% of tokens, compute average log-likelihood; compare to typical ranges for human vs LLM reference sets (calibrated offline).
  - Or a tiny **sequence classifier** you train offline on human vs AI samples and then ship as ONNX/transformers model.

Workflow:

1. Offline:
   - Collect small corpora:
     - Human: your own writing, mailing list posts, student essays.
     - AI: ChatGPT/Claude outputs on similar prompts.
   - Extract your heuristic features to a feature vector.
   - (Optional) Train a logistic regression / random forest on top.
   - Optionally fine-tune a small classifier model.

2. Online (Worker):
   - Load the tiny classifier with `@xenova/transformers`.
   - For each document, get an **aiProbability** in `[0,1]`.

If edge inference is too heavy, skip this and rely on external LLM judging (next step).

---

### 1.4 LLM “meta-judge” pass (external API)

You already have Workers → OpenAI; use that to get **interpretive** features rather than raw classification.

Prompt structure (simplified):

> System:  
> You are an AI detection assistant. You are not perfect and your output will only be used as a heuristic signal.  
> Given the following text and precomputed statistics, estimate how likely it is that the text is largely written by an LLM vs a human, and explain your reasoning briefly. Return JSON only.
>
> User:  
> TEXT: """…"""  
> STATS:  
> - num_words: …  
> - avg_sentence_length: …, std_dev_sentence_length: …  
> - repeated_ngrams: …  
> - ai_phrases_hits: …  

Expected JSON:

```json
{
  "ai_probability": 0.72,
  "reasons": [
    "Highly generic phrasing with minimal concrete detail",
    "Multiple boilerplate discourse markers (\"in conclusion\", \"overall\")",
    "Low variance in sentence length and structure"
  ],
  "suspect_spans": [
    { "start": 125, "end": 280, "reason": "formulaic conclusion paragraph" }
  ]
}
```

You then merge this with your heuristic scores.

---

### 1.5 Scoring & verdict

Merge all signals into a simple weighted rule:

- `score = 0.4*heuristics + 0.4*llm_ai_probability + 0.2*edgeModelProbability(optional)`

Then apply coarse thresholds:

- `score < 0.35` → **“likely human”**  
- `0.35–0.65` → **“mixed / uncertain”**  
- `> 0.65` → **“likely AI-assisted”**

Output `DetectionVerdict` with:

- Per-sentence scores and reasons.
- Big fat caveat flag `forEducationOnly: true`.

You can surface this in the UI as:

> “This looks similar to AI-generated writing (score 0.71).  
> Treat this as a conversation starter, not proof.”

---

## 2. AI “Humanizer” module

Now the fun part: when text *is* AI-ish (maybe because you just generated it!), you want to **roughen it up**, align it with a **reference style**, and strip obvious AI tells.

This is a multi-pass LLM pipeline using your existing models.

### 2.1 Inputs

- `originalText: string`
- Optional:
  - `styleSamples: string[]` – 1–3 short examples of the user’s real writing.
  - `constraints`: e.g. “keep citations and LaTeX intact”, “don’t touch code blocks”.
  - `maxDelta`: how much content can change (0–1).

Also reuse the sentence stats from the Detector for targeting.

---

### 2.2 Pass 1 — De-templating & phrase cleanup

Goal: remove the 200 AI phrases and generic scaffolding without altering content.

Mechanism:

1. Use your phrase list to **mask** obvious AI metros:

   - Replace `“In conclusion,”` with `[REMOVE_IN_CONCLUSION]` markers in a temp version.
   - Mark other phrases similarly.

2. Prompt LLM to **rewrite only the marked spots**:

> System:  
> You are a careful editor. You receive text with markers like `[REMOVE_IN_CONCLUSION]`.  
> For each marker, remove the generic AI-like phrase and rewrite the sentence so it flows naturally while preserving meaning.  
> Do not add new arguments, just rephrase.
>
> User:  
> TEXT: """…"""

3. Replace markers with LLM rewrites; keep everything else untouched.

This pass already cuts a lot of “AI smell”.

---

### 2.3 Pass 2 — Style alignment (optional)

Goal: move toward a particular human voice (e.g., Tem Noon) without overdoing it.

Approach:

1. **Extract style profile** from `styleSamples` (once, cached per user):

   - Use embeddings (OpenAI / CF AI) to get vectors for each sample.
   - Also simple heuristics: avg sentence length, use of first-person, rhetorical qs, parentheticals, slang.
   - Store a small JSON “style fingerprint”:

```json
{
  "tone": "informal, curious, slightly playful",
  "sentences": "varied length, some long with parentheticals",
  "lexicon": "uses concrete examples, references to specific texts/people",
  "persona": "first-person, talking to a smart friend"
}
```

2. Pass the cleaned text + style fingerprint into a **style-transfer prompt**:

> System:  
> You are editing text so that it reads more like the following style description, while preserving all factual content and structure:  
> STYLE: {styleFingerprintJson}  
> Constraints:  
> - Preserve technical accuracy, citations, and code.  
> - Do not add new claims.  
> - Aim for small, local edits, not full rewrites.
>
> User:  
> ORIGINAL: """…"""

3. Optionally specify a **“change budget”**:

> Make no more than 30% of sentences significantly different. Prefer adjusting phrasing, rhythm, and specificity.

This gives you a softer, more human voice consistent with the user.

---

### 2.4 Pass 3 — Human “unevenness” & concreteness

Goal: introduce the kind of micro-variation humans naturally exhibit:

- variable sentence length
- occasional rhetorical question
- specific examples instead of abstractions
- small asides / parentheticals

Prompt template:

> System:  
> You are polishing this text to feel like it was written by a thoughtful human rather than an AI.  
> Add gentle “texture” while preserving meaning:
> - Vary sentence length and rhythm.  
> - Prefer concrete examples over vague abstractions.  
> - Allow occasional parenthetical asides or rhetorical questions.  
> - Do NOT add new factual claims or change the logical structure.  
> Return the full revised text.
>
> User:  
> TEXT: """…"""

You can **limit this to high-AI-score sentences** only, by sending small chunks rather than the whole document.

---

### 2.5 Pass 4 — Consistency & safety check

You don’t want the Humanizer to hallucinate or drift.

Use another LLM pass as a **diff checker**:

> System:  
> Compare ORIGINAL and REVISED.  
> - List any factual claims that appear in REVISED but not in ORIGINAL.  
> - If any are present, rewrite REVISED to remove or weaken them so that it is semantically equivalent to ORIGINAL.  
> Output ONLY the final safe revised text.

By doing this, you keep your “humanization” stylistic, not epistemic.

---

### 2.6 Integration with Detector

For a nice UX loop in Narrative Studio:

1. User sends text → Detector runs, returns highlight map.
2. UI shows “AI-ish segments” in purple.
3. User can:
   - click “Humanize highlighted” → send only those spans through passes 1–3.
   - optionally provide or pick a style reference (their own prior post) from a dropdown.
4. After humanization, run Detector again in **“self-check mode”**:
   - Show that the score moved from, say, 0.78 → 0.42.
   - Always keep messaging: “This is just a heuristic; you’re the final judge.”

---

## 3. Packages, infra, and where to run what

**Within Cloudflare Worker:**

- Text processing:  
  - `sentence-splitter` or `sbd`  
  - `wink-tokenizer` or `compromise`  
  - `natural` for n-grams / TF-IDF  
  - `fastest-levenshtein` for fuzzy phrase hits
- Data:
  - Store phrase lists + style fingerprints in KV / D1.
  - Optionally, per-user style fingerprints in D1 with userId.

**Via external AI (or CF AI Workers):**

- Detection meta-judge (one small model call per doc).
- Humanizer passes 1–4 (depending on how aggressive you want to be).

Optionally **edge model**:

- `@xenova/transformers` + tiny classifier for offline training, online inference.

---

## 4. Caveats & how you message it

- Your home-grown detector **will not** be as robust as GPTZero; don’t frame it as disciplinary evidence.
- Use Humanizer primarily on **your own generated text** or **opt-in transformations**, not as a “cheat-cleaner” for students.
- Document clearly in the UI:
  - “This tool estimates AI-likeness to help you reflect on your writing. It can be wrong.”
  - “Humanizer focuses on style and rhythm; you remain responsible for factual accuracy.”

---

If you want, next step I can sketch:

- A concrete **prompt library** for each pass (Detector judge + De-templater + Style aligner + Texture + Diff-checker).  
- Or a **Worker routing diagram** showing which endpoints handle detection vs humanization, and how they plug into your existing Allegorical / Round-Trip tools.


Here’s a design sketch for a “good-enough” home-grown detector + Humanizer that you can run on Workers with just JS/TS and LLM APIs.

I’ll break it into two sibling modules:

1. **AI Suspect Detector** – heuristic + light-ML + LLM-assisted judge  
2. **AI Humanizer** – multi-pass rewrite that adds human “texture” + optional style alignment  

No code, but concrete passes, data structures, and useful packages.

---

## 0. Overall shape

**Runtime:**  
- Cloudflare Worker (so: ES modules, no native deps, pure JS packages only).  
- Heavy ML either:
  - via **Cloudflare AI** or OpenAI API (perplexity proxy, embeddings, rewrite), or  
  - via small on-device models with `@xenova/transformers` (if you’re okay with slower cold starts).

**Common data structures:**

```ts
type TextSlice = {
  id: string;           // sentence or paragraph id
  text: string;
  start: number;        // char offsets in original string
  end: number;
};

type DetectionFeatures = {
  lexical: { /* burstiness, avg length, etc. */ };
  phraseHits: { phrase: string; sliceId: string; score: number }[];
  repetition: { sliceId: string; ngram: string; count: number }[];
  llmSignals?: { sliceId: string; aiProbability: number; rationale?: string };
};

type DetectionVerdict = {
  overallScore: number;          // 0–1 “AI-likeness”
  category: "likely_human" | "mixed" | "likely_ai";
  slices: Array<{
    sliceId: string;
    aiScore: number;
    reasons: string[];
  }>;
};
```

Both the Detector and Humanizer operate on `TextSlice[]`.

---

## 1. AI Suspect Detector

Think of this as a “triage” tool, not a courtroom. You want:

- **Cheap heuristics** that run entirely in the Worker.
- **Optional LLM refinement** when you can afford an API call.
- A **score + highlighted spans**, not a verdict of guilt.

### 1.1 Preprocessing pass

Goals: sentence segmentation, tokenization, basic stats.

Packages you can use:

- `sentence-splitter` or `sbd` — sentence boundary detection (or roll your own regex if needed).
- `wink-tokenizer` or `compromise` — simple tokenization / POS tags.
- `natural` — n-grams, TF-IDF, etc.

Steps:

1. **Sentence splitting** → `TextSlice[]` at sentence level, grouped into paragraphs.
2. For each sentence:
   - word count
   - character count
   - punctuation marks
3. For whole document:
   - type–token ratio (unique words / total words)
   - distribution of sentence lengths (min, max, mean, variance).

You’ll use these for burstiness and repetition later.

---

### 1.2 Heuristic features

#### (a) Burstiness & “flatness”

Heuristic proxies for perplexity without a full LM:

- Low variance in **sentence length** (nearly all 18–24 words) → AI-ish.
- Overuse of generic discourse markers:
  - “In conclusion”, “Overall”, “Additionally”, “However,” starting many sentences.
- Very low **lexical diversity** but high **fluency** → suspicious.

Add a “burstiness score” per sentence:

- `burstiness = |sentenceLength - meanSentenceLength| / stdDevSentenceLength`  
- Texts with **very low global std dev** get a global penalty (“flat style”).
- Sentences with extremely high consistency in structure (e.g., “X is Y. X is also Z. X is furthermore W.”) get flagged.

#### (b) 200 common AI tell phrases

Maintain a JSON list of ~200 phrases / constructions you want to flag, e.g.:

- “As an AI language model…”
- “In today’s fast-paced world…”
- “It is important to note that…”
- “On the other hand,” (when used excessively)
- “… in conclusion,” “overall,” “ultimately,” as boilerplate openers.
- Your own empirically discovered ChatGPT / Claude “fingerprints”.

Implementation details:

- Store as `{ phrase: string; weight: number; }[]`.
- Use **case-insensitive, punctuation-agnostic** search.
- For fuzziness, use a library like `fastest-levenshtein` and treat distance < 2 as a hit.
- Count hits per sentence and per doc.

#### (c) Repetition & n-grams

Use `natural` or your own map:

- Build **4-gram** token sequences across the doc.
- Flag n-grams that occur 3+ times.
- Also detect repeated **sentence templates**:
  - e.g., same first 3 words across many sentences, or same ending clause.

These are classic “AI patterning” signatures.

#### (d) Structural regularities

Capture:

- Too many paragraphs of similar length (e.g., 5 sentences each).
- Overly neat list structures without variation (“First… Second… Third…”).

All of these features are simple counts you can compute in the Worker.

---

### 1.3 Optional model-based features (cheap edge models)

If you want an on-platform LM without external API:

- Use `@xenova/transformers` (pure JS) with:
  - A small **masked language model** (e.g. `bert-base-uncased`) to approximate perplexity:
    - For each sentence, mask 10–15% of tokens, compute average log-likelihood; compare to typical ranges for human vs LLM reference sets (calibrated offline).
  - Or a tiny **sequence classifier** you train offline on human vs AI samples and then ship as ONNX/transformers model.

Workflow:

1. Offline:
   - Collect small corpora:
     - Human: your own writing, mailing list posts, student essays.
     - AI: ChatGPT/Claude outputs on similar prompts.
   - Extract your heuristic features to a feature vector.
   - (Optional) Train a logistic regression / random forest on top.
   - Optionally fine-tune a small classifier model.

2. Online (Worker):
   - Load the tiny classifier with `@xenova/transformers`.
   - For each document, get an **aiProbability** in `[0,1]`.

If edge inference is too heavy, skip this and rely on external LLM judging (next step).

---

### 1.4 LLM “meta-judge” pass (external API)

You already have Workers → OpenAI; use that to get **interpretive** features rather than raw classification.

Prompt structure (simplified):

> System:  
> You are an AI detection assistant. You are not perfect and your output will only be used as a heuristic signal.  
> Given the following text and precomputed statistics, estimate how likely it is that the text is largely written by an LLM vs a human, and explain your reasoning briefly. Return JSON only.
>
> User:  
> TEXT: """…"""  
> STATS:  
> - num_words: …  
> - avg_sentence_length: …, std_dev_sentence_length: …  
> - repeated_ngrams: …  
> - ai_phrases_hits: …  

Expected JSON:

```json
{
  "ai_probability": 0.72,
  "reasons": [
    "Highly generic phrasing with minimal concrete detail",
    "Multiple boilerplate discourse markers (\"in conclusion\", \"overall\")",
    "Low variance in sentence length and structure"
  ],
  "suspect_spans": [
    { "start": 125, "end": 280, "reason": "formulaic conclusion paragraph" }
  ]
}
```

You then merge this with your heuristic scores.

---

### 1.5 Scoring & verdict

Merge all signals into a simple weighted rule:

- `score = 0.4*heuristics + 0.4*llm_ai_probability + 0.2*edgeModelProbability(optional)`

Then apply coarse thresholds:

- `score < 0.35` → **“likely human”**  
- `0.35–0.65` → **“mixed / uncertain”**  
- `> 0.65` → **“likely AI-assisted”**

Output `DetectionVerdict` with:

- Per-sentence scores and reasons.
- Big fat caveat flag `forEducationOnly: true`.

You can surface this in the UI as:

> “This looks similar to AI-generated writing (score 0.71).  
> Treat this as a conversation starter, not proof.”

---

## 2. AI “Humanizer” module

Now the fun part: when text *is* AI-ish (maybe because you just generated it!), you want to **roughen it up**, align it with a **reference style**, and strip obvious AI tells.

This is a multi-pass LLM pipeline using your existing models.

### 2.1 Inputs

- `originalText: string`
- Optional:
  - `styleSamples: string[]` – 1–3 short examples of the user’s real writing.
  - `constraints`: e.g. “keep citations and LaTeX intact”, “don’t touch code blocks”.
  - `maxDelta`: how much content can change (0–1).

Also reuse the sentence stats from the Detector for targeting.

---

### 2.2 Pass 1 — De-templating & phrase cleanup

Goal: remove the 200 AI phrases and generic scaffolding without altering content.

Mechanism:

1. Use your phrase list to **mask** obvious AI metros:

   - Replace `“In conclusion,”` with `[REMOVE_IN_CONCLUSION]` markers in a temp version.
   - Mark other phrases similarly.

2. Prompt LLM to **rewrite only the marked spots**:

> System:  
> You are a careful editor. You receive text with markers like `[REMOVE_IN_CONCLUSION]`.  
> For each marker, remove the generic AI-like phrase and rewrite the sentence so it flows naturally while preserving meaning.  
> Do not add new arguments, just rephrase.
>
> User:  
> TEXT: """…"""

3. Replace markers with LLM rewrites; keep everything else untouched.

This pass already cuts a lot of “AI smell”.

---

### 2.3 Pass 2 — Style alignment (optional)

Goal: move toward a particular human voice (e.g., Tem Noon) without overdoing it.

Approach:

1. **Extract style profile** from `styleSamples` (once, cached per user):

   - Use embeddings (OpenAI / CF AI) to get vectors for each sample.
   - Also simple heuristics: avg sentence length, use of first-person, rhetorical qs, parentheticals, slang.
   - Store a small JSON “style fingerprint”:

```json
{
  "tone": "informal, curious, slightly playful",
  "sentences": "varied length, some long with parentheticals",
  "lexicon": "uses concrete examples, references to specific texts/people",
  "persona": "first-person, talking to a smart friend"
}
```

2. Pass the cleaned text + style fingerprint into a **style-transfer prompt**:

> System:  
> You are editing text so that it reads more like the following style description, while preserving all factual content and structure:  
> STYLE: {styleFingerprintJson}  
> Constraints:  
> - Preserve technical accuracy, citations, and code.  
> - Do not add new claims.  
> - Aim for small, local edits, not full rewrites.
>
> User:  
> ORIGINAL: """…"""

3. Optionally specify a **“change budget”**:

> Make no more than 30% of sentences significantly different. Prefer adjusting phrasing, rhythm, and specificity.

This gives you a softer, more human voice consistent with the user.

---

### 2.4 Pass 3 — Human “unevenness” & concreteness

Goal: introduce the kind of micro-variation humans naturally exhibit:

- variable sentence length
- occasional rhetorical question
- specific examples instead of abstractions
- small asides / parentheticals

Prompt template:

> System:  
> You are polishing this text to feel like it was written by a thoughtful human rather than an AI.  
> Add gentle “texture” while preserving meaning:
> - Vary sentence length and rhythm.  
> - Prefer concrete examples over vague abstractions.  
> - Allow occasional parenthetical asides or rhetorical questions.  
> - Do NOT add new factual claims or change the logical structure.  
> Return the full revised text.
>
> User:  
> TEXT: """…"""

You can **limit this to high-AI-score sentences** only, by sending small chunks rather than the whole document.

---

### 2.5 Pass 4 — Consistency & safety check

You don’t want the Humanizer to hallucinate or drift.

Use another LLM pass as a **diff checker**:

> System:  
> Compare ORIGINAL and REVISED.  
> - List any factual claims that appear in REVISED but not in ORIGINAL.  
> - If any are present, rewrite REVISED to remove or weaken them so that it is semantically equivalent to ORIGINAL.  
> Output ONLY the final safe revised text.

By doing this, you keep your “humanization” stylistic, not epistemic.

---

### 2.6 Integration with Detector

For a nice UX loop in Narrative Studio:

1. User sends text → Detector runs, returns highlight map.
2. UI shows “AI-ish segments” in purple.
3. User can:
   - click “Humanize highlighted” → send only those spans through passes 1–3.
   - optionally provide or pick a style reference (their own prior post) from a dropdown.
4. After humanization, run Detector again in **“self-check mode”**:
   - Show that the score moved from, say, 0.78 → 0.42.
   - Always keep messaging: “This is just a heuristic; you’re the final judge.”

---

## 3. Packages, infra, and where to run what

**Within Cloudflare Worker:**

- Text processing:  
  - `sentence-splitter` or `sbd`  
  - `wink-tokenizer` or `compromise`  
  - `natural` for n-grams / TF-IDF  
  - `fastest-levenshtein` for fuzzy phrase hits
- Data:
  - Store phrase lists + style fingerprints in KV / D1.
  - Optionally, per-user style fingerprints in D1 with userId.

**Via external AI (or CF AI Workers):**

- Detection meta-judge (one small model call per doc).
- Humanizer passes 1–4 (depending on how aggressive you want to be).

Optionally **edge model**:

- `@xenova/transformers` + tiny classifier for offline training, online inference.

---

## 4. Caveats & how you message it

- Your home-grown detector **will not** be as robust as GPTZero; don’t frame it as disciplinary evidence.
- Use Humanizer primarily on **your own generated text** or **opt-in transformations**, not as a “cheat-cleaner” for students.
- Document clearly in the UI:
  - “This tool estimates AI-likeness to help you reflect on your writing. It can be wrong.”
  - “Humanizer focuses on style and rhythm; you remain responsible for factual accuracy.”

---

If you want, next step I can sketch:

- A concrete **prompt library** for each pass (Detector judge + De-templater + Style aligner + Texture + Diff-checker).  
- Or a **Worker routing diagram** showing which endpoints handle detection vs humanization, and how they plug into your existing Allegorical / Round-Trip tools.

Awesome, let’s give Humanizer some bones. I’ll keep this implementation-ready but not overwhelming.

I’ll sketch:

- Overall storage strategy (D1 vs KV/R2)
- `style_profiles`
- `detector_runs`
- `humanizer_sessions`
- Optional helpers: `texts`, `style_samples`

All schemas are SQLite/D1 flavored, plus the JSON shapes you pass around in Workers.

---

## 0. Storage strategy

**D1 (SQLite)** – store *metadata and indices*:

- IDs, user IDs, timestamps
- Small JSON blobs (metrics, flags, configuration)
- Pointers to large text stored elsewhere

**KV or R2** – store *big stuff*:

- Full texts (original, rewritten)
- Long transformation plans if they get large

Pattern:

- D1 row has `text_blob_key` like `text:detector:run_123_original`
- Worker fetches from KV/R2 when needed.

---

## 1. `style_profiles` – per-user / per-persona style

Represents a reusable “style card” + stats for a given user or persona.

### 1.1 D1 table

```sql
CREATE TABLE style_profiles (
  id            TEXT PRIMARY KEY,       -- uuid or cuid
  user_id       TEXT NOT NULL,          -- internal user id
  label         TEXT NOT NULL,          -- "Tem Default", "Tem Academic"
  slug          TEXT NOT NULL,          -- "tem-default", unique per user
  description   TEXT NOT NULL,          -- human description of style
  style_card    TEXT NOT NULL,          -- JSON string: see below

  metrics_json  TEXT NOT NULL,          -- JSON metrics aggregate
  embedding_dim INTEGER NOT NULL,       -- e.g. 1536
  embedding_key TEXT,                   -- KV/R2 key for vector if large

  sample_count  INTEGER NOT NULL DEFAULT 0,
  is_default    INTEGER NOT NULL DEFAULT 0,  -- 0/1

  created_at    INTEGER NOT NULL,      -- unix ms
  updated_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_style_profiles_user_slug
  ON style_profiles(user_id, slug);
```

### 1.2 Style card JSON

This is what you *pass into prompts* as “the style”:

```jsonc
{
  "version": "v1",
  "tone": "curious, slightly informal, reflective",
  "rhythm": "mix of medium and long sentences with occasional short punchy lines",
  "quirks": [
    "uses parentheses for asides",
    "occasionally uses em dashes for pivots",
    "prefers concrete examples over abstractions when possible"
  ],
  "avoid": [
    "generic bloggy phrases like 'in today's fast-paced world'",
    "overly formal academic jargon unless explicitly requested"
  ],
  "target_metrics": {
    "avg_sentence_length": 22,
    "sentence_length_std": 9,
    "type_token_ratio": 0.32,
    "short_sentence_ratio": 0.15,
    "long_sentence_ratio": 0.2
  }
}
```

### 1.3 Aggregated metrics JSON

This is *your* computed summary:

```jsonc
{
  "source": "analysis-v1",
  "samples": 37,
  "metrics": {
    "avg_sentence_length_mean": 21.9,
    "avg_sentence_length_std": 2.3,
    "sentence_length_std_mean": 8.7,
    "type_token_ratio_mean": 0.31,
    "punctuation_profile": {
      "comma_per_sentence": 0.9,
      "dash_per_1000_words": 7.5
    },
    "embedding_centroid_key": "emb:style:tem-default:v1"
  },
  "notes": [
    "Based on Substack drafts + Humanizer forum posts May–Oct 2025."
  ]
}
```

---

## 2. `detector_runs` – audit log of “lite” detections

Every time someone runs the **Lite Detector**, log a row.

### 2.1 D1 table

```sql
CREATE TABLE detector_runs (
  id               TEXT PRIMARY KEY,     -- uuid/cuid
  user_id          TEXT,                 -- nullable for anonymous
  style_profile_id TEXT,                 -- optional, if used

  origin           TEXT NOT NULL,        -- 'studio', 'api', 'discourse', etc.
  source_doc_id    TEXT,                 -- external id (post id, file id)
  text_hash        TEXT NOT NULL,        -- sha256 or similar of original

  ai_likelihood    REAL NOT NULL,        -- 0-1
  confidence       TEXT NOT NULL,        -- 'low' | 'medium' | 'high'
  label            TEXT NOT NULL,        -- 'unknown','possibly_ai','ai_assisted', etc.

  metrics_json     TEXT NOT NULL,        -- summary metrics
  phrase_json      TEXT NOT NULL,        -- phrase hits summary
  burstiness_json  TEXT NOT NULL,        -- predictability stats
  style_json       TEXT,                 -- optional style-distance info

  model_version    TEXT NOT NULL,        -- 'lite-detector-v1.2'
  engine_version   TEXT NOT NULL,        -- worker/build version

  original_text_key TEXT NOT NULL,       -- KV/R2 key
  created_at        INTEGER NOT NULL
);

CREATE INDEX idx_detector_runs_user_time
  ON detector_runs(user_id, created_at DESC);
```

### 2.2 Metrics JSON (kept small)

```jsonc
{
  "token_count": 742,
  "sentence_count": 34,
  "avg_sentence_length": 21.8,
  "sentence_length_std": 7.1,
  "short_sentence_ratio": 0.12,
  "long_sentence_ratio": 0.18,
  "type_token_ratio": 0.31,
  "stopword_ratio": 0.58,
  "comma_per_sentence": 0.9
}
```

### 2.3 Phrase JSON

```jsonc
{
  "total_matches": 14,
  "weighted_score": 3.2,
  "examples": [
    { "phrase": "in conclusion", "count": 2, "weight": 1.5 },
    { "phrase": "it is important to note that", "count": 1, "weight": 2.0 }
  ]
}
```

### 2.4 Burstiness JSON

```jsonc
{
  "avg_predictability": 8.7,          // 1–10 scale
  "predictability_std": 0.9,
  "window_size_tokens": 250,
  "windows": 8
}
```

### 2.5 Style JSON (optional)

```jsonc
{
  "style_profile_id": "sty_abc123",
  "style_distance": 0.35,      // 0-1, higher = less like your usual
  "embedding_similarity": 0.72
}
```

---

## 3. `humanizer_sessions` – tracking rewrites

Each run of your Humanizer pipeline is a session with original text, plan, and result.

### 3.1 D1 table

```sql
CREATE TABLE humanizer_sessions (
  id                 TEXT PRIMARY KEY,    -- uuid/cuid
  user_id            TEXT NOT NULL,

  style_profile_id   TEXT,                -- optional
  goal               TEXT NOT NULL,       -- 'personalize','concretize','simplify','tone-shift'
  max_changes        TEXT NOT NULL,       -- 'light','medium','heavy'

  origin             TEXT NOT NULL,       -- 'studio','api','discourse', etc.
  source_doc_id      TEXT,                -- external doc/post id
  original_text_hash TEXT NOT NULL,
  rewritten_text_hash TEXT,               -- filled when finished

  plan_json          TEXT NOT NULL,       -- transformation plan summary
  before_metrics_json TEXT NOT NULL,      -- metrics of original
  after_metrics_json  TEXT,               -- metrics of rewritten

  detector_run_id    TEXT,                -- optional: link to pre-run detect

  original_text_key  TEXT NOT NULL,       -- KV/R2 keys
  rewritten_text_key TEXT,                -- set when done

  status             TEXT NOT NULL,       -- 'pending','running','complete','failed'
  error_message      TEXT,                -- if failed

  model_version      TEXT NOT NULL,       -- 'humanizer-v1.0'
  engine_version     TEXT NOT NULL,       -- worker build/id

  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX idx_humanizer_sessions_user_time
  ON humanizer_sessions(user_id, created_at DESC);
```

### 3.2 Transformation plan JSON

This is what you computed in Pass 1 of the Humanizer:

```jsonc
{
  "version": "plan-v1",
  "global": {
    "target_burstiness": 0.55,
    "target_sentence_length_std": 9,
    "style_profile_id": "sty_abc123",
    "max_change_level": "medium"
  },
  "operations": [
    {
      "type": "replace_phrase",
      "pattern": "in conclusion",
      "instruction": "Use a more personal, reflective closing that fits the Tem style."
    },
    {
      "type": "enrich_paragraph",
      "span": { "start_sentence": 5, "end_sentence": 8 },
      "instruction": "Add one concrete anecdote or example instead of generic claims."
    },
    {
      "type": "vary_rhythm",
      "span": { "start_sentence": 9, "end_sentence": 20 },
      "instruction": "Insert a couple of short sentences and one winding sentence, preserving meaning."
    }
  ]
}
```

### 3.3 Before/after metrics JSON

Same shape as the detector metrics, but nested:

```jsonc
{
  "analysis_version": "metrics-v1",
  "metrics": {
    "token_count": 820,
    "sentence_count": 39,
    "avg_sentence_length": 21.0,
    "sentence_length_std": 9.2,
    "type_token_ratio": 0.34,
    "short_sentence_ratio": 0.23,
    "long_sentence_ratio": 0.21
  },
  "phrase_score": {
    "total_matches": 3,
    "weighted_score": 0.8
  },
  "burstiness": {
    "avg_predictability": 7.8,
    "predictability_std": 1.4
  },
  "style_distance": 0.18
}
```

---

## 4. Optional helper tables

### 4.1 `texts` – shared text blob index (if you want indirection)

If you want to de-duplicate texts and centralize KV keys:

```sql
CREATE TABLE texts (
  hash        TEXT PRIMARY KEY,   -- sha256/sha1 of full text
  length      INTEGER NOT NULL,
  kv_key      TEXT NOT NULL,     -- 'text:...'
  created_at  INTEGER NOT NULL
);
```

Then `detector_runs.original_text_key` and `humanizer_sessions.*_text_key` can always point at `texts.kv_key`.

### 4.2 `style_samples` – which texts built a style profile

To later re-train or debug:

```sql
CREATE TABLE style_samples (
  id               TEXT PRIMARY KEY,
  style_profile_id TEXT NOT NULL,
  text_hash        TEXT NOT NULL,
  source_doc_id    TEXT,
  role             TEXT NOT NULL,  -- 'training','validation'
  created_at       INTEGER NOT NULL
);

CREATE INDEX idx_style_samples_profile
  ON style_samples(style_profile_id);
```

---

## 5. How this maps into your Narrative Studio UI

- **Style Manager / “Manage Voices”**
  - Lists rows from `style_profiles` for the current user.
  - Lets you pick default style (set `is_default=1`).
  - Could show small sparkline graphs from `metrics_json` (sentence length, burstiness).

- **AI Detector Panel**
  - When you run “AI Detector” on a note:
    - Worker creates a `texts` row (if new), stores text in KV.
    - Runs analysis, creates a `detector_runs` row, returns analysis JSON.
    - UI can query “latest 10 runs for this user” via `detector_runs`.

- **Humanizer Panel**
  - When you click “Humanize”:
    - Worker creates `humanizer_sessions` row (status `pending`) with original text hash + plan.
    - Runs the multi-pass pipeline, updates `rewritten_text_key`, `after_metrics_json`, `status='complete'`.
    - Returns final `rewritten` text + notes immediately in the response; the row is for history and analytics.

This gives you:

- A clean history of how texts were analyzed & transformed.
- A way to revisit any run later (for debugging, screenshots, or user history).
- A schema that’s small enough to be easy to evolve but structured enough that you can build dashboards on top.

If you want, next step I can:

- Propose a few concrete KV key naming conventions (`text:orig:...`, `text:rew:...`, `emb:style:...`)
- Or sketch the Worker route handlers’ *shape* (validation + D1 calls + KV lookup) in TypeScript so Claude Code can fill in the details.