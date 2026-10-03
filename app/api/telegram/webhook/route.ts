import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if there is a message
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text.trim();
      const firstName = body.message.from?.first_name || "Trader";

      // If the user sends /start
      if (text.startsWith("/start")) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (botToken) {
          const welcomeMessage = 
            `🛡 *Welcome to Xspy-Trader Security, ${firstName}!*\n\n` +
            `Your Telegram account is now successfully linked to our system.\n\n` +
            `Your personal Chat ID is: \`${chatId}\`\n\n` +
            `You can copy this ID and paste it into your Xspy-Trader profile to receive secure 2FA withdrawal codes.`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeMessage,
              parse_mode: "Markdown",
            }),
          });
        }
      }
    }

    // Always return 200 OK to Telegram so it doesn't retry
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook Error]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
