/**
 * Pricing Page - Stripe Integration
 *
 * Shows subscription tiers, day passes, and handles checkout flow.
 * Users can subscribe with optional trial and promo codes.
 */

import { Component, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { authStore } from '@/stores/auth';
import { AUTH_API_URL } from '@/config/constants';
import '@/styles/pricing.css';

// Keyboard navigation helper
const TIERS = ['member', 'pro', 'premium'] as const;

interface PriceInfo {
  priceId: string;
  amount: number;
  currency: string;
  features: string[];
}

interface PricingData {
  monthly: {
    member: PriceInfo;
    pro: PriceInfo;
    premium: PriceInfo;
  };
  dayPass: {
    amount: number;
    duration: string;
    features: string[];
  };
  trial: {
    days: number;
    description: string;
  };
}

interface AccessInfo {
  accessLevel: string;
  source: string;
  expiresAt: number | null;
  isTrialing: boolean;
}

export const PricingPage: Component = () => {
  const navigate = useNavigate();

  const [pricing, setPricing] = createSignal<PricingData | null>(null);
  const [access, setAccess] = createSignal<AccessInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [checkoutLoading, setCheckoutLoading] = createSignal<string | null>(null);
  const [promoCode, setPromoCode] = createSignal('');
  const [promoValid, setPromoValid] = createSignal<boolean | null>(null);
  const [promoMessage, setPromoMessage] = createSignal('');
  const [withTrial, setWithTrial] = createSignal(true);
  const [error, setError] = createSignal('');
  const [selectedTier, setSelectedTier] = createSignal<number>(1); // Default to Pro (index 1)

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (loading()) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedTier(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedTier(prev => Math.min(TIERS.length - 1, prev + 1));
        break;
      case 'Enter':
        e.preventDefault();
        const tier = TIERS[selectedTier()];
        if (tier) checkout(tier);
        break;
    }
  };

  onMount(async () => {
    await loadPricing();
    if (authStore.isAuthenticated()) {
      await loadAccess();
    }
    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  const loadPricing = async () => {
    try {
      const res = await fetch(`${AUTH_API_URL}/stripe/prices`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setPricing(data);
    } catch (err) {
      console.error('Failed to load pricing:', err);
      setError(`Failed to load pricing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAccess = async () => {
    try {
      const res = await fetch(`${AUTH_API_URL}/stripe/access`, {
        headers: { 'Authorization': `Bearer ${authStore.token()}` }
      });
      const data = await res.json();
      setAccess(data);
    } catch (err) {
      console.error('Failed to load access:', err);
    }
  };

  const validatePromo = async () => {
    const code = promoCode().trim();
    if (!code) {
      setPromoValid(null);
      setPromoMessage('');
      return;
    }

    try {
      const res = await fetch(`${AUTH_API_URL}/stripe/validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();

      if (data.valid) {
        setPromoValid(true);
        const discount = data.discount.type === 'percent'
          ? `${data.discount.value}% off`
          : `$${data.discount.value} off`;
        setPromoMessage(`${discount} applied!`);
      } else {
        setPromoValid(false);
        setPromoMessage(data.error || 'Invalid code');
      }
    } catch (err) {
      setPromoValid(false);
      setPromoMessage('Failed to validate');
    }
  };

  const checkout = async (tier: 'member' | 'pro' | 'premium') => {
    if (!authStore.isAuthenticated()) {
      navigate('/login?redirect=/pricing');
      return;
    }

    setCheckoutLoading(tier);
    setError('');

    try {
      const body: Record<string, unknown> = {
        tier,
        withTrial: withTrial(),
        successUrl: `${window.location.origin}/app?upgrade=success`,
        cancelUrl: `${window.location.origin}/pricing`
      };

      if (promoValid()) {
        body.promoCode = promoCode().trim();
      }

      const res = await fetch(`${AUTH_API_URL}/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token()}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const buyDayPass = async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login?redirect=/pricing');
      return;
    }

    setCheckoutLoading('daypass');
    setError('');

    try {
      const res = await fetch(`${AUTH_API_URL}/stripe/day-pass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token()}`
        },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/app?daypass=success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openPortal = async () => {
    try {
      const res = await fetch(`${AUTH_API_URL}/stripe/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token()}`
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/pricing`
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError('Failed to open billing portal');
    }
  };

  const tierLabels: Record<string, string> = {
    member: 'Standard',
    pro: 'Professional',
    premium: 'Premium'
  };

  return (
    <div class="pricing-page">
      <header class="pricing-header">
        <h1>Upgrade Your Membership</h1>
        <p class="subtitle">Choose the plan that's right for you</p>

        <Show when={authStore.isAuthenticated()}>
          <div class="current-access">
            <Show when={access()}>
              <span class="access-badge" data-level={access()!.accessLevel}>
                {access()!.accessLevel.toUpperCase()}
                {access()!.isTrialing && ' (Trial)'}
              </span>
              <Show when={access()!.source !== 'default'}>
                <button class="manage-btn" onClick={openPortal}>
                  Manage Billing
                </button>
              </Show>
            </Show>
          </div>
        </Show>
      </header>

      <Show when={error()}>
        <div class="error-banner">{error()}</div>
      </Show>

      <Show when={!loading()} fallback={<div class="loading">Loading pricing...</div>}>
        {/* Options */}
        <div class="pricing-options">
          <label class="option-checkbox">
            <input
              type="checkbox"
              checked={withTrial()}
              onChange={(e) => setWithTrial(e.currentTarget.checked)}
            />
            <span>Include 7-day free trial</span>
          </label>
        </div>

        {/* Promo Code */}
        <div class="promo-section">
          <div class="promo-input">
            <input
              type="text"
              placeholder="Promo code"
              value={promoCode()}
              onInput={(e) => setPromoCode(e.currentTarget.value)}
              onKeyPress={(e) => e.key === 'Enter' && validatePromo()}
            />
            <button onClick={validatePromo}>Apply</button>
          </div>
          <Show when={promoMessage()}>
            <div class={`promo-result ${promoValid() ? 'valid' : 'invalid'}`}>
              {promoMessage()}
            </div>
          </Show>
        </div>

        {/* Pricing Grid */}
        <div class="pricing-grid" role="listbox" aria-label="Subscription plans">
          <For each={TIERS}>
            {(tier, index) => {
              const info = pricing()?.monthly[tier];
              const isPopular = tier === 'pro';
              const isCurrent = access()?.accessLevel === tier;
              const isSelected = () => selectedTier() === index();

              return (
                <div
                  class={`pricing-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''} ${isSelected() ? 'selected' : ''}`}
                  role="option"
                  aria-selected={isSelected()}
                  tabindex={isSelected() ? 0 : -1}
                  onClick={() => setSelectedTier(index())}
                  onKeyPress={(e) => e.key === 'Enter' && checkout(tier)}>
                  <Show when={isPopular}>
                    <div class="popular-badge">MOST POPULAR</div>
                  </Show>
                  <Show when={isCurrent}>
                    <div class="current-badge">CURRENT PLAN</div>
                  </Show>

                  <div class="tier-name">{tierLabels[tier]}</div>
                  <div class="price">
                    ${info?.amount.toFixed(2)}
                    <span>/month</span>
                  </div>
                  <div class="tax-note">Tax included (8.625% NY)</div>

                  <ul class="features">
                    <For each={info?.features || []}>
                      {(feature) => <li>{feature}</li>}
                    </For>
                  </ul>

                  <button
                    class={`upgrade-btn ${isPopular ? 'primary' : 'secondary'}`}
                    disabled={checkoutLoading() !== null || isCurrent}
                    onClick={() => checkout(tier)}
                  >
                    {checkoutLoading() === tier ? 'Loading...' :
                     isCurrent ? 'Current Plan' :
                     tier === 'member' ? 'Get Started' :
                     tier === 'pro' ? 'Upgrade to Pro' : 'Go Premium'}
                  </button>
                </div>
              );
            }}
          </For>
        </div>

        {/* Day Pass */}
        <div class="day-pass-section">
          <h3>Just need a quick fix?</h3>
          <p>
            <strong>${pricing()?.dayPass.amount.toFixed(2)}</strong> for {pricing()?.dayPass.duration} of full Pro access.
            No commitment.
          </p>
          <button
            class="day-pass-btn"
            disabled={checkoutLoading() !== null}
            onClick={buyDayPass}
          >
            {checkoutLoading() === 'daypass' ? 'Loading...' : 'Buy Day Pass'}
          </button>
        </div>

        {/* Not logged in prompt */}
        <Show when={!authStore.isAuthenticated()}>
          <div class="login-prompt">
            <p>Already have an account?</p>
            <button onClick={() => navigate('/login?redirect=/pricing')}>
              Sign in to upgrade
            </button>
          </div>
        </Show>
      </Show>

      <footer class="pricing-footer">
        <p>Powered by Stripe &bull; Secure payments</p>
        <p class="test-mode">Test mode: Use card 4242 4242 4242 4242</p>
        <div class="site-footer-links" style={{ "margin-top": "var(--space-lg)" }}>
          <A href="/privacy">Privacy</A>
          <A href="/terms">Terms</A>
          <A href="/transparency">Transparency</A>
          <A href="/login">Sign In</A>
        </div>
        <p class="site-footer-copyright">© 2026 humanizer.com</p>
      </footer>
    </div>
  );
};
