# ChatGPT/Claude Archive Parser - Instructions

**For Humanizer Workbench Users**

---

## Overview

To upload individual conversations from your ChatGPT or Claude archives to the Humanizer workbench, you'll need to first extract and organize them using our parser tool.

**Why?** ChatGPT exports come as a single large `.zip` file with thousands of conversations. The parser helps you:
- Extract individual conversations
- Select which conversations to upload
- Organize conversations into folders
- Preserve attachments (images, code files, etc.)

---

## Step 1: Download the Parser

**GitHub Repository**: [https://github.com/temnoon/openai_export_parser](https://github.com/temnoon/openai_export_parser)

### Installation

```bash
# Clone the repository
git clone https://github.com/temnoon/openai_export_parser.git
cd openai_export_parser

# Install dependencies
pip install -r requirements.txt
```

---

## Step 2: Export Your ChatGPT Archive

1. Go to [ChatGPT Settings](https://chat.openai.com/settings)
2. Click "Data Controls"
3. Click "Export Data"
4. Wait for email (usually within 24 hours)
5. Download the `.zip` file

---

## Step 3: Parse Your Export

```bash
# Run the parser
python parse_export.py /path/to/your/chatgpt-export.zip

# This creates a folder structure:
# chatgpt_conversations/
# ├── 2024-11-12_conversation_title_1/
# │   ├── conversation.json
# │   └── attachments/
# ├── 2024-11-10_conversation_title_2/
# │   ├── conversation.json
# │   └── attachments/
# └── ...
```

---

## Step 4: Select Conversations to Upload

Browse the `chatgpt_conversations/` folder and select which conversations you want to work with in Humanizer.

**Tip**: Look for conversations with rich narrative content, storytelling, or detailed discussions that would benefit from transformation.

---

## Step 5: Upload to Humanizer

### Option A: Upload Individual Files

1. Log in to [Humanizer Workbench](https://workbench.humanizer.com)
2. Click the "Archive" panel (left sidebar, 🗄️ icon)
3. Set your encryption password (first time only)
4. Drag and drop the `conversation.json` file
5. **Optional**: Specify a folder (e.g., "ChatGPT Nov 2024")

### Option B: Upload Entire Conversation Folder

1. Zip the individual conversation folder:
   ```bash
   cd chatgpt_conversations/2024-11-12_conversation_title_1
   zip -r conversation.zip .
   ```
2. Upload the `.zip` file to Archive
3. **Future feature**: The workbench will auto-extract conversations from `.zip`

---

## Step 6: Use Your Archive

Once uploaded:
1. Go to the Archive panel
2. Find your conversation
3. Click "Load" to load it into the Content Source
4. Use any Humanizer transformation tool (Allegorical, Round-Trip, etc.)

---

## Claude Archives (Coming Soon)

The parser will soon support Claude conversation exports:
- Similar workflow to ChatGPT
- Export from Claude → Parse → Upload
- Unified interface for all AI conversation archives

---

## Browser Plugin (Coming Soon)

For single conversations from our browser plugin:
- Right-click → "Export to Humanizer"
- Automatically encrypted and synced
- No manual export/parse/upload needed

---

## Supported File Formats

**Current**:
- `.json` (ChatGPT conversations)
- `.txt` (plain text)
- `.md` (Markdown)

**Planned**:
- `.zip` (conversation bundles)
- `.pdf` (documents)
- Claude conversation exports
- Browser plugin exports

---

## Security Note

All files uploaded to the Archive are **encrypted in your browser** before being sent to the server. Your encryption password is never shared with the server. If you forget your password, your files **cannot be recovered**.

**Recommendation**: Store your encryption password in a secure password manager.

---

## Troubleshooting

### Parser Errors

**Problem**: `ModuleNotFoundError: No module named 'X'`
**Solution**: Run `pip install -r requirements.txt`

**Problem**: `FileNotFoundError: conversations.json not found`
**Solution**: Make sure you're pointing to the `.zip` file, not an extracted folder

### Upload Errors

**Problem**: "File too large"
**Solution**: ChatGPT conversations can be large. Split into smaller files or compress.

**Problem**: "Decryption failed"
**Solution**: Make sure you're using the same encryption password you set initially.

---

## Need Help?

- **Parser Issues**: [GitHub Issues](https://github.com/temnoon/openai_export_parser/issues)
- **Humanizer Issues**: [Contact Support](mailto:dreegle@gmail.com)
- **Documentation**: [Humanizer Docs](https://humanizer.com/docs)

---

## Future Enhancements

We're working on:
- ✅ Web-based parser (no Python installation needed)
- ✅ Direct Claude integration
- ✅ Browser plugin for one-click export
- ✅ Conversation search and indexing
- ✅ Bulk operations (upload/transform multiple conversations)

Stay tuned!
