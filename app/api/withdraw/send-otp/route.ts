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
  // cryptographically secure 6-digit integer
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}



import { getOtpBotToken } from "@/lib/telegram-tokens";

async function sendTelegramOtp(chatId: string, otp: string) {
  const token = getOtpBotToken();
  if (!token) {
    console.warn("[send-otp] TELEGRAM_BOT_TOKEN not set — skipping Telegram.");
    return { ok: true, skipped: true };
  }

  const text =
    `🔐 *Xspy Trader Withdrawal Verification / تأكيد عملية السحب*\n\n` +
    `Your one-time security code is:\n` +
    `رمز الأمان الخاص بك لتأكيد السحب:\n\n` +
    `\`${otp}\` _(tap to copy / اضغط لنسخ الكود)_\n\n` +
    `⏱ Expires in *5 minutes* / صالح لمدة *5 دقائق* فقط.\n\n` +
    `⚠️ If you did not request this withdrawal, please contact support immediately.\n` +
    `إذا لم تكن أنت من طلب هذا السحب، يرجى التواصل مع الدعم الفني فوراً.`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );

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
    const { walletId, amount, fee, netAmount } = body;

    if (!walletId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const amt = Number(amount);
    const feeNum = Number(fee || 0);
    const netNum = Number(netAmount || amt - feeNum);

    // 2. Fetch user profile (email, telegram_chat_id, balance, full_name)
    const { data: profile, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("balance, telegram_chat_id, full_name")
      .eq("uid", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Check balance
    if (Number(profile.balance) < amt) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 422 });
    }

    // 4. Check daily withdrawal limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: todayRows } = await adminClient
      .from("withdrawals")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", startOfDay.toISOString());

    if (todayRows && todayRows.length > 0) {
      return NextResponse.json({ error: "One withdrawal per day allowed" }, { status: 429 });
    }

    // 5. Invalidate any previous unused OTPs for this user
    await adminClient
      .from("withdrawal_otps")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // 6. Generate OTP (Email verification solely)
    const emailOtp = generateOtp();
    const telegramOtp = emailOtp; // Keep populated for DB backward-compatibility

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // +5 minutes

    // 7. Store OTP session in DB
    const { data: otpRow, error: otpErr } = await adminClient
      .from("withdrawal_otps")
      .insert([{
        user_id: user.id,
        email_otp: emailOtp,
        telegram_otp: telegramOtp,
        wallet_id: walletId,
        amount: amt,
        fee: feeNum,
        net_amount: netNum,
        expires_at: expiresAt.toISOString(),
      }])
      .select("id")
      .single();

    if (otpErr || !otpRow) {
      console.error("[send-otp] DB insert failed:", otpErr);
      return NextResponse.json({ error: "Failed to create OTP session" }, { status: 500 });
    }

    // 8. Send Verification Code via Email (Gmail)
    const emailResult = await sendEmail({
      to: user.email!,
      subject: "🔐 Your Withdrawal Verification Code – Xspy Trader",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:28px 36px;text-align:center;border-bottom:1px solid #1e293b;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#60a5fa;letter-spacing:1px;">🔐 Xspy Trader</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#64748b;">Security Verification</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:32px 36px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#cbd5e1;">Hello <strong style="color:#e2e8f0;">${profile.full_name || "Trader"}</strong>,</p>
                    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
                      A withdrawal request was initiated on your account. Use the one-time code below to confirm the transaction.
                    </p>
                    <!-- OTP Block -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:12px;padding:28px;text-align:center;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#60a5fa;letter-spacing:2px;text-transform:uppercase;">Your Verification Code</p>
                          <p style="margin:12px 0 4px;font-size:48px;font-weight:900;letter-spacing:14px;color:#ffffff;font-variant-numeric:tabular-nums;">${emailOtp}</p>
                          <p style="margin:8px 0 0;font-size:12px;color:#f59e0b;">⏱ Expires in 5 minutes</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                      If you did not request this withdrawal, please <a href="https://xspy-trader.com/dashboard/support" style="color:#60a5fa;text-decoration:none;">contact our support team</a> immediately.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 36px;border-top:1px solid #1e293b;text-align:center;">
                    <p style="margin:0;font-size:11px;color:#334155;">© 2025 Xspy Trader · <a href="https://xspy-trader.com" style="color:#475569;text-decoration:none;">xspy-trader.com</a></p>
                    <p style="margin:4px 0 0;font-size:10px;color:#1e293b;">Sent from no-reply@xspy-trader.com</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("[send-otp] Verification email result:", emailResult);

    return NextResponse.json({
      sessionId: otpRow.id,
      hasTelegram: false,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (err: any) {
    console.error("[send-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
