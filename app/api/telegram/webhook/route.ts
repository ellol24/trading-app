import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BOT_TOKEN = "8935322771:AAF6RrJLk-qpzg9cqcLLM2D-Y_J6LotQBZI";

type SupportedLang = "ar" | "en" | "fr" | "de" | "ru";

const MESSAGES: Record<
  SupportedLang,
  {
    title: string;
    hello: (name: string) => string;
    chatIdLabel: string;
    stepsTitle: string;
    step1: string;
    step2: string;
    step3: string;
    footer: string;
    openProfile: string;
    visitSite: string;
  }
> = {
  ar: {
    title: "🛡️ *أمان Xspy Trader والتحقق بخطوتين (2FA)*",
    hello: (name) =>
      `مرحباً بك يا *${name}*! حسابك في تيليجرام جاهز لتلقي رموز الأمان لعمليات السحب (OTP) بشكل فوري ومباشر.`,
    chatIdLabel: "🔑 *معرف الدردشة الشخصي الخاص بك (Chat ID):*",
    stepsTitle: "📋 *خطوات ربط حسابك بالمنصة:*",
    step1: "1. اضغط على رقم الـ Chat ID أعلاه لنسخه.",
    step2: "2. توجه إلى إعدادات *الملف الشخصي* في منصة Xspy Trader.",
    step3: "3. الصق الرقم في حقل *Telegram Chat ID* ثم اضغط حفظ.",
    footer:
      "عند قيامك بطلب سحب أموال، ستصلك رسالة تحتوي على كود تأكيد السحب هنا فوراً لضمان أقصى حماية لحسابك. 🔐",
    openProfile: "👤 فتح إعدادات الملف الشخصي",
    visitSite: "🌐 زيارة منصة Xspy Trader",
  },
  en: {
    title: "🛡️ *Xspy Trader Security & 2FA*",
    hello: (name) =>
      `Hello *${name}*! Your Telegram account is ready to receive instant one-time withdrawal security codes (OTP).`,
    chatIdLabel: "🔑 *Your Personal Chat ID:*",
    stepsTitle: "📋 *How to connect your account:*",
    step1: "1. Tap your Chat ID above to copy it.",
    step2: "2. Go to your *Xspy Trader Profile* settings.",
    step3: "3. Paste your Chat ID into the *Telegram Chat ID* field and click Save.",
    footer:
      "Whenever you request a withdrawal, your 6-digit confirmation code will be delivered here instantly for maximum security. 🔐",
    openProfile: "👤 Open Profile Settings",
    visitSite: "🌐 Visit Platform",
  },
  fr: {
    title: "🛡️ *Sécurité Xspy Trader & 2FA*",
    hello: (name) =>
      `Bonjour *${name}* ! Votre compte Telegram est prêt à recevoir vos codes de sécurité instantanés (OTP) pour les retraits.`,
    chatIdLabel: "🔑 *Votre identifiant de chat personnel (Chat ID) :*",
    stepsTitle: "📋 *Comment associer votre compte :*",
    step1: "1. Appuyez sur votre Chat ID ci-dessus pour le copier.",
    step2: "2. Rendez-vous dans les paramètres de votre *Profil Xspy Trader*.",
    step3: "3. Collez votre identifiant dans le champ *Telegram Chat ID* et enregistrez.",
    footer:
      "Lors de chaque demande de retrait, un code de confirmation à 6 chiffres vous sera envoyé ici instantanément pour une sécurité maximale. 🔐",
    openProfile: "👤 Paramètres du profil",
    visitSite: "🌐 Visiter la plateforme",
  },
  de: {
    title: "🛡️ *Xspy Trader Sicherheit & 2FA*",
    hello: (name) =>
      `Hallo *${name}*! Ihr Telegram-Konto ist bereit, sofortige Sicherheits-Codes (OTP) für Auszahlungsbestätigungen zu empfangen.`,
    chatIdLabel: "🔑 *Ihre persönliche Chat-ID:*",
    stepsTitle: "📋 *So verknüpfen Sie Ihr Konto:*",
    step1: "1. Tippen Sie auf Ihre obige Chat-ID, um sie zu kopieren.",
    step2: "2. Öffnen Sie die *Profil-Einstellungen* auf Xspy Trader.",
    step3: "3. Fügen Sie die ID in das Feld *Telegram Chat ID* ein und speichern Sie.",
    footer:
      "Bei jeder Auszahlung wird Ihr 6-stelliger Bestätigungscode sofort hierher gesendet, um maximale Sicherheit zu gewährleisten. 🔐",
    openProfile: "👤 Profil-Einstellungen",
    visitSite: "🌐 Plattform besuchen",
  },
  ru: {
    title: "🛡️ *Безопасность Xspy Trader и 2FA*",
    hello: (name) =>
      `Здравствуйте, *${name}*! Ваш аккаунт Telegram готов к получению одноразовых кодов безопасности (OTP) для вывода средств.`,
    chatIdLabel: "🔑 *Ваш личный Chat ID:*",
    stepsTitle: "📋 *Как привязать аккаунт:*",
    step1: "1. Нажмите на ваш Chat ID выше, чтобы скопировать.",
    step2: "2. Перейдите в настройки *Профиля* на Xspy Trader.",
    step3: "3. Вставьте ваш Chat ID в поле *Telegram Chat ID* и сохраните.",
    footer:
      "При каждом запросе на вывод средств ваш 6-значный код подтверждения будет мгновенно отправляться сюда для максимальной безопасности. 🔐",
    openProfile: "👤 Открыть профиль",
    visitSite: "🌐 Перейти на платформу",
  },
};

function detectLanguage(userLang?: string, messageText?: string): SupportedLang {
  // If user typed in Arabic
  if (messageText && /[\u0600-\u06FF]/.test(messageText)) {
    return "ar";
  }
  // If user typed in Cyrillic (Russian)
  if (messageText && /[\u0400-\u04FF]/.test(messageText)) {
    return "ru";
  }

  // Telegram client interface language
  const code = (userLang || "").toLowerCase();
  if (code.startsWith("ar")) return "ar";
  if (code.startsWith("fr")) return "fr";
  if (code.startsWith("de")) return "de";
  if (code.startsWith("ru")) return "ru";

  return "en";
}

function formatMessage(lang: SupportedLang, firstName: string, chatId: number | string): string {
  const t = MESSAGES[lang] || MESSAGES.en;
  return (
    `${t.title}\n\n` +
    `${t.hello(firstName)}\n\n` +
    `${t.chatIdLabel}\n` +
    `\`${chatId}\`\n\n` +
    `${t.stepsTitle}\n` +
    `${t.step1}\n` +
    `${t.step2}\n` +
    `${t.step3}\n\n` +
    `${t.footer}`
  );
}

function buildReplyMarkup(lang: SupportedLang, chatId: number | string) {
  const t = MESSAGES[lang] || MESSAGES.en;
  return {
    inline_keyboard: [
      [
        {
          text: t.openProfile,
          url: "https://www.xspy-trader.com/dashboard/profile",
        },
      ],
      [
        {
          text: t.visitSite,
          url: "https://www.xspy-trader.com",
        },
      ],
      [
        { text: "🇸🇦 العربية", callback_data: `lang_ar_${chatId}` },
        { text: "🇬🇧 English", callback_data: `lang_en_${chatId}` },
        { text: "🇫🇷 Français", callback_data: `lang_fr_${chatId}` },
        { text: "🇩🇪 Deutsch", callback_data: `lang_de_${chatId}` },
      ],
    ],
  };
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;

  try {
    const body = await req.json();

    // 1. Handle language button clicks (callback_query)
    if (body.callback_query) {
      const cb = body.callback_query;
      const data = (cb.data as string) || "";

      if (data.startsWith("lang_")) {
        const parts = data.split("_");
        const selectedLang = (parts[1] || "en") as SupportedLang;
        const targetChatId = parts[2] || cb.message?.chat?.id;
        const firstName = cb.from?.first_name || "Trader";

        const text = formatMessage(selectedLang, firstName, targetChatId);
        const reply_markup = buildReplyMarkup(selectedLang, targetChatId);

        // Edit existing message in-place smoothly
        if (cb.message?.message_id && targetChatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChatId,
              message_id: cb.message.message_id,
              text,
              parse_mode: "Markdown",
              reply_markup,
            }),
          });
        }

        // Dismiss Telegram loading indicator
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cb.id }),
        });
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Handle normal messages or /start
    if (body.message && body.message.chat) {
      const chatId = body.message.chat.id;
      const firstName = body.message.from?.first_name || "Trader";
      const userLang = body.message.from?.language_code;
      const messageText = body.message.text || "";

      // Detect user language automatically
      const lang = detectLanguage(userLang, messageText);
      const text = formatMessage(lang, firstName, chatId);
      const reply_markup = buildReplyMarkup(lang, chatId);

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          reply_markup,
        }),
      });
    }

    // Always return 200 OK so Telegram acknowledges delivery
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook Error]", error);
    return NextResponse.json({ ok: true });
  }
}
