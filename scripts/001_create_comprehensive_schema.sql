-- Creating comprehensive database schema for trading platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- Enhanced user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    country TEXT,
    date_of_birth DATE,
    profile_image_url TEXT,
    preferred_language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(email)
);

-- KYC verification table
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')) DEFAULT 'pending',
    verification_level INTEGER DEFAULT 1 CHECK (verification_level BETWEEN 1 AND 3),
    document_type TEXT CHECK (document_type IN ('passport', 'drivers_license', 'national_id')),
    document_number TEXT,
    document_front_url TEXT,
    document_back_url TEXT,
    selfie_url TEXT,
    address_proof_url TEXT,
    rejection_reason TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    trading_notifications BOOLEAN DEFAULT true,
    two_factor_enabled BOOLEAN DEFAULT false,
    auto_invest_enabled BOOLEAN DEFAULT false,
    risk_tolerance TEXT DEFAULT 'medium' CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- FINANCIAL TABLES
-- =============================================

-- User wallets and balances
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL DEFAULT 'USD',
    balance DECIMAL(20,8) DEFAULT 0.00000000 CHECK (balance >= 0),
    locked_balance DECIMAL(20,8) DEFAULT 0.00000000 CHECK (locked_balance >= 0),
    total_deposited DECIMAL(20,8) DEFAULT 0.00000000,
    total_withdrawn DECIMAL(20,8) DEFAULT 0.00000000,
    total_profit DECIMAL(20,8) DEFAULT 0.00000000,
    total_loss DECIMAL(20,8) DEFAULT 0.00000000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, currency)
);

-- Deposit transactions
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id TEXT UNIQUE,
    network_id TEXT NOT NULL,
    network_label TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDT',
    amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT,
    proof_image_url TEXT,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')) DEFAULT 'pending',
    admin_notes TEXT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Withdrawal transactions
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id TEXT UNIQUE,
    currency TEXT NOT NULL,
    amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
    fee DECIMAL(20,8) DEFAULT 0.00000000,
    net_amount DECIMAL(20,8) NOT NULL CHECK (net_amount > 0),
    destination_address TEXT NOT NULL,
    network TEXT NOT NULL,
    transaction_hash TEXT,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')) DEFAULT 'pending',
    admin_notes TEXT,
    otp_verified BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TRADING SYSTEM TABLES
-- =============================================

-- Enhanced trading pairs (keeping existing structure but adding more fields)
ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS fee_percentage DECIMAL(5,4) DEFAULT 0.0000;
ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS min_price_movement DECIMAL(20,8) DEFAULT 0.00000001;
ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS trading_hours TEXT DEFAULT '24/7';
ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'crypto';
ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Binary options trades
CREATE TABLE IF NOT EXISTS binary_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    trade_type TEXT CHECK (trade_type IN ('CALL', 'PUT')) NOT NULL,
    amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    payout_percentage DECIMAL(5,2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    status TEXT CHECK (status IN ('pending', 'active', 'won', 'lost', 'draw', 'cancelled')) DEFAULT 'pending',
    profit_loss DECIMAL(20,8) DEFAULT 0.00000000,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    settlement_time TIMESTAMP WITH TIME ZONE,
    admin_deal_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin trading control deals
CREATE TABLE IF NOT EXISTS admin_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    entry_window_seconds INTEGER DEFAULT 5 CHECK (entry_window_seconds >= 0),
    payout_percentage DECIMAL(5,2) NOT NULL CHECK (payout_percentage > 0),
    forced_outcome TEXT CHECK (forced_outcome IN ('win', 'loss', 'draw')) NOT NULL,
    status TEXT CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INVESTMENT PACKAGES TABLES
-- =============================================

-- Package catalog
CREATE TABLE IF NOT EXISTS investment_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'mining',
    min_investment DECIMAL(20,8) NOT NULL CHECK (min_investment > 0),
    max_investment DECIMAL(20,8) NOT NULL CHECK (max_investment >= min_investment),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    roi_daily_percentage DECIMAL(5,4) NOT NULL CHECK (roi_daily_percentage > 0),
    total_roi_percentage DECIMAL(8,4) NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    max_purchases_per_user INTEGER DEFAULT NULL,
    total_capacity DECIMAL(20,8) DEFAULT NULL,
    current_invested DECIMAL(20,8) DEFAULT 0.00000000,
    risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
    features JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User package purchases
CREATE TABLE IF NOT EXISTS user_package_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES investment_packages(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
    daily_profit DECIMAL(20,8) NOT NULL CHECK (daily_profit > 0),
    total_expected_profit DECIMAL(20,8) NOT NULL,
    total_credited DECIMAL(20,8) DEFAULT 0.00000000,
    days_completed INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'completed', 'cancelled', 'paused')) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_payout_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily package payouts
CREATE TABLE IF NOT EXISTS package_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES user_package_purchases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
    payout_date DATE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'credited', 'failed')) DEFAULT 'credited',
    transaction_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- MARKET DATA TABLES
-- =============================================

-- Price history for charts
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) DEFAULT 0,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    change_percent DECIMAL(8,4) DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    timeframe TEXT DEFAULT '1m' CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ADMIN AND SYSTEM TABLES
-- =============================================

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    category TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Trading indexes
CREATE INDEX IF NOT EXISTS idx_binary_trades_user_id ON binary_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_binary_trades_symbol ON binary_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_binary_trades_status ON binary_trades(status);
CREATE INDEX IF NOT EXISTS idx_binary_trades_entry_time ON binary_trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_admin_deals_symbol ON admin_deals(symbol);
CREATE INDEX IF NOT EXISTS idx_admin_deals_start_time ON admin_deals(start_time);
CREATE INDEX IF NOT EXISTS idx_admin_deals_status ON admin_deals(status);

-- Package indexes
CREATE INDEX IF NOT EXISTS idx_user_package_purchases_user_id ON user_package_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_package_purchases_package_id ON user_package_purchases(package_id);
CREATE INDEX IF NOT EXISTS idx_user_package_purchases_status ON user_package_purchases(status);
CREATE INDEX IF NOT EXISTS idx_package_payouts_user_id ON package_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_package_payouts_payout_date ON package_payouts(payout_date);

-- Market data indexes
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_timeframe ON price_history(symbol, timeframe);

-- System indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
