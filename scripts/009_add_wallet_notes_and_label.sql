-- Migration 009: Add admin-only notes and label fields to deposit_wallets
-- Run this in Supabase SQL Editor

ALTER TABLE deposit_wallets
  ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS label       TEXT DEFAULT NULL;

COMMENT ON COLUMN deposit_wallets.admin_notes IS 'Internal admin notes — not shown to users';
COMMENT ON COLUMN deposit_wallets.label        IS 'Friendly label for admins (e.g. "Bybit Main", "Binance Backup")';
