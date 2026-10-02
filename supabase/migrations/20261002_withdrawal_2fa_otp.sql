-- ============================================================
-- Migration: Dual 2FA OTP for Withdrawals
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add telegram_chat_id to user_profiles (if missing)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- 2. Create ephemeral OTP storage table
CREATE TABLE IF NOT EXISTS public.withdrawal_otps (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_otp      text        NOT NULL,
  telegram_otp   text        NOT NULL,
  wallet_id      uuid        NOT NULL,
  amount         numeric     NOT NULL,
  fee            numeric     NOT NULL,
  net_amount     numeric     NOT NULL,
  used           boolean     NOT NULL DEFAULT false,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_user_id
  ON public.withdrawal_otps (user_id);

-- 3. Enable RLS — only service-role bypasses it
ALTER TABLE public.withdrawal_otps ENABLE ROW LEVEL SECURITY;
