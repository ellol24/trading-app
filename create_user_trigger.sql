-- ==========================================
-- SUPABASE AUTH TRIGGER: CREATE USER PROFILE
-- ==========================================
-- This script creates a trigger that automatically inserts a row into 
-- public.user_profiles whenever a new user signs up in auth.users.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  extracted_username TEXT;
BEGIN
  -- Generate a fallback username from the email prefix
  extracted_username := split_part(new.email, '@', 1);

  INSERT INTO public.user_profiles (
    uid,
    email,
    full_name,
    username,
    role,
    ip_address,
    referral_code_used
  ) VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    extracted_username,
    'user', -- Enforce 'user' role by default for new signups
    new.raw_user_meta_data->>'ip_address',
    new.raw_user_meta_data->>'referral_code_used'
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Bind the trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
