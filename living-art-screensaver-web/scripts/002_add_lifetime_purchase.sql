-- One-time "Own it forever" purchase ($15.99). A lifetime buyer keeps their
-- subscriptions row (one row per user); these columns mark the purchase and
-- are never touched by the recurring-subscription sync, so a later
-- subscription event can't clobber lifetime access.
--
-- Access rule (see `isSubscriptionActive` in @screensaver-art/constants):
--   lifetime_purchased_at IS NOT NULL  OR  status IN ('active', 'trialing')
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS lifetime_purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifetime_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
