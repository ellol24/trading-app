import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  
  // Find users ordered by total_referrals
  const { data: popularUsers } = await supabase
    .from("user_profiles")
    .select("uid, email, full_name, referral_code, total_referrals")
    .order("total_referrals", { ascending: false })
    .limit(5);

  // find users with non-null referral_code_used
  const { data: usedCodes } = await supabase
    .from("user_profiles")
    .select("uid, email, referral_code_used")
    .not("referral_code_used", "is", null)
    .limit(20);

  // Check the referrals table
  const { data: rawReferrals } = await supabase
    .from("referrals")
    .select("*")
    .limit(20);

  return NextResponse.json({
    popularUsers,
    usedCodes,
    rawReferrals
  });
}
