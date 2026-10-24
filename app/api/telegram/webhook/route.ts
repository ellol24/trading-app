import { NextRequest, NextResponse } from "next/server";
import { getOtpBotToken } from "@/lib/telegram-tokens";

const SITE_URL = "https://www.xspy-trader.com";

// ─── Supported Languages ──────────────────────────────────────────────────────
type SupportedLang = "ar" | "en" | "fr" | "de" | "ru";

// ─── Translation Dictionary ───────────────────────────────────────────────────
const MESSAGES: Record<
  SupportedLang,
  {
    title: string;
    hello: (name: string) => string;
    chatIdLabel: string;
    chatIdNote: string;
    stepsTitle: string;
    step1: string;
    step2: string;
    step3: string;
    securityNote: string;
    footer: string;
    openProfile: string;
    visitSite: string;
    joinGroup: string;
    alreadyAnswered: string;
  }
> = {
  ar: {
    title: "🛡️ *بوت التحقق الأمني — XSPY Trader*",
    hello: (name) =>
      `مرحباً *${name}*! لقد اكتشف البوت رقم التعريف الخاص بحسابك على تيليجرام بنجاح.\nستستخدم هذا الرقم لربط حسابك بمنصة XSPY Trader وتفعيل التحقق بخطوتين.`,
    chatIdLabel: "🔑 *رقم التعريف الخاص بك (Chat ID):*",
    chatIdNote: "اضغط على الرقم أعلاه لنسخه تلقائياً",
    stepsTitle: "📋 *كيفية ربط حسابك:*",
    step1: "١. اضغط على رقم الـ Chat ID أعلاه لنسخه.",
    step2: "٢. توجه إلى *الملف الشخصي* في منصة XSPY Trader.",
    step3: "٣. الصق الرقم في خانة *Telegram Chat ID* ثم اضغط *حفظ*.",
    securityNote:
      "🔒 *ملاحظة أمنية:* لا تشارك هذا الرقم مع أي شخص آخر.",
    footer:
      "✅ بعد الربط الناجح، ستتلقى رمز تأكيد السحب (OTP) مباشرةً هنا في كل مرة تطلب فيها سحب أموال — لضمان أقصى حماية لحسابك.",
    openProfile: "👤 فتح الملف الشخصي",
    visitSite: "🌐 زيارة المنصة",
    joinGroup: "💬 انضم للمجموعة الرسمية",
    alreadyAnswered: "لقد أرسلنا إليك رقم Chat ID الخاص بك. يمكنك نسخه من الرسالة السابقة.",
  },
  en: {
    title: "🛡️ *XSPY Trader — Account Verification Bot*",
    hello: (name) =>
      `Hello *${name}*! Your Telegram Chat ID has been detected successfully.\nYou'll use this ID to link your Telegram account to XSPY Trader and enable two-factor authentication (2FA).`,
    chatIdLabel: "🔑 *Your Personal Chat ID:*",
    chatIdNote: "Tap the number above to copy it automatically",
    stepsTitle: "📋 *How to link your account:*",
    step1: "1. Tap your Chat ID above to copy it.",
    step2: "2. Open your *XSPY Trader Profile* settings.",
    step3: "3. Paste your Chat ID into the *Telegram Chat ID* field and click *Save*.",
    securityNote:
      "🔒 *Security note:* Never share this ID with anyone else.",
    footer:
      "✅ Once linked, you'll receive an instant 6-digit OTP code here every time you request a withdrawal — ensuring maximum security for your funds.",
    openProfile: "👤 Open Profile Settings",
    visitSite: "🌐 Visit Platform",
    joinGroup: "💬 Join Official Group",
    alreadyAnswered:
      "Your Chat ID was already sent. You can find it in the previous message above.",
  },
  fr: {
    title: "🛡️ *XSPY Trader — Bot de Vérification*",
    hello: (name) =>
      `Bonjour *${name}* ! Votre Chat ID Telegram a été détecté avec succès.\nVous utiliserez cet identifiant pour relier votre compte Telegram à XSPY Trader et activer l'authentification à deux facteurs (2FA).`,
    chatIdLabel: "🔑 *Votre identifiant de chat personnel (Chat ID) :*",
    chatIdNote: "Appuyez sur le numéro ci-dessus pour le copier automatiquement",
    stepsTitle: "📋 *Comment associer votre compte :*",
    step1: "1. Appuyez sur votre Chat ID ci-dessus pour le copier.",
    step2: "2. Ouvrez les paramètres de votre *Profil XSPY Trader*.",
    step3: "3. Collez votre identifiant dans le champ *Telegram Chat ID* et cliquez *Enregistrer*.",
    securityNote:
      "🔒 *Note de sécurité :* Ne partagez jamais cet identifiant avec qui que ce soit.",
    footer:
      "✅ Une fois lié, vous recevrez un code OTP à 6 chiffres ici instantanément à chaque demande de retrait — pour une sécurité maximale.",
    openProfile: "👤 Paramètres du profil",
    visitSite: "🌐 Visiter la plateforme",
    joinGroup: "💬 Rejoindre le groupe officiel",
    alreadyAnswered:
      "Votre Chat ID a déjà été envoyé. Retrouvez-le dans le message précédent.",
  },
  de: {
    title: "🛡️ *XSPY Trader — Verifizierungs-Bot*",
    hello: (name) =>
      `Hallo *${name}*! Ihre Telegram Chat-ID wurde erfolgreich erkannt.\nSie verwenden diese ID, um Ihr Telegram-Konto mit XSPY Trader zu verknüpfen und die Zwei-Faktor-Authentifizierung (2FA) zu aktivieren.`,
    chatIdLabel: "🔑 *Ihre persönliche Chat-ID:*",
    chatIdNote: "Tippen Sie auf die Nummer oben, um sie zu kopieren",
    stepsTitle: "📋 *So verknüpfen Sie Ihr Konto:*",
    step1: "1. Tippen Sie auf Ihre Chat-ID oben, um sie zu kopieren.",
    step2: "2. Öffnen Sie Ihre *XSPY Trader Profil-Einstellungen*.",
    step3: "3. Fügen Sie Ihre Chat-ID in das Feld *Telegram Chat ID* ein und klicken Sie *Speichern*.",
    securityNote:
      "🔒 *Sicherheitshinweis:* Teilen Sie diese ID niemals mit anderen Personen.",
    footer:
      "✅ Nach der Verknüpfung erhalten Sie bei jeder Auszahlungsanforderung sofort einen 6-stelligen OTP-Code — für maximale Kontosicherheit.",
    openProfile: "👤 Profil-Einstellungen",
    visitSite: "🌐 Plattform besuchen",
    joinGroup: "💬 Offizielle Gruppe beitreten",
    alreadyAnswered:
      "Ihre Chat-ID wurde bereits gesendet. Sie finden sie in der vorherigen Nachricht.",
  },
  ru: {
    title: "🛡️ *XSPY Trader — Бот Верификации*",
    hello: (name) =>
      `Здравствуйте, *${name}*! Ваш Telegram Chat ID успешно определён.\nВы используете этот ID для привязки аккаунта Telegram к XSPY Trader и активации двухфакторной аутентификации (2FA).`,
    chatIdLabel: "🔑 *Ваш персональный Chat ID:*",
    chatIdNote: "Нажмите на номер выше, чтобы скопировать его",
    stepsTitle: "📋 *Как привязать аккаунт:*",
    step1: "1. Нажмите на ваш Chat ID выше, чтобы скопировать.",
    step2: "2. Перейдите в настройки *Профиля* на XSPY Trader.",
    step3: "3. Вставьте Chat ID в поле *Telegram Chat ID* и нажмите *Сохранить*.",
    securityNote:
      "🔒 *Безопасность:* Никогда не делитесь этим ID с другими людьми.",
    footer:
      "✅ После привязки вы будете мгновенно получать 6-значный OTP-код при каждом запросе на вывод средств — для максимальной защиты.",
    openProfile: "👤 Открыть настройки профиля",
    visitSite: "🌐 Перейти на платформу",
    joinGroup: "💬 Присоединиться к группе",
    alreadyAnswered:
      "Ваш Chat ID уже был отправлен. Вы найдёте его в предыдущем сообщении.",
  },
};

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(
  userLang?: string,
  messageText?: string
): SupportedLang {
  // Script-based detection first
  if (messageText && /[\u0600-\u06FF]/.test(messageText)) return "ar";
  if (messageText && /[\u0400-\u04FF]/.test(messageText)) return "ru";

  // Telegram interface language
  const code = (userLang || "").toLowerCase();
  if (code.startsWith("ar")) return "ar";
  if (code.startsWith("fr")) return "fr";
  if (code.startsWith("de")) return "de";
  if (code.startsWith("ru")) return "ru";

  return "en";
}

// ─── Format Verification Message ─────────────────────────────────────────────
function formatMessage(
  lang: SupportedLang,
  firstName: string,
  chatId: number | string
): string {
  const t = MESSAGES[lang] || MESSAGES.en;

  return (
    `${t.title}\n\n` +
    `${t.hello(firstName)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${t.chatIdLabel}\n` +
    `\`${chatId}\`\n` +
    `_${t.chatIdNote}_\n\n` +
    `${t.stepsTitle}\n` +
    `${t.step1}\n` +
    `${t.step2}\n` +
    `${t.step3}\n\n` +
    `${t.securityNote}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${t.footer}`
  );
}

// ─── Build Inline Keyboard ────────────────────────────────────────────────────
function buildReplyMarkup(lang: SupportedLang, chatId: number | string) {
  const t = MESSAGES[lang] || MESSAGES.en;
  return {
    inline_keyboard: [
      [
        { text: t.openProfile, url: `${SITE_URL}/dashboard/profile` },
        { text: t.visitSite, url: SITE_URL },
      ],
      [{ text: t.joinGroup, url: "https://t.me/XSpyAIBot" }],
      [
        { text: "🇸🇦 العربية", callback_data: `lang_ar_${chatId}` },
        { text: "🇬🇧 English", callback_data: `lang_en_${chatId}` },
        { text: "🇫🇷 Français", callback_data: `lang_fr_${chatId}` },
      ],
      [
        { text: "🇩🇪 Deutsch", callback_data: `lang_de_${chatId}` },
        { text: "🇷🇺 Русский", callback_data: `lang_ru_${chatId}` },
      ],
    ],
  };
}

// ─── Rate Limiting for Webhook (in-memory) ────────────────────────────────────
const rateLimitMap = new Map<number, number>();
const RATE_LIMIT_WINDOW_MS = 800; // Minimum interval between requests per user

function isRateLimited(userId: number): boolean {
  const lastTime = rateLimitMap.get(userId);
  if (lastTime && Date.now() - lastTime < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  rateLimitMap.set(userId, Date.now());
  return false;
}

// ─── Telegram API Helper ──────────────────────────────────────────────────────
async function callTelegramApi(method: string, body: object) {
  const token = getOtpBotToken();
  if (!token) {
    console.warn("[OTP Bot] TELEGRAM_BOT_TOKEN not configured.");
    return { ok: false, description: "Token missing" };
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

// ─── Debug & Webhook Setup GET endpoint ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const token = getOtpBotToken();

  // Force setup if requested: ?action=setup
  if (action === "setup") {
    const res = await callTelegramApi("setWebhook", {
      url: `${SITE_URL}/api/telegram/webhook`,
      drop_pending_updates: true,
    });
    const info = await callTelegramApi("getWebhookInfo", {});
    return NextResponse.json({
      status: "setup_executed",
      setWebhookResult: res,
      webhookInfo: info,
      webhookUrl: `${SITE_URL}/api/telegram/webhook`,
    });
  }

  // Inspect bot & webhook status
  try {
    const [me, webhookInfo] = await Promise.all([
      callTelegramApi("getMe", {}).catch(() => ({ ok: false })),
      callTelegramApi("getWebhookInfo", {}).catch(() => ({ ok: false })),
    ]);

    // If webhook is not configured or pointing elsewhere, automatically set it
    let autoSetResult = null;
    const currentUrl = webhookInfo?.result?.url || "";
    const targetUrl = `${SITE_URL}/api/telegram/webhook`;

    if (token && currentUrl !== targetUrl) {
      autoSetResult = await callTelegramApi("setWebhook", {
        url: targetUrl,
        drop_pending_updates: true,
      }).catch(() => null);
    }

    return NextResponse.json({
      status: "ok",
      bot: "Xspy Trader Security (@XspyTraderOtp_bot)",
      version: "v7-hardened",
      hasToken: !!token,
      tokenMasked: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : "NOT_CONFIGURED",
      botDetails: me?.result || null,
      targetWebhookUrl: targetUrl,
      currentWebhookInfo: webhookInfo?.result || null,
      autoConfigured: !!autoSetResult,
      autoSetResult,
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "error",
      message: err.message || "Failed to contact Telegram API",
      targetWebhookUrl: `${SITE_URL}/api/telegram/webhook`,
    });
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Handle language button presses ────────────────────────────────────────
    if (body.callback_query) {
      const cb = body.callback_query;
      const data = (cb.data as string) || "";

      if (data.startsWith("lang_")) {
        const parts = data.split("_");
        // Format: lang_<code>_<chatId>
        const selectedLang = (parts[1] || "en") as SupportedLang;
        const targetChatId =
          parts.slice(2).join("_") || String(cb.message?.chat?.id);
        const firstName = cb.from?.first_name || "Trader";

        const text = formatMessage(selectedLang, firstName, targetChatId);
        const reply_markup = buildReplyMarkup(selectedLang, targetChatId);

        // Edit the existing message in-place
        if (cb.message?.message_id && targetChatId) {
          await callTelegramApi("editMessageText", {
            chat_id: targetChatId,
            message_id: cb.message.message_id,
            text,
            parse_mode: "Markdown",
            reply_markup,
          });
        }

        // Dismiss loading indicator silently
        await callTelegramApi("answerCallbackQuery", {
          callback_query_id: cb.id,
        });
      }

      return NextResponse.json({ ok: true });
    }

    // ── Handle incoming messages ───────────────────────────────────────────────
    if (body.message && body.message.chat) {
      const msg = body.message;
      const chatId = msg.chat.id;
      const fromId = msg.from?.id;

      // Rate limit protection against automated flood attacks
      if (fromId && isRateLimited(fromId)) {
        return NextResponse.json({ ok: true, rate_limited: true });
      }

      const firstName = msg.from?.first_name || "Trader";
      const userLang = msg.from?.language_code;
      const messageText: string = msg.text || "";

      // Detect user's preferred language
      const lang = detectLanguage(userLang, messageText);
      const t = MESSAGES[lang] || MESSAGES.en;

      // Handle /start or any message — always respond with Chat ID
      const text = formatMessage(lang, firstName, chatId);
      const reply_markup = buildReplyMarkup(lang, chatId);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup,
      });

      // If user sends something other than /start, acknowledge gently
      if (messageText && messageText.trim() !== "/start" && messageText.trim() !== "/help") {
        // Already sent the ID message above — no need for extra reply
      }
    }

    // Always return 200 OK to acknowledge delivery to Telegram
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[OTP Bot Webhook Error]", error);
    // Return 200 even on error so Telegram doesn't keep retrying
    return NextResponse.json({ ok: true });
  }
}
