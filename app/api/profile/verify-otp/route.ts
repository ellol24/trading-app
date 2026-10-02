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
    const { sessionId, otp } = body;

    if (!sessionId || !otp) {
      return NextResponse.json({ error: "Missing sessionId or otp" }, { status: 400 });
    }

    // 2. Fetch the OTP session
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

    // 3. Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 410 });
    }

    // 4. Verify the code
    if (otpRow.email_otp !== otp.trim()) {
      return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 422 });
    }

    // 5. Mark OTP as used FIRST (prevent replay attacks)
    await adminClient
      .from("profile_update_otps")
      .update({ used: true })
      .eq("id", sessionId);

    // 6. Apply the staged profile changes from new_data
    const newData: any = otpRow.new_data;

    // Compute status: verified if all key fields are filled
    const isComplete =
      newData.first_name?.trim() &&
      newData.last_name?.trim() &&
      newData.phone?.trim() &&
      newData.country?.trim() &&
      newData.city?.trim() &&
      newData.address?.trim() &&
      newData.zip_code?.trim();

    const updatePayload: any = {
      ...newData,
      full_name: `${newData.first_name} ${newData.last_name}`.trim(),
      status: isComplete ? "verified" : "pending",
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await adminClient
      .from("user_profiles")
      .update(updatePayload)
      .eq("uid", user.id);

    if (updateErr) {
      console.error("[profile/verify-otp] Update failed:", updateErr);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[profile/verify-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
