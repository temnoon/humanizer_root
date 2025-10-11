# Humanizer Edge Architecture — One Pager

> Cloudflare-first, Postgres-backed, narrative-room native. Designed to scale from a single creator to a global, post-social network.

---

## 1) High-Level Diagram (Text)

```
[Browser/Client]
   ↕ (HTTP/WebSocket, Auth tokens)
[Cloudflare Workers Router]
   → Static assets via CDN/Pages
   → API routes → Controllers (Hono/Remix)
       ↘
        [Durable Objects]
          • NarrativeRoom DO (presence, locks, cursors, chat)
          • RateLimiter DO
          • Job Orchestrator DO (workflow triggers)
       ↘                ↘
        [D1 (Edge SQLite)]   [Queues & Workflows]
        • Drafts, sessions    • Moderation, indexing, builds
        • Small indices       • Ingestion pipelines
        • Activity logs       • Notification fan-out
           ↘
            [Vectorize]
            • Embeddings for archives, RAG, related-passages

       ↘ (media)
        [R2 Object Storage]
        • Uploads, PDFs/EPUBs, images, audio (zero egress)

       ↘ (relational truth via edge tunnel)
        [Hyperdrive → PostgreSQL]
        • Users/roles/ACLs, payments, provenance, graphs
        • Heavy joins, cross-entity transactions

(Optionals / later):
   • Workers AI / external LLMs
   • Containers on Workers (heavier/longer compute)
```

---

## 2) Responsibilities & Data Boundaries

* **Workers Router**: request auth, routing, SSR/SPA handoffs, lightweight validation. No long work here.
* **Durable Objects (DOs)**: single-writer coordination per **narrative room** (chat/logs), real-time state (presence, cursors, locks), conflict resolution hooks.
* **D1 (edge)**: fast, local reads/writes for session/drafts/tiny tables; many-small-DB tenancy (per user or per room) possible.
* **Hyperdrive → Postgres**: system-of-record for users, permissions, billing, provenance, content graphs, audit trails.
* **R2**: canonical binaries & artifacts (uploads, exports). Signed URLs; lifecycle rules for cold storage.
* **Queues/Workflows**: asynchronous jobs (moderation, embed, build, notify) with retries & idempotency.
* **Vectorize**: embeddings for archive search, narrative linking, character/persona retrieval.

---

## 3) Request & Edit Flow (Happy Path)

1. Client hits Workers route (SSR or API).
2. Auth check (JWT/mtls/Turnstile); session pulled from D1.
3. For live editing: client joins **NarrativeRoom DO** (WebSocket).
4. DO validates intent, applies op, emits presence/cursor updates.
5. Small, frequent writes → D1 (edge).
6. Periodic commit/checkpoint → Hyperdrive → Postgres (append-only log + snapshot).
7. Media uploads stream to R2; post-process via Queue (thumbnails, OCR, text extraction).
8. Build/export requests enqueue a **Workflow** → artifacts saved to R2 → notify clients.

---

## 4) Migration/Adaptation Plan (from Docker/Express)

* **Keep** domain logic, models, and SQL (Postgres).
* **Adapt** web/API layer to Workers runtime (Hono/Remix on CF) with `nodejs_compat` for libraries.
* **Introduce** Durable Objects for rooms/presence/locks; replace in-process mutexes.
* **Move** uploads + exports to R2 (signed upload URLs).
* **Front** existing Postgres with Hyperdrive (no schema rewrite).
* **Extract** background tasks into Queues/Workflows; remove cron pods.

---

## 5) Faults & Backpressure

* **DO hot key**: shard narrative rooms by stable key; implement backpressure (queue length, max clients) + overflow rooms.
* **Postgres limits**: Hyperdrive pools connections; implement circuit-breaker & read degradation (serve from D1 snapshot).
* **R2 transient**: retry with exponential backoff; ensure idempotent keys on writes.
* **Workflow retries**: use deterministic job IDs; log to Postgres.

---

## 6) Security & Privacy by Design

* Token-bound sessions; short-lived JWT + refresh; DO-local session cache.
* Per-room ACLs enforced in DO; signed URL policies for R2.
* PII minimized in D1; encrypted-at-rest secrets; audit trails in Postgres.
* "Local-first" UX: client diff buffers; optimistic UI; eventual commit snapshots.

---

## 7) Cost Levers (predictable from day one)

* **R2**: zero egress → publish heavy content freely; watch Class A/B ops.
* **D1**: keep hot, small tables close to users; avoid cross-tenant mega-joins.
* **Hyperdrive**: centralize expensive joins; cache derived views at edge.
* **Vectorize**: batch embed jobs; chunk wisely; TTL cache on top-k lookups.
* **Workflows/Queues**: consolidate steps; prefer streaming transforms.

---

## 8) What Changes in Code

* Replace `express()` with Workers entry (Hono/Remix loader/actions).
* Swap Node-only APIs (e.g., `fs`, raw sockets) for platform APIs (R2, KV, DO alarms).
* Introduce DO classes for `NarrativeRoom`, `RateLimiter`, `JobOrchestrator`.
* Factor writes: **Edge-fast to D1**, **durable commits to Postgres** via Hyperdrive.
* Centralize upload pipeline around R2 + Workflows.

---

## 9) Milestones (90 days)

**T0**: Workers app skeleton; auth; R2 uploads; Hyperdrive to existing Postgres.
**T30**: NarrativeRoom DO (presence/locks); D1 drafts; basic Workflows build → R2 export.
**T60**: Vectorize search over archives; moderation queue; role/ACL model in Postgres.
**T90**: Multi-room scaling test; cost review; observability dashboards; beta launch.

---

### TL;DR

Run the **experience at the edge** (Workers + DO + D1), keep **truth in Postgres** (via Hyperdrive), store **media in R2**, and orchestrate **everything async** with Queues/Workflows. This preserves your current data model, delivers global real-time UX, and scales cost-sensibly as Humanizer grows.
