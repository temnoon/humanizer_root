# The Debugging Chronicles: War Stories

The bug appeared at 11:47 PM on a Tuesday.

Image matching was broken. The archive had 36,000 messages, many with images. The images weren't rendering. The database said they existed. The filesystem said they existed. But when the parser tried to match them, nothing connected.

I spent four hours before I found it.

---

## The Seven-Strategy Matching Bug

The image matcher used seven strategies in sequence:
1. Hash match
2. File-ID match
3. Filename + size match
4. Conversation directory match
5. Size + metadata match
6. Size-only match
7. Filename-only match

Strategy 4 was the problem. The code assumed conversation directories were named by UUID. Some were. Some weren't. Some were named by date. Some had prefixes.

> "Root Cause Analysis: openai-export-parser creates a messages table with text content only—image message nodes (with `image_asset_pointer`) are NOT stored in the messages table."
>
> *— Debug notes, December 2025*

The fix was ugly: normalize all directory names before comparison. Handle the edge cases individually. Add fallbacks for formats I hadn't anticipated.

The larger lesson: seven strategies sounds robust. Seven strategies with inconsistent assumptions is a cascade of edge cases.

---

## The Audio File Incident

Two days later, audio files stopped matching.

Different root cause. Same emotional experience.

Audio files lived in `{uuid}/audio/` directories. The path parser expected them in a flat structure. When I'd added directory traversal to fix the image bug, I'd broken the audio path logic.

The fix was smaller but the frustration was larger. Every bug fix creates new surfaces for bugs.

---

## The Port 8010 Mystery

The MCP memory server was unreachable.

I checked the process: running. I checked the port: listening. I ran curl: connection refused. I ran it again: worked fine.

Intermittent. The worst kind.

The cause was simple once I found it. The server was binding to `127.0.0.1`, not `0.0.0.0`. When I accessed it from inside Docker, the loopback interface wasn't the same loopback interface.

Networking bugs always feel stupid in retrospect. In the moment, they feel like the universe is lying.

---

## The Embedding Dimension Mismatch

Vector search returned garbage.

The embeddings were 768-dimensional. The search query was 384-dimensional. PostgreSQL's pgvector extension didn't throw an error—it just returned wrong answers with high confidence.

> "Ensure nomic-embed-text:768d for archive consistency."
>
> *— Configuration notes, November 2025*

The fix was a config guard: check dimensions before storing, before querying, before anything. Make the failure loud instead of silent.

Silent failures teach the wrong lessons. The code worked, technically. It was useless, practically.

---

## The Christmas Eve Deploy

December 24. The MVP was supposed to ship by the 31st. I found a critical bug in the persona transformation pipeline.

The bug: transformations weren't preserving paragraph breaks. The transformed text came back as a single wall of text. The Rho metrics looked fine—purity and entropy were acceptable. But the output was unreadable.

Turns out the LLM was generating markdown without newlines, and the parser was stripping what few it had.

The fix took 20 minutes. Finding the bug took 3 hours. Accepting that I'd be debugging on Christmas Eve took some emotional adjustment.

---

## The Lessons

Every debugging session teaches something obvious that wasn't obvious until you lived it.

**Assumptions compound.** The seven-strategy matcher assumed consistency across data formats. Each assumption was reasonable. Combined, they created a fragile system.

**Edge cases multiply.** Audio paths, image paths, conversation directories—each had its own format variations. "Handle all formats" is easy to say, hard to implement, harder to test.

**Silent failures are expensive.** The dimension mismatch cost hours because the system kept working. Make failures loud. Make mismatches throw errors. Make the wrong thing obvious.

**Fix the foundation.** Most bugs I fixed, I fixed twice—once as a patch, once as a proper solution. The patches bought time; the solutions bought sanity.

---

## The Emotional Part

Debugging is emotional labor.

At 2am, when the thing you've spent days building refuses to work for reasons you can't identify, it's hard not to take it personally. The code feels hostile. The universe feels adversarial.

It's not, of course. The code is deterministic. The bug has a cause. The cause is findable. But finding it requires patience you don't feel while you're in it.

The skill isn't just technical. It's the ability to stay curious when you want to be angry. To keep asking "what is actually happening" when you'd rather ask "why is this happening to me."

I'm still learning that part.

---

*Chapter assembled from debug logs and late-night commit messages, 2025*
