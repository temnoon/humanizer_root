# Humanizer Capture - Browser Extension

Capture live ChatGPT conversations directly to your Humanizer database.

## Features

- ✅ **One-Click Capture** - Capture entire conversations with one button
- ✅ **Auto-Capture** - Automatically capture new messages as they appear
- ✅ **Media Support** - Downloads and saves DALL-E images and attachments
- ✅ **Real-time Sync** - See captured message count in real-time
- ✅ **Seamless Integration** - Works with your existing Humanizer backend

## Installation

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `/Users/tem/humanizer_root/browser-extension` folder
5. The extension should now appear in your extensions list

### 2. Start Backend Server

Make sure your Humanizer backend is running:

```bash
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000
```

### 3. Visit ChatGPT

1. Go to https://chatgpt.com
2. Open any conversation
3. Click the Humanizer extension icon in your toolbar
4. Click "Capture Now" to capture the conversation

## Usage

### Manual Capture

1. Navigate to a ChatGPT conversation
2. Click the Humanizer extension icon
3. Click "Capture Now"
4. Check the status - it will show conversation ID and message count

### Auto-Capture

1. Click the Humanizer extension icon
2. Enable "Auto-capture new messages"
3. Continue your conversation - new messages will be captured automatically

### View in Humanizer

1. Click "Open Dashboard" in the extension popup
2. Your captured conversations will appear in the conversation list
3. They will be marked with `source_archive: "live_capture"`

## How It Works

### Architecture

```
ChatGPT Page
    ↓ (content-script.js parses DOM)
Messages + Media
    ↓ (HTTP POST)
Backend API (/api/capture/*)
    ↓
PostgreSQL Database
    ↓
Humanizer GUI (http://localhost:3001)
```

### Content Script (content-script.js)

- Runs on ChatGPT pages
- Parses conversation structure from DOM
- Extracts messages with `data-message-author-role` attribute
- Downloads media files as blobs
- Sends to backend API

### Backend API (/api/capture/*)

- **POST /api/capture/conversation** - Create/update conversation
- **POST /api/capture/message** - Add message to conversation
- **POST /api/capture/media** - Upload media file
- **GET /api/capture/status/{uuid}** - Check capture status

### Data Storage

- Conversations: `chatgpt_conversations` table (source_archive = "live_capture")
- Messages: `chatgpt_messages` table
- Media: `chatgpt_media` table + files in `/humanizer/media/captured/`

## Troubleshooting

### Extension Not Capturing

1. Check that backend is running: `curl http://localhost:8000/health`
2. Open Chrome DevTools → Console tab to see logs
3. Look for `[Humanizer]` log messages
4. Verify conversation UUID in URL: `https://chatgpt.com/c/{uuid}`

### CORS Errors

If you see CORS errors, verify backend settings:

```python
# humanizer/config.py
CORS_ORIGINS = ["http://localhost:3001", "https://chatgpt.com"]
```

### Media Not Capturing

1. Check that media directory exists: `/Users/tem/humanizer_root/humanizer/media/captured/`
2. Verify file permissions
3. Check backend logs for upload errors

## API Endpoints

All endpoints are prefixed with `/api/capture`:

### Capture Conversation

```bash
curl -X POST http://localhost:8000/api/capture/conversation \
  -H 'Content-Type: application/json' \
  -d '{
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Discussion about TRM",
    "source_url": "https://chatgpt.com/c/550e8400-e29b-41d4-a716-446655440000",
    "model_slug": "gpt-4"
  }'
```

### Capture Message

```bash
curl -X POST http://localhost:8000/api/capture/message \
  -H 'Content-Type: application/json' \
  -d '{
    "uuid": "660e8400-e29b-41d4-a716-446655440000",
    "conversation_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "author_role": "user",
    "content_text": "Can you explain TRM?",
    "content_parts": [{"content_type": "text", "parts": ["Can you explain TRM?"]}]
  }'
```

### Check Status

```bash
curl http://localhost:8000/api/capture/status/550e8400-e29b-41d4-a716-446655440000
```

## Known Limitations

1. **Timestamps** - Uses current time, not exact ChatGPT timestamps (harder to extract)
2. **Message UUIDs** - Relies on ChatGPT's `data-message-id` attribute (may change)
3. **Media CDN** - DALL-E images may expire, capture ASAP
4. **DOM Changes** - ChatGPT UI changes may break selectors

## Future Enhancements

- [ ] Support for Claude, Gemini, etc.
- [ ] Batch capture multiple conversations
- [ ] Offline queue (capture when backend is down)
- [ ] Export conversations (JSON, Markdown)
- [ ] Conversation diffing (show what changed since last capture)
- [ ] Firefox support (Manifest v2)

## Development

### Files

```
browser-extension/
├── manifest.json          # Extension config
├── content-script.js      # Runs on ChatGPT pages
├── background.js          # Service worker
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
└── README.md             # This file
```

### Debugging

1. Open `chrome://extensions/`
2. Find "Humanizer Capture"
3. Click "Inspect views: service worker" (for background.js)
4. Go to ChatGPT page
5. Open DevTools → Console (for content-script.js)
6. Click extension icon → Right-click → Inspect (for popup.js)

### Making Changes

1. Edit files in `/browser-extension/`
2. Go to `chrome://extensions/`
3. Click the refresh icon on "Humanizer Capture"
4. Reload ChatGPT page to get updated content script

---

**Version**: 1.0.0
**Author**: Humanizer Project
**License**: MIT
