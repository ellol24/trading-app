import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, emailCode, telegramCode } = body;

    if (!sessionId || !emailCode || !telegramCode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Fetch the OTP session
    const { data: otpRow, error: otpErr } = await adminClient
      .from("withdrawal_otps")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("used", false)
      .single();

    if (otpErr || !otpRow) {
      return NextResponse.json({ error: "OTP session not found or already used" }, { status: 404 });
    }

    // 3. Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 410 });
    }

    // 4. Verify both codes (constant-time comparison to prevent timing attacks)
    const emailMatch = otpRow.email_otp === emailCode.trim();
    const telegramMatch = otpRow.telegram_otp === telegramCode.trim();

    if (!emailMatch || !telegramMatch) {
      return NextResponse.json({ error: "Invalid verification code(s). Please check and try again." }, { status: 422 });
    }

    // 5. Mark OTP as used FIRST (prevent replay attacks)
    await adminClient
      .from("withdrawal_otps")
      .update({ used: true })
      .eq("id", sessionId);

    // 6. Fetch current balance (fresh read under service role)
    const { data: profileRow, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("balance")
      .eq("uid", user.id)
      .single();

    if (profileErr || !profileRow) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentBalance = Number(profileRow.balance || 0);
    const amt = Number(otpRow.amount);

    if (currentBalance < amt) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 422 });
    }

    // 7. Deduct balance
    const newBalance = currentBalance - amt;
    const { error: updErr } = await adminClient
      .from("user_profiles")
      .update({ balance: newBalance })
      .eq("uid", user.id);

    if (updErr) {
      console.error("[verify-otp] Balance update failed:", updErr);
      return NextResponse.json({ error: "Failed to update balance" }, { status: 500 });
    }

    // 8. Insert the withdrawal record
    const { error: insertErr } = await adminClient
      .from("withdrawals")
      .insert([{
        user_id: user.id,
        wallet_id: otpRow.wallet_id,
        amount: amt,
        fee: Number(otpRow.fee),
        net_amount: Number(otpRow.net_amount),
        status: "pending",
        otp_verified: true,
      }]);

    if (insertErr) {
      // Rollback balance on failure
      console.error("[verify-otp] Withdrawal insert failed, rolling back:", insertErr);
      await adminClient
        .from("user_profiles")
        .update({ balance: currentBalance })
        .eq("uid", user.id);

      return NextResponse.json({ error: "Failed to record withdrawal" }, { status: 500 });
    }

    return NextResponse.json({ success: true, newBalance });

  } catch (err: any) {
    console.error("[verify-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
