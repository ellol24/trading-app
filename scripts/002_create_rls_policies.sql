-- Creating Row Level Security policies for data protection

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE binary_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER PROFILE POLICIES
-- =============================================

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- KYC POLICIES
-- =============================================

CREATE POLICY "Users can view own KYC" ON kyc_verifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC" ON kyc_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own KYC" ON kyc_verifications
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- PREFERENCES POLICIES
-- =============================================

CREATE POLICY "Users can manage own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- WALLET POLICIES
-- =============================================

CREATE POLICY "Users can view own wallets" ON user_wallets
    FOR SELECT USING (auth.uid() = user_id);

-- Only system can modify wallet balances (through functions)
CREATE POLICY "System can manage wallets" ON user_wallets
    FOR ALL USING (current_setting('app.current_user_id', true)::uuid = user_id);

-- =============================================
-- DEPOSIT POLICIES
-- =============================================

CREATE POLICY "Users can view own deposits" ON deposits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create deposits" ON deposits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- WITHDRAWAL POLICIES
-- =============================================

CREATE POLICY "Users can view own withdrawals" ON withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawals" ON withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- TRADING POLICIES
-- =============================================

CREATE POLICY "Users can view own trades" ON binary_trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create trades" ON binary_trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PACKAGE POLICIES
-- =============================================

CREATE POLICY "Users can view own packages" ON user_package_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can purchase packages" ON user_package_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own payouts" ON package_payouts
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- NOTIFICATION POLICIES
-- =============================================

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- PUBLIC READ POLICIES
-- =============================================

-- Trading pairs are public
ALTER TABLE trading_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trading pairs are public" ON trading_pairs
    FOR SELECT USING (true);

-- Investment packages are public
ALTER TABLE investment_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Investment packages are public" ON investment_packages
    FOR SELECT USING (is_active = true);

-- Admin deals are public (for trading interface)
ALTER TABLE admin_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin deals are public" ON admin_deals
    FOR SELECT USING (true);

-- Price history is public
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price history is public" ON price_history
    FOR SELECT USING (true);

-- Public system settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public system settings" ON system_settings
    FOR SELECT USING (is_public = true);
