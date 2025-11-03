// WebAuthn routes for device-based authentication
import { Hono } from 'hono';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { requireAuth, requireAdmin } from '../middleware/auth';
import type { Env } from '../../shared/types';

const webauthnRoutes = new Hono<{ Bindings: Env }>();

// RP (Relying Party) configuration
const RP_NAME = 'Narrative Projection Engine';
const RP_ID = 'humanizer.com'; // Your domain

// Helper functions for base64 encoding/decoding (Workers-compatible)
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * POST /webauthn/register-challenge
 * Generate challenge for device registration
 * Requires: Admin user authenticated
 */
webauthnRoutes.post('/register-challenge', requireAuth(), requireAdmin(), async (c) => {
  try {
    const auth = c.get('auth');

    // Get user's existing credentials
    const existingCreds = await c.env.DB.prepare(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?'
    ).bind(auth.userId).all();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: auth.userId,
      userName: auth.email,
      attestationType: 'none',
      excludeCredentials: existingCreds.results.map((cred: any) => ({
        id: base64ToUint8Array(cred.credential_id),
        type: 'public-key' as const,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge in KV for verification (expires in 5 minutes)
    await c.env.KV.put(
      `webauthn:challenge:${auth.userId}`,
      options.challenge,
      { expirationTtl: 300 }
    );

    return c.json(options);
  } catch (error) {
    console.error('Register challenge error:', error);
    return c.json({ error: 'Failed to generate registration challenge' }, 500);
  }
});

/**
 * POST /webauthn/register-verify
 * Verify and save device registration
 * Requires: Admin user authenticated
 */
webauthnRoutes.post('/register-verify', requireAuth(), requireAdmin(), async (c) => {
  try {
    const auth = c.get('auth');
    const { response, deviceName } = await c.req.json<{
      response: RegistrationResponseJSON;
      deviceName: string;
    }>();

    if (!deviceName || deviceName.trim().length === 0) {
      return c.json({ error: 'Device name is required' }, 400);
    }

    // Get stored challenge
    const expectedChallenge = await c.env.KV.get(`webauthn:challenge:${auth.userId}`);
    if (!expectedChallenge) {
      return c.json({ error: 'Challenge expired or not found' }, 400);
    }

    // Verify registration
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: `https://${RP_ID}`,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: 'Verification failed' }, 400);
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // Store credential in database
    const credentialId = uint8ArrayToBase64(credentialID);
    const publicKey = uint8ArrayToBase64(credentialPublicKey);
    const transports = response.response.transports
      ? JSON.stringify(response.response.transports)
      : null;

    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO webauthn_credentials
      (id, user_id, credential_id, public_key, counter, device_name, transports, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, auth.userId, credentialId, publicKey, counter, deviceName.trim(), transports, now).run();

    // Clean up challenge
    await c.env.KV.delete(`webauthn:challenge:${auth.userId}`);

    return c.json({
      verified: true,
      deviceId: id,
      deviceName: deviceName.trim(),
    });
  } catch (error) {
    console.error('Register verify error:', error);
    return c.json({ error: 'Failed to verify registration' }, 500);
  }
});

/**
 * POST /webauthn/login-challenge
 * Generate challenge for WebAuthn authentication
 * Public endpoint - no auth required
 */
webauthnRoutes.post('/login-challenge', async (c) => {
  try {
    const { email } = await c.req.json<{ email: string }>();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Find user
    const userRow = await c.env.DB.prepare(
      'SELECT id, email, role FROM users WHERE email = ?'
    ).bind(email).first();

    if (!userRow) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user's credentials
    const creds = await c.env.DB.prepare(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?'
    ).bind(userRow.id).all();

    if (creds.results.length === 0) {
      return c.json({ error: 'No devices registered for this user' }, 404);
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: creds.results.map((cred: any) => ({
        id: base64ToUint8Array(cred.credential_id),
        type: 'public-key' as const,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      })),
      userVerification: 'preferred',
    });

    // Store challenge in KV (expires in 5 minutes)
    await c.env.KV.put(
      `webauthn:auth:${email}`,
      options.challenge,
      { expirationTtl: 300 }
    );

    return c.json(options);
  } catch (error) {
    console.error('Login challenge error:', error);
    return c.json({ error: 'Failed to generate login challenge' }, 500);
  }
});

/**
 * POST /webauthn/login-verify
 * Verify WebAuthn login and issue JWT
 * Public endpoint - no auth required
 */
webauthnRoutes.post('/login-verify', async (c) => {
  try {
    const { email, response } = await c.req.json<{
      email: string;
      response: AuthenticationResponseJSON;
    }>();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Get stored challenge
    const expectedChallenge = await c.env.KV.get(`webauthn:auth:${email}`);
    if (!expectedChallenge) {
      return c.json({ error: 'Challenge expired or not found' }, 400);
    }

    // Find user
    const userRow = await c.env.DB.prepare(
      'SELECT id, email, role FROM users WHERE email = ?'
    ).bind(email).first();

    if (!userRow) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Find credential
    const credId = response.rawId; // This is already base64 from the client
    const credRow = await c.env.DB.prepare(
      'SELECT id, public_key, counter FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?'
    ).bind(credId, userRow.id).first();

    if (!credRow) {
      return c.json({ error: 'Credential not found' }, 404);
    }

    // Verify authentication
    const publicKey = base64ToUint8Array(credRow.public_key as string);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: `https://${RP_ID}`,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64ToUint8Array(credId),
        credentialPublicKey: publicKey,
        counter: credRow.counter as number,
      },
    });

    if (!verification.verified) {
      return c.json({ error: 'Verification failed' }, 400);
    }

    // Update counter and last_used
    const now = Date.now();
    await c.env.DB.prepare(
      'UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?'
    ).bind(verification.authenticationInfo.newCounter, now, credRow.id).run();

    // Update user last_login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    ).bind(now, userRow.id).run();

    // Generate JWT token (import from auth.ts)
    const { generateToken } = await import('../middleware/auth');
    const token = await generateToken(
      userRow.id as string,
      userRow.email as string,
      userRow.role as string,
      c.env.JWT_SECRET
    );

    // Clean up challenge
    await c.env.KV.delete(`webauthn:auth:${email}`);

    return c.json({
      verified: true,
      user: {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role,
      },
      token,
    });
  } catch (error) {
    console.error('Login verify error:', error);
    return c.json({ error: 'Failed to verify login' }, 500);
  }
});

/**
 * GET /webauthn/devices
 * List user's registered devices
 * Requires: Authenticated user
 */
webauthnRoutes.get('/devices', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');

    const devices = await c.env.DB.prepare(`
      SELECT id, device_name, created_at, last_used_at
      FROM webauthn_credentials
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(auth.userId).all();

    return c.json({
      devices: devices.results.map((d: any) => ({
        id: d.id,
        deviceName: d.device_name,
        createdAt: d.created_at,
        lastUsedAt: d.last_used_at,
      })),
    });
  } catch (error) {
    console.error('List devices error:', error);
    return c.json({ error: 'Failed to list devices' }, 500);
  }
});

/**
 * DELETE /webauthn/devices/:id
 * Revoke a device
 * Requires: Authenticated user (can only revoke own devices)
 */
webauthnRoutes.delete('/devices/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    const deviceId = c.req.param('id');

    // Verify device belongs to user
    const device = await c.env.DB.prepare(
      'SELECT id FROM webauthn_credentials WHERE id = ? AND user_id = ?'
    ).bind(deviceId, auth.userId).first();

    if (!device) {
      return c.json({ error: 'Device not found' }, 404);
    }

    // Delete device
    await c.env.DB.prepare(
      'DELETE FROM webauthn_credentials WHERE id = ?'
    ).bind(deviceId).run();

    return c.json({ success: true, message: 'Device revoked' });
  } catch (error) {
    console.error('Delete device error:', error);
    return c.json({ error: 'Failed to revoke device' }, 500);
  }
});

export default webauthnRoutes;
