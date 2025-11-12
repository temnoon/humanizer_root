# Secure Archive - Phase 1 Implementation Plan

**Status**: 70% Complete - Backend done, Frontend UI remaining
**Created**: November 12, 2025
**Estimated Time Remaining**: 3-4 hours

---

## ✅ COMPLETED (Backend Infrastructure)

### 1. Database Migration (0014_encrypted_archive.sql)
- ✅ `encrypted_files` table with indexes
- ✅ `user_encryption_settings` table for salt storage
- ✅ Folder support for organizing files

### 2. R2 Storage Configuration
- ✅ R2 bucket binding added to wrangler.toml
- ✅ Env types updated with R2_ARCHIVE

### 3. Worker API Routes (/secure-archive)
**File**: `workers/npe-api/src/routes/secure-archive.ts`

- ✅ **GET /salt** - Get/create user's encryption salt
- ✅ **POST /upload** - Upload encrypted file to R2
- ✅ **GET /files** - List all files with optional folder filter
- ✅ **GET /files/:fileId** - Download encrypted file
- ✅ **DELETE /files/:fileId** - Delete file
- ✅ **DELETE /folders/:folderName** - Delete entire folder

### 4. Client-Side Encryption Utilities
**File**: `cloud-workbench/src/lib/encryption.ts`

- ✅ `keyManager` - Singleton for key management
- ✅ `encryptFile()` - Encrypt files with AES-256-GCM
- ✅ `decryptFile()` - Decrypt files
- ✅ `encryptText()` / `decryptText()` - Text convenience wrappers
- ✅ Helper functions: file size formatting, type validation, downloads

---

## 🚧 REMAINING WORK (Frontend UI)

### 5. Archive Panel Component (3-4 hours)

**Location**: `cloud-workbench/src/features/panels/archive/ArchivePanel.tsx`

**Features to Implement**:

#### A. Encryption Password Modal (30 min)
When user first accesses Archive:
1. Show modal: "Set Your Archive Encryption Password"
2. Warning: "If you forget this password, your files CANNOT be recovered"
3. Input field for password (separate from login!)
4. Confirm password field
5. Store salt via API, initialize keyManager

```typescript
// Pseudo-code
const [showPasswordModal, setShowPasswordModal] = useState(true);
const [password, setPassword] = useState('');

async function setupEncryption() {
  // Get/create salt from server
  const { salt } = await fetch('/secure-archive/salt');

  // Initialize encryption key in memory
  await keyManager.initialize(password, salt);

  setShowPasswordModal(false);
}
```

#### B. File Upload Interface (1 hour)
Drag-and-drop zone + file picker:
1. Accept: .txt, .md, .json (expand later)
2. Show upload progress
3. Encrypt client-side before upload
4. Optional: folder/category selector

```typescript
async function handleUpload(file: File) {
  const key = keyManager.getKey();
  const { encryptedData, iv } = await encryptFile(file, key);

  const formData = new FormData();
  formData.append('file', new Blob([encryptedData]));
  formData.append('iv', JSON.stringify(iv));
  formData.append('filename', file.name);
  formData.append('contentType', file.type);
  formData.append('folder', selectedFolder || '');

  await fetch('/secure-archive/upload', {
    method: 'POST',
    body: formData,
    headers: { 'Authorization': `Bearer ${token}` }
  });

  await refreshFileList();
}
```

#### C. File List UI (1 hour)
Table/list view:
- Columns: Filename, Size, Folder, Date, Actions
- Sort by date (newest first)
- Filter by folder dropdown
- Actions: Load, Delete
- Empty state: "No files uploaded yet"

```typescript
interface ArchiveFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  folder: string | null;
  createdAt: number;
}

const [files, setFiles] = useState<ArchiveFile[]>([]);
const [folders, setFolders] = useState<string[]>([]);
const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

async function loadFiles() {
  const params = selectedFolder ? `?folder=${selectedFolder}` : '';
  const { files, folders } = await fetch(`/secure-archive/files${params}`);
  setFiles(files);
  setFolders(folders);
}
```

#### D. Load into Content Source (30 min)
Click "Load" on a file:
1. Download encrypted file from API
2. Decrypt in browser
3. Convert to text (for .txt, .md, .json)
4. Insert into Content Source pane (left column)
5. Close Archive panel

```typescript
async function loadFileIntoSource(fileId: string) {
  const key = keyManager.getKey();

  // Download encrypted file
  const response = await fetch(`/secure-archive/files/${fileId}`);
  const { data, iv, filename, contentType } = await response.json();

  // Decrypt
  const decrypted = await decryptFile(
    new Uint8Array(data),
    iv,
    key
  );

  // Convert to text
  const text = uint8ArrayToText(decrypted);

  // Load into Content Source (via context or prop)
  onLoadContent(text, filename);
}
```

#### E. Delete Functionality (30 min)
Delete button with confirmation:
1. Show confirmation modal
2. Call API to delete
3. Refresh file list

```typescript
async function deleteFile(fileId: string, filename: string) {
  if (!confirm(`Delete "${filename}"?`)) return;

  await fetch(`/secure-archive/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  await refreshFileList();
}
```

---

## 📝 UI Component Structure

```typescript
// cloud-workbench/src/features/panels/archive/ArchivePanel.tsx

export default function ArchivePanel() {
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // On mount: check if encryption key is set
  useEffect(() => {
    if (keyManager.isInitialized()) {
      setIsUnlocked(true);
      loadFiles();
    }
  }, []);

  // If not unlocked, show password modal
  if (!isUnlocked) {
    return <EncryptionPasswordModal onUnlock={() => setIsUnlocked(true)} />;
  }

  // Main UI
  return (
    <div className="archive-panel">
      <header>
        <h3>Secure Archive</h3>
        <select value={selectedFolder || ''} onChange={handleFolderFilter}>
          <option value="">All Files</option>
          {folders.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </header>

      <FileUploadZone onUpload={handleUpload} uploading={uploading} />

      <FileList
        files={files}
        onLoad={loadFileIntoSource}
        onDelete={deleteFile}
      />
    </div>
  );
}
```

---

## 🎨 Visual Design

**Match workbench aesthetic**:
- Use existing CSS variables (`--bg-primary`, `--text-primary`, etc.)
- Card-based file list (like other panels)
- Purple accent for actions
- Drag-and-drop zone with dashed border
- Icons: 📄 (file), 📁 (folder), 🔒 (locked), 🔓 (unlocked)

---

## 🔌 Integration Points

### 1. Tool Dock
Add Archive panel to Tool Dock:
```typescript
// cloud-workbench/src/features/panels/ToolDock.tsx
import ArchivePanel from './archive/ArchivePanel';

const panels = [
  // ... existing panels
  {
    id: 'archive',
    name: 'Archive',
    icon: '🗄️',
    component: ArchivePanel,
    category: 'source'
  }
];
```

### 2. Content Source Integration
Pass `onLoadContent` prop to Archive panel:
```typescript
<ArchivePanel
  onLoadContent={(text, filename) => {
    setContentSource(text);
    setSourceFilename(filename);
    closeToolDock();
  }}
/>
```

### 3. Logout Hook
Destroy encryption key on logout:
```typescript
// In logout handler
keyManager.destroy();
```

---

## 🧪 Testing Checklist

- [ ] Upload .txt file → encrypts → stores in R2
- [ ] List files → shows in UI
- [ ] Load file → decrypts → loads into Content Source
- [ ] Delete file → removes from R2 + D1
- [ ] Upload to folder → organizes correctly
- [ ] Filter by folder → filters list
- [ ] Logout → key destroyed → re-login requires password
- [ ] Wrong password → shows error (decryption fails)
- [ ] Large file (10MB) → uploads successfully
- [ ] Multiple files → no conflicts

---

## 🚀 Deployment Steps

1. **Apply Migration**:
```bash
cd workers/npe-api
npx wrangler d1 execute npe-production-db --remote --file=migrations/0014_encrypted_archive.sql
```

2. **Create R2 Bucket**:
```bash
npx wrangler r2 bucket create humanizer-archive
```

3. **Deploy Worker**:
```bash
npx wrangler deploy
```

4. **Deploy Workbench**:
```bash
cd cloud-workbench
npm run build
npx wrangler pages deploy dist --project-name=workbench-4ec
```

---

## 📈 Next Steps After Phase 1

Once basic upload/download works:
- **Phase 2**: ChatGPT conversation parser (upload .zip → select conversations)
- **Phase 3**: Project Gutenberg browser
- **Phase 4**: Simple web scraper

**See**: `SECURE_ARCHIVE_FUTURE_PHASES.md` for detailed Phase 2+ planning

---

## 💡 Quick Start for Implementation

To continue building the UI:

1. Create `cloud-workbench/src/features/panels/archive/` directory
2. Copy component structure from above
3. Test with backend (already deployed)
4. Iterate on UX

**Estimated time**: 3-4 hours for complete UI implementation
