# ⚠️ ARCHIVED - Use narrative-studio Instead

**This interface (cloud-workbench) is no longer the primary interface.**

## Use Narrative Studio Instead

The **narrative-studio** directory contains the current, maintained interface with:
- ✅ Beautiful, polished UI
- ✅ Full archive functionality
- ✅ JSON import capability
- ✅ Better UX and performance

## To Run Narrative Studio

```bash
cd ../narrative-studio
nvm use  # Uses Node 22 from .nvmrc
npm install
npm run dev
```

The server will start at http://localhost:5173

## Why This Directory Exists

This directory is kept for **reference purposes only**:
- May contain useful tool code that can be extracted
- Serves as historical reference
- **Should NEVER be deployed or linked as a primary interface**

## Archive Server

Both interfaces can use the same archive server:

```bash
cd narrative-studio  # or cloud-workbench
node archive-server.js
```

The server runs on port 3002 and serves conversations from:
`/Users/tem/openai-export-parser/output_v13_final`

---

**Last Updated**: November 18, 2025
**Status**: Archived - Use narrative-studio instead
