-- Migration script to add trading limit fields to user_profiles

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS min_trade_amount NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS suggested_trade_amounts JSONB DEFAULT '[10, 25, 50, 100, 250, 500]'::jsonb;

-- Ensure the fields are readable and writable by admins (already covered by existing RLS on user_profiles usually, but we define defaults here)
