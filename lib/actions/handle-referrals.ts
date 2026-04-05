"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Creates up to 3 levels of referral links when a new user registers.
 * X -> Y (Level 1)
 * W -> X -> Y (W is Level 2 to Y)
 * V -> W -> X -> Y (V is Level 3 to Y)
 */
export async function processNewUserReferral(newUserId: string, newUserEmail: string, referralCodeUsed: string | null) {
  if (!referralCodeUsed) return;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseServiceKey) return;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  // 1. Find Level 1 Referrer
  const { data: level1User } = await supabaseAdmin
    .from("user_profiles")
    .select("uid")
    .eq("referral_code", referralCodeUsed)
    .single();

  if (!level1User?.uid) return; // Invalid code

  // Insert Level 1 row
  await supabaseAdmin.from("referrals").insert({
    referrer_id: level1User.uid,
    referred_id: newUserId,
    referred_email: newUserEmail,
    status: "active",
    level: 1
  });

  // 2. Find Level 2 Referrer (Who referred Level 1?) - Must be level 1 of the level 1 user
  const { data: level2Ref } = await supabaseAdmin
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", level1User.uid)
    .eq("level", 1)
    .single();

  if (!level2Ref?.referrer_id) return; // Level 1 referrer was not referred by anyone

  // Insert Level 2 row
  await supabaseAdmin.from("referrals").insert({
    referrer_id: level2Ref.referrer_id,
    referred_id: newUserId,
    referred_email: newUserEmail,
    status: "active",
    level: 2
  });

  // 3. Find Level 3 Referrer (Who referred Level 2?)
  const { data: level3Ref } = await supabaseAdmin
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", level2Ref.referrer_id)
    .eq("level", 1)
    .single();

  if (!level3Ref?.referrer_id) return;

  // Insert Level 3 row
  await supabaseAdmin.from("referrals").insert({
    referrer_id: level3Ref.referrer_id,
    referred_id: newUserId,
    referred_email: newUserEmail,
    status: "active",
    level: 3
  });
}
