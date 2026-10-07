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
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim();

// ─── Debug GET endpoint ───────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: "ok",
    hasBotToken: !!BOT_TOKEN,
    botTokenPrefix: BOT_TOKEN,
    hasGeminiKey: !!GEMINI_API_KEY,
    geminiKeyPrefix: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + "..." : "NOT SET",
    model: "gemini-flash-latest",
    version: "v5",
  });
}

// ─── URL Detection ────────────────────────────────────────────────────────────
function containsExternalLink(text: string): boolean {
  // Match http/https links or t.me links
  const urlRegex = /(https?:\/\/[^\s]+)|(t\.me\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];

  for (const url of matches) {
    const lower = url.toLowerCase();
    // Allow site URL and telegram group links
    if (
      lower.includes("xspy-trader.vercel.app") ||
      lower.includes("xspy_trader") ||
      lower.includes("xspytrader") ||
      lower.includes("t.me/xspytraderbot") ||
      lower.includes("t.me/xspytraderotp_bot")
    ) {
      continue;
    }
    return true; // Found an external unrelated link
  }
  return false;
}

// ─── Telegram API Helper ──────────────────────────────────────────────────────
async function callTelegram(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Send Message ─────────────────────────────────────────────────────────────
async function sendMessage(chatId: number | string, text: string, replyToMessageId?: number) {
  let res = await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
  });
  
  if (!res.ok) {
    console.warn(`[GroupBot] Markdown parsing failed, retrying in plaintext. Error:`, res);
    // If Markdown parsing fails (e.g. unclosed asterisks, unescaped underscores),
    // retry sending as plain text so the message isn't lost.
    res = await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
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

// ─── Mute User (restrict for 24h) ────────────────────────────────────────────
async function muteUser(chatId: number | string, userId: number) {
  const until = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
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

// ─── Ban user on site for 24 hours ───────────────────────────────────────────
async function banUserOnSite(telegramUserId: number) {
  try {
    const bannedUntil = new Date(Date.now() + 86400 * 1000).toISOString();
    
    // Find user by telegram_chat_id
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
          ban_reason: "Posting external links in Telegram group"
        })
        .eq("uid", profile.uid);
      return true;
    }
  } catch (err) {
    console.error("[GroupBot] Failed to ban user on site:", err);
  }
  return false;
}

function getKeywordFallback(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes("deposit") || lower.includes("إيداع") || lower.includes("fund") || lower.includes("ايداع")) {
    return `📥 *How to Deposit on Xspy-Trader*\n\n1. Go to **Dashboard > Wallet > Deposit**\n2. Select your crypto network (USDT TRC20, BTC, ETH, etc.)\n3. Copy the wallet address shown\n4. Transfer the exact amount from your personal wallet\n5. Upload a payment screenshot and submit\n\n⏱ Deposits are approved manually within **5–15 minutes**.\n\n🌐 https://xspy-trader.vercel.app/dashboard`;
  }
  if (lower.includes("withdraw") || lower.includes("سحب")) {
    return `📤 *How to Withdraw on Xspy-Trader*\n\n1. Complete your profile first (required for withdrawals)\n2. Add a withdrawal wallet under **Wallet > Manage Wallets**\n3. Go to **Wallet > Withdraw**, select your wallet and enter the amount\n4. Verify with the 6-digit codes sent to your Email & Telegram\n\n⚠️ *Limits*: 1 withdrawal per day. A fee is deducted from the amount.\n\n🌐 https://xspy-trader.vercel.app/dashboard`;
  }
  if (lower.includes("trade") || lower.includes("trading") || lower.includes("تداول")) {
    return `📈 *How Trading Works on Xspy-Trader*\n\nXspy-Trader uses **Binary Options** trading:\n\n1. Go to **Dashboard > Trading**\n2. Select an asset (BTC/USD, EUR/USD, Gold, etc.)\n3. Enter your trade amount\n4. Predict: **HIGHER** 📈 or **LOWER** 📉\n5. Wait for the round to end — profits are credited automatically!\n\n🌐 https://xspy-trader.vercel.app/dashboard`;
  }
  if (lower.includes("package") || lower.includes("mining") || lower.includes("باقة") || lower.includes("استثمار")) {
    return `⛏ *Mining Packages on Xspy-Trader*\n\nEarn **daily profits** with our investment packages:\n\n- Each package has a minimum/maximum investment and a daily ROI %\n- Profits are **auto-credited every day** to your balance\n- Only one active investment per package type is allowed\n\nGo to **Dashboard > Packages** to get started!\n\n🌐 https://xspy-trader.vercel.app/dashboard`;
  }
  if (lower.includes("referral") || lower.includes("refer") || lower.includes("invite") || lower.includes("إحالة") || lower.includes("احالة")) {
    return `👥 *Referral Program on Xspy-Trader*\n\nEarn lifetime commissions on **3 levels**:\n\n- 🥇 Level 1: Your direct referrals\n- 🥈 Level 2: Referrals of your referrals\n- 🥉 Level 3: Third-degree network\n\nCommissions are paid on deposits, trades, and packages.\n\nGo to **Dashboard > Referrals** to get your link!\n\n🌐 https://xspy-trader.vercel.app/dashboard`;
  }
  if (lower.includes("register") || lower.includes("sign up") || lower.includes("account") || lower.includes("تسجيل") || lower.includes("حساب")) {
    return `👤 *Create an Account on Xspy-Trader*\n\n1. Visit: https://xspy-trader.vercel.app/auth/register\n2. Fill in your details and verify your email\n3. Complete your profile (name, phone, country) to unlock all features\n\n✅ Verified profile = full access to withdrawals and trading!`;
  }
  if (lower.includes("2fa") || lower.includes("telegram") || lower.includes("otp") || lower.includes("security") || lower.includes("أمان") || lower.includes("امان") || lower.includes("حماية")) {
    return `🔐 *Security & 2FA on Xspy-Trader*\n\nAll withdrawals require dual verification:\n\n1. A 6-digit code sent to your **Email**\n2. A 6-digit code sent to your **Telegram**\n\nTo link your Telegram:\n- Go to **Profile > Telegram** section\n- Message @XspyTraderOtp_bot and press START\n- Copy the Chat ID it gives you and paste it in your profile\n\n🌐 https://xspy-trader.vercel.app/dashboard/profile`;
  }

  // Generic fallback
  return `👋 *Xspy-Trader Support*\n\nI can help you with:\n📥 Deposits • 📤 Withdrawals • 📈 Trading • ⛏ Packages • 👥 Referrals • 🔐 Security\n\nJust ask about any topic and I'll guide you!\n\n🌐 https://xspy-trader.vercel.app`;
}

// ─── AI Answer via Gemini ─────────────────────────────────────────────────────
async function getAIAnswer(userMessage: string, userName: string, userId: number): Promise<string> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "NOT SET") {
    return getKeywordFallback(userMessage);
  }

  // Check if user has linked their Telegram account to their platform profile
  let userInfoStr = "Status: Unlinked/Unknown (User has not linked their Telegram to the platform).";
  try {
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("*")
      .eq("telegram_chat_id", String(userId))
      .single();
      
    if (profile) {
      userInfoStr = `Linked Account Found!
- Name: ${profile.full_name || userName}
- Verification Status: ${profile.status}
- Account UID: ${profile.uid}
(You can address them by their verified name and confirm their account status if they ask about it.)`;
    }
  } catch (e) {
    // ignore
  }

  const prompt = `${PLATFORM_KNOWLEDGE}

---

## CONTEXT
You are talking to a user named "${userName}".
User Database Info:
${userInfoStr}

User Message:
"${userMessage}"

Reply professionally as the Xspy-Trader official support assistant. 
- Be concise (max 300 words)
- Use appropriate emojis
- Format nicely with Markdown (bold **text**, bullet points)
- Reply in the SAME language the user wrote in
- If you do not know the answer, say so politely and direct them to contact admin`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500,
          },
        }),
      }
    );

    const data = await res.json();
    
    if (!res.ok) {
      console.error("[GroupBot] Gemini API returned error:", data);
      return getKeywordFallback(userMessage);
    }
    
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) {
      console.error("[GroupBot] Gemini API returned empty or malformed answer:", data);
      return getKeywordFallback(userMessage);
    }
    
    return answer;
  } catch (err) {
    console.error("[GroupBot] Gemini API error:", err);
    return getKeywordFallback(userMessage);
  }
}

// ─── Is the message directed at the bot or a question? ───────────────────────
function isQuestionForBot(text: string): boolean {
  const lower = text.toLowerCase();
  
  // Explicitly mentioned by either potential username
  if (lower.includes("@xspy_ai_bot") || lower.includes("@xspyaibot")) return true;
  
  // Common question starters
  const questionWords = [
    "how", "what", "when", "where", "why", "can", "could", "do", "does", 
    "is", "are", "will", "كيف", "ما", "متى", "أين", "لماذا", "هل", "ما هو", "طريقة", "كيفية",
    "comment", "quand", "où", "pourquoi", "est-ce", "wie", "was", "wann"
  ];
  
  return questionWords.some(w => lower.startsWith(w)) || lower.includes("?") || lower.includes("؟");
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Only process regular messages (not edited, etc.)
    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const chatType = message.chat.type; // "group", "supergroup", "private"
    const userId = message.from?.id;
    const userName = message.from?.first_name || "User";
    const messageId = message.message_id;

    // ── 0. NEW MEMBERS WELCOME ───────────────────────────────────────────────
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;
        
        await sendMessage(
          chatId,
          `👋 *Welcome to the official Xspy-Trader group, ${member.first_name}!* 🚀\n\n` +
          `I am the platform's AI Assistant. We offer professional binary options trading and high-yield mining packages.\n\n` +
          `🔒 *Important:* To enable withdrawals and secure your account, you must link your Telegram to your profile.\n` +
          `👉 *How to do it:*\n` +
          `1. Message our security bot @XspyTraderOtp\\_bot and press START to get your ID.\n` +
          `2. Paste that ID in your Profile on the platform.\n\n` +
          `If you have any questions about deposits, trading, or anything else, just ask me here in the group!\n\n` +
          `🌐 *Platform*: https://xspy-trader.vercel.app`
        );
      }
      return NextResponse.json({ ok: true });
    }

    const text = message.text || message.caption || "";
    if (!text || !userId) return NextResponse.json({ ok: true });

    // ── 1. SPAM MODERATION: Detect external links in groups ──────────────────
    if ((chatType === "group" || chatType === "supergroup") && containsExternalLink(text)) {
      // Delete the message
      await deleteMessage(chatId, messageId);
      
      // Mute the user for 24 hours
      await muteUser(chatId, userId);
      
      // Try to ban them on the site
      const siteBanned = await banUserOnSite(userId);
      
      // Send warning
      await sendMessage(
        chatId,
        `⚠️ *Group Policy Violation*\n\n@${message.from?.username || userName} has been muted for *24 hours* for posting an external link.\n\n${siteBanned ? "🔒 Their platform account has also been temporarily suspended." : ""}\n\n_Only links related to Xspy-Trader are allowed in this group._`
      );
      
      return NextResponse.json({ ok: true });
    }

    // ── 2. PRIVATE MESSAGES: Always respond ──────────────────────────────────
    if (chatType === "private") {
      // Handle /start command with a rich welcome message (no AI needed)
      if (text.trim() === "/start") {
        await sendMessage(chatId,
          `👋 *Welcome to Xspy-Trader AI Support, ${userName}!*\n\n` +
          `I'm the official support assistant for the **Xspy-Trader** trading platform. I can help you with:\n\n` +
          `📥 *Deposits* — How to fund your account\n` +
          `📤 *Withdrawals* — How to withdraw your earnings\n` +
          `📈 *Trading* — How binary options trading works\n` +
          `⛏ *Mining Packages* — Daily ROI investment packages\n` +
          `👥 *Referrals* — Earn commissions by inviting friends\n` +
          `🔐 *Security & 2FA* — Keep your account safe\n` +
          `👤 *Account & Profile* — Registration, KYC, and profile setup\n\n` +
          `Just ask me anything and I'll answer immediately! 🚀\n\n` +
          `🌐 *Platform*: https://xspy-trader.vercel.app`
        );
        return NextResponse.json({ ok: true });
      }

      const answer = await getAIAnswer(text, userName, userId);
      await sendMessage(chatId, answer);
      return NextResponse.json({ ok: true });
    }

    // ── 3. GROUP MESSAGES: Respond to questions & mentions ───────────────────
    if (chatType === "group" || chatType === "supergroup") {
      if (isQuestionForBot(text)) {
        // Clean the text (remove bot mention if present)
        let cleanText = text.replace(/@xspy_ai_bot/gi, "").replace(/@xspyaibot/gi, "").trim();
        
        const answer = await getAIAnswer(cleanText || text, userName, userId);
        await sendMessage(chatId, answer, messageId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[GroupBot Webhook Error]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
