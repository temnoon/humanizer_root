// Mailing list routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type {
  Env,
  MailingListSignupRequest,
  MailingListSignupResponse,
  MailingListEntry
} from '../../shared/types';

const mailingListRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /mailing-list/signup - Add email to mailing list
 * Public endpoint - no authentication required
 */
mailingListRoutes.post('/signup', async (c) => {
  try {
    const { name, email, interest_comment }: MailingListSignupRequest = await c.req.json();

    // Validate input
    if (!name || !email) {
      return c.json({
        success: false,
        message: 'Name and email are required'
      } as MailingListSignupResponse, 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({
        success: false,
        message: 'Invalid email format'
      } as MailingListSignupResponse, 400);
    }

    // Check if email already exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM mailing_list WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return c.json({
        success: false,
        message: 'This email is already subscribed to our mailing list'
      } as MailingListSignupResponse, 409);
    }

    // Insert into database
    await c.env.DB.prepare(
      'INSERT INTO mailing_list (name, email, interest_comment) VALUES (?, ?, ?)'
    ).bind(name, email, interest_comment || null).run();

    return c.json({
      success: true,
      message: 'Successfully added to mailing list!'
    } as MailingListSignupResponse, 201);

  } catch (error) {
    console.error('Mailing list signup error:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    } as MailingListSignupResponse, 500);
  }
});

/**
 * GET /mailing-list/export - Export all mailing list entries
 * Protected endpoint - requires authentication
 */
mailingListRoutes.get('/export', requireAuth(), async (c) => {
  try {
    // This endpoint should be protected by requireAuth middleware in main app
    const auth = c.get('auth');

    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all mailing list entries ordered by creation date
    const result = await c.env.DB.prepare(
      'SELECT id, name, email, interest_comment, created_at FROM mailing_list ORDER BY created_at DESC'
    ).all();

    const entries: MailingListEntry[] = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      interest_comment: row.interest_comment || undefined,
      created_at: row.created_at
    }));

    return c.json({
      count: entries.length,
      entries
    }, 200);

  } catch (error) {
    console.error('Mailing list export error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /mailing-list/export/csv - Export mailing list as CSV
 * Protected endpoint - requires authentication
 */
mailingListRoutes.get('/export/csv', requireAuth(), async (c) => {
  try {
    // This endpoint should be protected by requireAuth middleware in main app
    const auth = c.get('auth');

    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all mailing list entries ordered by creation date
    const result = await c.env.DB.prepare(
      'SELECT id, name, email, interest_comment, created_at FROM mailing_list ORDER BY created_at DESC'
    ).all();

    // Build CSV
    const headers = 'ID,Name,Email,Interest Comment,Created At';
    const rows = result.results.map((row: any) => {
      const comment = (row.interest_comment || '').replace(/"/g, '""'); // Escape quotes
      return `${row.id},"${row.name}","${row.email}","${comment}","${row.created_at}"`;
    });

    const csv = [headers, ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="npe-mailing-list-${Date.now()}.csv"`
      }
    });

  } catch (error) {
    console.error('Mailing list CSV export error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default mailingListRoutes;
