import JSZip from 'jszip';
import type { Session } from './sessionStorage';

/**
 * Export/Import Service for Session Data
 * Supports JSON and ZIP formats with validation
 */

// Export metadata structure
interface ExportMetadata {
  exportedAt: string;
  exportVersion: string;
  sessionId: string;
  sessionName: string;
  bufferCount: number;
  hasEdits: boolean;
  appVersion: string;
}

// Validation result
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  session?: Session;
}

// Current export format version (for future compatibility)
const EXPORT_VERSION = '1.0.0';
const APP_VERSION = '0.1.0'; // Update when app changes

/**
 * Generate filename for export
 */
function generateFilename(session: Session, extension: 'json' | 'zip'): string {
  // Sanitize session name for filename
  const safeName = session.name
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .slice(0, 50); // Max 50 chars

  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `humanizer_session_${safeName}_${timestamp}.${extension}`;
}

/**
 * Create export metadata
 */
function createMetadata(session: Session): ExportMetadata {
  const hasEdits = session.buffers.some(b => b.isEdited);

  return {
    exportedAt: new Date().toISOString(),
    exportVersion: EXPORT_VERSION,
    sessionId: session.sessionId,
    sessionName: session.name,
    bufferCount: session.buffers.length,
    hasEdits,
    appVersion: APP_VERSION
  };
}

/**
 * Download file to user's system
 */
function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export session as JSON file
 */
export async function exportSessionAsJSON(session: Session): Promise<void> {
  try {
    const filename = generateFilename(session, 'json');
    const content = JSON.stringify(session, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    downloadFile(filename, blob);
    console.log(`✓ Exported session as JSON: ${filename}`);
  } catch (error) {
    console.error('Failed to export session as JSON:', error);
    throw new Error('Failed to export session as JSON');
  }
}

/**
 * Export session as ZIP file with metadata
 */
export async function exportSessionAsZIP(session: Session): Promise<void> {
  try {
    const zip = new JSZip();
    const metadata = createMetadata(session);

    // Add session data
    zip.file('session.json', JSON.stringify(session, null, 2));

    // Add metadata
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add README
    const readme = generateReadme(session, metadata);
    zip.file('README.md', readme);

    // Generate ZIP blob
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const filename = generateFilename(session, 'zip');
    downloadFile(filename, blob);

    console.log(`✓ Exported session as ZIP: ${filename}`);
  } catch (error) {
    console.error('Failed to export session as ZIP:', error);
    throw new Error('Failed to export session as ZIP');
  }
}

/**
 * Generate README.md for ZIP export
 */
function generateReadme(session: Session, metadata: ExportMetadata): string {
  const editedBuffers = session.buffers.filter(b => b.isEdited);

  return `# Humanizer Session Export

## Session Information

- **Name**: ${session.name}
- **Session ID**: ${session.sessionId}
- **Created**: ${new Date(session.created).toLocaleString()}
- **Last Updated**: ${new Date(session.updated).toLocaleString()}
- **Buffers**: ${session.buffers.length}
- **Edited Buffers**: ${editedBuffers.length}

## Export Details

- **Exported At**: ${new Date(metadata.exportedAt).toLocaleString()}
- **Export Version**: ${metadata.exportVersion}
- **App Version**: ${metadata.appVersion}

## Buffers

${session.buffers.map((buffer, index) => `
${index + 1}. **${buffer.displayName}** (${buffer.bufferId})
   - Type: ${buffer.type}
   - Created: ${new Date(buffer.created).toLocaleString()}
   - Edited: ${buffer.isEdited ? 'Yes' : 'No'}
   ${buffer.tool ? `- Tool: ${buffer.tool}` : ''}
   ${buffer.sourceBufferId ? `- Source: ${buffer.sourceBufferId}` : ''}
`).join('\n')}

## How to Import

1. Open Humanizer (humanizer.com)
2. Go to Sessions tab
3. Click "Import Session"
4. Select this ZIP file or the session.json file inside
5. Your session will be restored with all buffers and edit history

## Files in This Archive

- \`session.json\` - Complete session data (can be imported directly)
- \`metadata.json\` - Export metadata (informational)
- \`README.md\` - This file

---

Generated with [Humanizer](https://humanizer.com) - Transform your narrative
`;
}

/**
 * Validate session data structure
 */
export function validateSession(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required top-level fields
  if (!data.sessionId) errors.push('Missing sessionId');
  if (!data.name) errors.push('Missing name');
  if (!data.created) errors.push('Missing created timestamp');
  if (!data.updated) errors.push('Missing updated timestamp');
  if (!data.buffers || !Array.isArray(data.buffers)) {
    errors.push('Missing or invalid buffers array');
  }
  if (!data.activeBufferId) errors.push('Missing activeBufferId');
  if (!data.viewMode) errors.push('Missing viewMode');

  // Validate viewMode
  if (data.viewMode && !['split', 'single-original', 'single-transformed'].includes(data.viewMode)) {
    errors.push(`Invalid viewMode: ${data.viewMode}`);
  }

  // Validate buffers (if present)
  if (Array.isArray(data.buffers)) {
    if (data.buffers.length === 0) {
      warnings.push('Session has no buffers');
    }

    data.buffers.forEach((buffer: any, index: number) => {
      if (!buffer.bufferId) errors.push(`Buffer ${index}: Missing bufferId`);
      if (!buffer.type) errors.push(`Buffer ${index}: Missing type`);
      if (!['original', 'transformation', 'analysis', 'edited'].includes(buffer.type)) {
        errors.push(`Buffer ${index}: Invalid type ${buffer.type}`);
      }
      if (!buffer.displayName) errors.push(`Buffer ${index}: Missing displayName`);
      if (!buffer.created) errors.push(`Buffer ${index}: Missing created timestamp`);
      if (buffer.isEdited === undefined) errors.push(`Buffer ${index}: Missing isEdited flag`);
    });

    // Check for buffer ID uniqueness
    const bufferIds = data.buffers.map((b: any) => b.bufferId);
    const uniqueIds = new Set(bufferIds);
    if (bufferIds.length !== uniqueIds.size) {
      errors.push('Duplicate buffer IDs found');
    }

    // Check if activeBufferId exists in buffers
    if (data.activeBufferId && !bufferIds.includes(data.activeBufferId)) {
      errors.push('activeBufferId does not match any buffer');
    }
  }

  // Validate timestamps (if present)
  if (data.created && isNaN(Date.parse(data.created))) {
    errors.push('Invalid created timestamp format');
  }
  if (data.updated && isNaN(Date.parse(data.updated))) {
    errors.push('Invalid updated timestamp format');
  }

  // Version compatibility check (future-proofing)
  if (data.exportVersion) {
    const exportedVersion = parseVersion(data.exportVersion);
    const currentVersion = parseVersion(EXPORT_VERSION);

    if (exportedVersion.major > currentVersion.major) {
      warnings.push(`Session exported with newer version (${data.exportVersion}). Some features may not work.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    session: errors.length === 0 ? (data as Session) : undefined
  };
}

/**
 * Parse semantic version string
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

/**
 * Import session from JSON file
 */
export async function importSessionFromJSON(file: File): Promise<Session> {
  try {
    const content = await file.text();
    const data = JSON.parse(content);

    // Validate
    const validation = validateSession(data);
    if (!validation.valid) {
      throw new Error(`Invalid session data: ${validation.errors.join(', ')}`);
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn('Session import warnings:', validation.warnings);
    }

    console.log(`✓ Imported session from JSON: ${data.name}`);
    return validation.session!;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format');
    }
    throw error;
  }
}

/**
 * Import session from ZIP file
 */
export async function importSessionFromZIP(file: File): Promise<Session> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    // Find session.json in ZIP
    const sessionFile = contents.file('session.json');
    if (!sessionFile) {
      throw new Error('session.json not found in ZIP archive');
    }

    // Extract and parse
    const content = await sessionFile.async('text');
    const data = JSON.parse(content);

    // Validate
    const validation = validateSession(data);
    if (!validation.valid) {
      throw new Error(`Invalid session data: ${validation.errors.join(', ')}`);
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn('Session import warnings:', validation.warnings);
    }

    // Check metadata (if present)
    const metadataFile = contents.file('metadata.json');
    if (metadataFile) {
      const metadataContent = await metadataFile.async('text');
      const metadata = JSON.parse(metadataContent);
      console.log('Import metadata:', metadata);
    }

    console.log(`✓ Imported session from ZIP: ${data.name}`);
    return validation.session!;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to import session from ZIP');
  }
}

/**
 * Import session from file (auto-detect format)
 */
export async function importSession(file: File): Promise<Session> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') {
    return importSessionFromJSON(file);
  } else if (extension === 'zip') {
    return importSessionFromZIP(file);
  } else {
    throw new Error('Unsupported file format. Use .json or .zip files.');
  }
}

/**
 * Export all sessions as single ZIP
 */
export async function exportAllSessionsAsZIP(sessions: Session[]): Promise<void> {
  try {
    const zip = new JSZip();

    // Add each session to sessions/ folder
    sessions.forEach((session) => {
      const filename = `${session.sessionId}.json`;
      zip.file(`sessions/${filename}`, JSON.stringify(session, null, 2));
    });

    // Add manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      exportVersion: EXPORT_VERSION,
      appVersion: APP_VERSION,
      sessionCount: sessions.length,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        name: s.name,
        created: s.created,
        updated: s.updated,
        bufferCount: s.buffers.length
      }))
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Add README
    const readme = `# Humanizer Sessions Export

## Export Details

- **Exported At**: ${new Date().toLocaleString()}
- **Total Sessions**: ${sessions.length}
- **Export Version**: ${EXPORT_VERSION}

## Sessions

${sessions.map((s, i) => `${i + 1}. **${s.name}** (${s.buffers.length} buffers) - Updated ${new Date(s.updated).toLocaleString()}`).join('\n')}

## How to Import

1. Open Humanizer (humanizer.com)
2. Go to Sessions tab
3. Click "Import Session"
4. Select individual session JSON files from the \`sessions/\` folder

---

Generated with [Humanizer](https://humanizer.com)
`;
    zip.file('README.md', readme);

    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `humanizer_all_sessions_${timestamp}.zip`;
    downloadFile(filename, blob);

    console.log(`✓ Exported ${sessions.length} sessions as ZIP: ${filename}`);
  } catch (error) {
    console.error('Failed to export all sessions:', error);
    throw new Error('Failed to export all sessions');
  }
}
