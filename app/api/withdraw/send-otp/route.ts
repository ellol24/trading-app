import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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

async function sendEmailOtp(email: string, otp: string, fullName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_placeholder")) {
    console.warn("[send-otp] RESEND_API_KEY not configured — skipping email.");
    return { ok: true, skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Xspy-Trader <onboarding@resend.dev>",
      to: [email],
      subject: "🔐 Your Withdrawal Verification Code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <h2 style="color:#60a5fa;margin-bottom:8px;">Withdrawal Security Code</h2>
          <p style="color:#94a3b8;">Hello ${fullName || "Trader"},</p>
          <p style="color:#94a3b8;">You requested a withdrawal. Enter the code below to confirm:</p>
          <div style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:10px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#ffffff;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">This code expires in <strong style="color:#f59e0b;">5 minutes</strong>. If you did not request this, please contact support immediately.</p>
          <hr style="border-color:#1e293b;margin:24px 0;" />
          <p style="color:#475569;font-size:11px;">Xspy-Trader Security Team</p>
        </div>
      `,
    }),
  });

  return { ok: res.ok, status: res.status };
}

async function sendTelegramOtp(chatId: string, otp: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[send-otp] TELEGRAM_BOT_TOKEN not set — skipping Telegram.");
    return { ok: true, skipped: true };
  }

  const text =
    `🔐 *Xspy-Trader Withdrawal Verification*\n\n` +
    `Your security code is:\n\n` +
    `\`${otp}\`\n\n` +
    `⏱ Expires in *5 minutes*.\n` +
    `If you didn't request this, contact support immediately.`;

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

    // 6. Generate two independent OTPs
    const emailOtp = generateOtp();
    const telegramOtp = generateOtp();

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

    // 8. Fire dual dispatch in parallel
    const hasTelegram = !!profile.telegram_chat_id;
    const dispatches: Promise<any>[] = [
      sendEmailOtp(user.email!, emailOtp, profile.full_name || "Trader"),
    ];
    if (hasTelegram) {
      dispatches.push(sendTelegramOtp(profile.telegram_chat_id!, telegramOtp));
    }

    const results = await Promise.allSettled(dispatches);
    const [emailResult, telegramResult] = results;

    console.log("[send-otp] Email result:", emailResult);
    if (hasTelegram) console.log("[send-otp] Telegram result:", telegramResult);

    return NextResponse.json({
      sessionId: otpRow.id,
      hasTelegram,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (err: any) {
    console.error("[send-otp] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
