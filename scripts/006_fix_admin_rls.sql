-- ========================================================
-- FIX ROW LEVEL SECURITY FOR ADMINS (system_settings)
-- ========================================================
-- Problem: When you toggled "Enable Bonus" and clicked Save, 
-- Supabase Row Level Security (RLS) silently blocked the update 
-- because there was no rule allowing ANYONE to modify settings.
-- This script safely grants "admin" users the right to save!

-- 1. Create a secure function to check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE (user_id = auth.uid() OR id = auth.uid() OR uid::uuid = auth.uid()) 
        AND role = 'admin'
    ) INTO is_admin;
    
    RETURN is_admin;
EXCEPTION WHEN OTHERS THEN
    -- Fallback gracefully if schema naming differs
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Allow Admins to INSERT, UPDATE, and DELETE on system_settings
DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
CREATE POLICY "Admins can manage system settings" ON system_settings
FOR ALL USING (is_admin_user());

-- 3. Allow Admins to manage Referral Commissions (so that part of the page saves too)
DROP POLICY IF EXISTS "Admins can manage referral commissions" ON referral_commission_rates;
CREATE POLICY "Admins can manage referral commissions" ON referral_commission_rates
FOR ALL USING (is_admin_user());

-- 4. Allow Admins to manage Trade Profit Commissions
DROP POLICY IF EXISTS "Admins can manage trade profit commissions" ON trade_profit_commission_rates;
CREATE POLICY "Admins can manage trade profit commissions" ON trade_profit_commission_rates
FOR ALL USING (is_admin_user());

-- 5. Allow Admins to manage Package Commissions
DROP POLICY IF EXISTS "Admins can manage package commissions" ON package_referral_commission_rates;
CREATE POLICY "Admins can manage package commissions" ON package_referral_commission_rates
FOR ALL USING (is_admin_user());
