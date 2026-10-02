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

    const body = await req.json();
    const { firstName, lastName, phone, country, city, address, zipCode, telegramChatId } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // Invalidate any previous unused OTPs for this user
    await adminClient
      .from("profile_update_otps")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // Generate new OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const stagingData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: fullName,
      phone: phone?.trim() || null,
      country: country?.trim() || null,
      city: city?.trim() || null,
      address: address?.trim() || null,
      zip_code: zipCode?.trim() || null,
      telegram_chat_id: telegramChatId?.trim() || null,
    };

    const { data: otpRow, error: otpErr } = await adminClient
      .from("profile_update_otps")
      .insert([{
        user_id: user.id,
        email_otp: otp,
        new_data: stagingData,
        expires_at: expiresAt.toISOString(),
      }])
      .select("id")
      .single();

    if (otpErr || !otpRow) {
      console.error("[profile/send-otp] DB insert failed:", otpErr);
      return NextResponse.json({ error: "Failed to create verification session" }, { status: 500 });
    }

    // Send OTP email using the unified email utility
    const emailResult = await sendEmail({
      to: user.email!,
      subject: "🛡️ Verify Your Profile Update",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <h2 style="color:#60a5fa;margin-bottom:8px;">Verify Your Changes</h2>
          <p style="color:#94a3b8;">Hello ${fullName || "Trader"},</p>
          <p style="color:#94a3b8;">You recently requested to update your profile information. Enter the code below to confirm these changes:</p>
          <div style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:10px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#ffffff;">${otp}</span>
          </div>
          <p style="color:#f87171;font-size:13px;"><strong>⚠️ If you did not make this request, please change your password immediately.</strong></p>
          <p style="color:#94a3b8;font-size:13px;">This code expires in <strong style="color:#f59e0b;">10 minutes</strong>.</p>
          <hr style="border-color:#1e293b;margin:24px 0;" />
          <p style="color:#475569;font-size:11px;">Xspy-Trader Security Team</p>
        </div>
      `,
    });
    console.log("[profile/send-otp] Email result:", emailResult);

    return NextResponse.json({
      sessionId: otpRow.id,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (err: any) {
    console.error("[profile/send-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
