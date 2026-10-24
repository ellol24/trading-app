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

// ─── Supported Languages ──────────────────────────────────────────────────────
export type SupportedLang = "ar" | "en" | "fr" | "de" | "ru";

interface BotResponse {
  text: string;
  replyMarkup?: object;
}

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(text: string, userLang?: string): SupportedLang {
  // 1. Script checks take highest priority
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";

  const lower = (text || "").toLowerCase();

  // 2. Keyword detection for Latin-script languages
  if (
    /\b(bonjour|salut|retrait|retirer|depot|dépôt|déposer|comment|pourquoi|combien|parrainage|compte|sécurité|securite|argent|gagner|investir|merci)\b/i.test(
      lower
    )
  ) {
    return "fr";
  }

  if (
    /\b(hallo|guten|auszahlung|auszahlen|einzahlung|einzahlen|wie|warum|wieviel|überweisung|konto|sicherheit|geld|verdienen|anlegen|danke)\b/i.test(
      lower
    )
  ) {
    return "de";
  }

  // 3. User's Telegram interface language code
  const code = (userLang || "").toLowerCase();
  if (code.startsWith("ar")) return "ar";
  if (code.startsWith("fr")) return "fr";
  if (code.startsWith("de")) return "de";
  if (code.startsWith("ru")) return "ru";

  return "en";
}

// ─── Inline Keyboards ─────────────────────────────────────────────────────────
function buildWithdrawalInlineKeyboard(lang: SupportedLang) {
  const labels: Record<
    SupportedLang,
    { verify: string; withdraw: string; profile: string }
  > = {
    ar: {
      verify: "🔐 فتح بوت التحقق (@XSpyTraderOtp_bot)",
      withdraw: "💸 التوجه لصفحة السحب",
      profile: "👤 ربط المعرف في الملف الشخصي",
    },
    en: {
      verify: "🔐 Open Verification Bot (@XSpyTraderOtp_bot)",
      withdraw: "💸 Go to Withdraw Page",
      profile: "👤 Link ID in Profile",
    },
    fr: {
      verify: "🔐 Ouvrir le Bot (@XSpyTraderOtp_bot)",
      withdraw: "💸 Page de retrait",
      profile: "👤 Associer dans le profil",
    },
    de: {
      verify: "🔐 Verifizierungs-Bot (@XSpyTraderOtp_bot)",
      withdraw: "💸 Auszahlungsseite öffnen",
      profile: "👤 ID im Profil hinterlegen",
    },
    ru: {
      verify: "🔐 Бот верификации (@XSpyTraderOtp_bot)",
      withdraw: "💸 Перейти к выводу",
      profile: "👤 Привязать ID в профиле",
    },
  };
  const l = labels[lang] || labels.en;
  return {
    inline_keyboard: [
      [{ text: l.verify, url: "https://t.me/XSpyTraderOtp_bot" }],
      [
        { text: l.withdraw, url: `${SITE_URL}/dashboard/withdraw` },
        { text: l.profile, url: `${SITE_URL}/dashboard/profile` },
      ],
    ],
  };
}

function buildVerificationInlineKeyboard(lang: SupportedLang) {
  const labels: Record<SupportedLang, { verify: string; profile: string }> = {
    ar: { verify: "🔐 تشغيل بوت التحقق الآن", profile: "👤 فتح الملف الشخصي" },
    en: { verify: "🔐 Start Verification Bot Now", profile: "👤 Open Profile" },
    fr: {
      verify: "🔐 Démarrer le Bot de Vérification",
      profile: "👤 Ouvrir le Profil",
    },
    de: { verify: "🔐 Verifizierungs-Bot starten", profile: "👤 Profil öffnen" },
    ru: {
      verify: "🔐 Запустить бота верификации",
      profile: "👤 Открыть профиль",
    },
  };
  const l = labels[lang] || labels.en;
  return {
    inline_keyboard: [
      [{ text: l.verify, url: "https://t.me/XSpyTraderOtp_bot" }],
      [{ text: l.profile, url: `${SITE_URL}/dashboard/profile` }],
    ],
  };
}

function buildDepositInlineKeyboard(lang: SupportedLang) {
  const labels: Record<SupportedLang, string> = {
    ar: "💰 التوجه لصفحة الإيداع",
    en: "💰 Go to Deposit Page",
    fr: "💰 Aller sur la page de dépôt",
    de: "💰 Zur Einzahlungsseite",
    ru: "💰 Перейти к пополнению",
  };
  return {
    inline_keyboard: [
      [{ text: labels[lang] || labels.en, url: `${SITE_URL}/dashboard/deposit` }],
    ],
  };
}

function buildTradingInlineKeyboard(lang: SupportedLang) {
  const labels: Record<SupportedLang, string> = {
    ar: "📊 التوجه لصفحة التداول",
    en: "📊 Go to Trading Page",
    fr: "📊 Aller sur la page de trading",
    de: "📊 Zur Trading-Seite",
    ru: "📊 Перейти к сделкам",
  };
  return {
    inline_keyboard: [
      [{ text: labels[lang] || labels.en, url: `${SITE_URL}/dashboard/trading` }],
    ],
  };
}

function buildPackagesInlineKeyboard(lang: SupportedLang) {
  const labels: Record<SupportedLang, string> = {
    ar: "⛏️ تصفح باقات الاستثمار",
    en: "⛏️ View Investment Packages",
    fr: "⛏️ Voir les packs d'investissement",
    de: "⛏️ Pakete ansehen",
    ru: "⛏️ Посмотреть пакеты",
  };
  return {
    inline_keyboard: [
      [{ text: labels[lang] || labels.en, url: `${SITE_URL}/dashboard/packages` }],
    ],
  };
}

function buildReferralsInlineKeyboard(lang: SupportedLang) {
  const labels: Record<SupportedLang, string> = {
    ar: "🤝 صفحة الإحالات وفريقي",
    en: "🤝 My Referrals & Team",
    fr: "🤝 Mes parrainages et équipe",
    de: "🤝 Meine Partner & Team",
    ru: "🤝 Моя партнёрская сеть",
  };
  return {
    inline_keyboard: [
      [{ text: labels[lang] || labels.en, url: `${SITE_URL}/dashboard/referrals` }],
    ],
  };
}

function buildRegisterInlineKeyboard(lang: SupportedLang) {
  const labels: Record<SupportedLang, string> = {
    ar: "📝 فتح حساب جديد الآن",
    en: "📝 Create Account Now",
    fr: "📝 Créer un compte maintenant",
    de: "📝 Jetzt Konto eröffnen",
    ru: "📝 Зарегистрироваться сейчас",
  };
  return {
    inline_keyboard: [
      [{ text: labels[lang] || labels.en, url: `${SITE_URL}/auth/register` }],
    ],
  };
}

function isWithdrawalQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("withdraw") ||
    lower.includes("سحب") ||
    lower.includes("السحب") ||
    lower.includes("اسحب") ||
    lower.includes("retrait") ||
    lower.includes("retirer") ||
    lower.includes("auszahlung") ||
    lower.includes("auszahlen") ||
    lower.includes("abheben") ||
    lower.includes("вывод") ||
    lower.includes("вывести")
  );
}

// ─── Multilingual Knowledge Dictionary ────────────────────────────────────────
const FALLBACK_CONTENT: Record<
  SupportedLang,
  {
    withdraw: string;
    deposit: string;
    trade: string;
    package: string;
    referral: string;
    register: string;
    verify: string;
    defaultSupport: string;
  }
> = {
  ar: {
    withdraw:
      `💸 *طريقة السحب من منصة XSPY Trader*\n\n` +
      `*الحد الأدنى:* $21 | *الرسوم:* 10% | *وقت المعالجة:* خلال 24 ساعة\n` +
      `⚠️ *الحد الأقصى:* يُسمح بسحب واحد فقط كل 24 ساعة.\n\n` +
      `📋 *خطوات السحب وتفعيل الأمان:*\n` +
      `1️⃣ *إكمال بيانات الملف الشخصي:* تأكد من ملء وتأكيد بيانات ملفك الشخصي أولاً.\n\n` +
      `2️⃣ *تفعيل بوت التحقق الأمني (خطوة إلزامية):*\n` +
      `لاستلام رمز التحقق السري (OTP) المكون من 6 أرقام والمطلوب لإتمام كل عملية سحب، يجب ربط حسابك ببوت التحقق الرسمي:\n` +
      `👉 رابط البوت: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `👉 اضغط على *START* وسيقوم البوت بتوليد رقم التعريف الخاص بك (Chat ID).\n` +
      `👉 انسخ الرقم وتوجه إلى *الملف الشخصي*: ${SITE_URL}/dashboard/profile\n` +
      `👉 الصق الرقم في خانة *Telegram Chat ID* واضغط *حفظ*.\n\n` +
      `3️⃣ *إضافة محفظة السحب:* من قسم *المحفظة › إدارة المحافظ* (المحافظ الجديدة تخضع لفترة حماية 24 ساعة قبل أول استخدام).\n\n` +
      `4️⃣ *تقديم طلب السحب:* توجه إلى *المحفظة › سحب*، اختر محفظتك وأدخل المبلغ، ثم أدخل رمز OTP المستلم على تيليجرام وبريدك الإلكتروني.\n\n` +
      `🔗 *رابط بوت التحقق:* https://t.me/XSpyTraderOtp_bot\n` +
      `🌐 *صفحة السحب:* ${SITE_URL}/dashboard/withdraw`,

    deposit:
      `💰 *طريقة الإيداع في منصة XSPY Trader*\n\n` +
      `*الحد الأدنى للإيداع:* $51\n\n` +
      `📋 *خطوات شحن الرصيد:*\n` +
      `1️⃣ توجه إلى *لوحة التحكم › المحفظة › إيداع*\n` +
      `2️⃣ اختر شبكة العملة الرقمية المفضلة (USDT TRC20, BTC, ETH وغيرها)\n` +
      `3️⃣ انسخ عنوان المحفظة المعروض بدقة\n` +
      `4️⃣ قم بالتحويل من محفظتك الشخصية بنفس المبلغ\n` +
      `5️⃣ التقط لقطة شاشة لإشعار التحويل المكتمل وقم برفعها مع رمز المعاملة (TXID)\n\n` +
      `⏱ *وقت التأكيد:* من 5 إلى 15 دقيقة بعد المراجعة اليدوية من الإدارة.\n\n` +
      `🌐 *صفحة الإيداع:* ${SITE_URL}/dashboard/deposit`,

    trade:
      `📊 *نظام التداول في منصة XSPY Trader*\n\n` +
      `⚠️ *تنبيه هام:* لا يمكنك فتح صفقات بمفردك — الإدارة هي من تفتح الصفقات اليومية وتعلن عنها.\n\n` +
      `📋 *آلية العمل:*\n` +
      `1️⃣ تفتح الإدارة *صفقة واحدة يومياً* (من الاثنين إلى الجمعة) ويتم الإعلان عنها في المجموعة.\n` +
      `2️⃣ يتوجه الأعضاء إلى *لوحة التحكم › التداول* وينضمون للصفقة النشطة بالمبلغ المرغوب.\n` +
      `3️⃣ فور انتهاء مدة الجولة، تُضاف الأرباح تلقائياً إلى رصيدك.\n\n` +
      `📈 *نسب الأرباح حسب مدة الصفقة:*\n` +
      `⏱ صفقة 30 ثانية: *ربح 2%*\n` +
      `⏱ صفقة 45 ثانية: *ربح 2.5%*\n` +
      `⏱ صفقة 60 ثانية: *ربح 3%*\n\n` +
      `💡 *مثال:* دخول صفقة 60 ثانية بمبلغ $100 = ربح $3 صافي (المجموع $103).\n\n` +
      `🌐 *صفحة التداول:* ${SITE_URL}/dashboard/trading`,

    package:
      `⛏️ *باقات التعدين والاستثمار في XSPY Trader*\n\n` +
      `احصل على *عائد يومي تلقائي* من خلال تفعيل إحدى الباقات:\n\n` +
      `1️⃣ *باقة المبتدئين (Beginner):*\n` +
      `💵 الاستثمار: $51 – $100 | 📈 العائد: *1.8% يومياً* | ⏱ المدة: 15 يوماً\n\n` +
      `2️⃣ *الباقة الاحترافية (Professional):*\n` +
      `💵 الاستثمار: $101 – $150 | 📈 العائد: *2.0% يومياً* | ⏱ المدة: 30 يوماً\n\n` +
      `3️⃣ *باقة كبار الشخصيات (VIP):*\n` +
      `💵 الاستثمار: $151 – $200 | 📈 العائد: *2.5% يومياً* | ⏱ المدة: 45 يوماً\n\n` +
      `💡 *مثال:* باقة المبتدئين بمبلغ $80 تعود عليك بـ $1.44 يومياً × 15 يوماً = *$21.60 صافي ربح*.\n` +
      `- الأرباح تُضاف يومياً بشكل تلقائي إلى رصيدك.\n` +
      `- يُسمح بباقة استثمارية نشطة واحدة من كل نوع في نفس الوقت.\n\n` +
      `🌐 *صفحة الباقات:* ${SITE_URL}/dashboard/packages`,

    referral:
      `🤝 *برنامج الإحالات في منصة XSPY Trader*\n\n` +
      `اكسب عمولات مجزية من نشاط وتداولات فريقك عبر *3 مستويات:*\n\n` +
      `🥇 *المستوى الأول (دعواتك المباشرة):* *10%*\n` +
      `🥈 *المستوى الثاني (دعوات المستوى الأول):* *7%*\n` +
      `🥉 *المستوى الثالث (الجيل الثالث):* *2%*\n\n` +
      `💰 *تشمل العمولات كافة أنشطة فريقك:*\n` +
      `🎁 إيداعات الفريق\n` +
      `📈 أرباح التداول\n` +
      `📦 أرباح باقات التعدين\n\n` +
      `🔗 *رابط إحالتك ومتابعة الفريق:* ${SITE_URL}/dashboard/referrals`,

    register:
      `📝 *فتح حساب جديد في XSPY Trader*\n\n` +
      `1️⃣ ادخل إلى رابط التسجيل: ${SITE_URL}/auth/register\n` +
      `2️⃣ أدخل بياناتك وبريدك الإلكتروني وقم بتأكيده.\n` +
      `3️⃣ توجه إلى صفحة الملف الشخصي وأكمل بياناتك الشخصية (الاسم، البلد، الهاتف، ورقم التيليجرام) لتفعيل حسابك بالكامل وفتح إمكانية السحب.\n\n` +
      `💰 *الحد الأدنى للبدء:* إيداع $51\n` +
      `🌐 *رابط التسجيل:* ${SITE_URL}/auth/register`,

    verify:
      `🔐 *الأمان والتحقق الثنائي في منصة XSPY Trader*\n\n` +
      `لحماية أموالك، تتطلب جميع عمليات السحب *تحققاً أمنياً مزدوجاً (2FA):*\n` +
      `1️⃣ رمز تأكيد مكون من 6 أرقام يُرسل إلى *بريدك الإلكتروني*.\n` +
      `2️⃣ رمز تأكيد فوري يُرسل إلى *تيليجرام* عبر بوت التحقق الأمني الرسمي.\n\n` +
      `📋 *طريقة ربط حساب تيليجرام وتفعيله:*\n` +
      `1️⃣ افتح بوت التحقق: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `2️⃣ اضغط على *START* ليظهر لك رقم التعريف الشخصي (*Chat ID*).\n` +
      `3️⃣ انسخ الرقم وتوجه إلى ملفك الشخصي: ${SITE_URL}/dashboard/profile\n` +
      `4️⃣ الصق الرقم في خانة *Telegram Chat ID* واضغط *حفظ*.\n\n` +
      `⚠️ *تنبيه أمني:* لا تشارك رموز OTP الخاصة بك مع أي شخص، ففريق المنصة لن يطلبها منك أبداً!\n\n` +
      `🔗 *رابط بوت التحقق:* https://t.me/XSpyTraderOtp_bot`,

    defaultSupport:
      `🤖 *المساعد الذكي الرسمي لمنصة XSPY Trader*\n\n` +
      `أهلاً بك! يمكنني الإجابة الفورية على استفساراتك حول:\n\n` +
      `💰 *الإيداع* | 💸 *السحب* | 📊 *التداول*\n` +
      `⛏️ *باقات التعدين* | 🤝 *برنامج الإحالات* | 🔐 *أمان الحساب والتوثيق*\n\n` +
      `💡 اكتب سؤالك في أي وقت وسأقوم بالرد فوراً!\n` +
      `🌐 *الموقع الرسمي:* ${SITE_URL}`,
  },

  en: {
    withdraw:
      `💸 *How to Withdraw on XSPY Trader*\n\n` +
      `*Minimum:* $21 | *Fee:* 10% | *Processing time:* Within 24 hours\n` +
      `⚠️ *Limit:* Only 1 withdrawal per day is allowed.\n\n` +
      `📋 *Step-by-step Withdrawal & Verification Guide:*\n` +
      `1️⃣ *Complete your profile:* Ensure your profile details are saved and verified.\n\n` +
      `2️⃣ *Activate the Security Verification Bot (CRITICAL):*\n` +
      `To receive your 6-digit withdrawal OTP security codes, you *must* link your Telegram via our official verification bot:\n` +
      `👉 Open the bot: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `👉 Tap *START* and copy your personal *Chat ID*.\n` +
      `👉 Go to your profile: ${SITE_URL}/dashboard/profile\n` +
      `👉 Paste your Chat ID into the Telegram field and click *Save*.\n\n` +
      `3️⃣ *Add a Withdrawal Wallet:* Under *Wallet › Manage Wallets* (New wallets undergo a 24-hour security hold before first use).\n\n` +
      `4️⃣ *Submit Withdrawal:* Go to *Wallet › Withdraw*, select your wallet, enter amount ($21+), and confirm using the 6-digit OTP codes sent to your Email and Telegram.\n\n` +
      `🔗 *Verification Bot:* https://t.me/XSpyTraderOtp_bot\n` +
      `🌐 *Withdrawal Page:* ${SITE_URL}/dashboard/withdraw`,

    deposit:
      `💰 *How to Deposit on XSPY Trader*\n\n` +
      `*Minimum deposit:* $51\n\n` +
      `📋 *Deposit Steps:*\n` +
      `1️⃣ Go to *Dashboard › Wallet › Deposit*\n` +
      `2️⃣ Select your preferred crypto network (USDT TRC20, BTC, ETH, etc.)\n` +
      `3️⃣ Copy the displayed wallet address carefully\n` +
      `4️⃣ Transfer the exact amount from your personal crypto wallet\n` +
      `5️⃣ Upload a transaction screenshot and submit\n\n` +
      `⏱ *Processing time:* 5–15 minutes (manually verified by admin)\n\n` +
      `🌐 *Deposit Page:* ${SITE_URL}/dashboard/deposit`,

    trade:
      `📊 *How Trading Works on XSPY Trader*\n\n` +
      `⚠️ *Important Notice:* Trades cannot be opened independently — the admin opens all daily trades.\n\n` +
      `📋 *How It Works:*\n` +
      `1️⃣ The admin opens *one trade per day* (Monday–Friday) and announces it in the group.\n` +
      `2️⃣ Go to *Dashboard › Trading* and JOIN the active round with your desired amount.\n` +
      `3️⃣ Once the round ends, winning profits are automatically credited to your balance.\n\n` +
      `📈 *Profit Rates:*\n` +
      `⏱ 30-second trade: *2% profit*\n` +
      `⏱ 45-second trade: *2.5% profit*\n` +
      `⏱ 60-second trade: *3% profit*\n\n` +
      `💡 *Example:* Joining a 60-second trade with $100 yields *$3 pure profit* (Total balance: $103).\n\n` +
      `🌐 *Trading Page:* ${SITE_URL}/dashboard/trading`,

    package:
      `⛏️ *Mining & Investment Packages on XSPY Trader*\n\n` +
      `Activate a package to earn *automatic daily passive income*:\n\n` +
      `1️⃣ *Beginner Package:*\n` +
      `💵 Investment: $51 – $100 | 📈 ROI: *1.8%/day* | ⏱ Duration: 15 days\n\n` +
      `2️⃣ *Professional Package:*\n` +
      `💵 Investment: $101 – $150 | 📈 ROI: *2.0%/day* | ⏱ Duration: 30 days\n\n` +
      `3️⃣ *VIP Package:*\n` +
      `💵 Investment: $151 – $200 | 📈 ROI: *2.5%/day* | ⏱ Duration: 45 days\n\n` +
      `💡 *Example:* An $80 investment in Beginner generates $1.44/day × 15 days = *$21.60 net profit*.\n` +
      `- Earnings are automatically credited to your balance daily.\n` +
      `- One active investment per package type at a time.\n\n` +
      `🌐 *Packages Page:* ${SITE_URL}/dashboard/packages`,

    referral:
      `🤝 *Referral Program on XSPY Trader*\n\n` +
      `Earn substantial commissions across *3 team levels:*\n\n` +
      `🥇 *Level 1 (Direct Invites):* *10%*\n` +
      `🥈 *Level 2 (Invited by Level 1):* *7%*\n` +
      `🥉 *Level 3 (Third Degree):* *2%*\n\n` +
      `💰 *You earn commissions on your team's:*\n` +
      `🎁 Deposits\n` +
      `📈 Trading Profits\n` +
      `📦 Mining Package Earnings\n\n` +
      `🔗 *Get your referral link:* ${SITE_URL}/dashboard/referrals`,

    register:
      `📝 *Create an Account on XSPY Trader*\n\n` +
      `1️⃣ Visit registration: ${SITE_URL}/auth/register\n` +
      `2️⃣ Enter your details and verify your email.\n` +
      `3️⃣ Go to your profile and complete your personal information to achieve Verified status and enable withdrawals.\n\n` +
      `💰 *Minimum to get started:* $51 deposit\n` +
      `🌐 *Sign Up:* ${SITE_URL}/auth/register`,

    verify:
      `🔐 *Security & Telegram Verification on XSPY Trader*\n\n` +
      `To ensure maximum fund protection, all withdrawals require *dual 2FA verification:*\n` +
      `1️⃣ A 6-digit confirmation code sent to your *Email*.\n` +
      `2️⃣ A 6-digit instant OTP code sent to your *Telegram* via our verification bot.\n\n` +
      `📋 *How to Link Your Telegram:*\n` +
      `1️⃣ Open the verification bot: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `2️⃣ Tap *START* and copy the generated personal *Chat ID*.\n` +
      `3️⃣ Go to your platform profile: ${SITE_URL}/dashboard/profile\n` +
      `4️⃣ Paste the Chat ID into the Telegram field and click *Save*.\n\n` +
      `⚠️ *Security Alert:* Never share your OTP codes. XSPY Trader staff will NEVER ask for them!\n\n` +
      `🔗 *Verification Bot:* https://t.me/XSpyTraderOtp_bot`,

    defaultSupport:
      `🤖 *XSPY Trader Official AI Support*\n\n` +
      `Welcome! I can instantly assist you with:\n\n` +
      `💰 *Deposits* | 💸 *Withdrawals* | 📊 *Trading*\n` +
      `⛏️ *Mining Packages* | 🤝 *Referral Program* | 🔐 *Security & 2FA*\n\n` +
      `💡 Simply type your question and I will answer right away!\n` +
      `🌐 *Official Website:* ${SITE_URL}`,
  },

  fr: {
    withdraw:
      `💸 *Comment effectuer un retrait sur XSPY Trader*\n\n` +
      `*Minimum :* 21 $ | *Frais :* 10 % | *Délai de traitement :* sous 24 heures\n` +
      `⚠️ *Limite :* Un seul retrait par jour est autorisé.\n\n` +
      `📋 *Étapes de retrait et configuration de sécurité :*\n` +
      `1️⃣ *Complétez votre profil :* Vos informations doivent être renseignées pour débloquer les retraits.\n\n` +
      `2️⃣ *Activez le Bot de Vérification (OBLIGATOIRE) :*\n` +
      `Pour recevoir votre code secret OTP à 6 chiffres indispensable pour chaque retrait, liez votre compte Telegram via notre bot officiel :\n` +
      `👉 Ouvrez le bot : [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `👉 Cliquez sur *START* et copiez votre identifiant personnel (*Chat ID*).\n` +
      `👉 Rendez-vous sur votre profil : ${SITE_URL}/dashboard/profile\n` +
      `👉 Collez l'identifiant dans le champ Telegram et cliquez sur *Enregistrer*.\n\n` +
      `3️⃣ *Ajoutez votre portefeuille de retrait :* Dans *Portefeuille › Gérer les portefeuilles* (délai de sécurité de 24h pour les nouveaux portefeuilles).\n\n` +
      `4️⃣ *Validez votre retrait :* Rendez-vous sur *Portefeuille › Retirer*, saisissez le montant (min 21 $) et confirmez avec le code OTP reçu par Telegram et E-mail.\n\n` +
      `🔗 *Lien du bot de vérification :* https://t.me/XSpyTraderOtp_bot\n` +
      `🌐 *Page de retrait :* ${SITE_URL}/dashboard/withdraw`,

    deposit:
      `💰 *Comment effectuer un dépôt sur XSPY Trader*\n\n` +
      `*Dépôt minimum :* 51 $\n\n` +
      `📋 *Étapes de dépôt :*\n` +
      `1️⃣ Rendez-vous dans *Tableau de bord › Portefeuille › Déposer*\n` +
      `2️⃣ Choisissez votre réseau crypto (USDT TRC20, BTC, ETH, etc.)\n` +
      `3️⃣ Copiez l'adresse du portefeuille affichée avec précision\n` +
      `4️⃣ Effectuez le virement depuis votre portefeuille personnel\n` +
      `5️⃣ Téléversez une capture d'écran du paiement et validez\n\n` +
      `⏱ *Délai de traitement :* 5 à 15 minutes (validation manuelle par l'administrateur)\n\n` +
      `🌐 *Page de dépôt :* ${SITE_URL}/dashboard/deposit`,

    trade:
      `📊 *Comment fonctionne le Trading sur XSPY Trader*\n\n` +
      `⚠️ *Règle importante :* Les trades sont ouverts uniquement par l'administrateur, pas individuellement.\n\n` +
      `📋 *Fonctionnement :*\n` +
      `1️⃣ L'administrateur lance *un trade par jour* (du lundi au vendredi) et l'annonce dans le groupe.\n` +
      `2️⃣ Rendez-vous dans *Tableau de bord › Trading* et rejoignez le trade avec votre mise.\n` +
      `3️⃣ À la fin du temps imparti, les bénéfices sont crédités immédiatement sur votre solde.\n\n` +
      `📈 *Taux de rendement :*\n` +
      `⏱ Trade de 30 secondes : *2 % de profit*\n` +
      `⏱ Trade de 45 secondes : *2,5 % de profit*\n` +
      `⏱ Trade de 60 secondes : *3 % de profit*\n\n` +
      `💡 *Exemple :* Une mise de 100 $ sur un trade de 60s génère *3 $ de profit net*.\n\n` +
      `🌐 *Page de trading :* ${SITE_URL}/dashboard/trading`,

    package:
      `⛏️ *Packs d'Investissement & Minage sur XSPY Trader*\n\n` +
      `Activez un pack et générez des *revenus passifs quotidiens* :\n\n` +
      `1️⃣ *Pack Débutant (Beginner) :*\n` +
      `💵 Investissement : 51 $ – 100 $ | 📈 Rendement : *1,8 %/jour* | ⏱ Durée : 15 jours\n\n` +
      `2️⃣ *Pack Professionnel (Professional) :*\n` +
      `💵 Investissement : 101 $ – 150 $ | 📈 Rendement : *2,0 %/jour* | ⏱ Durée : 30 jours\n\n` +
      `3️⃣ *Pack VIP :*\n` +
      `💵 Investissement : 151 $ – 200 $ | 📈 Rendement : *2,5 %/jour* | ⏱ Durée : 45 jours\n\n` +
      `💡 *Exemple :* 80 $ placés dans le pack Débutant = 1,44 $/jour pendant 15 jours = *21,60 $ de profit net*.\n` +
      `- Les profits sont crédités quotidiennement sur votre solde.\n\n` +
      `🌐 *Page des packs :* ${SITE_URL}/dashboard/packages`,

    referral:
      `🤝 *Programme de Parrainage sur XSPY Trader*\n\n` +
      `Gagnez des commissions sur *3 niveaux* d'équipe :\n\n` +
      `🥇 *Niveau 1 (Vos filleuls directs) :* *10 %*\n` +
      `🥈 *Niveau 2 (Filleuls de niveau 2) :* *7 %*\n` +
      `🥉 *Niveau 3 (Filleuls de niveau 3) :* *2 %*\n\n` +
      `💰 *Vous touchez des commissions sur :*\n` +
      `🎁 Les dépôts de votre équipe\n` +
      `📈 Les gains de trading\n` +
      `📦 Les revenus des packs de minage\n\n` +
      `🔗 *Obtenez votre lien de parrainage :* ${SITE_URL}/dashboard/referrals`,

    register:
      `📝 *Créer un compte sur XSPY Trader*\n\n` +
      `1️⃣ Rendez-vous sur : ${SITE_URL}/auth/register\n` +
      `2️⃣ Remplissez vos coordonnées et validez votre e-mail.\n` +
      `3️⃣ Complétez votre profil avec vos informations pour obtenir le statut Vérifié et débloquer les retraits.\n\n` +
      `💰 *Dépôt minimum de départ :* 51 $\n` +
      `🌐 *Inscription :* ${SITE_URL}/auth/register`,

    verify:
      `🔐 *Sécurité et Vérification Telegram sur XSPY Trader*\n\n` +
      `Pour protéger vos avoirs, tout retrait exige une *double vérification (2FA) :*\n` +
      `1️⃣ Un code à 6 chiffres envoyé à votre *E-mail*.\n` +
      `2️⃣ Un code OTP instantané envoyé à votre *Telegram* via notre bot de vérification.\n\n` +
      `📋 *Comment lier votre compte Telegram :*\n` +
      `1️⃣ Ouvrez le bot : [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `2️⃣ Cliquez sur *START* et copiez votre identifiant (*Chat ID*).\n` +
      `3️⃣ Rendez-vous sur votre profil : ${SITE_URL}/dashboard/profile\n` +
      `4️⃣ Collez le Chat ID dans le champ Telegram et enregistrez.\n\n` +
      `⚠️ *Sécurité :* Ne divulguez jamais vos codes OTP, le support ne vous les demandera jamais !\n\n` +
      `🔗 *Bot de vérification :* https://t.me/XSpyTraderOtp_bot`,

    defaultSupport:
      `🤖 *Support Officiel XSPY Trader*\n\n` +
      `Bienvenue ! Je peux répondre instantanément à vos questions sur :\n\n` +
      `💰 *Dépôts* | 💸 *Retraits* | 📊 *Trading*\n` +
      `⛏️ *Packs d'investissement* | 🤝 *Parrainage* | 🔐 *Sécurité & 2FA*\n\n` +
      `💡 Posez votre question et j'y répondrai aussitôt !\n` +
      `🌐 *Site officiel :* ${SITE_URL}`,
  },

  de: {
    withdraw:
      `💸 *So funktioniert die Auszahlung auf XSPY Trader*\n\n` +
      `*Mindestbetrag:* 21 $ | *Gebühr:* 10 % | *Bearbeitungszeit:* innerhalb von 24 Stunden\n` +
      `⚠️ *Limit:* Nur 1 Auszahlung pro Tag erlaubt.\n\n` +
      `📋 *Schritte zur Auszahlung & Sicherheitseinrichtung:*\n` +
      `1️⃣ *Profil vervollständigen:* Füllen Sie Ihre Profildaten aus, um Auszahlungen freizuschalten.\n\n` +
      `2️⃣ *Verifizierungs-Bot aktivieren (ERFORDERLICH):*\n` +
      `Um Ihren 6-stelligen OTP-Sicherheitscode für jede Auszahlung zu erhalten, müssen Sie Ihr Telegram-Konto über unseren offiziellen Bot verknüpfen:\n` +
      `👉 Öffnen Sie den Bot: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `👉 Drücken Sie *START* und kopieren Sie Ihre persönliche *Chat-ID*.\n` +
      `👉 Gehen Sie zu Ihrem Profil: ${SITE_URL}/dashboard/profile\n` +
      `👉 Fügen Sie die Chat-ID im Telegram-Feld ein und klicken Sie auf *Speichern*.\n\n` +
      `3️⃣ *Auszahlungs-Wallet hinzufügen:* Unter *Wallet › Wallets verwalten* (24-Stunden-Sicherheitssperre für neue Wallets).\n\n` +
      `4️⃣ *Auszahlung absenden:* Gehen Sie zu *Wallet › Auszahlen*, Wallet auswählen, Betrag eingeben und mit den OTP-Codes per E-Mail und Telegram bestätigen.\n\n` +
      `🔗 *Verifizierungs-Bot:* https://t.me/XSpyTraderOtp_bot\n` +
      `🌐 *Auszahlungsseite:* ${SITE_URL}/dashboard/withdraw`,

    deposit:
      `💰 *So funktioniert die Einzahlung auf XSPY Trader*\n\n` +
      `*Mindesteinzahlung:* 51 $\n\n` +
      `📋 *Schritte zur Einzahlung:*\n` +
      `1️⃣ Gehen Sie zu *Dashboard › Wallet › Einzahlen*\n` +
      `2️⃣ Wählen Sie das gewünschte Krypto-Netzwerk (USDT TRC20, BTC, ETH usw.)\n` +
      `3️⃣ Kopieren Sie die angezeigte Wallet-Adresse sorgfältig\n` +
      `4️⃣ Überweisen Sie den genauen Betrag von Ihrer privaten Wallet\n` +
      `5️⃣ Screenshot der Transaktion hochladen und absenden\n\n` +
      `⏱ *Bearbeitungszeit:* 5–15 Minuten (manuelle Überprüfung durch den Admin)\n\n` +
      `🌐 *Einzahlungsseite:* ${SITE_URL}/dashboard/deposit`,

    trade:
      `📊 *Funktionsweise des Tradings auf XSPY Trader*\n\n` +
      `⚠️ *Wichtiger Hinweis:* Trades werden ausschließlich vom Admin eröffnet.\n\n` +
      `📋 *Ablauf:*\n` +
      `1️⃣ Der Admin startet *einen Trade pro Tag* (Montag–Freitag) und kündigt ihn in der Gruppe an.\n` +
      `2️⃣ Sie gehen zu *Dashboard › Trading* und treten dem aktiven Trade mit Ihrem Einsatz bei.\n` +
      `3️⃣ Nach Ablauf der Runde werden Gewinne sofort Ihrem Guthaben gutgeschrieben.\n\n` +
      `📈 *Gewinnquoten:*\n` +
      `⏱ 30-Sekunden-Trade: *2 % Gewinn*\n` +
      `⏱ 45-Sekunden-Trade: *2,5 % Gewinn*\n` +
      `⏱ 60-Sekunden-Trade: *3 % Gewinn*\n\n` +
      `💡 *Beispiel:* 100 $ Einsatz im 60s-Trade bringen *3 $ Reingewinn*.\n\n` +
      `🌐 *Trading-Seite:* ${SITE_URL}/dashboard/trading`,

    package:
      `⛏️ *Mining- & Anlage-Pakete auf XSPY Trader*\n\n` +
      `Aktivieren Sie ein Paket für *automatisches tägliches passives Einkommen*:\n\n` +
      `1️⃣ *Beginner-Paket:*\n` +
      `💵 Anlage: 51 $ – 100 $ | 📈 Rendite: *1,8 %/Tag* | ⏱ Laufzeit: 15 Tage\n\n` +
      `2️⃣ *Professional-Paket:*\n` +
      `💵 Anlage: 101 $ – 150 $ | 📈 Rendite: *2,0 %/Tag* | ⏱ Laufzeit: 30 Tage\n\n` +
      `3️⃣ *VIP-Paket:*\n` +
      `💵 Anlage: 151 $ – 200 $ | 📈 Rendite: *2,5 %/Tag* | ⏱ Laufzeit: 45 Tage\n\n` +
      `💡 *Beispiel:* 80 $ im Beginner-Paket ergeben 1,44 $/Tag × 15 Tage = *21,60 $ Reingewinn*.\n` +
      `- Gewinne werden täglich automatisch gutgeschrieben.\n\n` +
      `🌐 *Pakete-Seite:* ${SITE_URL}/dashboard/packages`,

    referral:
      `🤝 *Partnerprogramm auf XSPY Trader*\n\n` +
      `Verdienen Sie Provisionen über *3 Teamebenen:*\n\n` +
      `🥇 *Ebene 1 (Direkte Partner):* *10 %*\n` +
      `🥈 *Ebene 2 (Partner der Ebene 1):* *7 %*\n` +
      `🥉 *Ebene 3 (Dritte Ebene):* *2 %*\n\n` +
      `💰 *Vergütung auf alle Aktivitäten Ihres Teams:*\n` +
      `🎁 Einzahlungen\n` +
      `📈 Trading-Gewinne\n` +
      `📦 Mining-Paket-Erträge\n\n` +
      `🔗 *Partnerlink abrufen & Team einsehen:* ${SITE_URL}/dashboard/referrals`,

    register:
      `📝 *Konto eröffnen auf XSPY Trader*\n\n` +
      `1️⃣ Registrierungsseite aufrufen: ${SITE_URL}/auth/register\n` +
      `2️⃣ Daten eingeben und E-Mail bestätigen.\n` +
      `3️⃣ Vervollständigen Sie Ihr Profil, um den Verifizierungsstatus zu erhalten und Auszahlungen freizuschalten.\n\n` +
      `💰 *Mindesteinzahlung zum Start:* 51 $\n` +
      `🌐 *Registrierung:* ${SITE_URL}/auth/register`,

    verify:
      `🔐 *Sicherheit & Telegram-Verifizierung auf XSPY Trader*\n\n` +
      `Zum Schutz Ihres Guthabens erfordert jede Auszahlung eine *doppelte 2FA-Bestätigung:*\n` +
      `1️⃣ Ein 6-stelliger Code per *E-Mail*.\n` +
      `2️⃣ Ein sofortiger 6-stelliger OTP-Code per *Telegram* über unseren Verifizierungs-Bot.\n\n` +
      `📋 *So verknüpfen Sie Ihr Telegram-Konto:*\n` +
      `1️⃣ Öffnen Sie den Bot: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `2️⃣ Drücken Sie *START* und kopieren Sie die angezeigte *Chat-ID*.\n` +
      `3️⃣ Gehen Sie zu Ihrem Profil: ${SITE_URL}/dashboard/profile\n` +
      `4️⃣ Fügen Sie die Chat-ID im Telegram-Feld ein und speichern Sie.\n\n` +
      `⚠️ *Sicherheitshinweis:* Geben Sie niemals Ihre OTP-Codes weiter!\n\n` +
      `🔗 *Verifizierungs-Bot:* https://t.me/XSpyTraderOtp_bot`,

    defaultSupport:
      `🤖 *Offizieller XSPY Trader AI-Support*\n\n` +
      `Willkommen! Ich helfe Ihnen bei allen Fragen zu:\n\n` +
      `💰 *Einzahlungen* | 💸 *Auszahlungen* | 📊 *Trading*\n` +
      `⛏️ *Mining-Pakete* | 🤝 *Partnerprogramm* | 🔐 *Sicherheit & 2FA*\n\n` +
      `💡 Stellen Sie Ihre Frage einfach hier in der Gruppe!\n` +
      `🌐 *Offizielle Website:* ${SITE_URL}`,
  },

  ru: {
    withdraw:
      `💸 *Как вывести средства на XSPY Trader*\n\n` +
      `*Минимум:* $21 | *Комиссия:* 10% | *Срок обработки:* в течение 24 часов\n` +
      `⚠️ *Лимит:* разрешён только 1 вывод в сутки.\n\n` +
      `📋 *Инструкция по выводу и настройке безопасности:*\n` +
      `1️⃣ *Заполните профиль:* Убедитесь, что ваш профиль полностью заполнен для получения верифицированного статуса.\n\n` +
      `2️⃣ *Активируйте бота верификации (ОБЯЗАТЕЛЬНО):*\n` +
      `Для получения 6-значных кодов подтверждения (OTP), необходимых для каждого вывода, подключите нашего официального бота:\n` +
      `👉 Откройте бота: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `👉 Нажмите *START* и скопируйте свой персональный *Chat ID*.\n` +
      `👉 Перейдите в профиль: ${SITE_URL}/dashboard/profile\n` +
      `👉 Вставьте Chat ID в поле Telegram и нажмите *Сохранить*.\n\n` +
      `3️⃣ *Добавьте кошелёк для вывода:* В разделе *Кошелёк › Управление кошельками* (новый кошелёк проходит 24-часовой период безопасности).\n\n` +
      `4️⃣ *Оформите вывод:* Перейдите в *Кошелёк › Вывод*, выберите кошелёк, введите сумму и подтвердите операцию кодами из Telegram и Email.\n\n` +
      `🔗 *Бот верификации:* https://t.me/XSpyTraderOtp_bot\n` +
      `🌐 *Страница вывода:* ${SITE_URL}/dashboard/withdraw`,

    deposit:
      `💰 *Как пополнить счёт на XSPY Trader*\n\n` +
      `*Минимальный депозит:* $51\n\n` +
      `📋 *Шаги пополнения:*\n` +
      `1️⃣ Перейдите в *Панель управления › Кошелёк › Депозит*\n` +
      `2️⃣ Выберите криптовалютную сеть (USDT TRC20, BTC, ETH и др.)\n` +
      `3️⃣ Скопируйте указанный адрес кошелька\n` +
      `4️⃣ Переведите точную сумму со своего личного криптокошелька\n` +
      `5️⃣ Загрузите скриншот успешного перевода и подтвердите заявку\n\n` +
      `⏱ *Время обработки:* 5–15 минут (ручная проверка администратором)\n\n` +
      `🌐 *Страница депозита:* ${SITE_URL}/dashboard/deposit`,

    trade:
      `📊 *Как устроен трейдинг на XSPY Trader*\n\n` +
      `⚠️ *Важно:* Пользователи не открывают сделки самостоятельно — сделки запускает администратор.\n\n` +
      `📋 *Механика:*\n` +
      `1️⃣ Администратор открывает *одну сделку в день* (с понедельника по пятницу) и анонсирует её в группе.\n` +
      `2️⃣ Вы переходите в раздел *Панель › Трейдинг* и присоединяетесь к активной сделке.\n` +
      `3️⃣ После завершения раунда прибыль автоматически зачисляется на ваш баланс.\n\n` +
      `📈 *Доходность по раундам:*\n` +
      `⏱ Сделка 30 сек: *2% прибыли*\n` +
      `⏱ Сделка 45 сек: *2.5% прибыли*\n` +
      `⏱ Сделка 60 сек: *3% прибыли*\n\n` +
      `💡 *Пример:* Вход на $100 в раунд 60 секунд = *$3 чистой прибыли*.\n\n` +
      `🌐 *Страница трейдинга:* ${SITE_URL}/dashboard/trading`,

    package:
      `⛏️ *Инвестиционные пакеты майнинга на XSPY Trader*\n\n` +
      `Получайте *ежедневный пассивный доход*, активировав пакет:\n\n` +
      `1️⃣ *Пакет Beginner:*\n` +
      `💵 Вложения: $51 – $100 | 📈 Доход: *1.8%/день* | ⏱ Срок: 15 дней\n\n` +
      `2️⃣ *Пакет Professional:*\n` +
      `💵 Вложения: $101 – $150 | 📈 Доход: *2.0%/день* | ⏱ Срок: 30 дней\n\n` +
      `3️⃣ *Пакет VIP:*\n` +
      `💵 Вложения: $151 – $200 | 📈 Доход: *2.5%/день* | ⏱ Срок: 45 дней\n\n` +
      `💡 *Пример:* Инвестиция $80 в Beginner даёт $1.44 в день × 15 дней = *$21.60 чистой прибыли*.\n` +
      `- Начисления поступают ежедневно на ваш баланс.\n\n` +
      `🌐 *Страница пакетов:* ${SITE_URL}/dashboard/packages`,

    referral:
      `🤝 *Партнёрская программа XSPY Trader*\n\n` +
      `Получайте высокие комиссионные с *3 уровней* вашей команды:\n\n` +
      `🥇 *Уровень 1 (прямые приглашения):* *10%*\n` +
      `🥈 *Уровень 2 (приглашённые 1-го уровня):* *7%*\n` +
      `🥉 *Уровень 3 (3-я линия):* *2%*\n\n` +
      `💰 *Вы получаете процент со всех операций команды:*\n` +
      `🎁 Пополнения баланса\n` +
      `📈 Доход с трейдинга\n` +
      `📦 Начисления с пакетов майнинга\n\n` +
      `🔗 *Ваша реферальная ссылка:* ${SITE_URL}/dashboard/referrals`,

    register:
      `📝 *Регистрация аккаунта на XSPY Trader*\n\n` +
      `1️⃣ Перейдите на страницу регистрации: ${SITE_URL}/auth/register\n` +
      `2️⃣ Заполните данные и подтвердите email.\n` +
      `3️⃣ Заполните данные профиля, чтобы активировать аккаунт и открыть возможность вывода средств.\n\n` +
      `💰 *Минимум для старта:* депозит от $51\n` +
      `🌐 *Регистрация:* ${SITE_URL}/auth/register`,

    verify:
      `🔐 *Безопасность и привязка Telegram на XSPY Trader*\n\n` +
      `Для защиты ваших средств любой вывод требует *двойной верификации (2FA):*\n` +
      `1️⃣ 6-значный код подтверждения на ваш *Email*.\n` +
      `2️⃣ Мгновенный 6-значный OTP-код в *Telegram* через нашего бота верификации.\n\n` +
      `📋 *Как привязать Telegram:*\n` +
      `1️⃣ Откройте бота: [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
      `2️⃣ Нажмите *START* и скопируйте полученный *Chat ID*.\n` +
      `3️⃣ Перейдите в профиль: ${SITE_URL}/dashboard/profile\n` +
      `4️⃣ Вставьте Chat ID в поле Telegram и нажмите *Сохранить*.\n\n` +
      `⚠️ *Безопасность:* Никогда и никому не сообщайте свои OTP-коды!\n\n` +
      `🔗 *Бот верификации:* https://t.me/XSpyTraderOtp_bot`,

    defaultSupport:
      `🤖 *Официальная поддержка XSPY Trader*\n\n` +
      `Приветствую! Я отвечу на любые вопросы по следующим темам:\n\n` +
      `💰 *Депозиты* | 💸 *Вывод средств* | 📊 *Трейдинг*\n` +
      `⛏️ *Пакеты майнинга* | 🤝 *Партнёрка* | 🔐 *Безопасность и 2FA*\n\n` +
      `💡 Задайте ваш вопрос прямо сейчас!\n` +
      `🌐 *Официальный сайт:* ${SITE_URL}`,
  },
};

// ─── Keyword Fallback Answers ─────────────────────────────────────────────────
function getKeywordFallback(
  userMessage: string,
  lang: SupportedLang = "en"
): BotResponse {
  const lower = userMessage.toLowerCase();
  const c = FALLBACK_CONTENT[lang] || FALLBACK_CONTENT.en;

  // 1. Withdrawal (Highest priority & includes OTP Bot link)
  if (
    lower.includes("withdraw") ||
    lower.includes("سحب") ||
    lower.includes("السحب") ||
    lower.includes("اسحب") ||
    lower.includes("طريق السحب") ||
    lower.includes("retrait") ||
    lower.includes("retirer") ||
    lower.includes("auszahlung") ||
    lower.includes("auszahlen") ||
    lower.includes("abheben") ||
    lower.includes("вывод") ||
    lower.includes("вывести")
  ) {
    return {
      text: c.withdraw,
      replyMarkup: buildWithdrawalInlineKeyboard(lang),
    };
  }

  // 2. Deposit
  if (
    lower.includes("deposit") ||
    lower.includes("إيداع") ||
    lower.includes("ايداع") ||
    lower.includes("شحن") ||
    lower.includes("fund") ||
    lower.includes("dépôt") ||
    lower.includes("depot") ||
    lower.includes("déposer") ||
    lower.includes("deposer") ||
    lower.includes("einzahlung") ||
    lower.includes("einzahlen") ||
    lower.includes("депозит") ||
    lower.includes("пополнить")
  ) {
    return {
      text: c.deposit,
      replyMarkup: buildDepositInlineKeyboard(lang),
    };
  }

  // 3. Trading
  if (
    lower.includes("trade") ||
    lower.includes("trading") ||
    lower.includes("تداول") ||
    lower.includes("التداول") ||
    lower.includes("صفقة") ||
    lower.includes("صفقات") ||
    lower.includes("trader") ||
    lower.includes("handeln") ||
    lower.includes("handel") ||
    lower.includes("трейдинг") ||
    lower.includes("торговля")
  ) {
    return {
      text: c.trade,
      replyMarkup: buildTradingInlineKeyboard(lang),
    };
  }

  // 4. Mining Packages
  if (
    lower.includes("package") ||
    lower.includes("mining") ||
    lower.includes("باقة") ||
    lower.includes("باقات") ||
    lower.includes("تعدين") ||
    lower.includes("استثمار") ||
    lower.includes("forfait") ||
    lower.includes("pack") ||
    lower.includes("paket") ||
    lower.includes("пакет") ||
    lower.includes("майнинг")
  ) {
    return {
      text: c.package,
      replyMarkup: buildPackagesInlineKeyboard(lang),
    };
  }

  // 5. Referrals
  if (
    lower.includes("referral") ||
    lower.includes("refer") ||
    lower.includes("invite") ||
    lower.includes("إحالة") ||
    lower.includes("احالة") ||
    lower.includes("احالات") ||
    lower.includes("فريق") ||
    lower.includes("عمولة") ||
    lower.includes("parrainage") ||
    lower.includes("parrain") ||
    lower.includes("empfehlung") ||
    lower.includes("реферал") ||
    lower.includes("партнерка")
  ) {
    return {
      text: c.referral,
      replyMarkup: buildReferralsInlineKeyboard(lang),
    };
  }

  // 6. Registration & Account
  if (
    lower.includes("register") ||
    lower.includes("sign up") ||
    lower.includes("signup") ||
    lower.includes("تسجيل") ||
    lower.includes("حساب جديد") ||
    lower.includes("انشاء حساب") ||
    lower.includes("inscription") ||
    lower.includes("registrierung") ||
    lower.includes("регистрация")
  ) {
    return {
      text: c.register,
      replyMarkup: buildRegisterInlineKeyboard(lang),
    };
  }

  // 7. Security / 2FA / OTP Verification Bot
  if (
    lower.includes("2fa") ||
    lower.includes("otp") ||
    lower.includes("verify") ||
    lower.includes("security") ||
    lower.includes("أمان") ||
    lower.includes("امان") ||
    lower.includes("توثيق") ||
    lower.includes("تحقق") ||
    lower.includes("ربط تيليجرام") ||
    lower.includes("sécurité") ||
    lower.includes("securite") ||
    lower.includes("sicherheit") ||
    lower.includes("верификация") ||
    lower.includes("безопасность")
  ) {
    return {
      text: c.verify,
      replyMarkup: buildVerificationInlineKeyboard(lang),
    };
  }

  // Default support overview
  return {
    text: c.defaultSupport,
  };
}

// ─── AI Answer via Gemini ─────────────────────────────────────────────────────
async function getAIAnswer(
  userMessage: string,
  userName: string,
  userId: number,
  lang: SupportedLang = "en"
): Promise<BotResponse> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "NOT SET") {
    return getKeywordFallback(userMessage, lang);
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

  const langNames: Record<SupportedLang, string> = {
    ar: "Arabic (العربية)",
    en: "English",
    fr: "French (Français)",
    de: "German (Deutsch)",
    ru: "Russian (Русский)",
  };

  const prompt =
    `${PLATFORM_KNOWLEDGE}\n\n---\n\n` +
    `## CONVERSATION CONTEXT\n` +
    `You are talking to a user named "${userName}" in the official XSPY Trader Telegram group.\n` +
    `User Database Info:\n${userInfoStr}\n\n` +
    `User Message:\n"${userMessage}"\n\n` +
    `## MANDATORY INSTRUCTIONS\n` +
    `- Reply as the XSPY Trader official support assistant\n` +
    `- TARGET LANGUAGE: ${langNames[lang] || "English"}. You MUST write your entire response strictly in ${langNames[lang] || "English"}!\n` +
    `- If the user asks about WITHDRAWALS (سحب / retrait / auszahlung / etc.), you MUST explicitly provide the link to our verification bot: [${OTP_BOT_USERNAME}](https://t.me/XSpyTraderOtp_bot) and explain that they must activate it to receive their 6-digit withdrawal OTP codes.\n` +
    `- Be concise (max 220 words)\n` +
    `- Use appropriate emojis for a professional look\n` +
    `- Format with Telegram Markdown (bold with *text*, bullets with -)\n` +
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
      console.warn("[GroupBot] Gemini API returned error, falling back to dictionary:", data);
      return getKeywordFallback(userMessage, lang);
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) {
      console.warn("[GroupBot] Gemini returned empty response, falling back to dictionary");
      return getKeywordFallback(userMessage, lang);
    }

    const isWithdrawal = isWithdrawalQuery(userMessage) || isWithdrawalQuery(answer);
    return {
      text: answer.trim(),
      ...(isWithdrawal ? { replyMarkup: buildWithdrawalInlineKeyboard(lang) } : {}),
    };
  } catch (err) {
    console.warn("[GroupBot] Gemini fetch error, using dictionary fallback:", err);
    return getKeywordFallback(userMessage, lang);
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

  // Question words in all supported languages
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
    "اين",
    "لماذا",
    "هل",
    "ما هو",
    "ماهو",
    "طريقة",
    "طريق",
    "كيفية",
    "شرح",
    "ممكن",
    "بدي",
    "اريد",
    "أريد",
    // French
    "comment",
    "quand",
    "où",
    "pourquoi",
    "est-ce",
    "que",
    "quel",
    "quelle",
    "combien",
    "peux",
    // German
    "wie",
    "was",
    "wann",
    "wo",
    "warum",
    "kann",
    "ist",
    "wieviel",
    // Russian
    "как",
    "что",
    "когда",
    "где",
    "почему",
    "сколько",
    "можно",
  ];

  const keywords = [
    // English
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
    "wallet",
    // Arabic
    "إيداع",
    "ايداع",
    "شحن",
    "سحب",
    "السحب",
    "اسحب",
    "طريق",
    "تداول",
    "التداول",
    "صفقة",
    "باقة",
    "باقات",
    "إحالة",
    "احالة",
    "فريق",
    "ارباح",
    "أرباح",
    "توثيق",
    "تحقق",
    "محفظة",
    "كود",
    // French
    "dépôt",
    "depot",
    "retrait",
    "retirer",
    "trading",
    "forfait",
    "pack",
    "parrainage",
    "sécurité",
    "securite",
    "portefeuille",
    // German
    "einzahlung",
    "auszahlung",
    "auszahlen",
    "handeln",
    "paket",
    "empfehlung",
    "sicherheit",
    "brieftasche",
    // Russian
    "депозит",
    "вывод",
    "вывести",
    "трейдинг",
    "пакет",
    "реферал",
    "безопасность",
    "верификация",
    "кошелек",
  ];

  if (questionStarters.some((w) => lower.startsWith(w))) return true;
  if (lower.includes("?") || lower.includes("؟")) return true;
  if (keywords.some((k) => lower.includes(k))) return true;

  return false;
}

// ─── Build Welcome Message ────────────────────────────────────────────────────
function buildWelcomeMessage(memberName: string, lang: SupportedLang = "en"): string {
  if (lang === "ar") {
    return (
      `🎉 *مرحباً بك في المجموعة الرسمية لمنصة XSPY Trader، ${memberName}!* 🚀\n\n` +
      `يسعدنا انضمامك إلى مجتمعنا الاستثماري. تقدم منصة XSPY Trader:\n\n` +
      `📊 *تداول الخيارات الثنائية* — صفقات يومية تفتحها الإدارة (الاثنين–الجمعة) بربح 2%–3% لكل جولة\n` +
      `⛏️ *باقات التعدين* — عائد يومي تلقائي يصل إلى 2.5% يومياً\n` +
      `🤝 *برنامج الإحالات (3 مستويات)* — عمولات 10%، 7%، و2% من نشاط وأرباح فريقك\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔐 *خطوة هامة جداً — تفعيل السحب وأمان الحساب:*\n\n` +
      `لتتمكن من سحب أرباحك واستلام أكواد التحقق (OTP)، يجب تفعيل بوت التحقق الرسمي وربطه بملفك الشخصي:\n\n` +
      `1️⃣ افتح [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot) واضغط *START*\n` +
      `2️⃣ انسخ رقم التعريف الشخصي الخاص بك (*Chat ID*)\n` +
      `3️⃣ توجه إلى ملفك الشخصي بالمنصة والصق الرقم في خانة تيليجرام ثم احفظ\n\n` +
      `✅ بمجرد الربط، ستتلقى رمز OTP فوري لكل عملية سحب للحفاظ على أمان أموالك بالكامل.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *اسألني أي شيء!* اكتب سؤالك هنا في المجموعة وسأجيبك على مدار 24 ساعة.\n\n` +
      `🌐 *المنصة:* ${SITE_URL}`
    );
  }

  if (lang === "fr") {
    return (
      `🎉 *Bienvenue dans le groupe officiel XSPY Trader, ${memberName} !* 🚀\n\n` +
      `Nous sommes ravis de vous accueillir. XSPY Trader vous propose :\n\n` +
      `📊 *Trading d'Options Binaires* — Sessions gérées par l'admin avec 2% à 3% de profit par tour\n` +
      `⛏️ *Packs de Minage* — Revenus passifs quotidiens jusqu'à 2,5 % par jour\n` +
      `🤝 *Programme de Parrainage (3 niveaux)* — 10 %, 7 % et 2 % de commissions sur votre équipe\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔐 *IMPORTANT — Activez vos retraits et la sécurité :*\n\n` +
      `Pour débloquer vos retraits et recevoir votre code secret OTP à 6 chiffres, liez votre Telegram :\n\n` +
      `1️⃣ Ouvrez [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot) et cliquez sur *START*\n` +
      `2️⃣ Copiez votre identifiant personnel (*Chat ID*)\n` +
      `3️⃣ Rendez-vous sur votre *Profil* et collez l'identifiant dans le champ Telegram\n\n` +
      `✅ Une fois lié, vous recevrez un code OTP instantané pour chaque retrait afin de sécuriser vos fonds.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *Posez votre question à tout moment dans le groupe !*\n\n` +
      `🌐 *Plateforme :* ${SITE_URL}`
    );
  }

  if (lang === "de") {
    return (
      `🎉 *Willkommen in der offiziellen XSPY Trader Gruppe, ${memberName}!* 🚀\n\n` +
      `Wir freuen uns, Sie bei uns zu haben. XSPY Trader bietet Ihnen:\n\n` +
      `📊 *Binäre Optionen Trading* — Tägliche Admin-Trades mit 2–3 % Gewinn pro Runde\n` +
      `⛏️ *Mining-Pakete* — Bis zu 2,5 % tägliches passives Einkommen\n` +
      `🤝 *3-Stufen-Partnerprogramm* — 10 %, 7 % und 2 % Provisionen auf Teamaktivitäten\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔐 *WICHTIG — Auszahlungen & Sicherheit freischalten:*\n\n` +
      `Um Auszahlungen zu ermöglichen und Ihre OTP-Sicherheitscodes zu erhalten, verknüpfen Sie Ihr Telegram:\n\n` +
      `1️⃣ Öffnen Sie [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot) und drücken Sie *START*\n` +
      `2️⃣ Kopieren Sie Ihre persönliche *Chat-ID*\n` +
      `3️⃣ Fügen Sie die ID in Ihrem *Profil* im Telegram-Feld ein und speichern Sie\n\n` +
      `✅ Nach der Verknüpfung erhalten Sie für jede Auszahlung sofort einen sicheren OTP-Code.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *Fragen Sie mich alles!* Schreiben Sie Ihre Frage hier in die Gruppe — 24/7 erreichbar.\n\n` +
      `🌐 *Plattform:* ${SITE_URL}`
    );
  }

  if (lang === "ru") {
    return (
      `🎉 *Добро пожаловать в официальную группу XSPY Trader, ${memberName}!* 🚀\n\n` +
      `Мы рады приветствовать вас в нашем инвестиционном сообществе. XSPY Trader предлагает:\n\n` +
      `📊 *Трейдинг бинарными опционами* — ежедневные раунды от админа с доходностью 2–3% за сделку\n` +
      `⛏️ *Пакеты майнинга* — пассивный доход до 2.5% в день\n` +
      `🤝 *3-уровневая партнёрская программа* — 10%, 7% и 2% комиссионных со всей команды\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔐 *ВАЖНО — Активация вывода средств и безопасность:*\n\n` +
      `Чтобы включить вывод средств и получать OTP-коды подтверждения, привяжите ваш Telegram:\n\n` +
      `1️⃣ Откройте [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot) и нажмите *START*\n` +
      `2️⃣ Скопируйте ваш персональный *Chat ID*\n` +
      `3️⃣ Вставьте Chat ID в настройках вашего *Профиля* на платформе и сохраните\n\n` +
      `✅ После привязки вы будете мгновенно получать код безопасности при каждом выводе.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *Задавайте любые вопросы в группе — бот отвечает круглосуточно!*\n\n` +
      `🌐 *Платформа:* ${SITE_URL}`
    );
  }

  // Default English
  return (
    `🎉 *Welcome to the Official XSPY Trader Group, ${memberName}!* 🚀\n\n` +
    `We're glad to have you here. XSPY Trader is a professional digital investment platform offering:\n\n` +
    `📊 *Binary Options Trading* — Join admin-opened trades (Mon–Fri) and earn 2–3% per round\n` +
    `⛏️ *Mining Packages* — Earn daily passive income of up to 2.5%/day\n` +
    `🤝 *3-Level Referral Program* — Earn 10%, 7%, and 2% from your team's activities\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔐 *IMPORTANT — Verify Your Account for Withdrawals:*\n\n` +
    `To enable withdrawals and receive your security OTP codes, you *must* link your Telegram to your profile:\n\n` +
    `1️⃣ Open [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot) and press *START*\n` +
    `2️⃣ Copy the *Chat ID* it provides\n` +
    `3️⃣ Go to your *Profile* on the platform and paste the Chat ID in the Telegram field\n\n` +
    `✅ Once linked, you'll receive instant OTP codes for every withdrawal — keeping your funds fully secure.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Ask me anything!* Just type your question here in the group — I'm available 24/7.\n\n` +
    `🌐 *Platform:* ${SITE_URL}`
  );
}

function buildWelcomeInlineKeyboard(lang: SupportedLang = "en") {
  const labels: Record<
    SupportedLang,
    { open: string; verify: string; profile: string }
  > = {
    ar: {
      open: "🚀 فتح المنصة",
      verify: "🔐 تفعيل بوت التحقق",
      profile: "👤 الملف الشخصي",
    },
    en: {
      open: "🚀 Open Platform",
      verify: "🔐 Verify Bot",
      profile: "👤 My Profile",
    },
    fr: {
      open: "🚀 Visiter la Plateforme",
      verify: "🔐 Activer le Bot",
      profile: "👤 Mon Profil",
    },
    de: {
      open: "🚀 Plattform öffnen",
      verify: "🔐 Bot verifizieren",
      profile: "👤 Mein Profil",
    },
    ru: {
      open: "🚀 Открыть платформу",
      verify: "🔐 Бот верификации",
      profile: "👤 Мой профиль",
    },
  };
  const l = labels[lang] || labels.en;
  return {
    inline_keyboard: [
      [
        { text: l.open, url: SITE_URL },
        { text: l.verify, url: "https://t.me/XSpyTraderOtp_bot" },
      ],
      [{ text: l.profile, url: `${SITE_URL}/dashboard/profile` }],
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
      await callTelegram("answerCallbackQuery", { callback_query_id: cb.id });
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const chatType = message.chat.type; // "group" | "supergroup" | "private"
    const userId = message.from?.id;
    const userName = message.from?.first_name || "Member";
    const userLang = message.from?.language_code;
    const messageId = message.message_id;

    // ── 0. NEW MEMBER WELCOME ──────────────────────────────────────────────────
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;

        const memberLang = detectLanguage("", member.language_code);
        await sendMessage(
          chatId,
          buildWelcomeMessage(member.first_name, memberLang),
          {
            replyMarkup: buildWelcomeInlineKeyboard(memberLang),
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── Member left (clean acknowledgement, optional) ──────────────────────────
    if (message.left_chat_member) {
      return NextResponse.json({ ok: true });
    }

    const text = message.text || message.caption || "";
    if (!text || !userId) return NextResponse.json({ ok: true });

    const detectedLang = detectLanguage(text, userLang);

    // ── 1. SPAM MODERATION: Detect external links in groups ───────────────────
    if (
      (chatType === "group" || chatType === "supergroup") &&
      containsExternalLink(text)
    ) {
      await deleteMessage(chatId, messageId);
      await muteUser(chatId, userId);
      const siteBanned = await banUserOnSite(userId);

      const warningText =
        detectedLang === "ar"
          ? `⚠️ *مخالفة لسياسة المجموعة*\n\n` +
            `تم كتم العضو @${message.from?.username || userName} لمدة *24 ساعة* بسبب نشر رابط خارجي.\n\n` +
            `${siteBanned ? "🔒 تم أيضاً تعليق حسابه على المنصة مؤقتاً.\n\n" : ""}` +
            `_يُسمح فقط بنشر الروابط التابعة لمنصة XSPY Trader._`
          : `⚠️ *Group Policy Violation*\n\n` +
            `@${message.from?.username || userName} has been muted for *24 hours* for posting an external link.\n\n` +
            `${siteBanned ? "🔒 Their platform account has also been temporarily suspended.\n\n" : ""}` +
            `_Only links related to XSPY Trader are permitted in this group._`;

      await sendMessage(chatId, warningText);

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
        const welcomeTexts: Record<SupportedLang, string> = {
          ar:
            `👋 *مرحباً بك في المساعد الذكي الرسمي لمنصة XSPY Trader، ${userName}!* 🚀\n\n` +
            `أنا المساعد الرسمي المتاح 24/7 لخدمتك والإجابة على كافة أسئلتك:\n\n` +
            `📥 *الإيداع* — طريقة شحن حسابك بالعملات الرقمية\n` +
            `📤 *السحب* — خطوات سحب الأرباح وربط بوت التحقق\n` +
            `📈 *التداول* — كيفية الانضمام لصفقات الإدارة اليومية\n` +
            `⛏️ *باقات التعدين* — تفاصيل الباقات الاستثمارية ذات العائد اليومي\n` +
            `👥 *الإحالات* — نظام العمولات على 3 مستويات\n` +
            `🔐 *الأمان والتحقق* — حماية حسابك عبر [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
            `👤 *الملف الشخصي* — توثيق الحساب وإعدادات المحفظة\n\n` +
            `💡 اطرح سؤالك مباشرةً وسأجيبك فوراً!\n\n` +
            `🌐 *المنصة:* ${SITE_URL}`,

          fr:
            `👋 *Bienvenue sur l'assistance officielle XSPY Trader, ${userName} !* 🚀\n\n` +
            `Je suis votre assistant IA disponible 24h/24 et 7j/7. Voici comment je peux vous aider :\n\n` +
            `📥 *Dépôts* — Comment recharger votre compte\n` +
            `📤 *Retraits* — Démarches et activation du bot de vérification\n` +
            `📈 *Trading* — Participer aux sessions quotidiennes\n` +
            `⛏️ *Packs d'investissement* — Revenus passifs quotidiens\n` +
            `👥 *Parrainage* — Commissions sur 3 niveaux\n` +
            `🔐 *Sécurité (2FA)* — Protection via [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
            `👤 *Profil & Compte* — Finaliser votre vérification\n\n` +
            `💡 Posez votre question et je vous répondrai instantanément !\n\n` +
            `🌐 *Plateforme :* ${SITE_URL}`,

          de:
            `👋 *Willkommen beim offiziellen XSPY Trader Support, ${userName}!* 🚀\n\n` +
            `Ich bin Ihr 24/7 KI-Assistent. Hierbei kann ich Ihnen helfen:\n\n` +
            `📥 *Einzahlungen* — Guthaben aufladen\n` +
            `📤 *Auszahlungen* — Ablauf & Verifizierungs-Bot\n` +
            `📈 *Trading* — Teilnahme an täglichen Admin-Trades\n` +
            `⛏️ *Mining-Pakete* — Tägliche passive Erträge\n` +
            `👥 *Partnerprogramm* — Provisionen auf 3 Ebenen\n` +
            `🔐 *Sicherheit & 2FA* — Schutz über [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
            `👤 *Profil & Konto* — Verifizierung & Einstellungen\n\n` +
            `💡 Stellen Sie einfach Ihre Frage, ich antworte sofort!\n\n` +
            `🌐 *Plattform:* ${SITE_URL}`,

          ru:
            `👋 *Добро пожаловать в официальную поддержку XSPY Trader, ${userName}!* 🚀\n\n` +
            `Я ваш персональный ассистент, доступный 24/7. Чем я могу помочь:\n\n` +
            `📥 *Депозиты* — Пополнение баланса\n` +
            `📤 *Вывод средств* — Инструкция и привязка бота верификации\n` +
            `📈 *Трейдинг* — Участие в ежедневных торговых раундах\n` +
            `⛏️ *Пакеты майнинга* — Ежедневный пассивный доход\n` +
            `👥 *Рефералы* — Трёхуровневая партнёрская программа\n` +
            `🔐 *Безопасность (2FA)* — Защита через [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
            `👤 *Профиль и аккаунт* — Верификация и настройки\n\n` +
            `💡 Просто напишите свой вопрос, и я отвечу сразу!\n\n` +
            `🌐 *Платформа:* ${SITE_URL}`,

          en:
            `👋 *Welcome to XSPY Trader AI Support, ${userName}!* 🚀\n\n` +
            `I'm the official 24/7 support assistant for *XSPY Trader*. Here's what I can help you with:\n\n` +
            `📥 *Deposits* — How to fund your account\n` +
            `📤 *Withdrawals* — How to withdraw your earnings\n` +
            `📈 *Trading* — How binary options trading works\n` +
            `⛏️ *Mining Packages* — Daily ROI investment packages\n` +
            `👥 *Referrals* — Earn commissions by inviting friends\n` +
            `🔐 *Security & 2FA* — Keep your account safe with [@XSpyTraderOtp_bot](https://t.me/XSpyTraderOtp_bot)\n` +
            `👤 *Account & Profile* — Registration, KYC, and profile setup\n\n` +
            `Just type your question and I'll answer immediately! 💡\n\n` +
            `🌐 *Platform:* ${SITE_URL}`,
        };

        await sendMessage(chatId, welcomeTexts[detectedLang] || welcomeTexts.en, {
          replyMarkup: buildWelcomeInlineKeyboard(detectedLang),
        });
        return NextResponse.json({ ok: true });
      }

      if (text.trim() === "/help") {
        const helpTexts: Record<SupportedLang, string> = {
          ar:
            `🆘 *الأوامر المتاحة والمساعدة*\n\n` +
            `/start — رسالة الترحيب ونظرة عامة\n` +
            `/help — عرض قائمة المساعدة هذه\n\n` +
            `أو ببساطة اطرح سؤالك بأي لغة!\n\n` +
            `أمثلة:\n` +
            `• "كيف يتم السحب؟"\n` +
            `• "طريقة شحن الرصيد"\n` +
            `• "ما هي أرباح التداول؟"\n` +
            `• "كيف أفعل بوت التحقق؟"`,

          fr:
            `🆘 *Commandes disponibles et aide*\n\n` +
            `/start — Message de bienvenue et aperçu\n` +
            `/help — Afficher ce menu d'aide\n\n` +
            `Ou posez directement votre question dans votre langue !\n\n` +
            `Exemples :\n` +
            `• "Comment faire un retrait ?"\n` +
            `• "Comment fonctionne le trading ?"\n` +
            `• "Activer le bot de vérification"`,

          de:
            `🆘 *Verfügbare Befehle & Hilfe*\n\n` +
            `/start — Willkommensnachricht & Übersicht\n` +
            `/help — Dieses Hilfemenü anzeigen\n\n` +
            `Oder stellen Sie einfach Ihre Frage in Ihrer Sprache!\n\n` +
            `Beispiele:\n` +
            `• "Wie kann ich auszahlen?"\n` +
            `• "Wie funktioniert das Trading?"\n` +
            `• "Verifizierungs-Bot einrichten"`,

          ru:
            `🆘 *Доступные команды и помощь*\n\n` +
            `/start — Приветственное сообщение и обзор\n` +
            `/help — Меню помощи\n\n` +
            `Или просто задайте вопрос своими словами!\n\n` +
            `Примеры:\n` +
            `• "Как вывести деньги?"\n` +
            `• "Как пополнить баланс?"\n` +
            `• "Как работает трейдинг?"`,

          en:
            `🆘 *Available Commands*\n\n` +
            `/start — Welcome message & overview\n` +
            `/help — Show this help menu\n\n` +
            `Or simply ask me any question in plain language!\n\n` +
            `Examples:\n` +
            `• "How do I withdraw?"\n` +
            `• "How to deposit crypto?"\n` +
            `• "How does trading work?"\n` +
            `• "How to link verification bot?"`,
        };

        await sendMessage(chatId, helpTexts[detectedLang] || helpTexts.en);
        return NextResponse.json({ ok: true });
      }

      // Rate limit check
      if (isRateLimited(userId)) {
        const rateLimitTexts: Record<SupportedLang, string> = {
          ar: `⏳ يرجى الانتظار لحظات قبل إرسال رسالة أخرى.`,
          en: `⏳ Please wait a moment before sending another message.`,
          fr: `⏳ Veuillez patienter un instant avant d'envoyer un autre message.`,
          de: `⏳ Bitte warten Sie einen Moment, bevor Sie eine weitere Nachricht senden.`,
          ru: `⏳ Пожалуйста, подождите немного перед отправкой следующего сообщения.`,
        };
        await sendMessage(
          chatId,
          rateLimitTexts[detectedLang] || rateLimitTexts.en
        );
        return NextResponse.json({ ok: true });
      }

      const response = await getAIAnswer(text, userName, userId, detectedLang);
      await sendMessage(chatId, response.text, {
        replyMarkup: response.replyMarkup,
      });
      return NextResponse.json({ ok: true });
    }

    // ── 3. GROUP MESSAGES: Respond to questions & mentions ────────────────────
    if (chatType === "group" || chatType === "supergroup") {
      if (!isQuestionForBot(text)) return NextResponse.json({ ok: true });

      // Rate limit per user in groups
      if (isRateLimited(userId)) {
        return NextResponse.json({ ok: true });
      }

      // Strip bot mention from question text
      const cleanText = text
        .replace(/@xspy_ai_bot/gi, "")
        .replace(/@xspyaibot/gi, "")
        .replace(/@xspybot/gi, "")
        .trim();

      const response = await getAIAnswer(
        cleanText || text,
        userName,
        userId,
        detectedLang
      );
      await sendMessage(chatId, response.text, {
        replyToMessageId: messageId,
        replyMarkup: response.replyMarkup,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[GroupBot Webhook Error]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

