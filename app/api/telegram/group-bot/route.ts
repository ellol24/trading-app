import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_KNOWLEDGE, SITE_URL } from "@/lib/telegram-bot-knowledge";

// ─── Admin Supabase Client ────────────────────────────────────────────────────
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOT_TOKEN = (process.env.TELEGRAM_GROUP_BOT_TOKEN || "").trim();
const OTP_BOT_USERNAME = "@XSpyTraderOtp_bot";
const GEMINI_API_KEY = (
  process.env.GEMINI_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  ""
).trim();

// ─── Rate Limiting (in-memory, per deployment instance) ──────────────────────
const rateLimitMap = new Map<number, number>();
const RATE_LIMIT_WINDOW_MS = 15000; // 15 seconds between AI responses per user

function isRateLimited(userId: number): boolean {
  const lastResponse = rateLimitMap.get(userId);
  if (lastResponse && Date.now() - lastResponse < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  rateLimitMap.set(userId, Date.now());
  return false;
}

// ─── Debug GET endpoint ───────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: "ok",
    bot: "XSpyAIBot (Group Bot)",
    hasBotToken: !!BOT_TOKEN,
    botTokenPrefix: BOT_TOKEN ? BOT_TOKEN.substring(0, 10) + "..." : "NOT SET",
    hasGeminiKey: !!GEMINI_API_KEY,
    geminiKeyPrefix: GEMINI_API_KEY
      ? GEMINI_API_KEY.substring(0, 10) + "..."
      : "NOT SET",
    model: "gemini-flash-latest",
    version: "v8",
  });
}

// ─── URL Detection ────────────────────────────────────────────────────────────
const ALLOWED_DOMAINS = [
  "xspy-trader.com",
  "xspy-trader.vercel.app",
  "xspy_trader",
  "xspytrader",
  "t.me/xspytraderbot",
  "t.me/xspytraderotp_bot",
  "t.me/xspytraderbot",
  "t.me/xspy_ai_bot",
  "t.me/xspyaibot",
];

function containsExternalLink(text: string): boolean {
  const urlRegex = /(https?:\/\/[^\s]+)|(t\.me\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];

  for (const url of matches) {
    const lower = url.toLowerCase();
    if (ALLOWED_DOMAINS.some((domain) => lower.includes(domain))) continue;
    return true;
  }
  return false;
}

// ─── Telegram API Helper ──────────────────────────────────────────────────────
async function callTelegram(method: string, body: object) {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

// ─── Send Message (with Markdown fallback) ────────────────────────────────────
async function sendMessage(
  chatId: number | string,
  text: string,
  options: {
    replyToMessageId?: number;
    replyMarkup?: object;
    parseMode?: "Markdown" | "HTML" | "MarkdownV2";
  } = {}
) {
  const { replyToMessageId, replyMarkup, parseMode = "Markdown" } = options;

  let res = await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

  // Fallback to plaintext if Markdown parsing fails
  if (!res.ok) {
    console.warn(`[GroupBot] Parse mode failed, retrying plaintext. Error:`, res.description);
    res = await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }
  return res;
}

// ─── Delete Message ───────────────────────────────────────────────────────────
async function deleteMessage(chatId: number | string, messageId: number) {
  return callTelegram("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

// ─── Mute User (restrict permissions for 24h) ─────────────────────────────────
async function muteUser(chatId: number | string, userId: number) {
  const until = Math.floor(Date.now() / 1000) + 86400;
  return callTelegram("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    permissions: {
      can_send_messages: false,
      can_send_audios: false,
      can_send_documents: false,
      can_send_photos: false,
      can_send_videos: false,
      can_send_video_notes: false,
      can_send_voice_notes: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
    },
    until_date: until,
  });
}

// ─── Ban User On Platform for 24h ────────────────────────────────────────────
async function banUserOnSite(telegramUserId: number): Promise<boolean> {
  try {
    const bannedUntil = new Date(Date.now() + 86400 * 1000).toISOString();

    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("uid")
      .eq("telegram_chat_id", String(telegramUserId))
      .single();

    if (profile?.uid) {
      await adminClient
        .from("user_profiles")
        .update({
          status: "banned",
          banned_until: bannedUntil,
          ban_reason: "Posting external links in the official Telegram group",
        })
        .eq("uid", profile.uid);
      return true;
    }
  } catch (err) {
    console.error("[GroupBot] Failed to ban user on site:", err);
  }
  return false;
}

// ─── Log Admin Notification ───────────────────────────────────────────────────
async function logAdminNotification(
  type: string,
  title: string,
  message: string,
  data?: object
) {
  try {
    await adminClient.from("admin_notifications").insert({
      type,
      title,
      message,
      data: data || {},
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical — swallow error silently
  }
}

// ─── Keyword Fallback Answers ─────────────────────────────────────────────────
function getKeywordFallback(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (
    lower.includes("deposit") ||
    lower.includes("إيداع") ||
    lower.includes("شحن") ||
    lower.includes("fund")
  ) {
    return (
      `💰 *How to Deposit on XSPY Trader*\n\n` +
      `*Minimum deposit:* $51\n\n` +
      `1. Go to *Dashboard › Wallet › Deposit*\n` +
      `2. Select your crypto network (USDT TRC20, BTC, ETH, etc.)\n` +
      `3. Copy the wallet address shown\n` +
      `4. Transfer the exact amount from your personal wallet\n` +
      `5. Upload a payment screenshot and submit\n\n` +
      `⏱ *Processing time:* 5–15 minutes (manually approved by admin)\n\n` +
      `🔗 ${SITE_URL}/dashboard/deposit`
    );
  }
  if (lower.includes("withdraw") || lower.includes("سحب")) {
    return (
      `💸 *How to Withdraw on XSPY Trader*\n\n` +
      `*Minimum:* $21 | *Fee:* 10% | *Processed within:* 24 hours\n\n` +
      `1. Complete your profile first (required for withdrawals)\n` +
      `2. Add a withdrawal wallet under *Wallet › Manage Wallets*\n` +
      `   _(New wallets have a 24-hour security hold before first use)_\n` +
      `3. Go to *Wallet › Withdraw*, select your wallet and enter amount\n` +
      `4. Confirm with 6-digit codes sent to your *Email* & *Telegram*\n\n` +
      `⚠️ Only *1 withdrawal per day* is allowed.\n\n` +
      `🔗 ${SITE_URL}/dashboard/withdraw`
    );
  }
  if (
    lower.includes("trade") ||
    lower.includes("trading") ||
    lower.includes("تداول") ||
    lower.includes("صفقة")
  ) {
    return (
      `📊 *How Trading Works on XSPY Trader*\n\n` +
      `⚠️ *Important:* You cannot open a trade yourself — the admin opens them.\n\n` +
      `*The process:*\n` +
      `1. Admin opens *one trade per day* (Mon–Fri) and announces it in the group\n` +
      `2. You go to *Dashboard › Trading* and JOIN the active trade with your amount\n` +
      `3. After the round ends, profits are automatically credited to your balance\n\n` +
      `*Profit rates:*\n` +
      `⏱ 30-second trade: *2% profit*\n` +
      `⏱ 45-second trade: *2.5% profit*\n` +
      `⏱ 60-second trade: *3% profit*\n\n` +
      `💡 Example: $100 in a 60s trade = $3 profit (winning)\n\n` +
      `🔗 ${SITE_URL}/dashboard/trading`
    );
  }
  if (
    lower.includes("package") ||
    lower.includes("mining") ||
    lower.includes("باقة") ||
    lower.includes("باقات") ||
    lower.includes("تعدين")
  ) {
    return (
      `⛏️ *Mining Packages on XSPY Trader*\n\n` +
      `Activate a package and earn *daily passive income*:\n\n` +
      `1️⃣ *Beginner:* $51–$100 | *1.8%/day* | 15 days\n` +
      `2️⃣ *Professional:* $101–$150 | *2%/day* | 30 days\n` +
      `3️⃣ *VIP:* $151–$200 | *2.5%/day* | 45 days\n\n` +
      `💡 Example: $80 in Beginner → $1.44/day × 15 days = *$21.60 profit*\n\n` +
      `- Profits auto-credited daily to your balance\n` +
      `- One active investment per package type at a time\n\n` +
      `🔗 ${SITE_URL}/dashboard/packages`
    );
  }
  if (
    lower.includes("referral") ||
    lower.includes("refer") ||
    lower.includes("invite") ||
    lower.includes("إحالة") ||
    lower.includes("فريق")
  ) {
    return (
      `🤝 *Referral Program on XSPY Trader*\n\n` +
      `Earn commissions from your team on *3 levels*:\n\n` +
      `🥇 Level 1 (your direct invites): *10%*\n` +
      `🥈 Level 2: *7%*\n` +
      `🥉 Level 3: *2%*\n\n` +
      `*You earn on your team's:*\n` +
      `🎁 Deposits\n` +
      `📈 Trading profits\n` +
      `📦 Mining package earnings\n\n` +
      `🔗 Get your referral link: ${SITE_URL}/dashboard/referrals`
    );
  }
  if (
    lower.includes("register") ||
    lower.includes("sign up") ||
    lower.includes("تسجيل") ||
    lower.includes("حساب جديد")
  ) {
    return (
      `📝 *Create an Account on XSPY Trader*\n\n` +
      `1. Visit: ${SITE_URL}/auth/register\n` +
      `2. Fill in your details and verify your email\n` +
      `3. Complete your full profile to unlock withdrawals\n\n` +
      `✅ A verified profile = full access to trading, packages & withdrawals!\n\n` +
      `*Minimum to start:* $51 deposit`
    );
  }
  if (
    lower.includes("2fa") ||
    lower.includes("otp") ||
    lower.includes("verify") ||
    lower.includes("security") ||
    lower.includes("أمان") ||
    lower.includes("توثيق") ||
    lower.includes("تحقق")
  ) {
    return (
      `🔐 *Security & Telegram Linking on XSPY Trader*\n\n` +
      `All withdrawals require *dual 2FA verification*:\n` +
      `1. A 6-digit code sent to your *Email*\n` +
      `2. A 6-digit code sent to your *Telegram*\n\n` +
      `*How to link your Telegram:*\n` +
      `1. Message ${OTP_BOT_USERNAME} and press *START*\n` +
      `2. Copy the Chat ID it gives you\n` +
      `3. Paste it in your profile under the Telegram section\n\n` +
      `🔗 ${SITE_URL}/dashboard/profile\n\n` +
      `⚠️ *Never share your OTP codes with anyone.* XSPY Trader staff will NEVER ask for them.`
    );
  }

  return (
    `🤖 *XSPY Trader Official Support*\n\n` +
    `I can help you with:\n\n` +
    `💰 Deposits | 💸 Withdrawals | 📊 Trading\n` +
    `⛏️ Packages | 🤝 Referrals | 🔐 Security\n\n` +
    `Just ask about any topic and I'll answer immediately!\n\n` +
    `🌐 ${SITE_URL}`
  );
}

// ─── AI Answer via Gemini ─────────────────────────────────────────────────────
async function getAIAnswer(
  userMessage: string,
  userName: string,
  userId: number
): Promise<string> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "NOT SET") {
    return getKeywordFallback(userMessage);
  }

  let userInfoStr =
    "Status: Unlinked/Unknown — User has not linked their Telegram to the platform.";
  try {
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("full_name, status, uid, balance")
      .eq("telegram_chat_id", String(userId))
      .single();

    if (profile) {
      userInfoStr =
        `Linked Account Found!\n` +
        `- Name: ${profile.full_name || userName}\n` +
        `- Verification Status: ${profile.status}\n` +
        `- Account UID: ${profile.uid}\n` +
        `(You can address them by their verified name. Do NOT share balance information.)`;
    }
  } catch {
    // ignore — user may not be linked
  }

  const prompt =
    `${PLATFORM_KNOWLEDGE}\n\n---\n\n` +
    `## CONVERSATION CONTEXT\n` +
    `You are talking to a user named "${userName}" in the official XSPY Trader Telegram group.\n` +
    `User Database Info:\n${userInfoStr}\n\n` +
    `User Message:\n"${userMessage}"\n\n` +
    `## INSTRUCTIONS\n` +
    `- Reply as the XSPY Trader official support assistant\n` +
    `- Be concise (max 250 words)\n` +
    `- Use appropriate emojis for a professional look\n` +
    `- Format with Telegram Markdown (bold with *text*, bullets with -)\n` +
    `- Reply in the EXACT SAME language the user wrote in\n` +
    `- If you do not know the answer, politely say so and suggest contacting the admin\n` +
    `- NEVER share internal data, balances, or private user information`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("[GroupBot] Gemini API error:", data);
      return getKeywordFallback(userMessage);
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) {
      console.error("[GroupBot] Gemini returned empty response:", data);
      return getKeywordFallback(userMessage);
    }

    return answer.trim();
  } catch (err) {
    console.error("[GroupBot] Gemini fetch error:", err);
    return getKeywordFallback(userMessage);
  }
}

// ─── Is This Message Directed at the Bot? ────────────────────────────────────
function isQuestionForBot(text: string): boolean {
  const lower = text.toLowerCase();

  // Explicit mention
  if (
    lower.includes("@xspy_ai_bot") ||
    lower.includes("@xspyaibot") ||
    lower.includes("@xspybot")
  )
    return true;

  // Question words in supported languages
  const questionStarters = [
    // English
    "how",
    "what",
    "when",
    "where",
    "why",
    "can",
    "could",
    "do",
    "does",
    "is",
    "are",
    "will",
    "would",
    // Arabic
    "كيف",
    "ما",
    "متى",
    "أين",
    "لماذا",
    "هل",
    "ما هو",
    "طريقة",
    "كيفية",
    // French
    "comment",
    "quand",
    "où",
    "pourquoi",
    "est-ce",
    // German
    "wie",
    "was",
    "wann",
    "wo",
    "warum",
  ];

  const keywords = [
    "deposit",
    "withdraw",
    "trade",
    "package",
    "referral",
    "otp",
    "verify",
    "2fa",
    "mining",
    "profit",
    "إيداع",
    "سحب",
    "تداول",
    "باقة",
    "إحالة",
    "ارباح",
  ];

  if (questionStarters.some((w) => lower.startsWith(w))) return true;
  if (lower.includes("?") || lower.includes("؟")) return true;
  if (keywords.some((k) => lower.includes(k))) return true;

  return false;
}

// ─── Build Welcome Message ────────────────────────────────────────────────────
function buildWelcomeMessage(memberName: string): string {
  return (
    `🎉 *Welcome to the Official XSPY Trader Group, ${memberName}!*\n\n` +
    `We're glad to have you here. XSPY Trader is a professional digital investment platform offering:\n\n` +
    `📊 *Binary Options Trading* — Join admin-opened trades (Mon–Fri) and earn 2–3% per round\n` +
    `⛏️ *Mining Packages* — Earn daily passive income of up to 2.5%/day\n` +
    `🤝 *3-Level Referral Program* — Earn 10%, 7%, and 2% from your team's activities\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔐 *IMPORTANT — Verify Your Account*\n\n` +
    `To enable withdrawals and receive your security codes, you *must* link your Telegram to your profile:\n\n` +
    `1️⃣ Open ${OTP_BOT_USERNAME} and press *START*\n` +
    `2️⃣ Copy the *Chat ID* it provides\n` +
    `3️⃣ Go to your *Profile* on the platform and paste the Chat ID in the Telegram field\n\n` +
    `✅ Once linked, you'll receive instant OTP codes for every withdrawal — keeping your funds fully secure.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Ask me anything!* Just type your question here in the group — I'm available 24/7.\n\n` +
    `🌐 *Platform:* ${SITE_URL}`
  );
}

function buildWelcomeInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🚀 Open Platform", url: SITE_URL },
        {
          text: "🔐 Verify Now",
          url: `https://t.me/XSpyTraderOtp_bot`,
        },
      ],
      [{ text: "👤 My Profile", url: `${SITE_URL}/dashboard/profile` }],
    ],
  };
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Handle callback queries (inline button presses) ──
    if (body.callback_query) {
      const cb = body.callback_query;
      // Acknowledge immediately to dismiss loading indicator
      await callTelegram("answerCallbackQuery", { callback_query_id: cb.id });
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const chatType = message.chat.type; // "group" | "supergroup" | "private"
    const userId = message.from?.id;
    const userName = message.from?.first_name || "Member";
    const messageId = message.message_id;

    // ── 0. NEW MEMBER WELCOME ──────────────────────────────────────────────────
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;

        await sendMessage(chatId, buildWelcomeMessage(member.first_name), {
          replyMarkup: buildWelcomeInlineKeyboard(),
        });
      }
      return NextResponse.json({ ok: true });
    }

    // ── Member left (clean acknowledgement, optional) ──────────────────────────
    if (message.left_chat_member) {
      // Silently ignore — no farewell spam
      return NextResponse.json({ ok: true });
    }

    const text = message.text || message.caption || "";
    if (!text || !userId) return NextResponse.json({ ok: true });

    // ── 1. SPAM MODERATION: Detect external links in groups ───────────────────
    if (
      (chatType === "group" || chatType === "supergroup") &&
      containsExternalLink(text)
    ) {
      await deleteMessage(chatId, messageId);
      await muteUser(chatId, userId);
      const siteBanned = await banUserOnSite(userId);

      await sendMessage(
        chatId,
        `⚠️ *Group Policy Violation*\n\n` +
          `@${message.from?.username || userName} has been muted for *24 hours* for posting an external link.\n\n` +
          `${siteBanned ? "🔒 Their platform account has also been temporarily suspended." : ""}\n\n` +
          `_Only links related to XSPY Trader are permitted in this group._`
      );

      // Log to admin notification center
      await logAdminNotification(
        "spam_detected",
        "🚨 Spam Detected in Telegram Group",
        `User @${message.from?.username || userName} (Telegram ID: ${userId}) posted an external link and was muted for 24h.${siteBanned ? " Platform account suspended." : ""}`,
        { telegramUserId: userId, username: message.from?.username, chatId }
      );

      return NextResponse.json({ ok: true });
    }

    // ── 2. PRIVATE MESSAGES: Always respond ───────────────────────────────────
    if (chatType === "private") {
      if (text.trim() === "/start") {
        await sendMessage(
          chatId,
          `👋 *Welcome to XSPY Trader AI Support, ${userName}!* 🚀\n\n` +
            `I'm the official 24/7 support assistant for *XSPY Trader*. Here's what I can help you with:\n\n` +
            `📥 *Deposits* — How to fund your account\n` +
            `📤 *Withdrawals* — How to withdraw your earnings\n` +
            `📈 *Trading* — How binary options trading works\n` +
            `⛏️ *Mining Packages* — Daily ROI investment packages\n` +
            `👥 *Referrals* — Earn commissions by inviting friends\n` +
            `🔐 *Security & 2FA* — Keep your account safe\n` +
            `👤 *Account & Profile* — Registration, KYC, and profile setup\n\n` +
            `Just type your question and I'll answer immediately! 💡\n\n` +
            `🌐 *Platform:* ${SITE_URL}`,
          {
            replyMarkup: {
              inline_keyboard: [
                [{ text: "🚀 Visit Platform", url: SITE_URL }],
                [
                  {
                    text: "📖 How to Get Started",
                    url: `${SITE_URL}/dashboard`,
                  },
                ],
              ],
            },
          }
        );
        return NextResponse.json({ ok: true });
      }

      if (text.trim() === "/help") {
        await sendMessage(
          chatId,
          `🆘 *Available Commands*\n\n` +
            `/start — Welcome message & overview\n` +
            `/help — Show this help menu\n\n` +
            `Or simply ask me any question in plain language!\n\n` +
            `Examples:\n` +
            `• "How do I deposit?"\n` +
            `• "كيف أسحب أموالي؟"\n` +
            `• "Comment fonctionne le trading?"`
        );
        return NextResponse.json({ ok: true });
      }

      // Rate limit check
      if (isRateLimited(userId)) {
        await sendMessage(
          chatId,
          `⏳ Please wait a moment before sending another message.`
        );
        return NextResponse.json({ ok: true });
      }

      const answer = await getAIAnswer(text, userName, userId);
      await sendMessage(chatId, answer);
      return NextResponse.json({ ok: true });
    }

    // ── 3. GROUP MESSAGES: Respond to questions & mentions ────────────────────
    if (chatType === "group" || chatType === "supergroup") {
      if (!isQuestionForBot(text)) return NextResponse.json({ ok: true });

      // Rate limit per user in groups
      if (isRateLimited(userId)) {
        return NextResponse.json({ ok: true }); // Silently skip in groups
      }

      // Strip bot mention from question text
      const cleanText = text
        .replace(/@xspy_ai_bot/gi, "")
        .replace(/@xspyaibot/gi, "")
        .replace(/@xspybot/gi, "")
        .trim();

      const answer = await getAIAnswer(cleanText || text, userName, userId);
      await sendMessage(chatId, answer, { replyToMessageId: messageId });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[GroupBot Webhook Error]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
