import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BOT_TOKEN = "8935322771:AAF6RrJLk-qpzg9cqcLLM2D-Y_J6LotQBZI";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.message && body.message.chat) {
      const chatId = body.message.chat.id;
      const firstName = body.message.from?.first_name || "Trader";
      const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;

      const welcomeMessage =
        `🛡️ *Xspy Trader Security & 2FA*\n\n` +
        `Hello *${firstName}*! Your Telegram account is ready to receive instant one-time withdrawal security codes (OTP).\n\n` +
        `🔑 *Your Personal Chat ID:*\n` +
        `\`${chatId}\` _(tap to copy)_\n\n` +
        `📋 *How to connect your account:*\n` +
        `1. Copy your Chat ID above.\n` +
        `2. Go to your *Xspy Trader Profile* settings.\n` +
        `3. Paste your Chat ID into the *Telegram Chat ID* field and save.\n\n` +
        `Whenever you request a withdrawal, your 6-digit confirmation code will be delivered here instantly for maximum security.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeMessage,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "👤 Open Profile Settings",
                  url: "https://www.xspy-trader.com/dashboard/profile",
                },
              ],
              [
                {
                  text: "🌐 Visit Xspy Trader Platform",
                  url: "https://www.xspy-trader.com",
                },
              ],
            ],
          },
        }),
      });
    }

    // Always return 200 OK so Telegram doesn't retry
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook Error]", error);
    return NextResponse.json({ ok: true });
  }
}
