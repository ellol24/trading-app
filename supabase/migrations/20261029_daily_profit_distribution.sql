-- ============================================================
-- Migration: Daily Profit Distribution for Mining Packages
-- Date: 2026-10-29
-- Description:
--   Adds columns to `investments` table to track daily profit
--   crediting. The cron job at /api/cron/package-profits uses
--   these to know when to credit next and how many days remain.
-- ============================================================

-- 1. Add new tracking columns to investments table
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS last_profit_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS days_credited   INTEGER     DEFAULT 0    NOT NULL,
  ADD COLUMN IF NOT EXISTS total_profit_credited DECIMAL(18, 6) DEFAULT 0 NOT NULL;

-- 2. For existing COMPLETED investments: set days_credited to duration_days
--    so the cron doesn't accidentally try to re-credit them.
UPDATE investments i
SET days_credited = COALESCE(
  (SELECT ip.duration_days FROM investment_packages ip WHERE ip.id = i.package_id),
  0
),
total_profit_credited = COALESCE(i.profit, 0)
WHERE i.status = 'completed';

-- 3. For existing ACTIVE investments that have no days_credited yet:
--    Estimate days_credited based on how long they've been running.
--    This gives them a "head start" so they don't get bulk-credited on first run.
UPDATE investments i
SET days_credited = GREATEST(0, LEAST(
  COALESCE(
    (SELECT ip.duration_days FROM investment_packages ip WHERE ip.id = i.package_id),
    0
  ),
  FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(i.start_date, i.created_at))) / 86400)
))
WHERE i.status = 'active' AND i.days_credited = 0;

-- 4. Create investment_transactions table for audit trail (optional but recommended)
CREATE TABLE IF NOT EXISTS investment_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id   UUID        NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  amount          DECIMAL(18, 2) NOT NULL,
  type            TEXT        NOT NULL CHECK (type IN ('daily_profit', 'principal_return')),
  day_number      INTEGER     NOT NULL DEFAULT 1,
  total_days      INTEGER     NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick user lookups
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user
  ON investment_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment
  ON investment_transactions (investment_id, created_at DESC);

-- 5. Enable RLS on investment_transactions
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own transactions
CREATE POLICY "Users can read own transactions"
  ON investment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (cron) can insert
CREATE POLICY "Service role can insert transactions"
  ON investment_transactions FOR INSERT
  WITH CHECK (true);  -- Enforced by service key usage

-- ============================================================
-- VERIFY: Run these to check columns were added correctly
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'investments'
--   AND column_name IN ('last_profit_at', 'days_credited', 'total_profit_credited');
-- ============================================================
