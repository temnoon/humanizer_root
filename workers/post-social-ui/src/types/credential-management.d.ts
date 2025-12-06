/**
 * Type definitions for the Credential Management API
 * https://developer.mozilla.org/en-US/docs/Web/API/Credential_Management_API
 */

interface PasswordCredentialData {
  id: string;
  name?: string;
  password: string;
  iconURL?: string;
}

declare class PasswordCredential extends Credential {
  constructor(data: PasswordCredentialData);
  readonly password: string;
  readonly name: string;
  readonly iconURL: string;
}

interface CredentialRequestOptions {
  password?: boolean;
  federated?: FederatedCredentialRequestOptions;
  publicKey?: PublicKeyCredentialRequestOptions;
  mediation?: CredentialMediationRequirement;
  signal?: AbortSignal;
}

interface FederatedCredentialRequestOptions {
  providers: string[];
  protocols?: string[];
}

interface Window {
  PasswordCredential: typeof PasswordCredential;
}
