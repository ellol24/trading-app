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
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, otp, newPassword } = body;

    if (!sessionId || !otp || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // 1. Fetch the OTP session
    const { data: otpRow, error: otpErr } = await adminClient
      .from("profile_update_otps")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("used", false)
      .single();

    if (otpErr || !otpRow) {
      return NextResponse.json({ error: "Verification session not found or already used" }, { status: 404 });
    }

    // 2. Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 410 });
    }

    // 3. Validate OTP
    if (otpRow.email_otp !== otp.trim()) {
      return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 422 });
    }

    // 4. Mark OTP as used immediately (prevent replay)
    await adminClient
      .from("profile_update_otps")
      .update({ used: true })
      .eq("id", sessionId);

    // 5. Update password via admin client (bypasses need for current password)
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateErr) {
      console.error("[verify-password-otp] Password update failed:", updateErr);
      return NextResponse.json({ error: "Failed to update password. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[verify-password-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
