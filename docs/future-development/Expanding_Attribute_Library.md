# Expanding the Attribute Library

**Status**: Future Development (Post-Launch)
**Priority**: MEDIUM
**Estimated Effort**: 2-3 weeks
**Target**: Week 5-6

---

## 🎯 Goal

Provide users with a rich, diverse library of **100+ personas, 50+ namespaces, and 30+ styles** extracted from classic and contemporary literature, with clear source attribution so users can understand the literary origins of each attribute.

---

## 📊 Current State (November 2025)

### Existing Attributes

**Personas**: 25 total
- 5 generic (neutral, advocate, critic, philosopher, storyteller)
- 20 from Project Gutenberg (Austen, Dickens, Holmes, Thoreau, Melville, etc.)

**Namespaces**: 15 total
- 6 generic (mythology, quantum, nature, corporate, medieval, science)
- 9 from classic literature (Regency England, Revolutionary France, Victorian detection, etc.)

**Styles**: 15 total
- 5 generic (standard, academic, poetic, technical, casual)
- 7 from classic authors (Austen precision, Dickens dramatic, Watson clarity, etc.)
- 3 contemporary internet (Reddit casual, Medium narrative, Internet collage)

**Total**: 55 attributes

### Current Limitations

1. **No source attribution displayed** - Users don't see which book/author an attribute came from
2. **Limited diversity** - Heavily weighted toward 19th century English literature
3. **Missing major authors** - No Hemingway, Fitzgerald, Woolf, Joyce, Kafka, Dostoevsky, etc.
4. **Limited contemporary voices** - Only 3 internet styles, no modern novels
5. **No non-Western perspectives** - All attributes are Western European/American
6. **No genre diversity** - Missing sci-fi, fantasy, romance, thriller, mystery (beyond Holmes)

---

## 🎯 Proposed Expansion

### Phase 1: Classic Literature Expansion (20 new personas, 10 new namespaces, 5 new styles)

**American Modernists**:
- Personas: Hemingway (sparse), Fitzgerald (jazz age), Faulkner (stream of consciousness)
- Namespaces: Lost Generation Paris, Jazz Age excess, Southern Gothic decay
- Styles: Hemingway minimalism, Fitzgerald lyrical, Faulkner polyphonic

**British Modernists**:
- Personas: Woolf (interior monologue), Joyce (experimental), Orwell (dystopian clarity)
- Namespaces: Bloomsbury intellectual circles, Edwardian society, totalitarian surveillance
- Styles: Woolf stream, Joyce linguistic play, Orwell direct

**Russian Giants**:
- Personas: Dostoevsky (psychological depth), Tolstoy (epic scope), Chekhov (subtle observation)
- Namespaces: Imperial Russia class struggle, Moscow salons, provincial estates
- Styles: Dostoevsky intense, Tolstoy panoramic, Chekhov understated

**European Masters**:
- Personas: Kafka (bureaucratic absurd), Camus (existential), Borges (labyrinthine)
- Namespaces: Kafkaesque bureaucracy, French Algeria, infinite libraries
- Styles: Kafka paranoid clarity, Camus philosophical prose, Borges metafictional

### Phase 2: Genre Fiction (15 new personas, 10 new namespaces, 5 new styles)

**Science Fiction**:
- Personas: Asimov (rational), LeGuin (anthropological), Gibson (cyberpunk)
- Namespaces: Foundation galactic empire, Hainish ansible network, Sprawl cyberspace
- Styles: Asimov expository, LeGuin ethnographic, Gibson noir tech

**Fantasy**:
- Personas: Tolkien (mythic), Pratchett (satirical), Martin (political)
- Namespaces: Middle Earth quests, Discworld parody, Westeros intrigue
- Styles: Tolkien elevated, Pratchett comedic footnotes, Martin brutal realism

**Mystery/Thriller**:
- Personas: Christie (puzzle solver), Chandler (hardboiled), King (horror)
- Namespaces: Country manor mysteries, LA noir streets, small town horror
- Styles: Christie clue-driven, Chandler simile-heavy, King slow dread

### Phase 3: Contemporary & Diverse Voices (20 new personas, 10 new namespaces, 5 new styles)

**Contemporary Literary**:
- Personas: Morrison (lyrical trauma), Murakami (surreal mundane), Atwood (speculative feminist)
- Namespaces: Post-slavery haunting, Tokyo magical realism, near-future dystopia
- Styles: Morrison poetic intensity, Murakami deadpan surreal, Atwood sharp satire

**Non-Western Classics**:
- Personas: Márquez (magical realist), Rushdie (postcolonial), Adichie (dual perspective)
- Namespaces: Macondo mythical village, Midnight's Children partition, Nigerian diaspora
- Styles: Márquez matter-of-fact magic, Rushdie digressive energy, Adichie clear-eyed

**Contemporary Genre**:
- Personas: Sanderson (magic systems), Gaiman (mythic modern), Jemisin (world-breaking)
- Namespaces: Cosmere investiture, American Gods roadside, Broken Earth apocalypse
- Styles: Sanderson systematic, Gaiman folkloric, Jemisin second-person urgency

### Phase 4: Internet & Modern Media (10 new personas, 5 new namespaces, 5 new styles)

**Internet Native**:
- Personas: Substack essayist, Twitter thread master, YouTube video essayist
- Namespaces: Online discourse norms, Platform-specific etiquette, Algorithm optimization
- Styles: Newsletter personal, Thread incremental, Video essay voiceover

**Professional/Technical**:
- Personas: Academic researcher, Technical writer, Journalist investigative
- Namespaces: Peer review process, Documentation structure, Investigative sourcing
- Styles: Academic hedging, Technical precision, Journalistic inverted pyramid

---

## 🏗️ Implementation Plan

### 1. Source Attribution System

**Database Schema Update** (migration 0020):
```sql
ALTER TABLE npe_personas ADD COLUMN source_author TEXT;
ALTER TABLE npe_personas ADD COLUMN source_title TEXT;
ALTER TABLE npe_personas ADD COLUMN source_year INTEGER;
ALTER TABLE npe_personas ADD COLUMN source_url TEXT;  -- Project Gutenberg link

ALTER TABLE npe_namespaces ADD COLUMN source_author TEXT;
ALTER TABLE npe_namespaces ADD COLUMN source_title TEXT;
ALTER TABLE npe_namespaces ADD COLUMN source_year INTEGER;
ALTER TABLE npe_namespaces ADD COLUMN source_url TEXT;

ALTER TABLE npe_styles ADD COLUMN source_author TEXT;
ALTER TABLE npe_styles ADD COLUMN source_title TEXT;
ALTER TABLE npe_styles ADD COLUMN source_year INTEGER;
ALTER TABLE npe_styles ADD COLUMN source_url TEXT;
```

**Example Entry**:
```sql
INSERT INTO npe_personas (
  name, description, system_prompt,
  culture, era, tags, source_text, is_seed,
  source_author, source_title, source_year, source_url
) VALUES (
  'hemingway_sparse',
  'Minimalist voice using short sentences and concrete nouns',
  'You write with Hemingway''s spare precision...',
  'Western (American)',
  'Modernist',
  '["minimalist", "iceberg_theory", "journalistic", "understated"]',
  'The Sun Also Rises by Ernest Hemingway',
  1,
  'Ernest Hemingway',
  'The Sun Also Rises',
  1926,
  'https://www.gutenberg.org/ebooks/67138'
);
```

### 2. Frontend Display of Source

**Dropdown with source** (ToolsPanel.tsx):
```typescript
{personas.map((persona) => (
  <option key={persona.id} value={persona.name}>
    {formatName(persona.name)} - {persona.description}
    {persona.source_author && ` (${persona.source_author})`}
  </option>
))}
```

**Example dropdown text**:
```
Holmes Analytical - Cold logic and keen observation (Arthur Conan Doyle)
Hemingway Sparse - Minimalist voice using short sentences (Ernest Hemingway)
Woolf Interior - Stream of consciousness psychological depth (Virginia Woolf)
```

**Detailed info card** (on hover or in modal):
```typescript
<div className="attribute-info">
  <h3>{formatName(persona.name)}</h3>
  <p>{persona.description}</p>

  {persona.source_author && (
    <div className="source">
      <strong>Source:</strong> <em>{persona.source_title}</em> by {persona.source_author} ({persona.source_year})
      {persona.source_url && (
        <a href={persona.source_url} target="_blank">Read on Project Gutenberg →</a>
      )}
    </div>
  )}

  <div className="tags">
    {persona.tags.map(tag => <span className="tag">{tag}</span>)}
  </div>
</div>
```

### 3. Attribute Extraction Workflow

**Step 1: Text Selection** (2-3 hours per book)
- Choose canonical edition (Project Gutenberg preferred for free/legal)
- Identify 3-5 representative passages (500-1000 words each)
- Select passages showing distinct voice/style/universe

**Step 2: Analysis** (1 hour per attribute)
- Identify linguistic patterns (sentence structure, vocabulary, rhythm)
- Note thematic elements (worldview, values, recurring motifs)
- Document narrative techniques (POV, tense, dialogue style)

**Step 3: Prompt Engineering** (30 min per attribute)
- Write system prompt capturing voice/style/universe
- Test prompt with sample transformations
- Refine until output matches source quality

**Step 4: Metadata Entry** (15 min per attribute)
- Fill out all fields: name, description, prompt, culture, era, tags
- Add source attribution: author, title, year, URL
- Mark as `is_seed=1` for system attributes

**Step 5: Quality Control** (30 min per attribute)
- Run 3-5 test transformations on diverse input texts
- Score outputs on 25-point rubric (like Sprint 3 testing)
- Only add to library if average score ≥22/25

**Total Time per Attribute**: ~4-5 hours
**Target**: 65 new attributes = 260-325 hours = 6-8 weeks at 40 hours/week

**Optimization**: Batch similar authors (e.g., all Russian classics in one sprint)

### 4. Migration Strategy

**Create migrations in batches**:
- Migration 0020: Source attribution schema update
- Migration 0021: American Modernists (Hemingway, Fitzgerald, Faulkner, Steinbeck)
- Migration 0022: British Modernists (Woolf, Joyce, Orwell, Lawrence)
- Migration 0023: Russian Giants (Dostoevsky, Tolstoy, Chekhov, Turgenev)
- Migration 0024: European Masters (Kafka, Camus, Borges, Proust)
- Migration 0025: Science Fiction (Asimov, LeGuin, Gibson, Clarke)
- Migration 0026: Fantasy (Tolkien, Pratchett, Martin, Sanderson)
- Migration 0027: Mystery/Thriller (Christie, Chandler, King, Flynn)
- Migration 0028: Contemporary Literary (Morrison, Murakami, Atwood, DeLillo)
- Migration 0029: Non-Western Classics (Márquez, Rushdie, Adichie, Achebe)
- Migration 0030: Internet & Modern Media (Newsletter, Twitter, YouTube styles)

**Backfill existing attributes** (migration 0031):
```sql
UPDATE npe_personas SET
  source_author = 'Jane Austen',
  source_title = 'Pride and Prejudice',
  source_year = 1813,
  source_url = 'https://www.gutenberg.org/ebooks/1342'
WHERE name = 'austen_ironic_observer';

-- ... repeat for all 40 existing attributes
```

---

## 🎨 UI/UX Enhancements

### Browse Attributes by Author

**New page**: `/attributes/browse`

Organize by literary period:
- Classical & Medieval (Homer, Dante, Shakespeare)
- 18th-19th Century (Austen, Dickens, Melville, Poe)
- Modernist (Hemingway, Woolf, Joyce, Kafka)
- Contemporary (Morrison, Murakami, Atwood)
- Genre Fiction (Tolkien, Asimov, King)
- Internet Native (Reddit, Medium, Twitter)

Each period shows:
- Grid of author portraits
- Click to see all attributes from that author
- Tag filters: voice, universe, style, era, culture

### Attribute Detail Modal

When user clicks "ℹ️ Info" on an attribute:

```
┌─────────────────────────────────────────┐
│ Holmes Analytical                        │
│                                          │
│ Cold logic and keen observation;        │
│ sees what others miss                   │
│                                          │
│ Source                                   │
│ The Adventures of Sherlock Holmes       │
│ by Arthur Conan Doyle (1892)            │
│ [Read on Project Gutenberg →]           │
│                                          │
│ Tags                                     │
│ #analytical #deductive #logical          │
│ #observant #detective                    │
│                                          │
│ Culture: Western (English)               │
│ Era: Victorian                           │
│                                          │
│ [Try This Persona] [Preview Transform]  │
└─────────────────────────────────────────┘
```

### "Preview Transform" Feature

Before running full transformation:
- User selects attribute
- Clicks "Preview Transform"
- System transforms just first paragraph of canvas text
- Shows side-by-side comparison
- User can try multiple attributes before committing

This helps users **explore** the library and find perfect matches.

---

## 📚 Community Contributions (Post-Launch)

### User-Submitted Attributes

Allow users to:
1. Extract attributes from their favorite books
2. Submit for community review
3. Vote on quality (Reddit-style upvotes)
4. Curated team approves best submissions
5. Becomes official system attribute with source attribution

**Incentive**: Credit in UI ("Contributed by @username")

### Attribute Collections

Users can create and share:
- "19th Century British Women Writers" (Austen, Brontë, Eliot, Gaskell)
- "Cyberpunk Essentials" (Gibson, Stephenson, Sterling)
- "New York School" (DeLillo, Pynchon, Franzen)

Collections are shareable links, installable with one click.

---

## ⚖️ Legal Considerations

### Public Domain

**Safe** (no copyright concerns):
- Published before 1928 in US
- Project Gutenberg texts
- Authors: Austen, Dickens, Melville, Tolstoy, Dostoevsky, etc.

### Contemporary Authors

**Careful** (potential copyright on exact prompts):
- Modern authors still under copyright (Morrison, Atwood, Murakami)
- Attributes must be **transformative** and **educational**
- System prompts describe style, not copy exact sentences
- Fair use applies to literary analysis and education

**Best Practice**:
- Focus on linguistic patterns, not plot/character details
- Cite source book in attribution
- Link to legal editions (Amazon, library catalog)
- Avoid verbatim text in prompts

### Attribution Policy

All attributes include:
- Author name
- Book title
- Publication year
- Link to public domain version (if available) OR purchase link

This is **good faith attribution** and likely strengthens fair use defense.

---

## 📈 Success Metrics

### Quantitative

- **Library Size**: 55 attributes → 150+ attributes (173% growth)
- **Diversity Score**: Measure culture/era/genre representation
- **Usage**: Track which attributes are most popular
- **User Satisfaction**: Survey users on attribute quality

### Qualitative

- Users report finding "perfect match" for their style preferences
- Diverse global voices represented (not just Western canon)
- Genre fiction fans feel included (not just literary fiction)
- Contemporary voices present (not just classics)

---

## 🚀 Timeline

### Phase 1: Foundation (Week 5)
- Schema migration with source attribution
- Backfill existing 40 attributes with source data
- Update UI to display source in dropdowns
- Create attribute detail modal

### Phase 2: Classic Expansion (Week 6-7)
- Add 35 attributes from classic literature (Hemingway, Woolf, Dostoevsky, etc.)
- Create browse page organized by literary period
- Add preview transform feature

### Phase 3: Genre & Contemporary (Week 8-9)
- Add 40 attributes from genre fiction and contemporary voices
- Implement tag-based filtering
- Launch community contribution system

### Phase 4: Polish & Launch (Week 10)
- Quality control testing (all attributes score 22+/25)
- Write attribution documentation
- Blog post: "150 Literary Voices Now Available"
- Social media campaign highlighting diverse representation

---

## 💡 Future: AI-Assisted Extraction

**Long-term vision**: Build tool to semi-automate attribute extraction

1. User provides Project Gutenberg URL
2. System downloads full text
3. LLM analyzes linguistic patterns across 10k+ word sample
4. Generates draft persona/namespace/style prompts
5. User reviews and refines
6. System runs quality control tests
7. If passes (22+/25), adds to library with source attribution

This could enable **1000+ attributes** from community contributions, making Humanizer the most comprehensive literary transformation tool available.

---

## 📋 Checklist

**Before Starting**:
- [ ] Confirm fair use legal review for contemporary authors
- [ ] Design source attribution UI mockups
- [ ] Create attribute extraction workflow documentation
- [ ] Set up quality control rubric and testing pipeline

**Phase 1 (Foundation)**:
- [ ] Write migration 0020 (source attribution schema)
- [ ] Backfill 40 existing attributes with source data
- [ ] Update API to return source fields
- [ ] Update frontend dropdowns to show author names
- [ ] Create attribute detail modal component
- [ ] Deploy to production

**Phase 2 (Classic Expansion)**:
- [ ] Extract 10 personas from American Modernists
- [ ] Extract 10 personas from British Modernists
- [ ] Extract 10 personas from Russian Giants
- [ ] Extract 5 personas from European Masters
- [ ] Create corresponding namespaces (10 total)
- [ ] Create corresponding styles (5 total)
- [ ] Quality control test all new attributes
- [ ] Write migrations 0021-0024
- [ ] Deploy to production

**Phase 3 (Genre & Contemporary)**:
- [ ] Extract 15 personas from genre fiction
- [ ] Extract 20 personas from contemporary voices
- [ ] Create corresponding namespaces (15 total)
- [ ] Create corresponding styles (10 total)
- [ ] Quality control test all new attributes
- [ ] Write migrations 0025-0029
- [ ] Deploy to production

**Phase 4 (Community)**:
- [ ] Build user submission form
- [ ] Implement upvote/review system
- [ ] Create curation queue for team review
- [ ] Launch beta to PRO users
- [ ] Iterate based on feedback
- [ ] Open to all users

---

**END OF DOCUMENT**

**Next Review**: After Week 2 launch, revisit timeline and prioritize based on user feedback.
