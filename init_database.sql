-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 0. CLEANUP EXISTING TABLES (Idempotency)
-- ==========================================
DROP TABLE IF EXISTS public.referral_commissions CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.package_referral_commission_rates CASCADE;
DROP TABLE IF EXISTS public.trade_profit_commission_rates CASCADE;
DROP TABLE IF EXISTS public.referral_commission_rates CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.investment_packages CASCADE;
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.trade_rounds CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.withdrawal_wallets CASCADE;
DROP TABLE IF EXISTS public.withdrawal_settings CASCADE;
DROP TABLE IF EXISTS public.withdrawal_control CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.deposit_wallets CASCADE;
DROP TABLE IF EXISTS public.deposit_settings CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- ==========================================
-- 1. USER PROFILES & SETTINGS
-- ==========================================
CREATE TABLE public.user_profiles (
    uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT UNIQUE,
    username TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    balance NUMERIC(20, 2) DEFAULT 0.00,
    demo_balance NUMERIC(20, 2) DEFAULT 50000.00,
    ip_address TEXT,
    referral_code TEXT UNIQUE,
    referral_code_used TEXT,
    total_referrals INT DEFAULT 0,
    total_trades INT DEFAULT 0,
    referral_earnings NUMERIC(20, 2) DEFAULT 0.00,
    min_trade_amount NUMERIC(20, 2) DEFAULT 1.00,
    suggested_trade_amounts JSONB DEFAULT '[10, 25, 50, 100, 250, 500]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. DEPOSITS & WITHDRAWALS
-- ==========================================
CREATE TABLE public.deposit_settings (
    id INT PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN DEFAULT true,
    min_deposit_amount NUMERIC(20, 2) DEFAULT 10.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.deposit_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset TEXT NOT NULL,
    address TEXT NOT NULL,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    username TEXT,
    email TEXT,
    amount NUMERIC(20, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    proof_base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.withdrawal_control (
    id INT PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.withdrawal_settings (
    id INT PRIMARY KEY DEFAULT 1,
    fee_percentage NUMERIC(5, 2) DEFAULT 0.00,
    min_withdraw_amount NUMERIC(20, 2) DEFAULT 21.00,
    withdraw_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.withdrawal_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    asset TEXT,
    address TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.withdrawal_wallets(id) ON DELETE SET NULL,
    amount NUMERIC(20, 2) NOT NULL, 
    requested_amount NUMERIC(20, 2), -- Supported for legacy dashboard checks
    fee NUMERIC(20, 2) DEFAULT 0.00,
    fee_pct NUMERIC(5, 2) DEFAULT 0.00,
    net_amount NUMERIC(20, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected')),
    otp_verified BOOLEAN DEFAULT false,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('approved', 'pending', 'rejected', 'not_submitted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. TRADING ENGINE
-- ==========================================
CREATE TABLE public.trade_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_sec INT NOT NULL,
    payout_percent NUMERIC(5, 2) NOT NULL,
    entry_window_sec INT NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'canceled')),
    admin_direction TEXT CHECK (admin_direction IN ('buy', 'sell')),
    forced_outcome TEXT CHECK (forced_outcome IN ('win', 'lose', 'draw')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    trade_round_id UUID REFERENCES public.trade_rounds(id) ON DELETE CASCADE,
    amount NUMERIC(20, 2) NOT NULL,
    roi_percentage NUMERIC(5, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CALL', 'PUT', 'BUY', 'SELL')),
    result TEXT CHECK (result IN ('win', 'lose', 'draw', 'pending')),
    profit_loss NUMERIC(20, 2) DEFAULT 0.00,
    settled BOOLEAN DEFAULT false,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. INVESTMENT PACKAGES
-- ==========================================
CREATE TABLE public.investment_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category TEXT,
    risk_level TEXT,
    min_investment NUMERIC(20, 2),
    max_investment NUMERIC(20, 2),
    duration_days INT,
    roi_daily_percentage NUMERIC(10, 4),
    total_roi_percentage NUMERIC(10, 4),
    is_active BOOLEAN DEFAULT true,
    max_purchases_per_user INT,
    total_capacity INT,
    current_invested NUMERIC(20, 2) DEFAULT 0.00,
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    package_id UUID REFERENCES public.investment_packages(id) ON DELETE CASCADE,
    amount NUMERIC(20, 2) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. REFERRALS & COMMISSIONS
-- ==========================================
CREATE TABLE public.referral_commission_rates (
    level INT PRIMARY KEY,
    percentage NUMERIC(5, 2) NOT NULL
);

CREATE TABLE public.trade_profit_commission_rates (
    level INT PRIMARY KEY,
    percentage NUMERIC(5, 2) NOT NULL
);

CREATE TABLE public.package_referral_commission_rates (
    level INT PRIMARY KEY,
    percentage NUMERIC(5, 2) NOT NULL
);

CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level IN (1, 2, 3)),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

CREATE TABLE public.referral_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_uid UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    source_uid UUID REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    amount NUMERIC(20, 2) NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    level INT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 6. REALTIME ENABLEMENT
-- ==========================================
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE deposits;
  ALTER PUBLICATION supabase_realtime ADD TABLE withdrawals;
  ALTER PUBLICATION supabase_realtime ADD TABLE trade_rounds;
  ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE referrals;
  ALTER PUBLICATION supabase_realtime ADD TABLE referral_commissions;
COMMIT;

-- ==========================================
-- 7. ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" 
ON public.user_profiles FOR SELECT 
USING (auth.uid() = uid);

CREATE POLICY "Users view own deposits" 
ON public.deposits FOR SELECT 
USING (auth.uid() = uid);

CREATE POLICY "Users view own withdrawals" 
ON public.withdrawals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users view own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users view own referral commissions"
ON public.referral_commissions FOR SELECT
USING (auth.uid() = recipient_uid);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE uid = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins full access system_settings"
ON public.system_settings FOR ALL
USING (public.is_admin());

CREATE POLICY "Public can view system_settings"
ON public.system_settings FOR SELECT
USING (true);
