-- =============================================================================
-- 008: IP Tracking & Geolocation
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- Add IP tracking columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ip_address         TEXT,
  ADD COLUMN IF NOT EXISTS ip_country         TEXT,
  ADD COLUMN IF NOT EXISTS ip_country_code    TEXT,
  ADD COLUMN IF NOT EXISTS ip_city            TEXT,
  ADD COLUMN IF NOT EXISTS ip_isp             TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ip_logged_at  TIMESTAMPTZ;

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_ip_country      ON user_profiles(ip_country);
CREATE INDEX IF NOT EXISTS idx_user_profiles_ip_country_code ON user_profiles(ip_country_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen_at    ON user_profiles(last_seen_at DESC);

-- Full IP history table
CREATE TABLE IF NOT EXISTS ip_logs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          REFERENCES user_profiles(uid) ON DELETE CASCADE,
  ip_address    TEXT,
  country       TEXT,
  country_code  TEXT,
  city          TEXT,
  isp           TEXT,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  timezone      TEXT,
  logged_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_logs_user_id   ON ip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_logs_logged_at ON ip_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_logs_country   ON ip_logs(country);
CREATE INDEX IF NOT EXISTS idx_ip_logs_ip        ON ip_logs(ip_address);

-- RLS: only service role can read/write ip_logs (admin use only)
ALTER TABLE ip_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_ip_logs" ON ip_logs;
CREATE POLICY "service_role_all_ip_logs"
  ON ip_logs FOR ALL
  USING (auth.role() = 'service_role');
