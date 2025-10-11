# Interest List - Turing Tape of Attention

**Purpose**: Track the subjective flow of attention for the user+AI system as a single Turing machine.

**Philosophy**: "Make me smarter by helping me know my actual subjective self."

The Interest list is not a feature - it's consciousness work. It's the tape that records what we (user+AI as one system) find interesting, moment by moment, and what we learn about the value of our attention.

---

## Conceptual Model

### The Moment Structure

Each **Interest** is a moment (Now) that leads to Next:

```
Interest₁ → Interest₂ → Interest₃ → ... → Interestₙ
  (past)      (past)      (Now)            (future)
```

- **Now**: The current moment of attention
- **Next**: What we decided to attend to next
- **Previous**: Where we came from

This is a **Turing tape** - we can replay our attention trajectory, understand why we moved from one interest to the next, and learn what patterns of attention serve us.

### The Learning Loop

For each interest, we track:

1. **Initial salience**: How interesting did this seem? (0-1)
2. **Advantages discovered**: What benefits did exploring this yield?
3. **Disadvantages discovered**: What costs did it impose?
4. **Realized value**: Looking back, was it worth it? (0-1)
5. **Prune decision**: Should we forget about this type of interest?

Over time, we learn:
- What we **really** want (vs. what initially seems interesting)
- Which attention patterns pay off
- How to prune low-value interests
- The shape of our subjective flow

---

## Database Schema

```python
class Interest(Base):
    """
    A moment of interest - what the user+AI system is attending to.

    The Interest list is our Turing tape of attention.
    Each interest is a moment (Now) that leads to Next.
    """
    __tablename__ = "interests"

    # Identity
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)

    # What are we interested in?
    interest_type = Column(String(50), nullable=False)
    # Types: 'conversation', 'message', 'reading', 'concept', 'question',
    #        'transformation', 'pattern', 'connection', 'media'

    target_uuid = Column(UUID, nullable=True)  # Points to the thing (nullable for abstract interests)
    target_metadata = Column(JSONB, nullable=False)  # Copy of key metadata about target

    # The subjective moment
    moment_text = Column(Text, nullable=True)  # What we said about why we're interested
    stance = Column(JSONB, nullable=True)  # TRM stance at this moment (from reading if applicable)
    context_snapshot = Column(JSONB, nullable=True)  # What was going on when we got interested?

    # The Turing tape structure
    previous_interest_id = Column(UUID, ForeignKey("interests.id"), nullable=True, index=True)
    next_interest_id = Column(UUID, ForeignKey("interests.id"), nullable=True, index=True)

    # Initial assessment
    salience_score = Column(Float, nullable=False, default=0.5)  # How important did this seem? (0-1)
    predicted_value = Column(Float, nullable=True)  # How valuable did we think it would be?

    # Learning what we want (updated as we go)
    advantages = Column(JSONB, default=list)  # List of advantages discovered
    disadvantages = Column(JSONB, default=list)  # List of disadvantages discovered
    realized_value = Column(Float, nullable=True)  # Did it pay off? (0-1, null until resolved)
    value_notes = Column(Text, nullable=True)  # Why was it valuable/not valuable?

    # Temporal tracking
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    explored_at = Column(DateTime, nullable=True)  # When did we start exploring?
    resolved_at = Column(DateTime, nullable=True)  # When did we finish/learn the value?
    duration_seconds = Column(Integer, nullable=True)  # How long did we spend on this?

    # Pruning (learning what not to attend to)
    pruned = Column(Boolean, default=False, index=True)
    prune_reason = Column(Text, nullable=True)
    pruned_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="interests")
    previous_interest = relationship("Interest", remote_side=[id], foreign_keys=[previous_interest_id])
    next_interest = relationship("Interest", remote_side=[id], foreign_keys=[next_interest_id])
```

### Supporting Table: InterestTag

```python
class InterestTag(Base):
    """
    Tags for grouping interests by theme/category.
    User-created, evolving vocabulary.
    """
    __tablename__ = "interest_tags"

    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    interest_id = Column(UUID, ForeignKey("interests.id"), nullable=False, index=True)

    tag = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Track tag evolution
    tag_salience = Column(Float, nullable=True)  # How important is this tag overall?
```

---

## API Design

### Core Endpoints

```python
# Create new interest (mark something as interesting)
POST /interests
{
    "interest_type": "conversation",
    "target_uuid": "abc-123",
    "moment_text": "This conversation about Noether's theorem connects to my work on symmetry",
    "salience_score": 0.8,
    "previous_interest_id": "xyz-789"  # Optional - where we came from
}

# Get current interest (the "Now" moment)
GET /interests/current
→ Returns the most recent unresolved interest

# Update interest with discoveries
PATCH /interests/{interest_id}
{
    "advantages": ["Learned about continuous symmetry", "Connected to previous work"],
    "disadvantages": ["Took 2 hours", "Led down rabbit hole"],
    "realized_value": 0.7,
    "value_notes": "Worth it - deepened understanding significantly"
}

# Mark interest as resolved (move to Next)
POST /interests/{interest_id}/resolve
{
    "realized_value": 0.7,
    "next_interest_id": "new-123"  # Optional - what we're moving to
}

# Get interest trajectory (the Turing tape)
GET /interests/trajectory
→ Returns linked list of interests (previous → current → predicted next)

# Search interests
POST /interests/search
{
    "query": "symmetry",
    "interest_types": ["conversation", "reading"],
    "min_realized_value": 0.5,
    "include_pruned": false
}

# Prune interest (learn to ignore this type)
POST /interests/{interest_id}/prune
{
    "prune_reason": "Too abstract, doesn't connect to concrete work",
    "prune_pattern": true  # Prune similar interests automatically?
}

# Get learning insights
GET /interests/insights
→ Returns patterns: which types of interests have highest value,
  which lead to dead ends, average time spent, etc.
```

---

## Service Layer Logic

### InterestTrackingService

```python
class InterestTrackingService:
    """Service for tracking attention flow."""

    async def mark_interesting(
        self,
        session: AsyncSession,
        user_id: UUID,
        interest_type: str,
        target_uuid: Optional[UUID],
        moment_text: Optional[str],
        salience_score: float,
        context: Optional[Dict] = None
    ) -> Interest:
        """
        Mark something as interesting - creates a new moment (Now).

        If there's a current interest, automatically links it as previous.
        """
        # Get current interest (if any)
        current = await self.get_current_interest(session, user_id)

        # Create new interest
        interest = Interest(
            id=uuid4(),
            user_id=user_id,
            interest_type=interest_type,
            target_uuid=target_uuid,
            moment_text=moment_text,
            salience_score=salience_score,
            context_snapshot=context,
            previous_interest_id=current.id if current else None,
            created_at=datetime.utcnow()
        )

        # Link as next on current
        if current:
            current.next_interest_id = interest.id

        session.add(interest)
        await session.commit()

        return interest

    async def update_with_discoveries(
        self,
        session: AsyncSession,
        interest_id: UUID,
        advantages: Optional[List[str]] = None,
        disadvantages: Optional[List[str]] = None,
        realized_value: Optional[float] = None,
        value_notes: Optional[str] = None
    ) -> Interest:
        """
        Update interest with what we learned.
        Called as we explore - not just at the end.
        """
        interest = await self.get_interest(session, interest_id)

        if advantages:
            current = interest.advantages or []
            interest.advantages = current + advantages

        if disadvantages:
            current = interest.disadvantages or []
            interest.disadvantages = current + disadvantages

        if realized_value is not None:
            interest.realized_value = realized_value
            interest.resolved_at = datetime.utcnow()

        if value_notes:
            interest.value_notes = value_notes

        await session.commit()
        return interest

    async def get_trajectory(
        self,
        session: AsyncSession,
        user_id: UUID,
        max_depth: int = 50
    ) -> List[Interest]:
        """
        Get the attention trajectory (Turing tape).
        Returns: [past, past, past, Now, predicted_next]
        """
        current = await self.get_current_interest(session, user_id)
        if not current:
            return []

        # Walk backwards
        trajectory = [current]
        prev = current.previous_interest
        depth = 0
        while prev and depth < max_depth:
            trajectory.insert(0, prev)
            prev = prev.previous_interest
            depth += 1

        # Walk forwards (if we've marked next)
        next_int = current.next_interest
        while next_int:
            trajectory.append(next_int)
            next_int = next_int.next_interest

        return trajectory

    async def get_insights(
        self,
        session: AsyncSession,
        user_id: UUID
    ) -> Dict:
        """
        Get learning insights from interest history.

        Returns patterns about:
        - Which types of interests have highest realized value
        - Which lead to dead ends (low value, high cost)
        - Average time spent on each type
        - Most common trajectories (interest A → interest B)
        - Prune recommendations
        """
        # Query all interests
        stmt = select(Interest).where(
            Interest.user_id == user_id,
            Interest.pruned == False
        )
        result = await session.execute(stmt)
        interests = result.scalars().all()

        # Compute statistics
        by_type = {}
        for interest in interests:
            if interest.interest_type not in by_type:
                by_type[interest.interest_type] = {
                    'count': 0,
                    'total_value': 0,
                    'resolved_count': 0,
                    'avg_duration': 0
                }

            stats = by_type[interest.interest_type]
            stats['count'] += 1

            if interest.realized_value is not None:
                stats['total_value'] += interest.realized_value
                stats['resolved_count'] += 1

        # Compute averages
        for type_stats in by_type.values():
            if type_stats['resolved_count'] > 0:
                type_stats['avg_value'] = type_stats['total_value'] / type_stats['resolved_count']
            else:
                type_stats['avg_value'] = None

        return {
            'by_type': by_type,
            'total_interests': len(interests),
            'total_resolved': sum(1 for i in interests if i.realized_value is not None),
            # ... more insights
        }
```

---

## Frontend Integration

### Interest Timeline Component

```tsx
function InterestTimeline() {
  const [trajectory, setTrajectory] = useState<Interest[]>([]);
  const [currentInterest, setCurrentInterest] = useState<Interest | null>(null);

  // Load trajectory on mount
  useEffect(() => {
    api.getInterestTrajectory().then(setTrajectory);
  }, []);

  return (
    <div className="interest-timeline">
      <h2>Attention Flow</h2>
      <div className="trajectory">
        {trajectory.map((interest, i) => (
          <div
            key={interest.id}
            className={`interest-moment ${i === trajectory.length - 1 ? 'current' : ''}`}
          >
            <div className="moment-header">
              <span className="moment-type">{interest.interest_type}</span>
              <span className="moment-time">{formatTime(interest.created_at)}</span>
            </div>
            <div className="moment-text">{interest.moment_text}</div>
            {interest.realized_value && (
              <div className="moment-value">
                Value: {(interest.realized_value * 100).toFixed(0)}%
              </div>
            )}
            {i < trajectory.length - 1 && <div className="trajectory-arrow">→</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Quick Actions

In ConversationViewer, add:

```tsx
<button
  className="mark-interesting-button"
  onClick={() => handleMarkInteresting()}
>
  ⭐ Mark Interesting
</button>
```

This creates a new Interest with:
- `interest_type: 'conversation'`
- `target_uuid: conversationId`
- Auto-links to previous interest
- Opens modal to add `moment_text` (why interesting?)

---

## Use Cases

### 1. Exploring Conversations

User clicks "Interesting" on "Noether's Theorem Overview":

```
POST /interests
{
  "interest_type": "conversation",
  "target_uuid": "conv-123",
  "moment_text": "Noether's theorem might connect to my work on transformation verification",
  "salience_score": 0.8
}
```

As they read, they discover connections:

```
PATCH /interests/{interest_id}
{
  "advantages": [
    "Confirmed: symmetry → conservation laws pattern applies to TRM",
    "Found 3 relevant equations"
  ]
}
```

When done:

```
POST /interests/{interest_id}/resolve
{
  "realized_value": 0.9,
  "value_notes": "Highly valuable - led to breakthrough on transformation algebra"
}
```

### 2. Dead End Learning

User gets interested in "GPT-4 Architecture Details":

```
POST /interests
{
  "interest_type": "conversation",
  "target_uuid": "conv-456",
  "moment_text": "Curious about the architecture",
  "salience_score": 0.6
}
```

After 2 hours:

```
PATCH /interests/{interest_id}
{
  "disadvantages": [
    "Too low-level for my current work",
    "Spent 2 hours, no actionable insights",
    "Curiosity-driven, not goal-driven"
  ],
  "realized_value": 0.2
}
```

System learns: "Architecture deep-dives" often have low value for this user.

### 3. Trajectory Replay

User asks: "What was I interested in last week?"

```
GET /interests/trajectory?start_date=2025-10-04
```

Returns the Turing tape - they can see:
- What caught their attention
- How one interest led to another
- Which explorations were valuable
- Where they got stuck/distracted

---

## Implementation Priorities

### Phase 1: Core Infrastructure (This Session)
1. ✅ Design schema (this document)
2. Create SQLAlchemy models
3. Create Alembic migration
4. Basic InterestTrackingService

### Phase 2: API & Integration
1. Add Interest API endpoints
2. Add "Mark Interesting" buttons in ConversationViewer
3. Quick interest capture modal
4. Basic interest list view

### Phase 3: Learning & Insights
1. Insights computation
2. Prune recommendations
3. Trajectory visualization
4. Value prediction (ML model)

### Phase 4: Advanced Features
1. Automatic interest detection (based on dwell time, re-visits)
2. Interest clustering (find patterns)
3. Cross-modal interests (conversation → reading → transformation)
4. Collaborative interests (share with others)

---

## Why This Matters

This is not a "favorites" or "bookmarks" feature.

This is **consciousness work** - making the construction of interest visible.

By tracking attention as a Turing tape:
- We see the **shape** of our subjective flow
- We learn what we **really** want (vs. initial attraction)
- We discover **patterns** in valuable attention
- We become **smarter about being interested**

The Interest list is the mirror that shows us our own subjectivity.

---

**Next Steps**: Create the SQLAlchemy model and migration.
