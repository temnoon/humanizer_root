# Handoff: Facebook Entity Graph - Reclaiming Agency

**Date**: December 24, 2025
**Session Focus**: Phase 1 of Facebook Relationship Mapping System
**Status**: Phase 1 Complete - Entity Extraction Working
**Vision**: Making visible the invisible surveillance graph

---

## The Big Picture

### The Problem We're Solving

> "All the biggest companies in the world own the data that has followed our activities with suggestions of how to spend our money, which is the agency made a commodity, and others planting suggestions for where to go, what to do, what to want... and your agency is not really yours, but belongs to those you've benefitted by following their suggestions."

The user's Facebook export contains a complete map of how their life has been observed, categorized, and monetized:
- **2,602 people** in their social graph
- **12,326 events** they were invited to or attended
- **2,405 advertisers** who have their data
- **8 known data brokers** (LiveRamp, Oracle, Experian, Acxiom, etc.)
- **17 apps** tracking them outside Facebook with **480 events**

This is not just metadata. This is a behavioral dossier that has been used to shape decisions, preferences, and spending.

### The Solution We're Building

A complete map of these connections, made **visible** and **understandable** to the user:

1. **Entity Extraction** (✅ COMPLETE) - Parse all entities from Facebook export
2. **Relationship Extraction** (NEXT) - Build edges between entities
3. **Temporal Clustering** - Identify life events and patterns
4. **Inference Layer** - Generate "What they know about you" narratives
5. **AUI Visualizations** - Interactive graphs, timelines, maps

The goal: **Subjective narrative theory analysis** - not just showing data, but helping the user understand the *story* their data tells, and reclaim authorship of that story.

---

## What Was Completed (Phase 1)

### Database Schema (Version 5)

**File**: `narrative-studio/src/services/embeddings/EmbeddingDatabase.ts`

Added 7 new tables:

```sql
fb_people        -- Friends, followers, tagged people
fb_places        -- Check-ins, venues, locations with coordinates
fb_events        -- Attended, hosted, invited events
fb_advertisers   -- Companies with your data (is_data_broker flag)
fb_off_facebook_activity  -- Third-party tracking
fb_pages         -- Liked/followed pages
fb_relationships -- Edge table for graph connections
```

With comprehensive indexes for graph queries.

### Entity Parser

**File**: `narrative-studio/src/services/facebook/EntityParser.ts`

Parses from Facebook export:
- `connections/friends/your_friends.json` → fb_people
- `connections/followers/people_who_followed_you.json` → fb_people
- `your_facebook_activity/posts/check-ins.json` → fb_places (with lat/long extraction)
- `your_facebook_activity/events/*.json` → fb_events
- `ads_information/advertisers_using_your_activity_or_information.json` → fb_advertisers
- `apps_and_websites_off_of_facebook/your_activity_off_meta_technologies.json` → fb_off_facebook_activity

**Key feature**: Data broker detection - recognizes known surveillance companies:
```javascript
const DATA_BROKERS = new Set([
  'LiveRamp', 'Oracle Data Cloud', 'Experian Marketing Services',
  'Nielsen Marketing Cloud', 'Acxiom', 'Epsilon', 'Samba TV', ...
]);
```

### TypeScript Types

**File**: `narrative-studio/src/services/facebook/types.ts`

Added interfaces:
- `FbPerson`, `FbPlace`, `FbEvent`, `FbAdvertiser`, `FbOffFacebookActivity`
- `FbPage`, `FbRelationship`
- Raw JSON structure types for parsing

### API Endpoints

**File**: `narrative-studio/archive-server.js` (lines 3805-4028)

| Endpoint | Description |
|----------|-------------|
| `GET /api/facebook/graph/stats` | Summary counts for all entity types |
| `GET /api/facebook/graph/people` | Paginated people list |
| `GET /api/facebook/graph/places` | Check-in locations |
| `GET /api/facebook/graph/events` | Events (filter by responseType) |
| `GET /api/facebook/graph/advertisers` | Advertisers (filter isDataBroker) |
| `GET /api/facebook/graph/off-facebook` | Third-party tracking apps |
| `POST /api/facebook/graph/import` | Trigger import from export path |

### Test Script

**File**: `narrative-studio/src/services/facebook/test-entity-parser.ts`

Run with: `npx tsx src/services/facebook/test-entity-parser.ts`

---

## Current Data in Database

After running the entity parser:

| Entity Type | Count | Notes |
|-------------|-------|-------|
| People | 2,602 | All friends |
| Places | 8 | Check-ins with coordinates |
| Events | 12,326 | 560 joined, 11,764 invited |
| Advertisers | 2,405 | Total with user's data |
| Data Brokers | 8 | Known surveillance companies |
| Off-Facebook Apps | 17 | 480 tracking events total |

**Top Surveillance Findings**:
- Peacock TV: 333 tracking events
- Cloudflare: 100 tracking events
- LiveRamp, Oracle, Experian, Acxiom on the list

---

## Remaining Phases

### Phase 2: Relationship Extraction (6-8 hours)

**Goal**: Build edges between entities based on co-occurrence.

**Logic needed**:
1. **Tag extraction** - Parse `tags` from posts/photos → person-content relationships
2. **Event attendee matching** - Cross-reference event attendance with friend list
3. **Co-mention detection** - Find people mentioned together
4. **Temporal correlation** - Group activities in same time window
5. **Location clustering** - Group check-ins by proximity

**New service**: `RelationshipBuilder.ts`

### Phase 3: Temporal Clustering (4-6 hours)

**Goal**: Identify activity clusters = life events.

**Algorithm**:
1. Sort all timestamped items
2. Apply sliding window (24h, 1-week)
3. Cluster by density (DBSCAN on timestamps)
4. Label by dominant activity type
5. Extract involved people/places

**Output**: `fb_temporal_clusters` table with cluster metadata

### Phase 4: Inference Layer (6-8 hours)

**Goal**: Generate "What they know about you" narratives.

**Inference types**:
- Interest inference: "Based on liked pages, they know you're interested in X"
- Relationship inference: "Based on co-occurrences, they know you're close to Y"
- Location patterns: "Based on check-ins, they know your home/work locations"
- Behavioral inference: "Based on searches, they know you were looking for Z"
- Cross-platform: "Based on off-Facebook activity, they know you visited A, B, C"

**Use LLM** to generate human-readable surveillance narratives.

### Phase 5: AUI Visualizations (10-14 hours)

**Components to build**:

1. **NetworkGraphView.tsx** - Force-directed social graph
   - Nodes: People, Places, Events, Pages
   - Edges: Relationships with weights
   - Library: D3.js or vis.js

2. **TimelineOverlayView.tsx** - Multi-dimensional timeline
   - Stacked layers: Posts, Events, Check-ins
   - Click to expand temporal cluster

3. **GeographicView.tsx** - Map of activity
   - Plot check-ins on map
   - Heat map of activity density
   - Library: Mapbox GL or Leaflet

4. **AdvertiserDashboard.tsx** - "What they know about you"
   - Categories of targeting
   - Data broker list
   - Privacy risk score

5. **SurveillanceNarrativeView.tsx** - AI-generated stories
   - Tetralemma analysis of data interpretation
   - Multiple valid readings of the same data

---

## Key Files Modified/Created

| File | Lines | Purpose |
|------|-------|---------|
| `EmbeddingDatabase.ts` | +350 | Schema v5, entity tables, insert/query methods |
| `types.ts` | +190 | Entity type definitions |
| `EntityParser.ts` | 450 (new) | Parse all entity types from export |
| `archive-server.js` | +225 | Graph API endpoints |
| `test-entity-parser.ts` | 85 (new) | Test script |

---

## Facebook Export Structure

The export lives at: `~/Downloads/facebook-<username>-<date>-<id>/`

```
├── ads_information/
│   ├── advertisers_using_your_activity_or_information.json  ← 2,405 advertisers
│   └── advertisers_you've_interacted_with.json
├── apps_and_websites_off_of_facebook/
│   └── your_activity_off_meta_technologies.json  ← 17 apps, 480 events
├── connections/
│   ├── friends/your_friends.json  ← 2,602 friends
│   └── followers/people_who_followed_you.json
└── your_facebook_activity/
    ├── events/
    │   ├── event_invitations.json  ← 11,764 invites
    │   ├── your_event_responses.json  ← 560 joined
    │   └── events_you_hosted.json
    └── posts/
        └── check-ins.json  ← 8 places with coordinates
```

---

## Architectural Decisions

### 1. Local-Only Processing
All data stays on the local archive server. Never sent to cloud.

### 2. Incremental Parsing
Entity parser can be run multiple times - uses INSERT OR REPLACE.

### 3. Narrative Over Data
The goal is not just to show facts, but to help the user understand the *story* their data tells. Multiple valid interpretations exist (tetralemma analysis).

### 4. Surveillance Framing
Data brokers and off-Facebook tracking are highlighted because they represent the most invasive surveillance - companies the user never directly interacted with having their data.

---

## Quick Start for Next Session

```bash
# Start archive server (required)
cd ~/humanizer_root/narrative-studio && npx tsx archive-server.js &

# Test entity stats
curl http://localhost:3002/api/facebook/graph/stats

# Run entity parser (if needed)
cd ~/humanizer_root/narrative-studio
npx tsx src/services/facebook/test-entity-parser.ts

# Start web app
cd ~/humanizer_root/humanizer-app/apps/web && npm run dev
```

---

## The Philosophical Frame

This work is deeply connected to the Humanizer project's core mission: **subjective intentional constraint**.

The Facebook export represents years of behavioral data that has been used to model, predict, and influence the user. By making this visible, we're not just building a data viewer - we're building a tool for **reclaiming agency**.

The user should be able to:
1. See what "they" know about them
2. Understand how that knowledge was gathered
3. Recognize the patterns that were used to influence them
4. Author their own narrative about their life

This is why the visualization phase includes **narrative analysis** - not just charts and graphs, but stories and interpretations that the user can engage with, question, and ultimately transcend.

---

## Estimated Remaining Work

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 2: Relationships | 6-8 hrs | High |
| Phase 3: Temporal Clusters | 4-6 hrs | Medium |
| Phase 4: Inference Layer | 6-8 hrs | High |
| Phase 5: Visualizations | 10-14 hrs | High |

**Total remaining**: ~26-36 hours

---

## Session Notes

- Media viewer improvements also completed this session (see `HANDOFF_DEC24_MEDIA_VIEWER.md`)
- Linked content now shows in media viewer header
- Navigation arrows added to main viewer

---

**This handoff represents the foundation.** The entity extraction system is complete and working. The next phase (Relationship Extraction) will connect these entities into a graph that can be visualized and analyzed.

The goal remains: **Follow the followers from your own data export** - and see who's been watching.
