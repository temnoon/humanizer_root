/**
 * User Service
 *
 * User account management for authentication and profiles.
 *
 * Features:
 * - User registration with email/password
 * - Password hashing with bcrypt
 * - Email verification flow
 * - Password reset flow
 * - Admin user management (list, ban, tier changes)
 *
 * @module @humanizer/core/aui/service/user-service
 */

import { randomUUID, createHash, randomBytes } from 'crypto';
import type { Pool } from 'pg';
import {
  INSERT_AUI_USER,
  GET_AUI_USER_BY_ID,
  GET_AUI_USER_BY_EMAIL,
  UPDATE_AUI_USER,
  UPDATE_AUI_USER_PASSWORD,
  UPDATE_AUI_USER_EMAIL_VERIFIED,
  UPDATE_AUI_USER_LOGIN,
  UPDATE_AUI_USER_ACTIVITY,
  BAN_AUI_USER,
  UNBAN_AUI_USER,
  UPDATE_AUI_USER_TIER,
  LIST_AUI_USERS,
  COUNT_AUI_USERS,
  DELETE_AUI_USER,
  INSERT_AUI_PASSWORD_RESET_TOKEN,
  GET_AUI_PASSWORD_RESET_TOKEN,
  USE_AUI_PASSWORD_RESET_TOKEN,
  CLEANUP_AUI_PASSWORD_RESET_TOKENS,
  INSERT_AUI_EMAIL_VERIFICATION_TOKEN,
  GET_AUI_EMAIL_VERIFICATION_TOKEN,
  USE_AUI_EMAIL_VERIFICATION_TOKEN,
  CLEANUP_AUI_EMAIL_VERIFICATION_TOKENS,
} from '../../storage/schema-aui.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User tier/role
 */
export type UserTier = 'free' | 'member' | 'pro' | 'premium' | 'admin';

/**
 * OAuth connection info
 */
export interface OAuthConnection {
  provider: string;
  providerId: string;
  email: string;
  connectedAt: string;
}

/**
 * User record
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  emailVerifiedAt: Date | null;
  displayName: string | null;
  avatarUrl: string | null;
  tier: UserTier;
  bannedAt: Date | null;
  banReason: string | null;
  banExpiresAt: Date | null;
  oauthConnections: OAuthConnection[];
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  loginCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation input
 */
export interface CreateUserInput {
  email: string;
  password?: string;
  displayName?: string;
  avatarUrl?: string;
  tier?: UserTier;
  emailVerified?: boolean;
  oauthConnection?: OAuthConnection;
  metadata?: Record<string, unknown>;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  tier?: UserTier;
  metadata?: Record<string, unknown>;
}

/**
 * List users filter options
 */
export interface ListUsersOptions {
  tier?: UserTier;
  search?: string;
  status?: 'active' | 'banned';
  limit?: number;
  offset?: number;
}

/**
 * Service options
 */
export interface UserServiceOptions {
  defaultTenantId?: string;
  passwordMinLength?: number;
  tokenExpiryHours?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD HASHING (bcrypt-like using scrypt for Node.js compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hash a password using scrypt.
 * Format: $scrypt$N=16384,r=8,p=1$salt$hash
 */
async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes: rb } = await import('crypto');
  const { promisify } = await import('util');
  const scryptAsync = promisify(scrypt);

  const salt = rb(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;

  return `$scrypt$N=16384,r=8,p=1$${salt}$${hash.toString('hex')}`;
}

/**
 * Verify a password against a hash.
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('$scrypt$')) {
    return false;
  }

  const { scrypt } = await import('crypto');
  const { promisify } = await import('util');
  const scryptAsync = promisify(scrypt);

  const parts = storedHash.split('$');
  // $scrypt$N=16384,r=8,p=1$salt$hash
  if (parts.length !== 5) {
    return false;
  }

  const salt = parts[3];
  const expectedHash = parts[4];

  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return hash.toString('hex') === expectedHash;
}

/**
 * Generate a secure random token.
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// USER SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UserService provides user account management.
 */
export class UserService {
  private pool: Pool;
  private options: Required<UserServiceOptions>;

  constructor(pool: Pool, options?: UserServiceOptions) {
    this.pool = pool;
    this.options = {
      defaultTenantId: options?.defaultTenantId ?? 'humanizer',
      passwordMinLength: options?.passwordMinLength ?? 8,
      tokenExpiryHours: options?.tokenExpiryHours ?? 24,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new user account.
   */
  async createUser(input: CreateUserInput, tenantId?: string): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Check if email already exists
    const existing = await this.getUserByEmail(input.email, tenant);
    if (existing) {
      throw new Error('Email already registered');
    }

    // Validate password if provided
    let passwordHash: string | null = null;
    if (input.password) {
      if (input.password.length < this.options.passwordMinLength) {
        throw new Error(`Password must be at least ${this.options.passwordMinLength} characters`);
      }
      passwordHash = await hashPassword(input.password);
    }

    const userId = randomUUID();
    const oauthConnections = input.oauthConnection ? [input.oauthConnection] : [];

    const result = await this.pool.query(INSERT_AUI_USER, [
      userId,
      tenant,
      input.email.toLowerCase().trim(),
      passwordHash,
      input.emailVerified ? new Date() : null,
      input.displayName ?? null,
      input.avatarUrl ?? null,
      input.tier ?? 'free',
      JSON.stringify(oauthConnections),
      JSON.stringify(input.metadata ?? {}),
    ]);

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Create a user from OAuth login (or return existing).
   */
  async findOrCreateOAuthUser(
    provider: string,
    providerId: string,
    email: string,
    displayName?: string,
    avatarUrl?: string,
    tenantId?: string
  ): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Try to find by email first
    const existing = await this.getUserByEmail(email, tenant);
    if (existing) {
      // Add OAuth connection if not already present
      const hasConnection = existing.oauthConnections.some(
        (c) => c.provider === provider && c.providerId === providerId
      );

      if (!hasConnection) {
        // Add the connection
        const connections = [
          ...existing.oauthConnections,
          {
            provider,
            providerId,
            email,
            connectedAt: new Date().toISOString(),
          },
        ];

        await this.pool.query(
          `UPDATE aui_users SET oauth_connections = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [existing.id, tenant, JSON.stringify(connections)]
        );
      }

      return existing;
    }

    // Create new user
    return this.createUser(
      {
        email,
        displayName,
        avatarUrl,
        emailVerified: true, // OAuth emails are verified
        oauthConnection: {
          provider,
          providerId,
          email,
          connectedAt: new Date().toISOString(),
        },
      },
      tenant
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get user by ID.
   */
  async getUserById(userId: string, tenantId?: string): Promise<User | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_USER_BY_ID, [userId, tenant]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Get user by email.
   */
  async getUserByEmail(email: string, tenantId?: string): Promise<User | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(GET_AUI_USER_BY_EMAIL, [
      email.toLowerCase().trim(),
      tenant,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToUser(result.rows[0]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Authenticate user with email and password.
   * Returns user on success, null on failure.
   */
  async authenticateWithPassword(
    email: string,
    password: string,
    tenantId?: string
  ): Promise<User | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(
      `SELECT * FROM aui_users WHERE email = $1 AND tenant_id = $2`,
      [email.toLowerCase().trim(), tenant]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Check if user has a password
    if (!row.password_hash) {
      return null; // OAuth-only user
    }

    // Verify password
    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) {
      return null;
    }

    // Check if banned
    const user = this.rowToUser(row);
    if (user.bannedAt) {
      // Check if ban has expired
      if (!user.banExpiresAt || user.banExpiresAt > new Date()) {
        // Include "banned" in message for auth route detection
        const reason = user.banReason ? `Account banned: ${user.banReason}` : 'Account is banned';
        throw new Error(reason);
      }
      // Ban expired, unban the user
      await this.unbanUser(user.id, tenant);
    }

    // Update login stats
    await this.pool.query(UPDATE_AUI_USER_LOGIN, [user.id, tenant]);

    return user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER UPDATES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update user profile.
   */
  async updateUser(userId: string, input: UpdateUserInput, tenantId?: string): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const result = await this.pool.query(UPDATE_AUI_USER, [
      userId,
      tenant,
      input.email ?? null,
      input.displayName ?? null,
      input.avatarUrl ?? null,
      input.tier ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Change user password.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    tenantId?: string
  ): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    // Get user with password hash
    const result = await this.pool.query(
      `SELECT password_hash FROM aui_users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenant]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0];

    // Verify current password
    if (row.password_hash) {
      const valid = await verifyPassword(currentPassword, row.password_hash);
      if (!valid) {
        throw new Error('Current password is incorrect');
      }
    }

    // Validate new password
    if (newPassword.length < this.options.passwordMinLength) {
      throw new Error(`Password must be at least ${this.options.passwordMinLength} characters`);
    }

    // Update password
    const newHash = await hashPassword(newPassword);
    await this.pool.query(UPDATE_AUI_USER_PASSWORD, [userId, tenant, newHash]);

    return true;
  }

  /**
   * Set user password (admin action, no current password required).
   */
  async setPassword(userId: string, newPassword: string, tenantId?: string): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    if (newPassword.length < this.options.passwordMinLength) {
      throw new Error(`Password must be at least ${this.options.passwordMinLength} characters`);
    }

    const newHash = await hashPassword(newPassword);
    const result = await this.pool.query(UPDATE_AUI_USER_PASSWORD, [userId, tenant, newHash]);

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Mark user email as verified.
   */
  async verifyEmail(userId: string, tenantId?: string): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const result = await this.pool.query(UPDATE_AUI_USER_EMAIL_VERIFIED, [userId, tenant]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Update user's last activity timestamp.
   */
  async updateActivity(userId: string, tenantId?: string): Promise<void> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    await this.pool.query(UPDATE_AUI_USER_ACTIVITY, [userId, tenant]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List users with filters.
   */
  async listUsers(
    options?: ListUsersOptions,
    tenantId?: string
  ): Promise<{ users: User[]; total: number }> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [usersResult, countResult] = await Promise.all([
      this.pool.query(LIST_AUI_USERS, [
        tenant,
        options?.tier ?? null,
        options?.search ?? null,
        options?.status ?? null,
        limit,
        offset,
      ]),
      this.pool.query(COUNT_AUI_USERS, [
        tenant,
        options?.tier ?? null,
        options?.search ?? null,
        options?.status ?? null,
      ]),
    ]);

    return {
      users: usersResult.rows.map((row) => this.rowToUser(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Ban a user.
   */
  async banUser(
    userId: string,
    reason: string,
    expiresAt?: Date,
    tenantId?: string
  ): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const result = await this.pool.query(BAN_AUI_USER, [
      userId,
      tenant,
      reason,
      expiresAt ?? null,
    ]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Unban a user.
   */
  async unbanUser(userId: string, tenantId?: string): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const result = await this.pool.query(UNBAN_AUI_USER, [userId, tenant]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Change user tier.
   */
  async changeTier(userId: string, tier: UserTier, tenantId?: string): Promise<User> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const result = await this.pool.query(UPDATE_AUI_USER_TIER, [userId, tenant, tier]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.rowToUser(result.rows[0]);
  }

  /**
   * Delete a user.
   */
  async deleteUser(userId: string, tenantId?: string): Promise<boolean> {
    const tenant = tenantId ?? this.options.defaultTenantId;
    const result = await this.pool.query(DELETE_AUI_USER, [userId, tenant]);
    return (result.rowCount ?? 0) > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a password reset token.
   * Returns the raw token to be sent to the user.
   */
  async createPasswordResetToken(email: string, tenantId?: string): Promise<string | null> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const user = await this.getUserByEmail(email, tenant);
    if (!user) {
      return null; // Don't reveal if email exists
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.options.tokenExpiryHours * 60 * 60 * 1000);

    await this.pool.query(INSERT_AUI_PASSWORD_RESET_TOKEN, [user.id, tokenHash, expiresAt]);

    return token;
  }

  /**
   * Reset password using a token.
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const tokenHash = hashToken(token);

    const result = await this.pool.query(GET_AUI_PASSWORD_RESET_TOKEN, [tokenHash]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    const row = result.rows[0];
    const userId = row.user_id;

    // Validate new password
    if (newPassword.length < this.options.passwordMinLength) {
      throw new Error(`Password must be at least ${this.options.passwordMinLength} characters`);
    }

    // Update password
    const newHash = await hashPassword(newPassword);
    await this.pool.query(
      `UPDATE aui_users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [userId, newHash]
    );

    // Mark token as used
    await this.pool.query(USE_AUI_PASSWORD_RESET_TOKEN, [row.id]);

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create an email verification token.
   * Returns the raw token to be sent to the user.
   */
  async createEmailVerificationToken(userId: string, tenantId?: string): Promise<string> {
    const tenant = tenantId ?? this.options.defaultTenantId;

    const user = await this.getUserById(userId, tenant);
    if (!user) {
      throw new Error('User not found');
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.options.tokenExpiryHours * 60 * 60 * 1000);

    await this.pool.query(INSERT_AUI_EMAIL_VERIFICATION_TOKEN, [userId, tokenHash, null, expiresAt]);

    return token;
  }

  /**
   * Verify email using a token.
   */
  async verifyEmailWithToken(token: string): Promise<User> {
    const tokenHash = hashToken(token);

    const result = await this.pool.query(GET_AUI_EMAIL_VERIFICATION_TOKEN, [tokenHash]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    const row = result.rows[0];
    const userId = row.user_id;

    // Get user's tenant
    const userResult = await this.pool.query(`SELECT tenant_id FROM aui_users WHERE id = $1`, [
      userId,
    ]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const tenantId = userResult.rows[0].tenant_id;

    // Mark email as verified
    const user = await this.verifyEmail(userId, tenantId);

    // Mark token as used
    await this.pool.query(USE_AUI_EMAIL_VERIFICATION_TOKEN, [row.id]);

    return user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTENANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clean up expired tokens.
   */
  async cleanupExpiredTokens(): Promise<void> {
    await Promise.all([
      this.pool.query(CLEANUP_AUI_PASSWORD_RESET_TOKENS),
      this.pool.query(CLEANUP_AUI_EMAIL_VERIFICATION_TOKENS),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert database row to User object.
   */
  private rowToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      email: row.email as string,
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at as string) : null,
      displayName: row.display_name as string | null,
      avatarUrl: row.avatar_url as string | null,
      tier: row.tier as UserTier,
      bannedAt: row.banned_at ? new Date(row.banned_at as string) : null,
      banReason: row.ban_reason as string | null,
      banExpiresAt: row.ban_expires_at ? new Date(row.ban_expires_at as string) : null,
      oauthConnections: (row.oauth_connections as OAuthConnection[]) ?? [],
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string) : null,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at as string) : null,
      loginCount: (row.login_count as number) ?? 0,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _userService: UserService | null = null;

/**
 * Initialize the global user service.
 */
export function initUserService(pool: Pool, options?: UserServiceOptions): UserService {
  _userService = new UserService(pool, options);
  return _userService;
}

/**
 * Get the global user service.
 */
export function getUserService(): UserService | null {
  return _userService;
}

/**
 * Reset the global user service.
 */
export function resetUserService(): void {
  _userService = null;
}
