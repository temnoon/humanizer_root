// Stripe billing routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';

const stripeRoutes = new Hono<{ Bindings: Env }>();

// Stripe API base URL
const STRIPE_API = 'https://api.stripe.com/v1';

// Price IDs - Configured in Stripe Dashboard (Humanizer Sandbox)
// Monthly subscription prices (no annual until we've existed for a year!)
const PRICE_IDS: Record<string, string> = {
  member: 'price_1SYxjbAan5JVY3W94tofsfOZ',
  pro: 'price_1SYxllAan5JVY3W9TpguSxMZ',
  premium: 'price_1SYxo5Aan5JVY3W93wVtePwk',
  day_pass: '' // Set after creating in Stripe - one-time $2.99
};

// Tax configuration (Lynbrook, NY - Nassau County)
// NY State: 4% + Nassau County: 4.25% + MTA: 0.375% = 8.625%
const TAX_RATE = 0.08625;
const TAX_JURISDICTION = 'Lynbrook, NY (Nassau County)';

// Calculate tax from inclusive price
function calculateTaxFromInclusive(inclusivePriceCents: number): { pretax: number; tax: number } {
  const pretax = Math.round(inclusivePriceCents / (1 + TAX_RATE));
  const tax = inclusivePriceCents - pretax;
  return { pretax, tax };
}

// Day pass pricing (tax-inclusive)
const DAY_PASS_PRICE_CENTS = 299; // $2.99 includes tax
const DAY_PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Trial period configuration
const TRIAL_DAYS = 7;

// Tier mapping from Stripe price to our tier system
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SYxjbAan5JVY3W94tofsfOZ': 'member',
  'price_1SYxllAan5JVY3W9TpguSxMZ': 'pro',
  'price_1SYxo5Aan5JVY3W93wVtePwk': 'premium'
};

/**
 * Helper: Make Stripe API request
 */
async function stripeRequest(
  endpoint: string,
  method: string,
  secret: string,
  body?: Record<string, string | number | boolean | undefined>
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secret}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  let bodyStr: string | undefined;
  if (body) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    }
    bodyStr = params.toString();
  }

  return fetch(`${STRIPE_API}${endpoint}`, {
    method,
    headers,
    body: bodyStr,
  });
}

/**
 * Helper: Verify Stripe webhook signature
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const sigPart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !sigPart) {
    return false;
  }

  const timestamp = timestampPart.slice(2);
  const expectedSig = sigPart.slice(3);

  // Check timestamp is not too old (5 minutes tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === expectedSig;
}

/**
 * Helper: Get or create Stripe customer for user
 */
async function getOrCreateStripeCustomer(
  env: Env,
  userId: string,
  email: string
): Promise<string> {
  // Check if customer already exists
  const existing = await env.DB.prepare(
    'SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?'
  ).bind(userId).first();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }

  // Create new Stripe customer
  const response = await stripeRequest('/customers', 'POST', env.STRIPE_SECRET_KEY, {
    email,
    'metadata[user_id]': userId
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create Stripe customer: ${JSON.stringify(error)}`);
  }

  const customer = await response.json() as { id: string };
  const now = Date.now();

  // Store customer mapping
  await env.DB.prepare(
    'INSERT INTO stripe_customers (id, user_id, stripe_customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, customer.id, now, now).run();

  return customer.id;
}

/**
 * POST /stripe/webhook - Handle Stripe webhook events
 *
 * CRITICAL: This endpoint must NOT require auth - Stripe calls it directly
 */
stripeRoutes.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook not configured' }, 500);
  }

  const payload = await c.req.text();

  // Verify signature
  const isValid = await verifyWebhookSignature(payload, signature, webhookSecret);
  if (!isValid) {
    console.error('Invalid webhook signature');
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const event = JSON.parse(payload) as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };

  // Check for duplicate event (idempotency)
  const existingEvent = await c.env.DB.prepare(
    'SELECT id FROM stripe_events WHERE stripe_event_id = ?'
  ).bind(event.id).first();

  if (existingEvent) {
    return c.json({ received: true, duplicate: true });
  }

  // Log event
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO stripe_events (id, stripe_event_id, event_type, data, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), event.id, event.type, payload, now).run();

  try {
    // Handle event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          customer: string;
          subscription: string;
          payment_intent: string;
          amount_total: number;
          metadata?: { user_id?: string; type?: string };
        };

        // Handle day pass purchase
        if (session.metadata?.type === 'day_pass' && session.metadata?.user_id) {
          const userId = session.metadata.user_id;
          const purchasedAt = now;
          const expiresAt = now + DAY_PASS_DURATION_MS;
          const { pretax, tax } = calculateTaxFromInclusive(DAY_PASS_PRICE_CENTS);

          await c.env.DB.prepare(`
            INSERT INTO day_passes
            (id, user_id, stripe_payment_intent_id, purchased_at, expires_at, amount_cents, tax_cents, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
          `).bind(
            crypto.randomUUID(),
            userId,
            session.payment_intent,
            purchasedAt,
            expiresAt,
            DAY_PASS_PRICE_CENTS,
            tax,
            now
          ).run();
        }
        // Subscription will be handled by subscription.created event
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
          canceled_at: number | null;
          ended_at: number | null;
          items: { data: Array<{ price: { id: string } }> };
        };

        // Get user_id from stripe_customers
        const customerRow = await c.env.DB.prepare(
          'SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ?'
        ).bind(subscription.customer).first();

        if (!customerRow) {
          console.error(`No user found for Stripe customer ${subscription.customer}`);
          break;
        }

        const userId = customerRow.user_id as string;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = PRICE_TO_TIER[priceId] || 'member';

        // Upsert subscription
        const existingSub = await c.env.DB.prepare(
          'SELECT id FROM stripe_subscriptions WHERE stripe_subscription_id = ?'
        ).bind(subscription.id).first();

        if (existingSub) {
          await c.env.DB.prepare(`
            UPDATE stripe_subscriptions SET
              status = ?,
              tier = ?,
              stripe_price_id = ?,
              current_period_start = ?,
              current_period_end = ?,
              cancel_at_period_end = ?,
              canceled_at = ?,
              ended_at = ?,
              updated_at = ?
            WHERE stripe_subscription_id = ?
          `).bind(
            subscription.status,
            tier,
            priceId,
            subscription.current_period_start * 1000,
            subscription.current_period_end * 1000,
            subscription.cancel_at_period_end ? 1 : 0,
            subscription.canceled_at ? subscription.canceled_at * 1000 : null,
            subscription.ended_at ? subscription.ended_at * 1000 : null,
            now,
            subscription.id
          ).run();
        } else {
          await c.env.DB.prepare(`
            INSERT INTO stripe_subscriptions
            (id, user_id, stripe_subscription_id, stripe_price_id, tier, status,
             current_period_start, current_period_end, cancel_at_period_end,
             canceled_at, ended_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            userId,
            subscription.id,
            priceId,
            tier,
            subscription.status,
            subscription.current_period_start * 1000,
            subscription.current_period_end * 1000,
            subscription.cancel_at_period_end ? 1 : 0,
            subscription.canceled_at ? subscription.canceled_at * 1000 : null,
            subscription.ended_at ? subscription.ended_at * 1000 : null,
            now,
            now
          ).run();
        }

        // Update user role based on subscription status
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?')
            .bind(tier, userId).run();
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as {
          id: string;
          customer: string;
        };

        // Get user_id
        const customerRow = await c.env.DB.prepare(
          'SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ?'
        ).bind(subscription.customer).first();

        if (customerRow) {
          const userId = customerRow.user_id as string;

          // Update subscription status
          await c.env.DB.prepare(`
            UPDATE stripe_subscriptions SET status = 'canceled', ended_at = ?, updated_at = ?
            WHERE stripe_subscription_id = ?
          `).bind(now, now, subscription.id).run();

          // Downgrade user to free tier
          await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?')
            .bind('free', userId).run();
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as {
          id: string;
          customer: string;
          payment_intent: string;
          amount_paid: number;
          currency: string;
          lines: { data: Array<{ description: string }> };
        };

        const customerRow = await c.env.DB.prepare(
          'SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ?'
        ).bind(invoice.customer).first();

        if (customerRow) {
          await c.env.DB.prepare(`
            INSERT INTO payment_history
            (id, user_id, stripe_invoice_id, stripe_payment_intent_id, amount_cents, currency, status, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            customerRow.user_id,
            invoice.id,
            invoice.payment_intent,
            invoice.amount_paid,
            invoice.currency,
            'succeeded',
            invoice.lines.data[0]?.description || 'Subscription payment',
            now
          ).run();
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as {
          id: string;
          customer: string;
          payment_intent: string;
          amount_due: number;
          currency: string;
        };

        const customerRow = await c.env.DB.prepare(
          'SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ?'
        ).bind(invoice.customer).first();

        if (customerRow) {
          await c.env.DB.prepare(`
            INSERT INTO payment_history
            (id, user_id, stripe_invoice_id, stripe_payment_intent_id, amount_cents, currency, status, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            customerRow.user_id,
            invoice.id,
            invoice.payment_intent,
            invoice.amount_due,
            invoice.currency,
            'failed',
            'Payment failed',
            now
          ).run();
        }
        break;
      }
    }

    // Mark event as processed
    await c.env.DB.prepare(
      'UPDATE stripe_events SET processed = 1, processed_at = ? WHERE stripe_event_id = ?'
    ).bind(now, event.id).run();

  } catch (error) {
    console.error('Error processing webhook:', error);
    await c.env.DB.prepare(
      'UPDATE stripe_events SET processed = 0, error_message = ? WHERE stripe_event_id = ?'
    ).bind(error instanceof Error ? error.message : 'Unknown error', event.id).run();
  }

  return c.json({ received: true });
});

/**
 * POST /stripe/checkout - Create a checkout session for subscription
 * Supports: trial periods, promo codes
 */
stripeRoutes.post('/checkout', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  try {
    const { tier, successUrl, cancelUrl, promoCode, withTrial } = await c.req.json() as {
      tier: 'member' | 'pro' | 'premium';
      successUrl?: string;
      cancelUrl?: string;
      promoCode?: string;
      withTrial?: boolean;
    };

    if (!tier || !['member', 'pro', 'premium'].includes(tier)) {
      return c.json({ error: 'Invalid tier. Must be member, pro, or premium' }, 400);
    }

    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return c.json({
        error: 'Pricing not configured',
        hint: 'Price IDs must be set in Stripe Dashboard and configured in the API'
      }, 500);
    }

    // Get user email
    const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(auth.userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      c.env,
      auth.userId,
      user.email as string
    );

    // Build checkout session params
    const params: Record<string, string | number | boolean | undefined> = {
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      success_url: successUrl || 'https://humanizer.com/dashboard?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://humanizer.com/pricing',
      'metadata[user_id]': auth.userId,
      'subscription_data[metadata][user_id]': auth.userId,
      allow_promotion_codes: true, // Allow customer to enter promo codes
    };

    // Add trial period if requested
    if (withTrial) {
      params['subscription_data[trial_period_days]'] = TRIAL_DAYS;
    }

    // Pre-apply promo code if provided
    if (promoCode) {
      // Look up the promotion code in Stripe
      const promoResponse = await stripeRequest(
        `/promotion_codes?code=${encodeURIComponent(promoCode)}&active=true`,
        'GET',
        c.env.STRIPE_SECRET_KEY
      );

      if (promoResponse.ok) {
        const promoData = await promoResponse.json() as { data: Array<{ id: string }> };
        if (promoData.data.length > 0) {
          params['discounts[0][promotion_code]'] = promoData.data[0].id;
          // Remove allow_promotion_codes if we're pre-applying one
          delete params.allow_promotion_codes;
        }
      }
    }

    // Create checkout session
    const response = await stripeRequest('/checkout/sessions', 'POST', c.env.STRIPE_SECRET_KEY, params);

    if (!response.ok) {
      const error = await response.json();
      console.error('Stripe checkout error:', error);
      return c.json({ error: 'Failed to create checkout session' }, 500);
    }

    const session = await response.json() as { id: string; url: string };

    return c.json({
      sessionId: session.id,
      url: session.url,
      trialDays: withTrial ? TRIAL_DAYS : 0
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

/**
 * POST /stripe/portal - Create a customer portal session
 */
stripeRoutes.post('/portal', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  try {
    const { returnUrl } = await c.req.json() as { returnUrl?: string };

    // Get Stripe customer ID
    const customerRow = await c.env.DB.prepare(
      'SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?'
    ).bind(auth.userId).first();

    if (!customerRow?.stripe_customer_id) {
      return c.json({
        error: 'No billing account found',
        hint: 'You need an active subscription to access the billing portal'
      }, 404);
    }

    // Create portal session
    const response = await stripeRequest('/billing_portal/sessions', 'POST', c.env.STRIPE_SECRET_KEY, {
      customer: customerRow.stripe_customer_id as string,
      return_url: returnUrl || 'https://humanizer.com/dashboard',
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Stripe portal error:', error);
      return c.json({ error: 'Failed to create portal session' }, 500);
    }

    const session = await response.json() as { url: string };

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

/**
 * GET /stripe/subscription - Get current subscription status
 */
stripeRoutes.get('/subscription', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  const subscription = await c.env.DB.prepare(`
    SELECT
      ss.tier,
      ss.status,
      ss.current_period_start,
      ss.current_period_end,
      ss.cancel_at_period_end,
      ss.canceled_at
    FROM stripe_subscriptions ss
    WHERE ss.user_id = ? AND ss.status IN ('active', 'trialing', 'past_due')
    ORDER BY ss.created_at DESC
    LIMIT 1
  `).bind(auth.userId).first();

  if (!subscription) {
    return c.json({
      tier: 'free',
      status: 'none',
      message: 'No active subscription'
    });
  }

  return c.json({
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === 1,
    canceledAt: subscription.canceled_at
  });
});

/**
 * GET /stripe/history - Get payment history for user
 */
stripeRoutes.get('/history', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  const history = await c.env.DB.prepare(`
    SELECT
      amount_cents,
      currency,
      status,
      description,
      created_at
    FROM payment_history
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(auth.userId).all();

  return c.json({
    payments: history.results.map(row => ({
      amount: (row.amount_cents as number) / 100,
      currency: row.currency,
      status: row.status,
      description: row.description,
      date: row.created_at
    }))
  });
});

/**
 * GET /stripe/prices - Get available subscription prices
 */
stripeRoutes.get('/prices', async (c) => {
  // Return pricing info - these would normally come from Stripe
  // but we hardcode for simplicity and to avoid extra API calls
  return c.json({
    monthly: {
      member: {
        priceId: PRICE_IDS.member || 'not_configured',
        amount: 9.99,
        currency: 'usd',
        features: [
          '50 transformations/month',
          '100K tokens/month',
          'Basic AI detection',
          'Standard support'
        ]
      },
      pro: {
        priceId: PRICE_IDS.pro || 'not_configured',
        amount: 29.99,
        currency: 'usd',
        features: [
          '200 transformations/month',
          '1.6M tokens/month',
          'Advanced AI detection (GPTZero)',
          'Personalizer (personas & styles)',
          'Priority support'
        ]
      },
      premium: {
        priceId: PRICE_IDS.premium || 'not_configured',
        amount: 99.99,
        currency: 'usd',
        features: [
          'Unlimited transformations',
          'Unlimited tokens',
          'Full AI detection suite',
          'Custom personas & styles',
          'API access',
          'Dedicated support'
        ]
      }
    },
    annual: null, // No annual pricing until we've existed for a year!
    dayPass: {
      amount: 2.99,
      currency: 'usd',
      duration: '24 hours',
      features: [
        'Full Pro-tier access for 24 hours',
        'Unlimited transformations',
        'AI detection included',
        'No commitment'
      ],
      taxIncluded: true,
      taxInfo: {
        rate: TAX_RATE,
        jurisdiction: TAX_JURISDICTION,
        ...calculateTaxFromInclusive(DAY_PASS_PRICE_CENTS)
      }
    },
    trial: {
      days: TRIAL_DAYS,
      description: `${TRIAL_DAYS}-day free trial on any subscription`
    }
  });
});

/**
 * POST /stripe/day-pass - Purchase a 24-hour day pass
 */
stripeRoutes.post('/day-pass', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  try {
    const { successUrl, cancelUrl } = await c.req.json() as {
      successUrl?: string;
      cancelUrl?: string;
    };

    // Check if user already has an active day pass
    const activePass = await c.env.DB.prepare(`
      SELECT id, expires_at FROM day_passes
      WHERE user_id = ? AND status = 'active' AND expires_at > ?
    `).bind(auth.userId, Date.now()).first();

    if (activePass) {
      return c.json({
        error: 'You already have an active day pass',
        expiresAt: activePass.expires_at
      }, 400);
    }

    // Get user email
    const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(auth.userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      c.env,
      auth.userId,
      user.email as string
    );

    // Create a payment intent for the day pass
    const response = await stripeRequest('/checkout/sessions', 'POST', c.env.STRIPE_SECRET_KEY, {
      customer: customerId,
      mode: 'payment',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': 'Humanizer Day Pass',
      'line_items[0][price_data][product_data][description]': '24-hour full access to Pro features',
      'line_items[0][price_data][unit_amount]': DAY_PASS_PRICE_CENTS,
      'line_items[0][quantity]': 1,
      success_url: successUrl || 'https://humanizer.com/dashboard?day_pass=success',
      cancel_url: cancelUrl || 'https://humanizer.com/pricing',
      'metadata[user_id]': auth.userId,
      'metadata[type]': 'day_pass',
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Day pass checkout error:', error);
      return c.json({ error: 'Failed to create day pass checkout' }, 500);
    }

    const session = await response.json() as { id: string; url: string };

    return c.json({
      sessionId: session.id,
      url: session.url,
      price: DAY_PASS_PRICE_CENTS / 100,
      duration: '24 hours'
    });
  } catch (error) {
    console.error('Day pass error:', error);
    return c.json({ error: 'Failed to create day pass checkout' }, 500);
  }
});

/**
 * GET /stripe/day-pass - Check active day pass status
 */
stripeRoutes.get('/day-pass', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  const activePass = await c.env.DB.prepare(`
    SELECT id, purchased_at, expires_at, amount_cents, tax_cents
    FROM day_passes
    WHERE user_id = ? AND status = 'active' AND expires_at > ?
    ORDER BY expires_at DESC
    LIMIT 1
  `).bind(auth.userId, Date.now()).first();

  if (!activePass) {
    return c.json({
      active: false,
      message: 'No active day pass'
    });
  }

  return c.json({
    active: true,
    purchasedAt: activePass.purchased_at,
    expiresAt: activePass.expires_at,
    remainingMs: (activePass.expires_at as number) - Date.now(),
    amount: (activePass.amount_cents as number) / 100,
    taxPortion: (activePass.tax_cents as number) / 100
  });
});

/**
 * GET /stripe/access - Check user's current access level (subscription OR day pass)
 */
stripeRoutes.get('/access', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  // Check for active subscription
  const subscription = await c.env.DB.prepare(`
    SELECT tier, status, current_period_end
    FROM stripe_subscriptions
    WHERE user_id = ? AND status IN ('active', 'trialing')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(auth.userId).first();

  if (subscription) {
    return c.json({
      accessLevel: subscription.tier,
      source: subscription.status === 'trialing' ? 'trial' : 'subscription',
      expiresAt: subscription.current_period_end,
      isTrialing: subscription.status === 'trialing'
    });
  }

  // Check for active day pass
  const dayPass = await c.env.DB.prepare(`
    SELECT expires_at FROM day_passes
    WHERE user_id = ? AND status = 'active' AND expires_at > ?
    LIMIT 1
  `).bind(auth.userId, Date.now()).first();

  if (dayPass) {
    return c.json({
      accessLevel: 'pro', // Day pass gives Pro-level access
      source: 'day_pass',
      expiresAt: dayPass.expires_at,
      isTrialing: false
    });
  }

  // Default to free tier
  return c.json({
    accessLevel: 'free',
    source: 'default',
    expiresAt: null,
    isTrialing: false
  });
});

/**
 * POST /stripe/validate-promo - Validate a promo code
 */
stripeRoutes.post('/validate-promo', async (c) => {
  try {
    const { code } = await c.req.json() as { code: string };

    if (!code) {
      return c.json({ error: 'Promo code required' }, 400);
    }

    // Look up the promotion code in Stripe
    const response = await stripeRequest(
      `/promotion_codes?code=${encodeURIComponent(code)}&active=true`,
      'GET',
      c.env.STRIPE_SECRET_KEY
    );

    if (!response.ok) {
      return c.json({ valid: false, error: 'Failed to validate code' });
    }

    const data = await response.json() as {
      data: Array<{
        id: string;
        code: string;
        coupon: {
          percent_off?: number;
          amount_off?: number;
          currency?: string;
          duration: string;
          duration_in_months?: number;
        };
      }>;
    };

    if (data.data.length === 0) {
      return c.json({ valid: false, error: 'Invalid or expired promo code' });
    }

    const promo = data.data[0];
    const coupon = promo.coupon;

    return c.json({
      valid: true,
      code: promo.code,
      discount: coupon.percent_off
        ? { type: 'percent', value: coupon.percent_off }
        : { type: 'amount', value: (coupon.amount_off || 0) / 100, currency: coupon.currency },
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months
    });
  } catch (error) {
    console.error('Promo validation error:', error);
    return c.json({ valid: false, error: 'Failed to validate code' });
  }
});

/**
 * GET /stripe/tax-info - Get tax calculation info
 */
stripeRoutes.get('/tax-info', async (c) => {
  return c.json({
    rate: TAX_RATE,
    ratePercent: (TAX_RATE * 100).toFixed(3) + '%',
    jurisdiction: TAX_JURISDICTION,
    note: 'All prices include applicable sales tax',
    breakdown: {
      nyState: '4.000%',
      nassauCounty: '4.250%',
      mtaSurcharge: '0.375%',
      total: '8.625%'
    },
    examples: {
      member: calculateTaxFromInclusive(999),
      pro: calculateTaxFromInclusive(2999),
      premium: calculateTaxFromInclusive(9999),
      dayPass: calculateTaxFromInclusive(299)
    }
  });
});

export default stripeRoutes;
