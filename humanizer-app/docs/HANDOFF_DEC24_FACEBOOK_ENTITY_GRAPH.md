# Handoff: Facebook Entity Graph - Reclaiming Agency

**Date**: December 24, 2025
**Session Focus**: Phase 2 of Facebook Relationship Mapping System
**Status**: Phase 1 & 2 Complete - Entity Extraction + Relationships Working
**Vision**: Making visible the invisible surveillance graph

---

## The Big Picture

### The Problem We're Solving

> "All the biggest companies in the world own the data that has followed our activities with suggestions of how to spend our money, which is the agency made a commodity, and others planting suggestions for where to go, what to do, what to want... and your agency is not really yours, but belongs to those you've benefitted by following their suggestions."

The user's Facebook export contains a complete map of how their life has been observed, categorized, and monetized:
- **4,992 people** in their social graph (2,602 friends + 2,390 discovered through interactions)
- **12,326 events** they were invited to or attended
- **2,405 advertisers** who have their data
- **8 known data brokers** (LiveRamp, Oracle, Experian, Acxiom, etc.)
- **17 apps** tracking them outside Facebook with **480 events**
- **6,907 relationships** connecting these entities

This is not just metadata. This is a behavioral dossier that has been used to shape decisions, preferences, and spending.

### The Solution We're Building

A complete map of these connections, made **visible** and **understandable** to the user:

1. **Entity Extraction** (✅ COMPLETE) - Parse all entities from Facebook export
2. **Relationship Extraction** (✅ COMPLETE) - Build edges between entities
3. **Temporal Clustering** (NEXT) - Identify life events and patterns
4. **Inference Layer** - Generate "What they know about you" narratives
5. **AUI Visualizations** - Interactive graphs, timelines, maps

The goal: **Subjective narrative theory analysis** - not just showing data, but helping the user understand the *story* their data tells, and reclaim authorship of that story.

---

## What Was Completed (Phase 2 - This Session)

### RelationshipBuilder Service

**File**: `narrative-studio/src/services/facebook/RelationshipBuilder.ts` (new, ~450 lines)

Extracts relationships from:
- **Post tags** (164 relationships) - People tagged in posts/photos
- **Comments** (5,478 relationships) - Extracting "Tem Noon commented on X's post" patterns
- **Reactions** (50,571 reactions → 6,907 unique relationships) - Likes, Loves, Wows, Hahas, etc.

**Key features**:
- Pattern matching to extract person names from Facebook titles
- Automatic discovery of non-friend people mentioned in interactions
- Weight calculation based on reaction type (love=3x, wow/haha=2x, like=1x)
- Deduplication with weight accumulation

### Relationship Statistics

| Relationship Type | Count | Avg Weight |
|-------------------|-------|------------|
| reacted_like | 3,736 | 10.85 |
| commented_on | 1,088 | 5.03 |
| reacted_love | 1,003 | 19.45 |
| reacted_none | 741 | 4.44 |
| tagged_in | 164 | 1.00 |
| reacted_sorry | 127 | 2.85 |
| reacted_wow | 23 | 2.43 |
| reacted_haha | 22 | 2.18 |
| reacted_anger | 3 | 1.00 |

### Top Connected People

Your strongest connections based on cumulative interaction weight:

| Rank | Name | Weight | Relationship Count |
|------|------|--------|-------------------|
| 1 | Suzy Life | 1,477 | 7 |
| 2 | Hilary Oak | 1,222 | 24 |
| 3 | Shanda Christian | 1,072 | 7 |
| 4 | Sonnie Mynatt | 1,039 | 7 |
| 5 | Karl Baba | 821 | 4 |
| 6 | Heather Stargazer | 602 | 4 |
| 7 | Killy Dwyer | 598 | 5 |
| 8 | Coori Sellers | 571 | 10 |
| 9 | Brian Douglas | 570 | 10 |
| 10 | Lloyd H Floyd | 565 | 6 |

### New Database Methods

**File**: `narrative-studio/src/services/embeddings/EmbeddingDatabase.ts`

Added relationship operations:
- `insertFbRelationship()` / `insertFbRelationshipsBatch()` - Store relationships
- `getFbRelationships()` - Query with filters (type, source, target)
- `getFbPersonConnections()` - Get all connections for a person
- `getTopConnectedPeople()` - Ranked list by relationship weight
- `getRelationshipStats()` - Aggregate statistics
- `updatePersonInteractionStats()` - Update person records with calculated weights

### New API Endpoints

**File**: `narrative-studio/archive-server.js`

| Endpoint | Description |
|----------|-------------|
| `POST /api/facebook/graph/build-relationships` | Build relationships from export |
| `GET /api/facebook/graph/relationships` | Query relationships with filters |
| `GET /api/facebook/graph/relationships/stats` | Relationship statistics |
| `GET /api/facebook/graph/top-connections` | Top connected people |
| `GET /api/facebook/graph/person/:id/connections` | Person's connections |

### Test Script

**File**: `narrative-studio/src/services/facebook/test-relationship-builder.ts`

Run with: `npx tsx src/services/facebook/test-relationship-builder.ts`

---

## Current Data in Database

After running both entity and relationship parsers:

| Entity Type | Count | Notes |
|-------------|-------|-------|
| People | 4,992 | 2,602 friends + 2,390 discovered |
| Places | 8 | Check-ins with coordinates |
| Events | 12,326 | 560 joined, 11,764 invited |
| Advertisers | 2,405 | Total with user's data |
| Data Brokers | 8 | Known surveillance companies |
| Off-Facebook Apps | 17 | 480 tracking events total |
| **Relationships** | **6,907** | **Edges in the social graph** |

**Top Surveillance Findings**:
- Peacock TV: 333 tracking events
- Cloudflare: 100 tracking events
- LiveRamp, Oracle, Experian, Acxiom on the data broker list

---

## Remaining Phases

### Phase 3: Temporal Clustering (4-6 hours)

**Goal**: Identify activity clusters = life events.

**Algorithm**:
1. Sort all timestamped items (posts, reactions, events)
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
   - Nodes: People (sized by connection weight)
   - Edges: Relationships (colored by type)
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
| `EmbeddingDatabase.ts` | +250 | Relationship operations |
| `RelationshipBuilder.ts` | 450 (new) | Extract relationships from export |
| `archive-server.js` | +180 | Relationship API endpoints |
| `test-relationship-builder.ts` | 100 (new) | Test script |
| `index.ts` | +10 | Export RelationshipBuilder |

---

## Quick Start for Next Session

```bash
# Start archive server (required)
cd /Users/tem/humanizer_root/narrative-studio && npx tsx archive-server.js &

# Test entity + relationship stats
curl http://localhost:3002/api/facebook/graph/stats

# Test relationship stats
curl http://localhost:3002/api/facebook/graph/relationships/stats

# Get top connections
curl "http://localhost:3002/api/facebook/graph/top-connections?limit=10"

# Run relationship builder (if rebuilding)
cd /Users/tem/humanizer_root/narrative-studio
npx tsx src/services/facebook/test-relationship-builder.ts

# Start web app
cd /Users/tem/humanizer_root/humanizer-app/apps/web && npm run dev
```

---

## The Philosophical Frame

This work is deeply connected to the Humanizer project's core mission: **subjective intentional constraint**.

The Facebook export represents years of behavioral data that has been used to model, predict, and influence the user. By making this visible, we're not just building a data viewer - we're building a tool for **reclaiming agency**.

The relationship graph shows:
1. **Who you actually connect with** - based on real interactions, not Facebook's friend list
2. **The pattern of your attention** - where your likes and comments go
3. **The asymmetry of surveillance** - 2,405 advertisers know you, but you don't know them

The user should be able to:
1. See what "they" know about them
2. Understand how that knowledge was gathered
3. Recognize the patterns that were used to influence them
4. Author their own narrative about their life

---

## Estimated Remaining Work

| Phase | Effort | Priority | Status |
|-------|--------|----------|--------|
| Phase 1: Entities | - | - | ✅ Complete |
| Phase 2: Relationships | - | - | ✅ Complete |
| Phase 3: Temporal Clusters | 4-6 hrs | Medium | Pending |
| Phase 4: Inference Layer | 6-8 hrs | High | Pending |
| Phase 5: Visualizations | 10-14 hrs | High | Pending |

**Total remaining**: ~18-28 hours

---

## Session Notes

- Phase 2 completed: RelationshipBuilder extracts 6,907 edges
- Discovered 2,390 additional people through comment/reaction parsing
- Top connection weights reveal actual interaction patterns (Suzy Life, Hilary Oak top)
- All APIs tested and working

---

**The graph is built.** The entities are extracted, the relationships are mapped. Next session should focus on either:
- **Temporal clustering** (identify life event patterns)
- **Visualization** (start building NetworkGraphView.tsx)

The goal remains: **Follow the followers from your own data export** - and see who's been watching.
