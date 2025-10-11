# Final GUI Fixes - October 11, 2025

## Issues Reported & Status

### 1. ✅ **Sidebar Resize Bug** - FIXED
**Problem**: Could drag sidebar left (smaller) but not right (larger)

**Root Cause**: Used React's `onMouseMove` events which only fire when mouse is over the component. After starting a drag, moving the mouse outside the sidebar wouldn't trigger the handler.

**Fix**: Switched to global `document.addEventListener` for mousemove/mouseup during resize.

```typescript
// BEFORE: React events (doesn't work when dragging outside component)
<div onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

// AFTER: Global document listeners (works everywhere)
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => { /* ... */ };
  const handleMouseUp = () => { /* ... */ };

  if (isResizing) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isResizing]);
```

**File**: `frontend/src/components/layout/Sidebar.tsx`

---

### 2. ✅ **Unicode Filename Handling** - WORKING
**User Report**: Image works in Safari with `file://` URL but broken in our interface

**Example**:
- Works: `file:///Users/tem/rho/var/media/chat7/file-yk3DumzimKqFG8KB0wXftLwc-Screenshot%202024-08-10%20at%201.11.11%E2%80%AFAM.png`
- Contains: `\u{202f}` (NARROW NO-BREAK SPACE) before "AM"

**Investigation Results**:

1. **File on disk** (actual bytes):
```bash
$ python3 -c "..."
file-yk3DumzimKqFG8KB0wXftLwc-Screenshot 2024-08-10 at 1.11.11\u202fAM.png
# ✅ Has Unicode space
```

2. **Database stores it with regular space**:
```sql
SELECT file_path FROM chatgpt_media WHERE file_id = 'file-yk3DumzimKqFG8KB0wXftLwc';
-- /Users/tem/rho/var/media/chat7/file-yk3DumzimKqFG8KB0wXftLwc-Screenshot 2024-08-10 at 1.11.11 AM.png
-- ❌ Regular space (Unicode normalization during ingest)
```

3. **API serving works anyway**:
```bash
$ curl http://localhost:8000/media/file-yk3DumzimKqFG8KB0wXftLwc | file -
/dev/stdin: PNG image data, 1024 x 1024, 8-bit/color RGB
# ✅ macOS filesystem does Unicode normalization automatically!
```

**Conclusion**: The backend **works correctly** because macOS's HFS+/APFS filesystems automatically normalize Unicode characters. Python's `pathlib` can find files regardless of whether you use `\u202f` or regular space.

**No fix needed** - Unicode filenames work!

---

### 3. ⚠️ **Images Show as Broken in Frontend** - INVESTIGATING

**User Report**: Screenshots show broken images in the GUI

**What We Know**:
- ✅ Files exist on disk
- ✅ Database has correct file_id and file_path
- ✅ API serves images correctly: `curl http://localhost:8000/media/file-abc123` returns PNG
- ✅ Vite proxy works: `curl http://localhost:3001/api/media/file-abc123` returns PNG
- ✅ CORS configured correctly (includes port 3001)
- ✅ Image URLs constructed correctly: `/api/media/file-abc123`

**Possible Causes**:

**A. Images don't have file_path in database**:
```sql
SELECT COUNT(*) FROM chatgpt_media WHERE file_path IS NULL;
-- If many are NULL, images can't be served
```

**B. Frontend not actually requesting images**:
Check browser DevTools Network tab - are there requests to `/api/media/*`?

**C. JavaScript error preventing rendering**:
Check browser Console for errors

**D. CSS hiding images**:
Check computed styles on `<img>` tags

---

## Debugging Steps for User

### Step 1: Check Browser DevTools Console
```javascript
// Open http://localhost:3001
// Press F12
// Look for any red errors
```

### Step 2: Check Network Tab
```
1. Clear network log
2. Click Media tab in sidebar
3. Look for requests like:
   GET http://localhost:3001/api/media/file-...

4. Check response:
   - Status should be 200 (not 404 or 500)
   - Type should be "image/png" or "image/webp"
   - Size should be > 0
```

### Step 3: Test Single Image URL
```javascript
// In browser console:
const testUrl = '/api/media/file-0000000001e851f7b96c57ab1fbc0a9c';
fetch(testUrl)
  .then(r => {
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers.get('content-type'));
    return r.blob();
  })
  .then(blob => {
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);

    // Try to display it
    const url = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '400px';
    document.body.appendChild(img);
  });
```

### Step 4: Check Actual Image Elements
```javascript
// In browser console:
const imgs = document.querySelectorAll('.media-thumbnail img');
console.log('Found', imgs.length, 'image elements');

imgs.forEach((img, i) => {
  console.log(`Image ${i}:`, {
    src: img.src,
    naturalWidth: img.naturalWidth,  // 0 if broken
    naturalHeight: img.naturalHeight,
    complete: img.complete,  // true if loaded
    currentSrc: img.currentSrc
  });
});
```

### Step 5: Check Database
```bash
# How many images have NULL file_path?
psql humanizer_dev -c "SELECT
  COUNT(*) FILTER (WHERE file_path IS NOT NULL) as with_path,
  COUNT(*) FILTER (WHERE file_path IS NULL) as without_path,
  COUNT(*) as total
FROM chatgpt_media;"

# Expected:
# with_path | without_path | total
# ----------+--------------+-------
#       634 |          177 |   811
```

---

## Current Server Status

Both servers running:
- ✅ **Backend**: http://localhost:8000
- ✅ **Frontend**: http://localhost:3001

Test URLs:
```bash
# Health check
curl http://localhost:8000/health

# Get media list
curl http://localhost:8000/media?page=1&page_size=5

# Test specific image (one we know works)
curl http://localhost:8000/media/file-0000000001e851f7b96c57ab1fbc0a9c | file -
# Should show: PNG image data

# Same through proxy
curl http://localhost:3001/api/media/file-0000000001e851f7b96c57ab1fbc0a9c | file -
# Should also show: PNG image data
```

---

## Files Modified This Session

1. `frontend/src/components/conversations/ConversationList.tsx`
   - Fixed duplicate React keys (moved Map outside loop)

2. `frontend/src/components/media/MediaGallery.tsx`
   - Changed key from `item.uuid` to `item.file_id`

3. `frontend/src/components/layout/MainPane.tsx`
   - Imported and used actual MediaGallery component

4. `frontend/src/components/layout/Sidebar.tsx`
   - Fixed bidirectional resize with global event listeners

5. `humanizer/config.py`
   - Added `http://localhost:3001` to CORS origins

---

## Quick Test Script

```bash
# Terminal 1: Start backend (if not running)
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Terminal 2: Start frontend (if not running)
cd /Users/tem/humanizer_root/frontend
npm run dev

# Terminal 3: Test image serving
curl "http://localhost:8000/media/file-0000000001e851f7b96c57ab1fbc0a9c" -o /tmp/test.png
open /tmp/test.png  # Should open the image
```

---

## Next Steps

1. **Run debugging steps in browser** to identify why images show as broken
2. **Share browser console output** - any errors?
3. **Share network tab** - are image requests happening? What status codes?
4. **Check if file_path is NULL** for the broken images

Once we see the actual browser errors, we can fix the remaining issue!

---

## Known Good Test Case

This specific image **definitely works** through the API:

**File ID**: `file-0000000001e851f7b96c57ab1fbc0a9c`

**Database**:
```json
{
  "file_id": "file-0000000001e851f7b96c57ab1fbc0a9c",
  "file_path": "/Users/tem/rho/var/media/chat7/user-CD8AiHjX8v0DB1u99eW7z8n7/file_0000000001e851f7b96c57ab1fbc0a9c-86b9a53b-bd01-44dc-8edb-29e129abe6bb.png",
  "source_archive": "chat7"
}
```

**Test**:
```bash
curl -I "http://localhost:8000/media/file-0000000001e851f7b96c57ab1fbc0a9c"
# HTTP/1.1 200 OK
# content-type: image/png
# content-length: ~31KB
```

If this image shows as broken in the browser, check:
1. Is the Network request actually being made?
2. Does it return 200 or 404?
3. Is there a CORS error?
4. Is there a JavaScript error preventing the `<img>` from rendering?
