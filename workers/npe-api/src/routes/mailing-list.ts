// Mailing list routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../middleware/auth';
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

    // Send webhook notification (async, don't block response)
    const notificationPromise = (async () => {
      try {
        const topic = c.env.NTFY_TOPIC || 'npe-signups-secret-2024';
        const message = `🎉 New NPE Signup!\n\nName: ${name}\nEmail: ${email}\nInterest: ${interest_comment || 'Not specified'}`;

        await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          headers: {
            'Title': 'NPE Mailing List Signup',
            'Priority': 'high',
            'Tags': 'tada,email'
          },
          body: message
        });
      } catch (err) {
        console.error('Failed to send webhook notification:', err);
      }
    })();

    // Send confirmation email via MailChannels (async, don't block response)
    const emailPromise = (async () => {
      try {
        await fetch('https://api.mailchannels.net/tx/v1/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email, name }]
              }
            ],
            from: {
              email: 'noreply@humanizer.com',
              name: 'Narrative Projection Engine'
            },
            subject: 'Welcome to the NPE Mailing List!',
            content: [
              {
                type: 'text/plain',
                value: `Hi ${name},\n\nThank you for signing up for the Narrative Projection Engine mailing list!\n\nWe're excited to have you on board. You'll be among the first to hear about:\n- New transformation features and models\n- Research updates on allegorical projection\n- Early access opportunities\n- NPE community events\n\nYour interest: ${interest_comment || 'General interest'}\n\nStay tuned for updates!\n\nBest regards,\nThe NPE Team\n\n---\nNarrative Projection Engine\nhttps://humanizer.com`
              },
              {
                type: 'text/html',
                value: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    .feature-list { list-style: none; padding: 0; }
    .feature-list li { padding: 8px 0; padding-left: 25px; position: relative; }
    .feature-list li:before { content: "✨"; position: absolute; left: 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎭 Welcome to NPE!</h1>
  </div>
  <div class="content">
    <p>Hi ${name},</p>
    <p>Thank you for signing up for the <strong>Narrative Projection Engine</strong> mailing list!</p>
    <p>We're excited to have you on board. You'll be among the first to hear about:</p>
    <ul class="feature-list">
      <li>New transformation features and models</li>
      <li>Research updates on allegorical projection</li>
      <li>Early access opportunities</li>
      <li>NPE community events</li>
    </ul>
    ${interest_comment ? `<p><strong>Your interest:</strong> ${interest_comment}</p>` : ''}
    <a href="https://humanizer.com" class="button">Explore NPE →</a>
  </div>
  <div class="footer">
    <p>Narrative Projection Engine<br><a href="https://humanizer.com">humanizer.com</a></p>
  </div>
</body>
</html>
`
              }
            ]
          })
        });
      } catch (err) {
        console.error('Failed to send confirmation email:', err);
      }
    })();

    // Wait for both (but don't fail if they error - we already logged them)
    await Promise.allSettled([notificationPromise, emailPromise]);

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
 * Protected endpoint - requires admin role
 */
mailingListRoutes.get('/export', requireAuth(), requireAdmin(), async (c) => {
  try {
    // This endpoint is protected by requireAuth and requireAdmin middleware
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
 * Protected endpoint - requires admin role
 */
mailingListRoutes.get('/export/csv', requireAuth(), requireAdmin(), async (c) => {
  try {
    // This endpoint is protected by requireAuth and requireAdmin middleware
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
