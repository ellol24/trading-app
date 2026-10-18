// lib/translator.ts

export type SupportedLanguage = "en" | "ar" | "fr" | "de";

/**
 * Translate text between two languages using MyMemory API.
 * Free, fast, reliable, with HTML entity decoding.
 */
export async function translateSingle(
  text: string,
  from: string,
  to: string
): Promise<string> {
  if (!text || text.trim() === "" || from === to) return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.trim()
    )}&langpair=${from}|${to}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return text;
    const data = await res.json();
    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    }
    return text;
  } catch (err) {
    console.warn(`[Translator] Failed to translate ${from}->${to}:`, err);
    return text;
  }
}

/**
 * Auto-detect primary language from text content.
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text) return "en";
  // Arabic Unicode block
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  // French unique accented characters
  if (/[éèêëàâôûùçîï]/i.test(text)) return "fr";
  // German umlauts and eszett
  if (/[äöüß]/i.test(text)) return "de";
  return "en";
}

/**
 * Translate a string to all supported platform languages (en, ar, fr, de).
 */
export async function translateToAllLanguages(
  text: string,
  sourceLang?: SupportedLanguage
): Promise<Record<SupportedLanguage, string>> {
  if (!text || text.trim() === "") {
    return { en: "", ar: "", fr: "", de: "" };
  }

  const from = sourceLang || detectLanguage(text);
  const targets: SupportedLanguage[] = ["en", "ar", "fr", "de"];

  const results: Record<SupportedLanguage, string> = {
    en: text,
    ar: text,
    fr: text,
    de: text,
  };
  results[from] = text;

  await Promise.all(
    targets.map(async (target) => {
      if (target === from) return;
      try {
        const translated = await translateSingle(text, from, target);
        results[target] = translated || text;
      } catch {
        results[target] = text;
      }
    })
  );

  return results;
}

/**
 * Translate a Title + Message pair to all supported languages.
 */
export async function translateMessagePair(
  title: string,
  message: string,
  sourceLang?: SupportedLanguage
): Promise<Record<SupportedLanguage, { title: string; message: string }>> {
  const from = sourceLang || detectLanguage(`${title} ${message}`);

  const [titles, messages] = await Promise.all([
    translateToAllLanguages(title, from),
    translateToAllLanguages(message, from),
  ]);

  return {
    en: { title: titles.en, message: messages.en },
    ar: { title: titles.ar, message: messages.ar },
    fr: { title: titles.fr, message: messages.fr },
    de: { title: titles.de, message: messages.de },
  };
}
