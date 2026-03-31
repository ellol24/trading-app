-- Creating database functions and triggers for automation

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kyc_verifications_updated_at BEFORE UPDATE ON kyc_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_wallets_updated_at BEFORE UPDATE ON user_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_binary_trades_updated_at BEFORE UPDATE ON binary_trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_deals_updated_at BEFORE UPDATE ON admin_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investment_packages_updated_at BEFORE UPDATE ON investment_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_package_purchases_updated_at BEFORE UPDATE ON user_package_purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- USER MANAGEMENT FUNCTIONS
-- =============================================

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id);
    
    INSERT INTO user_wallets (user_id, currency, balance)
    VALUES (NEW.id, 'USD', 0.00000000);
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- =============================================
-- WALLET MANAGEMENT FUNCTIONS
-- =============================================

-- Function to update wallet balance
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
    
    -- Check if wallet exists
    IF current_balance IS NULL THEN
        INSERT INTO user_wallets (user_id, currency, balance)
        VALUES (p_user_id, p_currency, GREATEST(0, p_amount));
        current_balance := 0;
    END IF;
    
    -- Prevent negative balance for withdrawals
    IF p_transaction_type = 'withdrawal' AND (current_balance + p_amount) < 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Update balance
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
        END
    WHERE user_id = p_user_id AND currency = p_currency;
    
    RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- =============================================
-- TRADING FUNCTIONS
-- =============================================

-- Function to settle binary trade
CREATE OR REPLACE FUNCTION settle_binary_trade(
    p_trade_id UUID,
    p_exit_price DECIMAL(20,8),
    p_result TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    trade_record RECORD;
    profit_amount DECIMAL(20,8);
BEGIN
    -- Get trade details
    SELECT * INTO trade_record
    FROM binary_trades
    WHERE id = p_trade_id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate profit/loss
    IF p_result = 'won' THEN
        profit_amount := trade_record.amount * (trade_record.payout_percentage / 100);
    ELSIF p_result = 'draw' THEN
        profit_amount := 0; -- Refund original amount
    ELSE
        profit_amount := -trade_record.amount; -- Loss
    END IF;
    
    -- Update trade
    UPDATE binary_trades
    SET 
        exit_price = p_exit_price,
        status = p_result,
        profit_loss = profit_amount,
        settlement_time = NOW()
    WHERE id = p_trade_id;
    
    -- Update wallet
    PERFORM update_wallet_balance(
        trade_record.user_id,
        'USD',
        profit_amount,
        CASE WHEN profit_amount > 0 THEN 'profit' ELSE 'loss' END
    );
    
    RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- =============================================
-- PACKAGE FUNCTIONS
-- =============================================

-- Function to process daily package payouts
CREATE OR REPLACE FUNCTION process_daily_payouts()
RETURNS INTEGER AS $$
DECLARE
    payout_record RECORD;
    payouts_processed INTEGER := 0;
BEGIN
    -- Process all active packages that haven't received today's payout
    FOR payout_record IN
        SELECT 
            upp.*,
            ip.roi_daily_percentage
        FROM user_package_purchases upp
        JOIN investment_packages ip ON upp.package_id = ip.id
        WHERE upp.status = 'active'
        AND upp.ends_at > NOW()
        AND (upp.last_payout_at IS NULL OR upp.last_payout_at::date < CURRENT_DATE)
    LOOP
        -- Calculate daily payout
        DECLARE
            daily_payout DECIMAL(20,8);
        BEGIN
            daily_payout := payout_record.amount * (payout_record.roi_daily_percentage / 100);
            
            -- Insert payout record
            INSERT INTO package_payouts (
                purchase_id,
                user_id,
                amount,
                payout_date,
                status
            ) VALUES (
                payout_record.id,
                payout_record.user_id,
                daily_payout,
                CURRENT_DATE,
                'credited'
            );
            
            -- Update wallet
            PERFORM update_wallet_balance(
                payout_record.user_id,
                'USD',
                daily_payout,
                'profit'
            );
            
            -- Update package purchase
            UPDATE user_package_purchases
            SET 
                total_credited = total_credited + daily_payout,
                days_completed = days_completed + 1,
                last_payout_at = NOW(),
                status = CASE 
                    WHEN ends_at <= NOW() THEN 'completed'
                    ELSE status
                END
            WHERE id = payout_record.id;
            
            payouts_processed := payouts_processed + 1;
        END;
    END LOOP;
    
    RETURN payouts_processed;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- =============================================
-- AUDIT FUNCTIONS
-- =============================================

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        ip_address
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        inet_client_addr()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_user_wallets AFTER INSERT OR UPDATE OR DELETE ON user_wallets FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
CREATE TRIGGER audit_deposits AFTER INSERT OR UPDATE OR DELETE ON deposits FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
CREATE TRIGGER audit_withdrawals AFTER INSERT OR UPDATE OR DELETE ON withdrawals FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
CREATE TRIGGER audit_binary_trades AFTER INSERT OR UPDATE OR DELETE ON binary_trades FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
CREATE TRIGGER audit_user_package_purchases AFTER INSERT OR UPDATE OR DELETE ON user_package_purchases FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
