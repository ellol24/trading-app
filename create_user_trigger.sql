-- Function to handle new user creation from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  extracted_username TEXT;
  clean_prefix TEXT;
  generated_referral TEXT;
BEGIN
  -- Generate a fallback username from the email prefix
  extracted_username := split_part(new.email, '@', 1);
  
  -- Clean the prefix (only letters and numbers) and take up to 4 characters
  clean_prefix := upper(substring(regexp_replace(extracted_username, '[^a-zA-Z0-9]', '', 'g') from 1 for 4));
  
  -- If the clean prefix is too short/empty, fallback to a slice of their UUID
  IF length(clean_prefix) < 2 THEN
    clean_prefix := upper(substring(new.id::text from 1 for 4));
  END IF;

  -- Combine the prefix with a random 4-digit number (e.g. ALEX4921)
  generated_referral := clean_prefix || lpad(floor(random() * 10000)::text, 4, '0');

  INSERT INTO public.user_profiles (
    uid, 
    email, 
    full_name, 
    username, 
    role, 
    ip_address, 
    referral_code_used,
    referral_code
  ) VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    extracted_username, 
    'user', 
    new.raw_user_meta_data->>'ip_address',
    new.raw_user_meta_data->>'referral_code_used',
    generated_referral
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after a user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
