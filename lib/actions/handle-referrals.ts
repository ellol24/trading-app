"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Creates up to 3 levels of referral links when a new user registers.
 *
 * Real DB schema for referrals table (from live audit):
 * id, referrer_id, referred_id, status, level, created_at
 * NOTE: There is NO referred_email column in the referrals table.
 */
export async function processNewUserReferral(
  newUserId: string,
  newUserEmail: string,
  referralCodeUsed: string | null
) {
  if (!referralCodeUsed) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) return;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // 1. Find Level 1 Referrer
  const { data: level1User } = await supabaseAdmin
    .from("user_profiles")
    .select("uid")
    .eq("referral_code", referralCodeUsed)
    .single();

  if (!level1User?.uid) return; // Invalid code

  // Insert Level 1 row — only columns that actually exist in the DB
  const { error: e1 } = await supabaseAdmin.from("referrals").insert({
    referrer_id: level1User.uid,
    referred_id: newUserId,
    status: "active",
    level: 1,
  });
  if (e1) {
    console.error("[Referral L1 insert error]", e1.message);
    return;
  }

  // Also increment referrer's total_referrals counter
  const { data: ref1Profile } = await supabaseAdmin
    .from("user_profiles")
    .select("total_referrals")
    .eq("uid", level1User.uid)
    .single();
  if (ref1Profile) {
    await supabaseAdmin
      .from("user_profiles")
      .update({ total_referrals: (Number(ref1Profile.total_referrals || 0) + 1) })
      .eq("uid", level1User.uid);
  }

  // 2. Find Level 2 Referrer (Who referred Level 1?)
  const { data: level2Ref } = await supabaseAdmin
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", level1User.uid)
    .eq("level", 1)
    .single();

  if (!level2Ref?.referrer_id) return;

  // Insert Level 2 row
  const { error: e2 } = await supabaseAdmin.from("referrals").insert({
    referrer_id: level2Ref.referrer_id,
    referred_id: newUserId,
    status: "active",
    level: 2,
  });
  if (e2) console.error("[Referral L2 insert error]", e2.message);

  // 3. Find Level 3 Referrer (Who referred Level 2?)
  const { data: level3Ref } = await supabaseAdmin
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", level2Ref.referrer_id)
    .eq("level", 1)
    .single();

  if (!level3Ref?.referrer_id) return;

  // Insert Level 3 row
  const { error: e3 } = await supabaseAdmin.from("referrals").insert({
    referrer_id: level3Ref.referrer_id,
    referred_id: newUserId,
    status: "active",
    level: 3,
  });
  if (e3) console.error("[Referral L3 insert error]", e3.message);
}
