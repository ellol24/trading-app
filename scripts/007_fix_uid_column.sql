-- ========================================================
-- FIX ORPHANED ROWS due to `uid` vs `user_id` schema
-- ========================================================
-- The frontend explicitly queries `user_profiles` using `uid` instead of `user_id`.
-- Because the previous trigger only populated `user_id`, the Dashboard couldn't find the row,
-- resulting in the Dashboard defaulting to a $0 balance entirely!

-- 1. Redefine the Welcome Bonus Trigger to include `uid`
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_welcome_settings JSONB;
    v_bonus_enabled BOOLEAN := false;
    v_bonus_amount DECIMAL(20,8) := 0.00000000;
BEGIN
    SELECT value INTO v_welcome_settings
    FROM system_settings
    WHERE key = 'welcome_bonus';

    IF v_welcome_settings IS NOT NULL THEN
        v_bonus_enabled := COALESCE((v_welcome_settings->>'enabled')::boolean, false);
        v_bonus_amount := COALESCE((v_welcome_settings->>'amount')::numeric, 0);
    END IF;

    IF NOT v_bonus_enabled THEN
        v_bonus_amount := 0;
    END IF;

    -- Insert Profile WITH BOTH uid AND user_id!
    INSERT INTO user_profiles (uid, user_id, email, full_name, balance)
    VALUES (
        NEW.id,     -- Matches the frontend's expected .eq("uid", user.id)
        NEW.id,     -- Satisfies the backend foreign key constraints
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        v_bonus_amount
    );
    
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id);
    
    INSERT INTO user_wallets (user_id, currency, balance, total_deposited)
    VALUES (NEW.id, 'USD', v_bonus_amount, v_bonus_amount);

    IF v_bonus_amount > 0 THEN
        INSERT INTO deposits (user_id, amount, status, payment_method)
        VALUES (NEW.id, v_bonus_amount, 'confirmed', 'welcome_bonus');
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;


-- 2. Redefine 'update_wallet_balance' to strictly update `uid`
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
    SELECT balance INTO current_balance
    FROM user_wallets
    WHERE user_id = p_user_id AND currency = p_currency;
    
    IF current_balance IS NULL THEN
        INSERT INTO user_wallets (user_id, currency, balance)
        VALUES (p_user_id, p_currency, GREATEST(0, p_amount));
        current_balance := 0;
    END IF;
    
    IF p_transaction_type = 'withdrawal' AND (current_balance + p_amount) < 0 THEN
        RETURN FALSE;
    END IF;
    
    UPDATE user_wallets
    SET 
        balance = balance + p_amount,
        total_deposited = CASE WHEN p_transaction_type = 'deposit' THEN total_deposited + p_amount ELSE total_deposited END,
        total_withdrawn = CASE WHEN p_transaction_type = 'withdrawal' THEN total_withdrawn + ABS(p_amount) ELSE total_withdrawn END,
        total_profit = CASE WHEN p_transaction_type = 'profit' THEN total_profit + p_amount ELSE total_profit END,
        total_loss = CASE WHEN p_transaction_type = 'loss' THEN total_loss + ABS(p_amount) ELSE total_loss END,
        updated_at = NOW()
    WHERE user_id = p_user_id AND currency = p_currency;

    -- ALSO Update user_profiles Table targeting ALL expected column variations:
    UPDATE user_profiles
    SET balance = balance + p_amount
    WHERE uid = p_user_id OR user_id = p_user_id OR id = p_user_id;

    RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;
