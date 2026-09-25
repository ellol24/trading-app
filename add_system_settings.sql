-- Step 1: Create the system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies (to prevent duplicates if ran multiple times)
DROP POLICY IF EXISTS "Public can view system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Anyone can insert/update system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can manage system_settings" ON public.system_settings;

-- Step 4: Create policy to allow ANYONE to read (SELECT) the trading limits
CREATE POLICY "Public can view system_settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Step 5: Create policy to allow INSERT and UPDATE for authenticated users.
-- This ensures your Admin dashboard can successfully save the trading limits 
-- without hitting the 403 Forbidden error observed in the console.
CREATE POLICY "Authenticated users can manage system_settings"
  ON public.system_settings FOR ALL
  USING (auth.uid() IS NOT NULL);
