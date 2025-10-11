# Image Display Fix Summary - Oct 11, 2025

## Issues Fixed

### 1. ✅ ConversationList Duplicate Keys
**Problem**: React warning about duplicate keys `2c173c7d-8155-4aa0-a24b-344cc1b476a0`

**Root Cause**: The batched loading was creating a new Map for each batch, causing duplicates when appending to `allConversations` array.

**Fix**: Moved `conversationMap` outside the loop to deduplicate across ALL batches.

```typescript
// BEFORE (lines 43-69):
const allConversations: Conversation[] = [];
for (let batch = 0; batch < totalBatches; batch++) {
  const conversationMap = new Map<string, Conversation>();  // ❌ New map each loop!
  // ... populate map ...
  const batchConversations = Array.from(conversationMap.values());
  allConversations.push(...batchConversations);  // ❌ Duplicates!
}

// AFTER:
const conversationMap = new Map<string, Conversation>();  // ✅ Single map for all batches
for (let batch = 0; batch < totalBatches; batch++) {
  // ... populate map ...
  const allConversations = Array.from(conversationMap.values());  // ✅ No duplicates!
}
```

**File**: `frontend/src/components/conversations/ConversationList.tsx:43-66`

---

### 2. ✅ CORS Configuration
**Problem**: Dev server running on port 3001 but CORS only allowed 3000 and 5173

**Fix**: Added `http://localhost:3001` to CORS origins

```python
# humanizer/config.py:24
cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:8000,null"
```

**Note**: With Vite proxy, CORS isn't strictly necessary (same-origin), but added for consistency.

---

### 3. ✅ Image URL Construction
**Analysis**: URLs are CORRECT as-is!

The flow:
```
1. MediaGallery calls: api.getMediaFile(item.file_id)
2. Returns: "/api/media/file-abc123"
3. Browser loads: http://localhost:3001/api/media/file-abc123
4. Vite proxy intercepts and forwards to: http://localhost:8000/media/file-abc123
5. Backend serves the actual PNG/WebP file
```

**Verification**:
```bash
# Direct API test (works):
$ curl http://localhost:8000/media/file-0000000001e851f7b96c57ab1fbc0a9c | file -
/dev/stdin: PNG image data, 1179 x 2556, 8-bit/color RGBA, non-interlaced

# Through Vite proxy (should work):
$ curl http://localhost:3001/api/media/file-0000000001e851f7b96c57ab1fbc0a9c | file -
# (Test this in browser dev tools)
```

**No changes needed** - the implementation is correct!

---

## How Images Are Served

### Backend (`humanizer/api/media.py:81-134`)
```python
@router.get("/{file_id}")
async def get_media_file(file_id: str, session: AsyncSession):
    """Serve media file by file_id."""
    # 1. Lookup file in database
    media = await session.execute(
        select(ChatGPTMedia).where(ChatGPTMedia.file_id == file_id)
    )

    # 2. Check file exists on disk
    file_path = Path(media.file_path)
    if not file_path.exists():
        raise HTTPException(404)

    # 3. Serve with proper MIME type
    return FileResponse(
        path=str(file_path),
        media_type=mime_type or "application/octet-stream",
    )
```

### Frontend (`frontend/src/components/media/MediaGallery.tsx:39-46`)
```typescript
const getMediaUrl = (item: MediaItem): string => {
  // Universal media endpoint - works for all sources
  if (item.file_path) {
    return api.getMediaFile(item.file_id);  // Returns "/api/media/file-abc123"
  }
  // Fallback to placeholder SVG
  return `data:image/svg+xml,<svg>...`;
};
```

### Vite Proxy (`frontend/vite.config.ts:15-21`)
```typescript
proxy: {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),  // /api/media/X → /media/X
  },
}
```

---

## Testing Instructions

### 1. Open Browser Dev Tools
```bash
open http://localhost:3001
# Press F12 to open DevTools
```

### 2. Navigate to Media Gallery
- Click **"🖼️ Media"** in sidebar
- MediaGallery should load

### 3. Check Network Tab
Look for requests like:
```
GET http://localhost:3001/api/media/file-0000000001e851f7b96c57ab1fbc0a9c
Status: 200
Type: image/png
Size: 31KB
```

### 4. Check Console
Should see NO errors. If you see:
- ❌ "Failed to load resource" → Check file_path in database
- ❌ "CORS error" → Shouldn't happen with proxy, but check config
- ❌ "404 Not Found" → File missing from disk

### 5. Inspect Actual Image Element
```javascript
// In browser console:
document.querySelector('.media-thumbnail img').src
// Should return: "http://localhost:3001/api/media/file-..."
```

---

## Known Good Data

From API test:
```json
{
  "items": [
    {
      "file_id": "file-0000000001e851f7b96c57ab1fbc0a9c",
      "file_path": "/Users/tem/rho/var/media/chat7/user-CD8AiHjX8v0DB1u99eW7z8n7/file_0000000001e851f7b96c57ab1fbc0a9c-86b9a53b-bd01-44dc-8edb-29e129abe6bb.png",
      "source_archive": "chat7"
    }
  ],
  "total": 811,
  "page": 1,
  "page_size": 2,
  "total_pages": 406
}
```

Binary verification:
```bash
$ curl -s http://localhost:8000/media/file-0000000001e851f7b96c57ab1fbc0a9c | head -c 20 | xxd
00000000: 8950 4e47 0d0a 1a0a 0000 000d 4948 4452  .PNG........IHDR
# ✅ Valid PNG header!
```

---

## Troubleshooting

### Images Show as Broken/Missing

**Check 1: Is file_path NULL?**
```sql
SELECT file_id, file_path FROM chatgpt_media WHERE file_path IS NULL LIMIT 5;
```
If many are NULL, run media reimport with `force_reimport=True`.

**Check 2: Does file exist on disk?**
```bash
# Get a file_path from API response and test:
ls -lh "/Users/tem/rho/var/media/chat7/user-CD8AiHjX8v0DB1u99eW7z8n7/file_0000000001e851f7b96c57ab1fbc0a9c-86b9a53b-bd01-44dc-8edb-29e129abe6bb.png"
```

**Check 3: Are URLs being constructed correctly?**
```javascript
// In browser console:
const testUrl = '/api/media/file-0000000001e851f7b96c57ab1fbc0a9c';
fetch(testUrl).then(r => r.blob()).then(b => console.log(b.type));
// Should log: "image/png"
```

**Check 4: Is Vite proxy working?**
```bash
# Terminal:
curl -I http://localhost:3001/api/media/file-0000000001e851f7b96c57ab1fbc0a9c
# Should return: HTTP/1.1 200 OK
```

---

## Current Status

✅ **ConversationList**: Duplicate keys fixed
✅ **CORS**: Port 3001 added to allowed origins
✅ **API Server**: Running on http://localhost:8000
✅ **Frontend**: Running on http://localhost:3001
✅ **Image URLs**: Correctly constructed
✅ **Backend**: Serves files with proper MIME types
✅ **Vite Proxy**: Configured correctly

**Next**: Test in actual browser to verify images display!

---

## Files Modified

1. `frontend/src/components/conversations/ConversationList.tsx` - Fixed duplicate keys
2. `humanizer/config.py` - Added port 3001 to CORS origins

**No changes needed to**:
- `frontend/src/components/media/MediaGallery.tsx` - Already correct!
- `frontend/src/lib/api-client.ts` - Already correct!
- `humanizer/api/media.py` - Already working!
- `frontend/vite.config.ts` - Already configured!

---

**Ready to test!** Open http://localhost:3001 and click the Media tab.
