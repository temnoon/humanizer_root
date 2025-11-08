# Transformation History & Mobile UX - Implementation Plan

**Created**: November 8, 2025
**Status**: Phase 1 Complete (Database + API Routes)
**Remaining**: Phases 2-4 (Integration, Frontend, Mobile UX)

## Overview

This feature adds transformation persistence, history management, and mobile-friendly UX improvements including:
1. Save all transformations to database
2. View/manage transformation history
3. Copy buttons on all fields
4. Wake Lock API to prevent phone sleep
5. Status polling for incomplete transformations

## ✅ Phase 1: Database & Backend API (COMPLETE)

### Completed
- ✅ Migration 0009: `transformation_history` table with indexes
- ✅ API routes: `/transformation-history` (CRUD + favorites)
- ✅ Helper utilities for saving/updating transformations
- ✅ Tier-based storage quotas (FREE: 10, MEMBER: 50, PRO: 200, PREMIUM/ADMIN: unlimited)

### Files Created
- `workers/npe-api/migrations/0009_transformation_history.sql`
- `workers/npe-api/src/routes/transformation-history.ts` (270 lines)
- `workers/npe-api/src/utils/transformation-history-helper.ts` (125 lines)
- `workers/npe-api/src/index.ts` (updated with route registration)

## 📋 Phase 2: Transformation Route Integration (TODO)

### What to Do
Update each transformation route to save to history:

1. **Allegorical** (`routes/transformations/allegorical.ts`):
   ```typescript
   import { saveTransformationToHistory, updateTransformationHistory } from '../utils/transformation-history-helper';

   // Before transformation starts:
   await saveTransformationToHistory(c.env.DB, {
     id: transformationId,
     user_id: auth.userId,
     transformation_type: 'allegorical',
     input_text: text,
     input_params: { persona, namespace, style, model, length_preference }
   });

   // After transformation completes:
   await updateTransformationHistory(c.env.DB, {
     id: transformationId,
     user_id: auth.userId,
     status: 'completed',
     output_data: result
   });

   // On error:
   await updateTransformationHistory(c.env.DB, {
     id: transformationId,
     user_id: auth.userId,
     status: 'failed',
     error_message: error.message
   });
   ```

2. **Round-Trip** (`routes/transformations/round-trip.ts`): Same pattern
3. **Maieutic** (`routes/transformations/maieutic.ts`): Same pattern
4. **AI Detection** (`routes/ai-detection.ts`): Same pattern

### Estimated Time
- 2-3 hours to update all 4 transformation routes
- Testing: 1 hour

## 📋 Phase 3: Frontend UI (TODO)

### 3.1 Copy Buttons Component

Create reusable `CopyButton.tsx`:
```typescript
interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: 'icon' | 'text' | 'both';
}

export function CopyButton({ text, label = 'Copy', variant = 'both' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="copy-button">
      {copied ? '✓ Copied!' : `📋 ${label}`}
    </button>
  );
}
```

**Add to Every Field**:
- All input textareas (allegorical, round-trip, maieutic, quantum)
- All output areas
- AI Detector input/output
- Position: Top-right corner (sticky or absolute)

### 3.2 Wake Lock API

Add to transformation forms:
```typescript
import { useState, useEffect, useRef } from 'react';

function useWakeLock(isActive: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!isActive || !('wakeLock' in navigator)) return;

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[Wake Lock] Screen kept awake');
      } catch (err) {
        console.error('[Wake Lock] Failed:', err);
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        console.log('[Wake Lock] Released');
      }
    };
  }, [isActive]);
}

// Usage in AlllegoricalPanel:
const [isTransforming, setIsTransforming] = useState(false);
useWakeLock(isTransforming);
```

### 3.3 Transformation History Panel

Create `TransformationHistory.tsx`:
```typescript
export function TransformationHistory() {
  const [transformations, setTransformations] = useState([]);
  const [filter, setFilter] = useState({ type: 'all', status: 'all' });

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadHistory = async () => {
    const response = await cloudAPI.getTransformationHistory(filter);
    setTransformations(response.transformations);
  };

  return (
    <div className="transformation-history">
      <h2>Transformation History</h2>

      {/* Filters */}
      <div className="filters">
        <select onChange={(e) => setFilter({...filter, type: e.target.value})}>
          <option value="all">All Types</option>
          <option value="allegorical">Allegorical</option>
          <option value="round-trip">Round-Trip</option>
          <option value="maieutic">Maieutic</option>
          <option value="ai-detection">AI Detection</option>
        </select>
      </div>

      {/* List */}
      <div className="history-list">
        {transformations.map(t => (
          <TransformationCard
            key={t.id}
            transformation={t}
            onLoadInput={(text) => /* Load into current form */}
            onLoadOutput={(data) => /* Load result */}
            onDelete={loadHistory}
          />
        ))}
      </div>
    </div>
  );
}
```

### 3.4 Status Polling

Add to transformation forms:
```typescript
const pollTransformationStatus = async (id: string) => {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    const status = await cloudAPI.getTransformationStatus(id);

    if (status.status === 'completed') {
      setResult(status.output_data);
      clearInterval(interval);
    } else if (status.status === 'failed' || attempts >= maxAttempts) {
      setError(status.error_message || 'Transformation timed out');
      clearInterval(interval);
    }
  }, 5000); // Poll every 5 seconds
};
```

### Estimated Time
- CopyButton component: 1 hour
- Wake Lock integration: 1 hour
- History panel: 4-5 hours
- Status polling: 2 hours
- **Total: 8-9 hours**

## 📋 Phase 4: Cloud API Client (TODO)

Add methods to `cloud-frontend/src/lib/cloud-api-client.ts`:

```typescript
// Transformation History
async getTransformationHistory(params: { type?: string; status?: string; limit?: number; offset?: number }): Promise<any> {
  const query = new URLSearchParams(params as any).toString();
  return this.fetch(`/transformation-history?${query}`, { method: 'GET' });
}

async getTransformation(id: string): Promise<any> {
  return this.fetch(`/transformation-history/${id}`, { method: 'GET' });
}

async deleteTransformation(id: string): Promise<any> {
  return this.fetch(`/transformation-history/${id}`, { method: 'DELETE' });
}

async toggleFavorite(id: string): Promise<any> {
  return this.fetch(`/transformation-history/${id}/favorite`, { method: 'POST' });
}

async getTransformationStatus(id: string): Promise<any> {
  return this.fetch(`/transformation-history/${id}`, { method: 'GET' });
}
```

### Estimated Time
- 30 minutes

## 📋 Phase 5: Mobile Testing & Polish (TODO)

### Testing Checklist
- [ ] Test transformation persistence on mobile
- [ ] Verify Wake Lock prevents sleep
- [ ] Test copy buttons on iOS Safari
- [ ] Test copy buttons on Android Chrome
- [ ] Verify status polling works across page reloads
- [ ] Test storage quotas (create 11 transformations as FREE user)
- [ ] Test history panel on small screens
- [ ] Test favorite toggle
- [ ] Test delete functionality

### Estimated Time
- 3-4 hours

## 📊 Total Estimated Time

- ✅ Phase 1 (Database + API): **Complete**
- Phase 2 (Route Integration): 3 hours
- Phase 3 (Frontend UI): 8-9 hours
- Phase 4 (API Client): 30 minutes
- Phase 5 (Testing): 3-4 hours

**Total Remaining: 15-17 hours** (approx 2-3 full sessions)

## 🎯 Quick Wins (Priority Order)

If you want to implement incrementally:

1. **Copy Buttons** (1 hour) - Immediate UX improvement
2. **Wake Lock** (1 hour) - Solves phone sleep issue
3. **Save Transformations** (3 hours) - Enables persistence
4. **Status Polling** (2 hours) - Resume after sleep
5. **History Panel** (4-5 hours) - Full feature

## 🔗 Related Files

**Backend**:
- `/Users/tem/humanizer_root/workers/npe-api/migrations/0009_transformation_history.sql`
- `/Users/tem/humanizer_root/workers/npe-api/src/routes/transformation-history.ts`
- `/Users/tem/humanizer_root/workers/npe-api/src/utils/transformation-history-helper.ts`

**Frontend** (to be created):
- `cloud-frontend/src/components/common/CopyButton.tsx`
- `cloud-frontend/src/components/history/TransformationHistory.tsx`
- `cloud-frontend/src/components/history/TransformationCard.tsx`
- `cloud-frontend/src/hooks/useWakeLock.ts`
- `cloud-frontend/src/hooks/useTransformationPolling.ts`

**Routes to Update**:
- `workers/npe-api/src/routes/transformations/allegorical.ts`
- `workers/npe-api/src/routes/transformations/round-trip.ts`
- `workers/npe-api/src/routes/transformations/maieutic.ts`
- `workers/npe-api/src/routes/ai-detection.ts`

## 🚀 Next Session Starting Point

1. Start with **copy buttons** - quick win, immediate value
2. Add **Wake Lock** - solves sleep issue
3. Then tackle transformation persistence

---

**Memory ID for this work**: Store in ChromaDB after completion
**Git Branch**: Create `feature/transformation-history` for this work
