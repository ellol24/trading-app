import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_KNOWLEDGE, SITE_URL } from "@/lib/telegram-bot-knowledge";

// ─── Admin Supabase Client ────────────────────────────────────────────────────
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOT_TOKEN = process.env.TELEGRAM_GROUP_BOT_TOKEN!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

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
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
  });
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

// ─── AI Answer via Gemini ─────────────────────────────────────────────────────
async function getAIAnswer(userMessage: string, userName: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "I'm here to help! For questions about deposits, withdrawals, trading, or packages, please visit https://xspy-trader.vercel.app or contact our support team.";
  }

  const prompt = `${PLATFORM_KNOWLEDGE}

---

A user named "${userName}" asks in the Telegram group:
"${userMessage}"

Reply professionally as the Xspy-Trader official support assistant. 
- Be concise (max 300 words)
- Use appropriate emojis
- Format nicely with Markdown (bold **text**, bullet points)
- Reply in the SAME language the user wrote in
- If you do not know the answer, say so politely and direct them to contact admin`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        }),
      }
    );

    const data = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return answer || "I'm sorry, I couldn't generate a response. Please contact the admin directly.";
  } catch (err) {
    console.error("[GroupBot] Gemini API error:", err);
    return "I'm here to help! For specific questions, please visit https://xspy-trader.vercel.app";
  }
}

// ─── Is the message directed at the bot or a question? ───────────────────────
function isQuestionForBot(text: string, botUsername: string): boolean {
  const lower = text.toLowerCase();
  const botMention = `@${botUsername.toLowerCase()}`;
  
  // Explicitly mentioned
  if (lower.includes(botMention)) return true;
  
  // Common question starters
  const questionWords = [
    "how", "what", "when", "where", "why", "can", "could", "do", "does", 
    "is", "are", "will", "كيف", "ما", "متى", "أين", "لماذا", "هل", "ما هو",
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
      const answer = await getAIAnswer(text, userName);
      await sendMessage(chatId, answer);
      return NextResponse.json({ ok: true });
    }

    // ── 3. GROUP MESSAGES: Respond to questions & mentions ───────────────────
    if (chatType === "group" || chatType === "supergroup") {
      const BOT_USERNAME = "XSpyAIBot";
      
      if (isQuestionForBot(text, BOT_USERNAME)) {
        // Clean the text (remove bot mention if present)
        const cleanText = text.replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "").trim();
        
        const answer = await getAIAnswer(cleanText || text, userName);
        await sendMessage(chatId, answer, messageId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[GroupBot Webhook Error]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
