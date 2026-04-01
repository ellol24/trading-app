-- Execute this script in your Supabase SQL Editor to enable Realtime Subscriptions
-- Without these publication rules, supabase.channel() will silently receive zero updates.

-- Ensure the supabase_realtime publication exists (it usually does by default)
BEGIN;

  -- Add the Deposits table to the realtime stream
  ALTER PUBLICATION supabase_realtime ADD TABLE deposits;

  -- Add the Withdrawals table to the realtime stream
  ALTER PUBLICATION supabase_realtime ADD TABLE withdrawals;

  -- Add the Trading Rounds table to the realtime stream
  ALTER PUBLICATION supabase_realtime ADD TABLE trade_rounds;

  -- Add the User Profiles table to the realtime stream
  ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

COMMIT;

-- Optional: If you ever want to remove them from the stream to save bandwidth
-- ALTER PUBLICATION supabase_realtime DROP TABLE deposits;
