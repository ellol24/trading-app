// components/ProtectionScript.tsx
"use client";

import { useEffect } from "react";

/**
 * حماية من Google Translate وملحقات الترجمة الأخرى.
 *
 * أهداف النسخة المحسّنة:
 * 1. منع الترجمة على مستوى الوثيقة وداخل جذر React (#__next, #root, ...).
 * 2. إخفاء واجهات Google Translate (iframe, banner, widgets) عبر إدراج CSS ثابت بدل حذف عناصر DOM،
 *    لأن الحذف المباشر قد يتعارض مع شجرة React ويسبب أخطاء (removeChild / React hydration errors).
 * 3. إعادة تطبيق الحماية تلقائياً عند التنقل client-side (pushState/replaceState/popstate) و/أو عند إضافة عناصر جديدة.
 * 4. تجنّب عمليات ثقيلة أو عمليات DOM خطرة - نستخدم setAttribute و CSS فقط، ولا نحذف عناصر React-managed.
 */

export default function ProtectionScript() {
  useEffect(() => {
    let cleanupTimer: number | null = null;
    let mutationObserver: MutationObserver | null = null;

    // معرف لوسم style المضاف
    const STYLE_ID = "translate-protection-style-v2";

    // محددات CSS لإخفاء عناصر Google Translate وواجهاته
    const PROTECT_CSS = `
/* إخفاء عناصر واجهة Google Translate و frames المحتملة */
.goog-te-banner-frame,
.goog-te-gadget,
.goog-te-spinner,
iframe.goog-te-menu-frame,
.goog-tooltip,
.goog-text-highlight,
#goog-gt-tt,
[class^="goog-"],
[id^="goog-"],
[class*="goog-"],
[id*="goog-"],
.google-translate,
.google_translate_element,
.goog-te-combo {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  pointer-events: none !important;
  overflow: hidden !important;
}

/* إذا أضاف الملحق لعنصر root ظاهري للترجمة */
[translate="yes"] {
  translate: no !important;
}
`;

    // أدخل CSS الحمايه في head إن لم يكن موجوداً (استخدام CSS بدلاً من حذف nodes هو أقل خطورة)
    function ensureStyle() {
      try {
        if (!document.head) return;
        if (!document.getElementById(STYLE_ID)) {
          const styleEl = document.createElement("style");
          styleEl.id = STYLE_ID;
          styleEl.setAttribute("data-translate-protection", "true");
          styleEl.appendChild(document.createTextNode(PROTECT_CSS));
          document.head.appendChild(styleEl);
        }
      } catch (e) {
        // لا نرمي خطأ إن فشل الإدراج
        // console.warn("protect style insert failed", e)
      }
    }

    // ضع translate="no" على العناصر الأساسية (html, body, React roots)
    function setNoTranslateAttributes() {
      try {
        document.documentElement?.setAttribute?.("translate", "no");
      } catch {}

      try {
        document.body?.setAttribute?.("translate", "no");
      } catch {}

      // محاولات للعثور على جذور React/Next المعروفة وتعيين الخاصية عليها
      const rootSelectors = [
        "#__next", // Next.js
        "#root", // create-react-app
        "[data-reactroot]",
        "[data-nextjs-app-router-root]", // احتياطيات مستقبلية
        "[data-nextjs-app-page]", // احتياطي
      ];

      try {
        rootSelectors.forEach((s) => {
          try {
            const els = Array.from(document.querySelectorAll(s));
            els.forEach((el) => {
              if (el instanceof Element) {
                el.setAttribute("translate", "no");
                el.setAttribute("data-translate-protected", "true");
              }
            });
          } catch {
            // ignore
          }
        });
      } catch {}
    }

    // تنفيذ الحماية: إدراج style + تعيين attributes
    function applyProtection() {
      ensureStyle();
      setNoTranslateAttributes();
    }

    // دالة تُدعى عند حدوث تغييرات صغيرة (debounced) لإعادة تطبيق الحماية
    let debounceTimer: number | null = null;
    function scheduleReapply(delay = 50) {
      try {
        if (debounceTimer) {
          window.clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
          applyProtection();
          debounceTimer = null;
        }, delay) as unknown as number;
      } catch {}
    }

    // استمع لتغييرات التاريخ (client navigation) — نعترض pushState/replaceState ثم نطلق حدث مخصص
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    try {
      // اعادة تغليف pushState
      // @ts-ignore - تعديل مؤقت على الـ history
      history.pushState = function (...args: any[]) {
        const ret = origPush.apply(this, args);
        try {
          // أعد تطبيق الحماية بعد تبديل المسار (مع تأخير بسيط للسماح لـ React بتجهيز DOM الجديد)
          scheduleReapply(40);
          window.dispatchEvent(new CustomEvent("translate-protection:navigation"));
        } catch {}
        return ret;
      };

      // @ts-ignore
      history.replaceState = function (...args: any[]) {
        const ret = origReplace.apply(this, args);
        try {
          scheduleReapply(40);
          window.dispatchEvent(new CustomEvent("translate-protection:navigation"));
        } catch {}
        return ret;
      };

      // عند الرجوع/التقدم في التاريخ
      window.addEventListener("popstate", () => {
        scheduleReapply(40);
      });
    } catch (e) {
      // إن لم ينجح تعديل history لا يسبب انهيار
    }

    // MutationObserver لمراقبة العناصر المضافة وإعادة تطبيق حماية السمات CSS بشكل مُخفف
    try {
      mutationObserver = new MutationObserver((mutations) => {
        // نريد فقط إعادة تطبيق الحماية عند إضافة Nodes (لا نفحص سمات بكثرة لتقليل الضجيج)
        let added = false;
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length > 0) {
            added = true;
            break;
          }
        }
        if (added) {
          // جدولة إعادة تطبيق الحماية بشكل مخفف
          scheduleReapply(40);
        }
      });

      // راقب جسم المستند (childList + subtree) فقط
      if (document.body) {
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    } catch (e) {
      // ignore
    }

    // حماية احتياطية: فترة تنظيف متباعدة (أطول لتفادي الحمل) — فقط إذا لم تكن هناك مراقبة (فوق نستخدم observer)
    try {
      cleanupTimer = window.setInterval(() => {
        applyProtection();
      }, 10_000); // كل 10 ثواني — كـ safety net فقط
    } catch {}

    // تطبيق أولي مباشر
    try {
      applyProtection();
    } catch (e) {
      // ignore
    }

    // حدث مخصص يمكن الاستماع إليه (للإجراءات الخارجية إن لزم)
    const onManualNav = () => scheduleReapply(20);
    window.addEventListener("translate-protection:navigate", onManualNav);

    // ---------------------------------------
    // تنظيف عند إلغاء تركيب المكون
    return () => {
      try {
        // استعادة الدوال الأصلية للتاريخ
        // @ts-ignore
        history.pushState = origPush;
        // @ts-ignore
        history.replaceState = origReplace;
      } catch {}

      try {
        window.removeEventListener("popstate", () => {});
      } catch {}

      try {
        if (mutationObserver) mutationObserver.disconnect();
      } catch {}

      try {
        if (cleanupTimer) {
          window.clearInterval(cleanupTimer);
          cleanupTimer = null;
        }
      } catch {}

      try {
        window.removeEventListener("translate-protection:navigate", onManualNav);
      } catch {}
    };
  }, []);

  return null;
}
