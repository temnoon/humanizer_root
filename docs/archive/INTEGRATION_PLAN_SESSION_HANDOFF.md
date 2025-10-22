# Integration Plan & Session Handoff
## Narrative Objects + Business Systems Architecture

**Date**: October 12, 2025, 4:00 PM
**Status**: Ready for Code Generation
**Next Session**: Phase 1 Implementation Begins

---

## Executive Summary

This document integrates three critical architectural layers:

1. **Narrative Objects Architecture** (privacy-first, multi-avatar, learning loop)
2. **Business Systems** (usage tracking, billing, resource accounting)
3. **Current Codebase** (agent persistence, transformations, embeddings)

**Goal**: Begin Phase 1 implementation with full awareness of downstream business requirements.

---

## 1. Architecture Integration Map

### Narrative Objects ↔ Business Systems

```
┌───────────────────────────────────────────────────────────┐
│                  NARRATIVE OBJECTS                        │
│  (Privacy-first, multi-user, learning loop)               │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  User → Avatar(s) → Narrative Objects                     │
│                      ↓                                    │
│         [message, transformation, note, artifact]         │
│                      ↓                                    │
│              RESOURCE ACCOUNTING                          │
│  • Count transformations per user/month                   │
│  • Count tokens per transformation                        │
│  • Track API calls (embeddings, LLM)                      │
│  • Monitor storage usage                                  │
│                      ↓                                    │
│              USAGE TRACKING                               │
│  • Tier limits enforcement (Free/Premium/Enterprise)      │
│  • Rate limiting (10/100/1000 per hour)                   │
│  • Monthly quota resets                                   │
│  • Warning emails at 80%                                  │
│                      ↓                                    │
│              BILLING INTEGRATION                          │
│  • Stripe subscription management                         │
│  • Webhook handling (payment success/failure)             │
│  • Upgrade/downgrade flows                                │
│  • Invoice generation                                     │
│                      ↓                                    │
│              REVENUE & EXPENSE TRACKING                   │
│  • MRR/ARR analytics                                      │
│  • Per-user revenue                                       │
│  • API costs (Claude, embeddings)                         │
│  • Infrastructure costs (hosting, storage, email)         │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Key Integration Points

| Narrative Object Operation | Resource Accounting | Billing Implication |
|----------------------------|---------------------|---------------------|
| Create transformation | +1 transformation, +N tokens | Count toward monthly quota |
| Generate embedding | +1 embedding API call | Cost: $0.00013 per 1K tokens |
| Agent LLM call | +M tokens | Cost: $3/$15 per 1M tokens |
| Store object | +X bytes storage | Cost: $0.023 per GB-month |
| Share encrypted object | +Y bandwidth | Cost: $0.09 per GB transfer |

---

## 2. Database Schema Integration

### Extended User Model

```sql
-- Extends existing users table with business systems
ALTER TABLE users
    -- Billing (already in current schema)
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive',
    ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,

    -- Usage tracking (NEW)
    ADD COLUMN IF NOT EXISTS monthly_transformations INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_tokens_used INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_embeddings INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_agent_calls INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Resource usage (NEW)
    ADD COLUMN IF NOT EXISTS total_storage_bytes BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_bandwidth_bytes BIGINT DEFAULT 0;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(subscription_tier);
```

### Narrative Objects with Resource Tracking

```sql
-- Add resource tracking columns to narrative_objects
ALTER TABLE narrative_objects
    -- Resource metrics
    ADD COLUMN IF NOT EXISTS token_count INTEGER,
    ADD COLUMN IF NOT EXISTS storage_bytes INTEGER,
    ADD COLUMN IF NOT EXISTS processing_cost_usd DECIMAL(10, 6),

    -- Billing attribution
    ADD COLUMN IF NOT EXISTS counted_in_quota BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS quota_month VARCHAR(7);  -- YYYY-MM format

-- Index for quota queries
CREATE INDEX IF NOT EXISTS idx_narrative_objects_quota
    ON narrative_objects(owner_id, quota_month, counted_in_quota);
```

### Resource Tracking Table (NEW)

```sql
-- Detailed resource usage log for analytics
CREATE TABLE resource_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Attribution
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    avatar_id UUID REFERENCES avatars(id),
    object_id UUID REFERENCES narrative_objects(id) ON DELETE SET NULL,

    -- Resource type
    resource_type VARCHAR(50) NOT NULL,  -- 'transformation', 'embedding', 'llm_call', 'storage', 'bandwidth'

    -- Metrics
    quantity INTEGER,  -- e.g., token count, bytes
    cost_usd DECIMAL(10, 6),  -- Actual API/infra cost

    -- Provider
    provider VARCHAR(50),  -- 'anthropic', 'openai', 'cloudflare', etc.
    model VARCHAR(100),  -- 'claude-sonnet-4-5', 'mxbai-embed-large', etc.

    -- Context
    endpoint VARCHAR(200),
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_resource_usage_user_date (user_id, created_at),
    INDEX idx_resource_usage_type (resource_type),
    INDEX idx_resource_usage_month (DATE_TRUNC('month', created_at))
);
```

### Revenue & Expense Tables (NEW)

```sql
-- Subscription revenue tracking
CREATE TABLE subscription_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Billing
    stripe_subscription_id VARCHAR(100) UNIQUE,
    user_id UUID REFERENCES users(id),

    -- Revenue
    tier VARCHAR(20),
    amount_usd DECIMAL(10, 2),
    billing_period VARCHAR(20),  -- 'monthly', 'annual'

    -- Dates
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20),  -- 'active', 'canceled', 'past_due'

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Expense tracking
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Expense type
    category VARCHAR(50),  -- 'api_cost', 'infrastructure', 'email', 'monitoring', 'support', 'marketing'
    subcategory VARCHAR(50),  -- 'claude_api', 'r2_storage', 'sendgrid', etc.

    -- Amount
    amount_usd DECIMAL(10, 2),
    quantity INTEGER,  -- tokens, GB, emails sent
    unit_cost_usd DECIMAL(10, 6),

    -- Provider
    provider VARCHAR(100),
    invoice_id VARCHAR(100),

    -- Period
    expense_date DATE,
    period_start DATE,
    period_end DATE,

    -- Metadata
    description TEXT,
    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_expenses_date (expense_date),
    INDEX idx_expenses_category (category),
    INDEX idx_expenses_month (DATE_TRUNC('month', expense_date))
);
```

---

## 3. Tier Limits Configuration

### Integration with Narrative Objects

```python
# config/tier_limits.py

from enum import Enum
from dataclasses import dataclass

@dataclass
class TierLimits:
    """Usage limits for a subscription tier."""

    # Monthly quotas (from PRODUCTION_ROADMAP.md)
    max_transformations_per_month: int
    max_tokens_per_month: int
    max_embeddings_per_month: int
    max_agent_conversations: int

    # Storage limits (NEW for narrative objects)
    max_storage_gb: int
    max_objects: int
    max_shared_objects: int

    # Per-request limits
    max_tokens_per_request: int
    max_file_size_mb: int
    max_concurrent_jobs: int

    # Rate limits (per hour)
    rate_limit_per_hour: int

    # Features
    can_export_history: bool
    can_use_api: bool
    can_use_encryption: bool  # NEW
    can_have_multiple_avatars: bool  # NEW
    has_priority_support: bool

    # Moderation (NEW)
    moderation_strictness: str  # 'standard', 'relaxed' (premium), 'custom' (enterprise)

TIER_LIMITS = {
    "free": TierLimits(
        max_transformations_per_month=10,
        max_tokens_per_month=40_000,
        max_embeddings_per_month=100,
        max_agent_conversations=5,
        max_storage_gb=1,
        max_objects=100,
        max_shared_objects=10,
        max_tokens_per_request=4_000,
        max_file_size_mb=5,
        max_concurrent_jobs=1,
        rate_limit_per_hour=10,
        can_export_history=False,
        can_use_api=False,
        can_use_encryption=False,
        can_have_multiple_avatars=False,
        has_priority_support=False,
        moderation_strictness='standard'
    ),

    "premium": TierLimits(
        max_transformations_per_month=500,
        max_tokens_per_month=500_000,
        max_embeddings_per_month=10_000,
        max_agent_conversations=100,
        max_storage_gb=50,
        max_objects=10_000,
        max_shared_objects=1_000,
        max_tokens_per_request=32_000,
        max_file_size_mb=50,
        max_concurrent_jobs=5,
        rate_limit_per_hour=100,
        can_export_history=True,
        can_use_api=False,
        can_use_encryption=True,
        can_have_multiple_avatars=True,
        has_priority_support=True,
        moderation_strictness='relaxed'
    ),

    "enterprise": TierLimits(
        max_transformations_per_month=-1,  # Unlimited
        max_tokens_per_month=-1,
        max_embeddings_per_month=-1,
        max_agent_conversations=-1,
        max_storage_gb=500,
        max_objects=-1,
        max_shared_objects=-1,
        max_tokens_per_request=100_000,
        max_file_size_mb=200,
        max_concurrent_jobs=20,
        rate_limit_per_hour=1000,
        can_export_history=True,
        can_use_api=True,
        can_use_encryption=True,
        can_have_multiple_avatars=True,
        has_priority_support=True,
        moderation_strictness='custom'
    )
}
```

---

## 4. Resource Accounting Service (NEW)

```python
# services/resource_accounting.py

class ResourceAccountingService:
    """Track and log resource usage for billing."""

    @staticmethod
    async def log_transformation(
        user_id: UUID,
        object_id: UUID,
        token_count: int,
        model: str,
        db: AsyncSession
    ) -> None:
        """Log transformation resource usage."""

        # Calculate cost based on provider
        if model.startswith("claude"):
            # Claude Sonnet 4.5: $3 per 1M input tokens, $15 per 1M output
            # Estimate 20% output tokens
            input_tokens = int(token_count * 0.8)
            output_tokens = int(token_count * 0.2)
            cost = (input_tokens / 1_000_000 * 3) + (output_tokens / 1_000_000 * 15)
        elif model.startswith("mistral"):
            # Local Ollama: free
            cost = 0.0
        else:
            cost = 0.0

        # Log usage
        log = ResourceUsageLog(
            user_id=user_id,
            object_id=object_id,
            resource_type='transformation',
            quantity=token_count,
            cost_usd=cost,
            provider='anthropic' if 'claude' in model else 'ollama',
            model=model,
            endpoint='/api/transform',
            metadata={'token_count': token_count}
        )

        db.add(log)

        # Update user usage counters
        user = await db.get(User, user_id)
        user.monthly_transformations += 1
        user.monthly_tokens_used += token_count

        await db.commit()

    @staticmethod
    async def log_embedding(
        user_id: UUID,
        object_id: UUID,
        token_count: int,
        model: str,
        db: AsyncSession
    ) -> None:
        """Log embedding generation."""

        # mxbai-embed-large: Local, free
        # OpenAI text-embedding-3: $0.00013 per 1K tokens
        cost = (token_count / 1000 * 0.00013) if 'openai' in model else 0.0

        log = ResourceUsageLog(
            user_id=user_id,
            object_id=object_id,
            resource_type='embedding',
            quantity=token_count,
            cost_usd=cost,
            provider='local' if 'mxbai' in model else 'openai',
            model=model,
            endpoint='/api/embed',
            metadata={'token_count': token_count}
        )

        db.add(log)

        user = await db.get(User, user_id)
        user.monthly_embeddings += 1

        await db.commit()

    @staticmethod
    async def get_monthly_costs(
        user_id: UUID,
        month: str,  # YYYY-MM format
        db: AsyncSession
    ) -> dict:
        """Get detailed cost breakdown for a user/month."""

        # Query resource usage logs
        stmt = select(
            ResourceUsageLog.resource_type,
            func.count(ResourceUsageLog.id).label('count'),
            func.sum(ResourceUsageLog.quantity).label('total_quantity'),
            func.sum(ResourceUsageLog.cost_usd).label('total_cost')
        ).where(
            ResourceUsageLog.user_id == user_id,
            func.date_trunc('month', ResourceUsageLog.created_at) == month
        ).group_by(ResourceUsageLog.resource_type)

        result = await db.execute(stmt)
        usage = result.all()

        return {
            'month': month,
            'breakdown': [
                {
                    'resource_type': row.resource_type,
                    'count': row.count,
                    'quantity': row.total_quantity,
                    'cost_usd': float(row.total_cost or 0)
                }
                for row in usage
            ],
            'total_cost_usd': sum(float(row.total_cost or 0) for row in usage)
        }
```

---

## 5. Expense Tracking Service (NEW)

```python
# services/expense_tracking.py

class ExpenseTrackingService:
    """Track platform operating expenses."""

    @staticmethod
    async def log_monthly_expense(
        category: str,
        subcategory: str,
        amount_usd: float,
        provider: str,
        period_start: date,
        period_end: date,
        metadata: dict,
        db: AsyncSession
    ) -> None:
        """Log a monthly expense."""

        expense = Expense(
            category=category,
            subcategory=subcategory,
            amount_usd=amount_usd,
            provider=provider,
            expense_date=period_end,
            period_start=period_start,
            period_end=period_end,
            metadata=metadata
        )

        db.add(expense)
        await db.commit()

    @staticmethod
    async def import_stripe_invoice(
        invoice_id: str,
        db: AsyncSession
    ) -> None:
        """Import expense from Stripe invoice (for API usage)."""
        # Fetch from Stripe API
        # Parse line items
        # Log as expenses
        pass

    @staticmethod
    async def get_expense_summary(
        start_date: date,
        end_date: date,
        db: AsyncSession
    ) -> dict:
        """Get expense summary for date range."""

        stmt = select(
            Expense.category,
            func.sum(Expense.amount_usd).label('total')
        ).where(
            Expense.expense_date.between(start_date, end_date)
        ).group_by(Expense.category)

        result = await db.execute(stmt)
        expenses = result.all()

        return {
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'breakdown': [
                {'category': row.category, 'amount_usd': float(row.total)}
                for row in expenses
            ],
            'total_usd': sum(float(row.total) for row in expenses)
        }

    @staticmethod
    async def calculate_profit_margin(
        month: str,  # YYYY-MM
        db: AsyncSession
    ) -> dict:
        """Calculate profit margin for a month."""

        # Get revenue
        stmt = select(
            func.sum(SubscriptionRevenue.amount_usd)
        ).where(
            func.date_trunc('month', SubscriptionRevenue.period_start) == month,
            SubscriptionRevenue.status == 'active'
        )
        result = await db.execute(stmt)
        revenue = float(result.scalar() or 0)

        # Get expenses
        start_date = datetime.strptime(month, '%Y-%m').date()
        end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        expenses_data = await ExpenseTrackingService.get_expense_summary(
            start_date, end_date, db
        )
        expenses = expenses_data['total_usd']

        # Calculate
        profit = revenue - expenses
        margin = (profit / revenue * 100) if revenue > 0 else 0

        return {
            'month': month,
            'revenue_usd': revenue,
            'expenses_usd': expenses,
            'profit_usd': profit,
            'profit_margin_percent': margin
        }
```

---

## 6. Phased Implementation Plan

### Phase 1: Foundation (Weeks 1-4) - START HERE

**Focus**: Multi-user auth, avatars, narrative objects base

**Business Systems Integrated**:
- ✅ User authentication (JWT)
- ✅ Basic user model with billing references
- ✅ Usage tracking placeholders (columns created, not enforced)

**Deliverables**:
1. User registration & login
2. Avatar system (1 avatar per user initially)
3. Narrative objects table (polymorphic base)
4. Basic CRUD API

**Code Generation Tasks**:
1. Extend current User model with billing columns
2. Create Avatar model & CRUD
3. Create NarrativeObject base model
4. Update agent_conversations to inherit from NarrativeObject
5. Update transformations to inherit from NarrativeObject
6. Create API routes for objects

**Complexity**: Medium (builds on existing code)

---

### Phase 2: Privacy & Encryption (Weeks 5-8)

**Focus**: Encryption, sharing, billing separation

**Business Systems Integrated**:
- ⏳ Stripe billing integration (basic)
- ⏳ Usage tracking (display only, not enforced)

**Deliverables**:
1. Client-side encryption
2. Sharing permissions
3. Billing microservice (stub)
4. Subscription status display

**Deferred**:
- Full billing enforcement (Phase 4)
- Usage limits (Phase 4)

---

### Phase 3: Moderation & Safety (Weeks 9-10)

**Focus**: Agent moderation, content safety

**Business Systems Integrated**:
- ⏳ Resource accounting (log moderation API calls)

**Deliverables**:
1. Moderation agent
2. Content safety checks
3. Appeals process

---

### Phase 4: Business Systems (Weeks 11-14) - FULL INTEGRATION

**Focus**: Usage limits, billing enforcement, analytics

**Business Systems Integrated**:
- ✅ Usage tracking & enforcement (tier limits)
- ✅ Rate limiting (tier-based)
- ✅ Stripe webhooks (payment success/failure)
- ✅ Resource accounting (detailed logs)
- ✅ Monthly quota resets

**Deliverables**:
1. Usage enforcement service
2. Rate limiting middleware
3. Billing webhook handlers
4. Resource accounting logs
5. Admin dashboard (revenue, expenses, metrics)

---

### Phase 5: Feature Parity Loop (Weeks 15-16)

**Focus**: AUI/GUI/API/CLI learning system

**Business Systems Integrated**:
- ✅ Track which features users request most
- ✅ Log API endpoints with no GUI
- ✅ Measure feature adoption

**Deliverables**:
1. Feature registry
2. Capability analyzer
3. GUI suggestion system
4. CLI auto-generation

---

## 7. Metrics & Analytics

### Key Business Metrics to Track

**Revenue**:
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- ARPU (Average Revenue Per User)
- Churn rate
- Upgrade rate (free → premium)

**Usage**:
- Transformations per user per month
- Tokens per user per month
- Agent conversations per user
- API calls per endpoint
- Storage usage per user

**Costs**:
- Claude API costs (per user, per month)
- Embedding costs (per user, per month)
- Infrastructure costs (fixed monthly)
- Support costs (per ticket)

**Product**:
- DAU/MAU (Daily/Monthly Active Users)
- Feature adoption rate
- NPS (Net Promoter Score)
- Support ticket volume

### Dashboard Views (Phase 4+)

**Admin Dashboard**:
- Real-time MRR/ARR
- User growth (signups, conversions, churn)
- Cost breakdown (API, infra, support)
- Profit margin per tier
- Top users by usage
- Feature adoption heatmap

**User Dashboard**:
- Monthly usage (transformations, tokens, storage)
- Cost per operation (if enterprise tier)
- Quota remaining
- Upgrade prompts (if approaching limit)

---

## 8. Open Questions for Next Session

1. **Billing Separation Timing**: Implement in Phase 2 or defer to Phase 4?
   - **Recommendation**: Stub in Phase 2, full implementation Phase 4

2. **Encryption Default**: All objects encrypted by default or user opt-in?
   - **Recommendation**: User opt-in (Phase 2), default for premium (Phase 4)

3. **Free Tier Storage**: 1GB sufficient or too restrictive?
   - **Recommendation**: 1GB for MVP, monitor usage, adjust if needed

4. **Resource Accounting Granularity**: Log every API call or batch daily?
   - **Recommendation**: Real-time logging, async batch insertion (performance)

5. **Expense Import**: Manual CSV upload or auto-import from providers?
   - **Recommendation**: Manual Phase 4, auto-import Phase 5+

---

## 9. Code Generation Checklist (Phase 1)

### Session 1: User & Avatar Models
- [ ] Extend `User` model with billing columns
- [ ] Create `Avatar` model
- [ ] Add avatar CRUD API endpoints
- [ ] Update authentication to support avatars
- [ ] Migration script for new columns

### Session 2: Narrative Objects Base
- [ ] Create `NarrativeObject` base model
- [ ] Refactor `AgentConversation` to inherit
- [ ] Refactor `Transformation` to inherit
- [ ] Update API endpoints to use new schema
- [ ] Test polymorphic queries

### Session 3: Resource Tracking Infrastructure
- [ ] Create `ResourceUsageLog` table
- [ ] Create `SubscriptionRevenue` table (stub)
- [ ] Create `Expense` table
- [ ] Add usage tracking columns to User
- [ ] Create ResourceAccountingService (basic)

### Session 4: Integration Testing
- [ ] Test multi-user authentication
- [ ] Test avatar switching
- [ ] Test object ownership
- [ ] Test resource logging
- [ ] End-to-end transformation with tracking

---

## 10. Dependencies & Prerequisites

### Before Starting Phase 1:

1. **Environment Setup**:
   - PostgreSQL 16 with pgvector ✅ (already set up)
   - Python 3.11+ with Poetry ✅ (already set up)
   - Ollama with mistral:7b ✅ (already set up)

2. **Existing Systems to Preserve**:
   - Agent conversations (5 endpoints) ✅
   - Transformations (6 endpoints) ✅
   - Embeddings (47,698 embedded) ✅
   - TRM & Personification ✅

3. **New Dependencies to Add**:
   - `stripe` (Python SDK)
   - `slowapi` (rate limiting)
   - `python-jose` (JWT tokens)
   - `passlib[bcrypt]` (password hashing)
   - `cryptography` (client-side encryption support)

4. **Configuration**:
   - `STRIPE_SECRET_KEY` (environment variable)
   - `STRIPE_WEBHOOK_SECRET` (environment variable)
   - `JWT_SECRET_KEY` (generate secure random)
   - `ENCRYPTION_KEY` (for database-level encryption)

---

## 11. Migration Strategy

### Migrating Existing Data

**Current State**:
- 4 agent conversations (no user_id)
- 4 transformations (no user_id)
- 1,685 ChatGPT conversations (no user_id)

**Migration Plan**:

```sql
-- Step 1: Create default user
INSERT INTO users (id, email, is_anonymous, subscription_tier)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default@humanizer.local',
    true,
    'enterprise'  -- Give unlimited access
);

-- Step 2: Create default avatar
INSERT INTO avatars (id, user_id, display_name, is_primary)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Default Avatar',
    true
);

-- Step 3: Migrate existing conversations
UPDATE agent_conversations
SET
    owner_id = '00000000-0000-0000-0000-000000000001',
    avatar_id = '00000000-0000-0000-0000-000000000002'
WHERE owner_id IS NULL;

-- Step 4: Migrate existing transformations
UPDATE transformations
SET
    owner_id = '00000000-0000-0000-0000-000000000001',
    avatar_id = '00000000-0000-0000-0000-000000000002'
WHERE owner_id IS NULL;

-- Step 5: Migrate ChatGPT conversations
UPDATE chatgpt_conversations
SET owner_id = '00000000-0000-0000-0000-000000000001'
WHERE owner_id IS NULL;
```

---

## 12. Success Criteria

### Phase 1 Complete When:
- [ ] Multiple users can register & log in
- [ ] Each user can create avatars
- [ ] Objects are properly isolated by user
- [ ] Basic resource logging works
- [ ] All existing features still work

### Business Systems Complete When (Phase 4):
- [ ] Usage limits enforced by tier
- [ ] Stripe billing fully integrated
- [ ] Resource accounting logs all operations
- [ ] Admin dashboard shows revenue/expenses
- [ ] Monthly quota resets work
- [ ] Upgrade/downgrade flows work

---

## 13. Next Actions

**For Next Session (Code Generation Begins)**:

1. **Confirm Priorities**:
   - Start with Phase 1 (multi-user + avatars)?
   - Or prioritize billing (Phase 4 first)?

2. **Choose Starting Point**:
   - Option A: Extend User model → Create Avatar model → Refactor objects
   - Option B: Create billing infrastructure → Add usage tracking → Then multi-user

3. **Set Scope**:
   - Complete Phase 1 in next session (4-6 hours)?
   - Or break into smaller increments?

**My Recommendation**: Start with Phase 1, Option A. Build foundation (auth + avatars + objects) before adding business complexity (billing + usage tracking).

---

## Conclusion

This integration plan provides:

✅ **Full awareness** of business systems requirements
✅ **Phased approach** that doesn't require building everything at once
✅ **Clear integration points** between narrative objects and billing
✅ **Migration strategy** for existing data
✅ **Success criteria** for each phase

**Ready to begin code generation on Phase 1** with full context of downstream requirements.

---

**Status**: ✅ Architecture integrated and documented
**Next**: Begin Phase 1 implementation (multi-user auth, avatars, narrative objects)
