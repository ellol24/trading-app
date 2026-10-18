-- ============================================================
-- Migration: Notifications, Referral Milestones, Broadcasts
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info', -- info | success | warning | alert | broadcast | welcome | trading_alert
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (for admin broadcasts)
CREATE POLICY "Service role full access" ON notifications
  FOR ALL USING (true);

-- Enable realtime
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 2. REFERRAL MILESTONES TABLE
CREATE TABLE IF NOT EXISTS referral_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
  milestone_count INTEGER NOT NULL,  -- 5, 10, 20, 50, 100, 200
  reward_amount NUMERIC(10,2) NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, milestone_count)
);

CREATE INDEX IF NOT EXISTS idx_referral_milestones_user ON referral_milestones(user_id);

ALTER TABLE referral_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own milestones" ON referral_milestones
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on milestones" ON referral_milestones
  FOR ALL USING (true);

-- 3. BROADCASTS TABLE (admin message log)
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES user_profiles(uid),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all' | 'user'
  target_user_id UUID REFERENCES user_profiles(uid),
  notification_type TEXT NOT NULL DEFAULT 'info',
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only broadcasts" ON broadcasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- 4. SYSTEM SETTINGS — add welcome_message and trading_alert keys
INSERT INTO system_settings (key, value) VALUES
(
  'welcome_message',
  '{
    "title": "Welcome to Xspy Trader! 🚀",
    "message": "We are thrilled to have you join Xspy Trader — the professional platform for binary options trading and passive investment packages.\n\nHow you earn:\n• 📈 **Trading Sessions**: Participate in live trading rounds managed by our expert team and earn up to 50% profit per session.\n• 💼 **Investment Packages**: Choose from curated mining and investment packages that generate daily returns.\n• 👥 **Referral Program**: Invite friends and earn up to 10% commission on Level 1, 7% on Level 2, and 2% on Level 3 referrals — for life!\n\nWe succeed when you succeed. Let''s build wealth together.",
    "enabled": true
  }'::jsonb
),
(
  'trading_alert',
  '{
    "enabled": false,
    "title": "⚡ Trading Session Starting Soon!",
    "message": "A new trading session is about to begin. Make sure your account is funded and ready!",
    "scheduled_at": null
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
