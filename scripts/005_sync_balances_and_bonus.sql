-- ========================================================
-- FIX OVERLAPPING BALANCE ISSUES & WELCOME BONUS SYNC
-- ========================================================
-- The frontend dashboard reads balances from 'user_profiles' (column 'balance'),
-- but our previous trigger only inserted the bonus into 'user_wallets'.
-- This script safely updates 'create_user_profile' and 'update_wallet_balance'
-- to ensure BOTH tables are always perfectly synchronized!

-- 1. Redefine the Welcome Bonus Trigger
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_welcome_settings JSONB;
    v_bonus_enabled BOOLEAN := false;
    v_bonus_amount DECIMAL(20,8) := 0.00000000;
BEGIN
    -- Pull the Welcome Bonus settings
    SELECT value INTO v_welcome_settings
    FROM system_settings
    WHERE key = 'welcome_bonus';

    IF v_welcome_settings IS NOT NULL THEN
        v_bonus_enabled := COALESCE((v_welcome_settings->>'enabled')::boolean, false);
        v_bonus_amount := COALESCE((v_welcome_settings->>'amount')::numeric, 0);
    END IF;

    -- If disabled, set to 0
    IF NOT v_bonus_enabled THEN
        v_bonus_amount := 0;
    END IF;

    -- Insert Profile WITH THE BALANCE
    INSERT INTO user_profiles (user_id, email, full_name, balance)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        v_bonus_amount
    );
    
    -- Insert Preferences
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id);
    
    -- Insert Wallet
    INSERT INTO user_wallets (user_id, currency, balance, total_deposited)
    VALUES (NEW.id, 'USD', v_bonus_amount, v_bonus_amount);

    -- Log Bonus if applied
    IF v_bonus_amount > 0 THEN
        INSERT INTO deposits (user_id, amount, status, payment_method)
        VALUES (NEW.id, v_bonus_amount, 'confirmed', 'welcome_bonus');
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 2. Redefine 'update_wallet_balance' to sync with 'user_profiles'
CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_user_id UUID,
    p_currency TEXT,
    p_amount DECIMAL(20,8),
    p_transaction_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL(20,8);
BEGIN
    -- Get current balance
    SELECT balance INTO current_balance
    FROM user_wallets
    WHERE user_id = p_user_id AND currency = p_currency;
    
    IF current_balance IS NULL THEN
        INSERT INTO user_wallets (user_id, currency, balance)
        VALUES (p_user_id, p_currency, GREATEST(0, p_amount));
        current_balance := 0;
    END IF;
    
    -- Prevent negative balance for withdrawals
    IF p_transaction_type = 'withdrawal' AND (current_balance + p_amount) < 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Update user_wallets Table
    UPDATE user_wallets
    SET 
        balance = balance + p_amount,
        total_deposited = CASE 
            WHEN p_transaction_type = 'deposit' THEN total_deposited + p_amount
            ELSE total_deposited
        END,
        total_withdrawn = CASE 
            WHEN p_transaction_type = 'withdrawal' THEN total_withdrawn + ABS(p_amount)
            ELSE total_withdrawn
        END,
        total_profit = CASE 
            WHEN p_transaction_type = 'profit' THEN total_profit + p_amount
            ELSE total_profit
        END,
        total_loss = CASE 
            WHEN p_transaction_type = 'loss' THEN total_loss + ABS(p_amount)
            ELSE total_loss
        END,
        updated_at = NOW()
    WHERE user_id = p_user_id AND currency = p_currency;

    -- ALSO Update user_profiles Table so the Dashboard UI sees the money!
    UPDATE user_profiles
    SET balance = balance + p_amount
    WHERE user_id = p_user_id OR id = p_user_id;
    -- Note: Handle schemas where PK is id OR user_id just in case
    
    RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;
