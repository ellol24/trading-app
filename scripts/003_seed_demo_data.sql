-- Insert some demo market data and trading pairs (if needed for the platform)
-- This is optional and can be customized based on your trading platform needs

-- Create trading_pairs table for supported trading instruments
CREATE TABLE IF NOT EXISTS public.trading_pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  display_name TEXT NOT NULL,
  min_trade_amount DECIMAL(15,8) DEFAULT 0.00000001,
  max_trade_amount DECIMAL(15,2) DEFAULT 1000000.00,
  price_precision INTEGER DEFAULT 8,
  quantity_precision INTEGER DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert popular trading pairs
INSERT INTO public.trading_pairs (symbol, base_currency, quote_currency, display_name, min_trade_amount, price_precision, quantity_precision) VALUES
('BTCUSD', 'BTC', 'USD', 'Bitcoin / US Dollar', 0.00001, 2, 5),
('ETHUSD', 'ETH', 'USD', 'Ethereum / US Dollar', 0.001, 2, 3),
('EURUSD', 'EUR', 'USD', 'Euro / US Dollar', 0.01, 5, 2),
('GBPUSD', 'GBP', 'USD', 'British Pound / US Dollar', 0.01, 5, 2),
('USDJPY', 'USD', 'JPY', 'US Dollar / Japanese Yen', 0.01, 3, 2),
('XAUUSD', 'XAU', 'USD', 'Gold / US Dollar', 0.01, 2, 2),
('ADAUSD', 'ADA', 'USD', 'Cardano / US Dollar', 1, 4, 0),
('SOLUSD', 'SOL', 'USD', 'Solana / US Dollar', 0.01, 2, 2)
ON CONFLICT (symbol) DO NOTHING;

-- Enable RLS on trading_pairs
ALTER TABLE public.trading_pairs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read trading pairs
CREATE POLICY "All users can view trading pairs" ON public.trading_pairs
  FOR SELECT USING (auth.role() = 'authenticated');
