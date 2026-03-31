-- Seeding initial data for trading platform

-- =============================================
-- SEED TRADING PAIRS
-- =============================================

INSERT INTO trading_pairs (
    symbol, base_currency, quote_currency, display_name,
    price_precision, quantity_precision, min_trade_amount, max_trade_amount,
    fee_percentage, is_active, category
) VALUES
-- Forex pairs
('EUR/USD', 'EUR', 'USD', 'Euro / US Dollar', 5, 8, 10.00, 10000.00, 0.0000, true, 'forex'),
('GBP/USD', 'GBP', 'USD', 'British Pound / US Dollar', 5, 8, 10.00, 10000.00, 0.0000, true, 'forex'),
('USD/JPY', 'USD', 'JPY', 'US Dollar / Japanese Yen', 3, 8, 10.00, 10000.00, 0.0000, true, 'forex'),
('AUD/USD', 'AUD', 'USD', 'Australian Dollar / US Dollar', 5, 8, 10.00, 10000.00, 0.0000, true, 'forex'),
('USD/CAD', 'USD', 'CAD', 'US Dollar / Canadian Dollar', 5, 8, 10.00, 10000.00, 0.0000, true, 'forex'),

-- Crypto pairs
('BTC/USD', 'BTC', 'USD', 'Bitcoin / US Dollar', 2, 8, 10.00, 50000.00, 0.0000, true, 'crypto'),
('ETH/USD', 'ETH', 'USD', 'Ethereum / US Dollar', 2, 8, 10.00, 25000.00, 0.0000, true, 'crypto'),
('BNB/USD', 'BNB', 'USD', 'Binance Coin / US Dollar', 2, 8, 10.00, 5000.00, 0.0000, true, 'crypto'),
('ADA/USD', 'ADA', 'USD', 'Cardano / US Dollar', 4, 8, 10.00, 1000.00, 0.0000, true, 'crypto'),
('SOL/USD', 'SOL', 'USD', 'Solana / US Dollar', 2, 8, 10.00, 2000.00, 0.0000, true, 'crypto'),
('DOT/USD', 'DOT', 'USD', 'Polkadot / US Dollar', 3, 8, 10.00, 1000.00, 0.0000, true, 'crypto'),
('AVAX/USD', 'AVAX', 'USD', 'Avalanche / US Dollar', 2, 8, 10.00, 1000.00, 0.0000, true, 'crypto'),

-- Commodities
('XAU/USD', 'XAU', 'USD', 'Gold / US Dollar', 2, 8, 10.00, 5000.00, 0.0000, true, 'commodity'),
('XAG/USD', 'XAG', 'USD', 'Silver / US Dollar', 3, 8, 10.00, 1000.00, 0.0000, true, 'commodity'),
('OIL/USD', 'OIL', 'USD', 'Crude Oil / US Dollar', 2, 8, 10.00, 2000.00, 0.0000, true, 'commodity')

ON CONFLICT (symbol) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_precision = EXCLUDED.price_precision,
    quantity_precision = EXCLUDED.quantity_precision,
    min_trade_amount = EXCLUDED.min_trade_amount,
    max_trade_amount = EXCLUDED.max_trade_amount,
    fee_percentage = EXCLUDED.fee_percentage,
    is_active = EXCLUDED.is_active,
    category = EXCLUDED.category,
    updated_at = NOW();

-- =============================================
-- SEED INVESTMENT PACKAGES
-- =============================================

INSERT INTO investment_packages (
    title, description, category, min_investment, max_investment,
    duration_days, roi_daily_percentage, total_roi_percentage,
    image_url, is_active, risk_level, features
) VALUES
(
    'Starter Mining Package',
    'Perfect for beginners looking to start their crypto mining journey with low risk and steady returns.',
    'mining',
    100.00, 999.99,
    30, 1.5000, 45.0000,
    '/starter-mining-rack.png',
    true, 'low',
    '["24/7 Mining Operation", "Beginner Friendly", "Low Risk", "Daily Payouts", "30-Day Duration"]'
),
(
    'Professional Mining Package',
    'Advanced mining setup for experienced investors seeking higher returns with moderate risk.',
    'mining',
    1000.00, 4999.99,
    60, 2.0000, 120.0000,
    '/professional-crypto-mining-farm.png',
    true, 'medium',
    '["High-Performance Hardware", "Professional Management", "Higher Returns", "60-Day Duration", "Priority Support"]'
),
(
    'VIP Mining Package',
    'Premium mining facility access with maximum returns for high-volume investors.',
    'mining',
    5000.00, 50000.00,
    90, 2.5000, 225.0000,
    '/vip-mining-datacenter.png',
    true, 'high',
    '["Enterprise-Grade Equipment", "VIP Support", "Maximum Returns", "90-Day Duration", "Exclusive Access", "Custom Solutions"]'
);

-- =============================================
-- SEED SYSTEM SETTINGS
-- =============================================

INSERT INTO system_settings (key, value, description, category, is_public) VALUES
('platform_name', '"CryptoTrade Pro"', 'Platform display name', 'general', true),
('platform_version', '"1.0.0"', 'Current platform version', 'general', true),
('maintenance_mode', 'false', 'Enable/disable maintenance mode', 'general', false),
('min_deposit_amount', '10.00', 'Minimum deposit amount in USD', 'financial', true),
('max_deposit_amount', '100000.00', 'Maximum deposit amount in USD', 'financial', true),
('min_withdrawal_amount', '20.00', 'Minimum withdrawal amount in USD', 'financial', true),
('withdrawal_fee_percentage', '2.5', 'Withdrawal fee percentage', 'financial', true),
('max_daily_withdrawal', '10000.00', 'Maximum daily withdrawal limit', 'financial', false),
('kyc_required_for_withdrawal', 'true', 'Require KYC verification for withdrawals', 'compliance', false),
('max_trade_amount', '10000.00', 'Maximum single trade amount', 'trading', true),
('min_trade_amount', '1.00', 'Minimum single trade amount', 'trading', true),
('default_payout_percentage', '80.00', 'Default payout percentage for trades', 'trading', false),
('support_email', '"support@cryptotradepro.com"', 'Support contact email', 'contact', true),
('telegram_support', '"@cryptotradepro_support"', 'Telegram support handle', 'contact', true)

ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================
-- CREATE DEMO USER DATA (Optional)
-- =============================================

-- Note: This would typically be created through the auth system
-- This is just for reference of the data structure

-- Demo price history for charts (last 24 hours of BTC/USD)
INSERT INTO price_history (symbol, price, volume, high, low, open, close, change_percent, timestamp, timeframe)
SELECT 
    'BTC/USD',
    43000 + (random() * 2000 - 1000), -- Random price around $43,000
    1000000 + (random() * 500000), -- Random volume
    43000 + (random() * 2000 - 500), -- High
    43000 + (random() * 2000 - 1500), -- Low
    43000 + (random() * 2000 - 1000), -- Open
    43000 + (random() * 2000 - 1000), -- Close
    (random() * 10 - 5), -- Change percent between -5% and +5%
    NOW() - (interval '1 minute' * generate_series(1, 1440)), -- Last 24 hours in 1-minute intervals
    '1m'
FROM generate_series(1, 1440);

-- Add some sample data for other major pairs
INSERT INTO price_history (symbol, price, volume, high, low, open, close, change_percent, timestamp, timeframe)
SELECT 
    'ETH/USD',
    2600 + (random() * 200 - 100),
    500000 + (random() * 250000),
    2600 + (random() * 200 - 50),
    2600 + (random() * 200 - 150),
    2600 + (random() * 200 - 100),
    2600 + (random() * 200 - 100),
    (random() * 8 - 4),
    NOW() - (interval '1 minute' * generate_series(1, 1440)),
    '1m'
FROM generate_series(1, 1440);
