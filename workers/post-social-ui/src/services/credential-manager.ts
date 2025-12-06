/**
 * Credential Management Service
 *
 * Uses the Credential Management API to save/retrieve archive passphrases
 * in a way that integrates with browser password managers and OS keychains.
 *
 * The archive credential is stored with a distinct identifier to avoid
 * confusion with the user's login credentials.
 */

// Prefix to distinguish archive credentials from login credentials
const ARCHIVE_CREDENTIAL_PREFIX = 'archive:';

/**
 * Check if Credential Management API is available
 */
export function isCredentialApiSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    'PasswordCredential' in window
  );
}

/**
 * Generate the credential ID for archive storage
 * Uses a prefix to distinguish from login credentials
 */
function getArchiveCredentialId(email: string): string {
  return `${ARCHIVE_CREDENTIAL_PREFIX}${email}`;
}

/**
 * Save archive passphrase to the browser's credential manager
 *
 * @param email - User's email (used as identifier)
 * @param passphrase - The archive passphrase to save
 * @returns true if saved successfully, false if API not supported or failed
 */
export async function saveArchiveCredential(
  email: string,
  passphrase: string
): Promise<{ success: boolean; method: 'api' | 'manual'; error?: string }> {
  if (!isCredentialApiSupported()) {
    return { success: false, method: 'manual', error: 'Credential API not supported' };
  }

  try {
    // Create a PasswordCredential object
    // The 'id' field is what password managers use to identify the credential
    // We prefix with 'archive:' to distinguish from login credentials
    const credential = new PasswordCredential({
      id: getArchiveCredentialId(email),
      password: passphrase,
      name: `Humanizer Archive (${email})`,
    });

    // Store the credential
    // This should trigger the browser's "Save password?" prompt
    await navigator.credentials.store(credential);

    // Note: store() doesn't always indicate success clearly
    // Some browsers return the credential, some return undefined
    return { success: true, method: 'api' };
  } catch (err: any) {
    console.error('Failed to save credential:', err);
    return {
      success: false,
      method: 'manual',
      error: err.message || 'Failed to save to password manager'
    };
  }
}

/**
 * Retrieve archive passphrase from the browser's credential manager
 *
 * @param email - User's email (used as identifier)
 * @returns The passphrase if found, null otherwise
 */
export async function getArchiveCredential(
  email: string
): Promise<string | null> {
  if (!isCredentialApiSupported()) {
    return null;
  }

  try {
    // Request credential with mediation: 'optional' to allow silent retrieval
    // if the user has previously allowed it
    const credential = await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    }) as PasswordCredential | null;

    if (!credential) {
      return null;
    }

    // Check if this is an archive credential (has our prefix)
    const expectedId = getArchiveCredentialId(email);
    if (credential.id === expectedId) {
      return credential.password || null;
    }

    // Also check without prefix for backwards compatibility
    if (credential.id === email) {
      return credential.password || null;
    }

    return null;
  } catch (err) {
    console.error('Failed to retrieve credential:', err);
    return null;
  }
}

/**
 * Prompt user to select from available credentials
 * Useful when auto-fill doesn't work
 *
 * @returns The selected credential's password, or null
 */
export async function promptForCredential(): Promise<{
  email: string;
  passphrase: string
} | null> {
  if (!isCredentialApiSupported()) {
    return null;
  }

  try {
    // Request with mediation: 'required' to always show the picker
    const credential = await navigator.credentials.get({
      password: true,
      mediation: 'required',
    }) as PasswordCredential | null;

    if (!credential || !credential.password) {
      return null;
    }

    // Extract email from credential ID (remove archive: prefix if present)
    let email = credential.id;
    if (email.startsWith(ARCHIVE_CREDENTIAL_PREFIX)) {
      email = email.slice(ARCHIVE_CREDENTIAL_PREFIX.length);
    }

    return {
      email,
      passphrase: credential.password,
    };
  } catch (err) {
    console.error('Failed to prompt for credential:', err);
    return null;
  }
}

/**
 * Prevent automatic sign-in for this session
 * Call this when user explicitly locks their archive
 */
export async function preventSilentAccess(): Promise<void> {
  if (!isCredentialApiSupported()) {
    return;
  }

  try {
    await navigator.credentials.preventSilentAccess();
  } catch (err) {
    console.error('Failed to prevent silent access:', err);
  }
}

/**
 * Create a manual save instruction for browsers that don't support
 * the Credential Management API
 */
export function getManualSaveInstructions(): {
  title: string;
  steps: string[];
  tip: string;
} {
  // Detect browser/OS for tailored instructions
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isMac = /Mac/.test(ua);
  const isIOS = /iPhone|iPad/.test(ua);

  if (isIOS) {
    return {
      title: 'Save to iCloud Keychain',
      steps: [
        'Copy your passphrase using the copy button',
        'Open Settings > Passwords',
        'Tap the + button to add a new password',
        'Enter "humanizer.com" as the website',
        'Use your email as username',
        'Paste the passphrase as the password',
      ],
      tip: 'iCloud Keychain will sync this across all your Apple devices.',
    };
  }

  if (isSafari && isMac) {
    return {
      title: 'Save to Keychain',
      steps: [
        'Copy your passphrase using the copy button',
        'Open Safari > Settings > Passwords',
        'Click the + button',
        'Enter "humanizer.com" as the website',
        'Use your email as username',
        'Paste the passphrase as the password',
      ],
      tip: 'Keychain will sync this across all your Apple devices.',
    };
  }

  if (isChrome) {
    return {
      title: 'Save to Chrome',
      steps: [
        'Copy your passphrase using the copy button',
        'Go to chrome://settings/passwords',
        'Click "Add" next to "Saved Passwords"',
        'Enter "humanizer.com" as the site',
        'Use your email as username',
        'Paste the passphrase as the password',
      ],
      tip: 'Chrome will sync this if you\'re signed in.',
    };
  }

  if (isFirefox) {
    return {
      title: 'Save to Firefox',
      steps: [
        'Copy your passphrase using the copy button',
        'Go to about:logins',
        'Click "Create New Login"',
        'Enter "humanizer.com" as the site',
        'Use your email as username',
        'Paste the passphrase as the password',
      ],
      tip: 'Firefox will sync this if you\'re signed in.',
    };
  }

  // Generic instructions
  return {
    title: 'Save to Password Manager',
    steps: [
      'Copy your passphrase using the copy button',
      'Open your password manager',
      'Create a new entry for "humanizer.com"',
      'Use your email as the username',
      'Paste the passphrase as the password',
    ],
    tip: 'Using a password manager ensures you never lose access.',
  };
}
