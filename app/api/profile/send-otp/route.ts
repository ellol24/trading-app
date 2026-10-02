import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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

async function sendOtpEmail(email: string, otp: string, fullName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_placeholder")) {
    console.warn("[profile/send-otp] RESEND_API_KEY not configured — skipping email.");
    return { ok: true, skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Xspy-Trader <onboarding@resend.dev>",
      to: [email],
      subject: "🔐 Confirm Your Profile Changes",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <h2 style="color:#60a5fa;margin-bottom:8px;">Profile Update Verification</h2>
          <p style="color:#94a3b8;">Hello ${fullName || "Trader"},</p>
          <p style="color:#94a3b8;">You requested to update your profile. Enter the code below to confirm these changes:</p>
          <div style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:10px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#ffffff;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">This code expires in <strong style="color:#f59e0b;">10 minutes</strong>. If you did not request this, please ignore this email.</p>
          <hr style="border-color:#1e293b;margin:24px 0;" />
          <p style="color:#475569;font-size:11px;">Xspy-Trader Security Team</p>
        </div>
      `,
    }),
  });

  return { ok: res.ok, status: res.status };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller
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

    // 2. Fetch user profile to get email & name
    const { data: profile, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("full_name")
      .eq("uid", user.id)
      .single();

    if (profileErr) {
      console.error("[profile/send-otp] Profile fetch error:", profileErr);
    }

    const fullName = profile?.full_name || `${firstName} ${lastName}`;

    // 3. Invalidate any previous unused profile OTPs for this user
    await adminClient
      .from("profile_update_otps")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // 4. Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 5. Store OTP session with the new data payload (server-side staging)
    const newData = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      country: country || null,
      city: city || null,
      address: address || null,
      zip_code: zipCode || null,
      telegram_chat_id: telegramChatId || null,
    };

    const { data: otpRow, error: otpErr } = await adminClient
      .from("profile_update_otps")
      .insert([{
        user_id: user.id,
        email_otp: otp,
        new_data: newData,
        expires_at: expiresAt.toISOString(),
      }])
      .select("id")
      .single();

    if (otpErr || !otpRow) {
      console.error("[profile/send-otp] DB insert failed:", otpErr);
      return NextResponse.json({ error: "Failed to create verification session" }, { status: 500 });
    }

    // 6. Send OTP via email
    const emailResult = await sendOtpEmail(user.email!, otp, fullName);
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
