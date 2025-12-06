-- Day Passes and Promotional Features
-- Adds support for 24-hour day passes and coupon tracking

-- Day passes (one-time 24-hour access)
CREATE TABLE IF NOT EXISTS day_passes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    purchased_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'expired', 'refunded')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Coupon redemptions (track who used what)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stripe_coupon_id TEXT NOT NULL,
    coupon_code TEXT NOT NULL,
    discount_amount_cents INTEGER,
    discount_percent INTEGER,
    subscription_id TEXT,
    redeemed_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mailing list promo tracking (link mailing list signups to promo eligibility)
ALTER TABLE mailing_list ADD COLUMN promo_code_sent INTEGER DEFAULT 0;
ALTER TABLE mailing_list ADD COLUMN promo_code_used INTEGER DEFAULT 0;
ALTER TABLE mailing_list ADD COLUMN promo_sent_at INTEGER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_day_passes_user_id ON day_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_day_passes_expires_at ON day_passes(expires_at);
CREATE INDEX IF NOT EXISTS idx_day_passes_status ON day_passes(status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code ON coupon_redemptions(coupon_code);
