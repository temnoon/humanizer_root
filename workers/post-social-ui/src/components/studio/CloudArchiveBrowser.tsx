/**
 * Cloud Archive Browser
 *
 * Browse and manage encrypted conversation archives stored in Cloudflare R2.
 * Zero-trust: all encryption/decryption happens in browser.
 */

import { Component, createSignal, createResource, Show, For, onMount } from 'solid-js';
import { authStore } from '@/stores/auth';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';
import {
  listFiles,
  downloadConversation,
  deleteFile,
  initializeEncryption,
  isEncryptionReady,
  clearEncryption,
  uploadFile,
  checkIsNewUser,
  type EncryptedFile,
  type ConversationMetadata,
} from '@/services/secure-archive';
import { generatePassphrase } from '@/services/crypto';
import {
  saveArchiveCredential,
  getArchiveCredential,
  promptForCredential,
  preventSilentAccess,
  isCredentialApiSupported,
  getManualSaveInstructions,
} from '@/services/credential-manager';

interface CloudArchiveBrowserProps {
  onSelectConversation?: (content: any, metadata: EncryptedFile) => void;
}

export const CloudArchiveBrowser: Component<CloudArchiveBrowserProps> = (props) => {
  const [unlocked, setUnlocked] = createSignal(false);
  const [password, setPassword] = createSignal('');
  const [unlockError, setUnlockError] = createSignal('');
  const [unlocking, setUnlocking] = createSignal(false);
  const [selectedFile, setSelectedFile] = createSignal<EncryptedFile | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal<string | null>(null);

  // Setup flow states
  const [isNewUser, setIsNewUser] = createSignal<boolean | null>(null); // null = checking
  const [setupPassphrase, setSetupPassphrase] = createSignal('');
  const [copied, setCopied] = createSignal(false);

  // Credential manager states
  const [showManualInstructions, setShowManualInstructions] = createSignal(false);
  const [savedToManager, setSavedToManager] = createSignal(false);
  const [credentialApiAvailable] = createSignal(isCredentialApiSupported());
  const [autoFillAttempted, setAutoFillAttempted] = createSignal(false);

  // Get user email for credential storage
  const userEmail = () => authStore.user()?.email || '';

  // Check if already unlocked on mount, or if new user needs setup
  onMount(async () => {
    if (isEncryptionReady()) {
      setUnlocked(true);
      return;
    }

    // Check if this is a new user who needs to set up their passphrase
    const token = authStore.token();
    if (token) {
      try {
        const needsSetup = await checkIsNewUser(token);
        setIsNewUser(needsSetup);
        if (needsSetup) {
          // Generate initial passphrase for new users
          setSetupPassphrase(generatePassphrase(4));
        } else {
          // Existing user - try to auto-fill from credential manager
          tryAutoFill(token);
        }
      } catch (err) {
        console.error('Failed to check user status:', err);
        setIsNewUser(false); // Assume existing user on error
      }
    }
  });

  // Try to auto-fill password from credential manager
  const tryAutoFill = async (token: string) => {
    if (autoFillAttempted()) return;
    setAutoFillAttempted(true);

    const email = userEmail();
    if (!email) return;

    try {
      const savedPassphrase = await getArchiveCredential(email);
      if (savedPassphrase) {
        // Auto-unlock with saved credential
        const result = await initializeEncryption(token, savedPassphrase);
        if (result.success) {
          setUnlocked(true);
        }
      }
    } catch (err) {
      console.error('Auto-fill failed:', err);
    }
  };

  // Prompt user to select from saved credentials
  const handleUsePasswordManager = async () => {
    const token = authStore.token();
    if (!token) return;

    setUnlocking(true);
    setUnlockError('');

    try {
      const credential = await promptForCredential();
      if (credential) {
        const result = await initializeEncryption(token, credential.passphrase);
        if (result.success) {
          setUnlocked(true);
        } else {
          setUnlockError(result.error || 'Failed to unlock archive');
        }
      }
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to retrieve credential');
    } finally {
      setUnlocking(false);
    }
  };

  // Regenerate passphrase
  const handleRegenerate = () => {
    setSetupPassphrase(generatePassphrase(4));
    setCopied(false);
  };

  // Copy passphrase to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(setupPassphrase());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Fetch files when unlocked
  const [files, { refetch }] = createResource(
    () => unlocked() ? authStore.token() : null,
    async (token) => {
      if (!token) return { files: [], folders: [], total: 0 };
      try {
        return await listFiles(token);
      } catch (err) {
        console.error('Failed to list files:', err);
        return { files: [], folders: [], total: 0 };
      }
    }
  );

  // Save passphrase (new user setup)
  const handleSavePassphrase = async (e: Event) => {
    e.preventDefault();
    const token = authStore.token();
    const passphrase = setupPassphrase().trim();
    const email = userEmail();

    if (!token || !passphrase) return;

    setUnlocking(true);
    setUnlockError('');

    try {
      // First, create the archive with the passphrase
      const result = await initializeEncryption(token, passphrase);

      if (!result.success) {
        setUnlockError(result.error || 'Failed to create archive');
        return;
      }

      // Try to save to credential manager
      if (email) {
        const saveResult = await saveArchiveCredential(email, passphrase);

        if (saveResult.success && saveResult.method === 'api') {
          // Successfully saved via Credential API
          setSavedToManager(true);
          // Brief delay to show success, then unlock
          setTimeout(() => {
            setUnlocked(true);
            setSetupPassphrase('');
          }, 1500);
          return;
        } else {
          // API not available or failed - show manual instructions
          setShowManualInstructions(true);
          return;
        }
      }

      // No email available - just unlock
      setUnlocked(true);
      setSetupPassphrase('');
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to create archive');
    } finally {
      setUnlocking(false);
    }
  };

  // Continue after manual save instructions
  const handleContinueAfterManualSave = () => {
    setShowManualInstructions(false);
    setUnlocked(true);
    setSetupPassphrase('');
  };

  // Unlock the archive with password (existing user)
  const handleUnlock = async (e: Event) => {
    e.preventDefault();
    const token = authStore.token();
    if (!token || !password()) return;

    setUnlocking(true);
    setUnlockError('');

    try {
      const result = await initializeEncryption(token, password());

      if (!result.success) {
        setUnlockError(result.error || 'Failed to unlock archive');
        return;
      }

      setUnlocked(true);
      setPassword('');
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to unlock archive');
    } finally {
      setUnlocking(false);
    }
  };

  // Lock the archive
  const handleLock = async () => {
    clearEncryption();
    setUnlocked(false);
    setSelectedFile(null);
    setAutoFillAttempted(false); // Allow auto-fill again on next unlock attempt

    // Prevent credential manager from auto-filling until user interacts again
    await preventSilentAccess();
  };

  // Open a conversation
  const handleOpenConversation = async (file: EncryptedFile) => {
    const token = authStore.token();
    if (!token) return;

    setLoading(true);
    setSelectedFile(file);

    try {
      const { content } = await downloadConversation(token, file.id);
      props.onSelectConversation?.(content, file);
    } catch (err: any) {
      console.error('Failed to open conversation:', err);
      toast.error('Failed to decrypt conversation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete a file
  const handleDelete = async (file: EncryptedFile, e: Event) => {
    e.stopPropagation();

    const confirmed = await confirm({
      title: 'Delete File',
      message: `Delete "${file.filename}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true
    });
    if (!confirmed) return;

    const token = authStore.token();
    if (!token) return;

    try {
      await deleteFile(token, file.id);
      refetch();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  // Handle file upload
  const handleUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;

    const token = authStore.token();
    if (!token) return;

    setUploadProgress('Encrypting and uploading...');

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(`Uploading ${i + 1}/${fileList.length}: ${file.name}`);

        // Parse JSON to extract metadata if it's a conversation
        let metadata: ConversationMetadata | undefined;
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            // Extract metadata from common formats
            metadata = {
              title: parsed.title || parsed.name || file.name,
              provider: parsed.model ? 'openai' : parsed.provider || 'unknown',
              conversationId: parsed.id || parsed.conversation_id,
              created_at: parsed.create_time ? parsed.create_time * 1000 : Date.now(),
              updated_at: parsed.update_time ? parsed.update_time * 1000 : Date.now(),
              message_count: parsed.mapping ? Object.keys(parsed.mapping).length : parsed.messages?.length,
            };
          } catch {
            // Not a JSON we can parse, upload as generic file
          }
        }

        await uploadFile(token, file, {
          folder: 'conversations',
          conversationMetadata: metadata,
          fileRole: metadata ? 'conversation' : undefined,
        });
      }

      setUploadProgress(null);
      refetch();
      input.value = ''; // Reset input
    } catch (err: any) {
      setUploadProgress(null);
      alert('Upload failed: ' + err.message);
    }
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get conversations (files with conversation metadata)
  const conversations = () => {
    const f = files();
    if (!f) return [];
    return f.files.filter(f => f.conversation_id || f.conversation_title);
  };

  // Get other files
  const otherFiles = () => {
    const f = files();
    if (!f) return [];
    return f.files.filter(f => !f.conversation_id && !f.conversation_title);
  };

  return (
    <div class="cloud-archive-browser">
      <Show
        when={unlocked()}
        fallback={
          <Show
            when={isNewUser() !== null}
            fallback={
              <div class="archive-unlock">
                <div class="unlock-icon">🔐</div>
                <p class="unlock-description">Checking archive status...</p>
              </div>
            }
          >
            <Show
              when={isNewUser()}
              fallback={
                /* Existing user - unlock flow */
                <div class="archive-unlock">
                  <div class="unlock-icon">🔐</div>
                  <h3>Cloud Archive</h3>
                  <p class="unlock-description">
                    Enter your passphrase to access your encrypted archive.
                  </p>
                  <form onSubmit={handleUnlock} class="unlock-form">
                    {/* Hidden email field helps password managers associate credentials */}
                    <input
                      type="email"
                      value={userEmail()}
                      autocomplete="username"
                      readonly
                      class="hidden-email"
                      tabIndex={-1}
                    />
                    <input
                      type="password"
                      placeholder="Enter passphrase..."
                      value={password()}
                      onInput={(e) => setPassword(e.currentTarget.value)}
                      class="unlock-input"
                      autocomplete="current-password"
                    />
                    <button
                      type="submit"
                      class="unlock-button"
                      disabled={unlocking() || !password()}
                    >
                      {unlocking() ? 'Unlocking...' : 'Unlock'}
                    </button>
                  </form>
                  <Show when={credentialApiAvailable()}>
                    <button
                      type="button"
                      class="password-manager-button"
                      onClick={handleUsePasswordManager}
                      disabled={unlocking()}
                    >
                      🔑 Use Password Manager
                    </button>
                  </Show>
                  <Show when={unlockError()}>
                    <p class="unlock-error">{unlockError()}</p>
                  </Show>
                  <p class="unlock-hint">
                    Passphrase is case sensitive.
                  </p>
                </div>
              }
            >
              {/* New user - setup flow */}
              <Show
                when={!savedToManager() && !showManualInstructions()}
                fallback={
                  <Show
                    when={savedToManager()}
                    fallback={
                      /* Manual save instructions fallback */
                      <div class="archive-setup manual-instructions">
                        <div class="unlock-icon">📋</div>
                        <h3>{getManualSaveInstructions().title}</h3>
                        <p class="unlock-description">
                          Your archive is ready! Save your passphrase now:
                        </p>

                        <div class="passphrase-display">
                          <code class="passphrase-code">{setupPassphrase()}</code>
                          <button
                            type="button"
                            class="passphrase-action"
                            onClick={handleCopy}
                            title="Copy to clipboard"
                          >
                            {copied() ? '✓ Copied' : '📋 Copy'}
                          </button>
                        </div>

                        <ol class="manual-steps">
                          <For each={getManualSaveInstructions().steps}>
                            {(step) => <li>{step}</li>}
                          </For>
                        </ol>

                        <p class="manual-tip">
                          💡 {getManualSaveInstructions().tip}
                        </p>

                        <button
                          type="button"
                          class="setup-button"
                          onClick={handleContinueAfterManualSave}
                        >
                          I've Saved It - Continue
                        </button>
                      </div>
                    }
                  >
                    {/* Success - saved to credential manager */}
                    <div class="archive-setup saved-success">
                      <div class="unlock-icon">✅</div>
                      <h3>Saved to Password Manager</h3>
                      <p class="unlock-description">
                        Your passphrase has been saved. Opening archive...
                      </p>
                    </div>
                  </Show>
                }
              >
                {/* Initial setup form */}
                <div class="archive-setup">
                  <div class="unlock-icon">🔐</div>
                  <h3>Set Up Cloud Archive</h3>
                  <p class="unlock-description">
                    Your archive will be encrypted with a passphrase that only you know.
                    <br />
                    <strong>We cannot recover this if you lose it.</strong>
                  </p>

                  <form onSubmit={handleSavePassphrase} class="setup-form">
                    {/* Hidden email field helps password managers */}
                    <input
                      type="email"
                      value={userEmail()}
                      autocomplete="username"
                      readonly
                      class="hidden-email"
                      tabIndex={-1}
                    />
                    <label class="setup-label">Your Passphrase</label>
                    <div class="passphrase-container">
                      <input
                        type="text"
                        value={setupPassphrase()}
                        onInput={(e) => setSetupPassphrase(e.currentTarget.value)}
                        class="passphrase-input"
                        autocomplete="new-password"
                        spellcheck={false}
                      />
                      <button
                        type="button"
                        class="passphrase-action"
                        onClick={handleCopy}
                        title="Copy to clipboard"
                      >
                        {copied() ? '✓' : '📋'}
                      </button>
                      <button
                        type="button"
                        class="passphrase-action"
                        onClick={handleRegenerate}
                        title="Generate new passphrase"
                      >
                        🎲
                      </button>
                    </div>

                    <p class="setup-warning">
                      ⚠️ Passphrase is <strong>case sensitive</strong>.
                      {credentialApiAvailable()
                        ? ' We\'ll save it to your password manager.'
                        : ' Save it to your password manager before continuing.'}
                    </p>

                    <button
                      type="submit"
                      class="setup-button"
                      disabled={unlocking() || !setupPassphrase().trim()}
                    >
                      {unlocking() ? 'Creating Archive...' : 'Save & Create Archive'}
                    </button>
                  </form>

                  <Show when={unlockError()}>
                    <p class="unlock-error">{unlockError()}</p>
                  </Show>
                </div>
              </Show>
            </Show>
          </Show>
        }
      >
        <div class="archive-header">
          <span class="archive-status">🔓 Unlocked</span>
          <button class="lock-button" onClick={handleLock} title="Lock archive">
            🔒 Lock
          </button>
        </div>

        {/* Upload Section */}
        <div class="archive-upload">
          <label class="upload-button">
            <input
              type="file"
              accept=".json,.txt,.md"
              multiple
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
            📤 Upload Conversations
          </label>
          <Show when={uploadProgress()}>
            <span class="upload-progress">{uploadProgress()}</span>
          </Show>
        </div>

        {/* File List */}
        <div class="archive-files">
          <Show
            when={!files.loading}
            fallback={<div class="archive-loading">Loading archive...</div>}
          >
            <Show
              when={files()?.total}
              fallback={
                <div class="archive-empty">
                  <p>No files in your archive yet.</p>
                  <p class="archive-hint">Upload ChatGPT or Claude exports to get started.</p>
                </div>
              }
            >
              {/* Conversations */}
              <Show when={conversations().length > 0}>
                <div class="archive-section">
                  <h4 class="section-title">💬 Conversations ({conversations().length})</h4>
                  <For each={conversations()}>
                    {(file) => (
                      <div
                        class={`archive-item ${selectedFile()?.id === file.id ? 'selected' : ''}`}
                        onClick={() => handleOpenConversation(file)}
                      >
                        <div class="item-icon">
                          {file.conversation_provider === 'openai' ? '🤖' : '💬'}
                        </div>
                        <div class="item-info">
                          <div class="item-title">
                            {file.conversation_title || file.filename}
                          </div>
                          <div class="item-meta">
                            {file.message_count ? `${file.message_count} messages • ` : ''}
                            {formatSize(file.size)} • {formatDate(file.created_at)}
                          </div>
                        </div>
                        <button
                          class="item-delete"
                          onClick={(e) => handleDelete(file, e)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* Other Files */}
              <Show when={otherFiles().length > 0}>
                <div class="archive-section">
                  <h4 class="section-title">📁 Files ({otherFiles().length})</h4>
                  <For each={otherFiles()}>
                    {(file) => (
                      <div
                        class={`archive-item ${selectedFile()?.id === file.id ? 'selected' : ''}`}
                        onClick={() => handleOpenConversation(file)}
                      >
                        <div class="item-icon">📄</div>
                        <div class="item-info">
                          <div class="item-title">{file.filename}</div>
                          <div class="item-meta">
                            {formatSize(file.size)} • {formatDate(file.created_at)}
                          </div>
                        </div>
                        <button
                          class="item-delete"
                          onClick={(e) => handleDelete(file, e)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </Show>
        </div>

        {/* Loading Overlay */}
        <Show when={loading()}>
          <div class="archive-loading-overlay">
            <div class="loading-spinner">Decrypting...</div>
          </div>
        </Show>
      </Show>
    </div>
  );
};
