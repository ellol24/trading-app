import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch profile for name
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("full_name, first_name, last_name")
      .eq("uid", user.id)
      .single();

    const fullName = profile?.full_name ||
      `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
      "Trader";

    // Invalidate any previous unused password-change OTPs
    await adminClient
      .from("profile_update_otps")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store session — new_data marks this as a password_change type
    const { data: otpRow, error: otpErr } = await adminClient
      .from("profile_update_otps")
      .insert([{
        user_id: user.id,
        email_otp: otp,
        new_data: { type: "password_change" },
        expires_at: expiresAt.toISOString(),
      }])
      .select("id")
      .single();

    if (otpErr || !otpRow) {
      console.error("[password-otp] DB insert failed:", otpErr);
      return NextResponse.json({ error: "Failed to create verification session" }, { status: 500 });
    }

    // Send OTP email using unified utility
    const emailResult = await sendEmail({
      to: user.email!,
      subject: "🔐 Confirm Your Password Change",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <h2 style="color:#60a5fa;margin-bottom:8px;">Password Change Request</h2>
          <p style="color:#94a3b8;">Hello ${fullName || "Trader"},</p>
          <p style="color:#94a3b8;">We received a request to change your account password. Enter the code below to confirm:</p>
          <div style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:10px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#ffffff;">${otp}</span>
          </div>
          <p style="color:#f87171;font-size:13px;"><strong>⚠️ If you did not request a password change, please contact support immediately.</strong></p>
          <p style="color:#94a3b8;font-size:13px;">This code expires in <strong style="color:#f59e0b;">10 minutes</strong>.</p>
          <hr style="border-color:#1e293b;margin:24px 0;" />
          <p style="color:#475569;font-size:11px;">Xspy-Trader Security Team</p>
        </div>
      `,
    });
    console.log("[password-otp] Email result:", emailResult);

    return NextResponse.json({
      sessionId: otpRow.id,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (err: any) {
    console.error("[password-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
