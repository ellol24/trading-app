-- Update the user profile creation trigger to apply Welcome Bonus
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_welcome_settings JSONB;
    v_bonus_enabled BOOLEAN := false;
    v_bonus_amount DECIMAL(20,8) := 0.00000000;
BEGIN
    -- 1. Insert Profile
    INSERT INTO user_profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    
    -- 2. Insert Preferences
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id);
    
    -- 3. Check for Welcome Bonus in system_settings
    SELECT value INTO v_welcome_settings
    FROM system_settings
    WHERE key = 'welcome_bonus';

    IF v_welcome_settings IS NOT NULL THEN
        -- Handle both string and raw booleans/numbers safely
        v_bonus_enabled := COALESCE((v_welcome_settings->>'enabled')::boolean, false);
        v_bonus_amount := COALESCE((v_welcome_settings->>'amount')::numeric, 0);
    END IF;
    
    -- 4. Initial Wallet Setup
    IF v_bonus_enabled AND v_bonus_amount > 0 THEN
        -- Apply Bonus
        INSERT INTO user_wallets (user_id, currency, balance, total_deposited)
        VALUES (NEW.id, 'USD', v_bonus_amount, v_bonus_amount);

        -- Log the bonus as an approved deposit for the ledger
        INSERT INTO deposits (user_id, amount, status, payment_method)
        VALUES (NEW.id, v_bonus_amount, 'confirmed', 'welcome_bonus');
    ELSE
        -- Default (No Bonus)
        INSERT INTO user_wallets (user_id, currency, balance)
        VALUES (NEW.id, 'USD', 0.00000000);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;
