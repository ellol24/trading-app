// components/ProtectionScript.tsx
"use client";

import { useEffect } from "react";

/**
 * حماية من إضافات/عناصر Google Translate.
 * مبادئ مهمة في هذه النسخة:
 * - تنصيب مرة واحدة فقط عبر window.__translateProtectionInstalled
 * - لا نحذف DOM أبداً (لا removeChild) — هذا يمنع أخطاء React/Hydration
 * - نخفي عناصر الإضافة عبر إدراج <style> مركزي (display:none !important)
 * - مراقبة DOM محدودة (childList + subtree) والقيام بفحص احتياطي دوري
 * - أي خطأ يُمسك بصمت (لا نترك السكربت يرمي Exceptions)
 */
export default function ProtectionScript() {
  useEffect(() => {
    try {
      // حارس تثبيت واحد فقط (مهم لعمل SPA عند التنقل)
      if ((window as any).__translateProtectionInstalled) return;
      (window as any).__translateProtectionInstalled = true;

      // منع الترجمة على مستوى الوثيقة
      document.documentElement.setAttribute("translate", "no");
      document.body.setAttribute("translate", "no");
      document.body.setAttribute("data-react-protected", "true");

      // قائمة محدّثة من المحددات التي قد تضيفها إضافات الترجمة
      const selectors = [
        '[class*="goog-"]',
        '[id*="goog-"]',
        '[class*="google-translate"]',
        '[id*="google-translate"]',
        '#goog-gt-tt',
        '.goog-te-banner-frame',
        '.goog-te-spinner',
        'iframe.goog-te-menu-frame',
        '.goog-tooltip',
        '.goog-text-highlight',
      ];

      // أدخل قاعدة CSS واحدة تُخفي كل العناصر ذات الصلة (آمنة: لا تغيّر شجرة DOM)
      const styleId = "translate-protection-style";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = selectors
          .map(
            (sel) =>
              `${sel} { display: none !important; visibility: hidden !important; pointer-events: none !important; }`
          )
          .join("\n");
        document.head.appendChild(style);
      }

      // دالة مساعدة: نعلّم/نخفي العقدة احتياطياً دون حذفها
      function markOrHideNode(n: Node) {
        if (!(n instanceof Element)) return;
        try {
          // لا نغيّر العناصر الموجودة داخل React root — نترك CSS تتعامل مع العرض
          const insideReact =
            !!n.closest?.("[data-react-component], [data-reactroot], #__next, #__react-root");
          if (insideReact) {
            n.setAttribute("data-translate-hidden", "true");
            return;
          }
          // خارج React root: ضع إخفاء مباشرة كـ fallback
          (n as HTMLElement).style.setProperty("display", "none", "important");
          n.setAttribute("data-translate-hidden", "true");
        } catch {
          // لا نفشل الصفحة
        }
      }

      // فحص / مسح مبدئي وثانوي
      const scanAndMark = (root: ParentNode | Document = document) => {
        try {
          selectors.forEach((sel) => {
            Array.from(root.querySelectorAll(sel)).forEach((n) => markOrHideNode(n));
          });
        } catch {
          // تجاهل أي خطأ
        }
      };

      // مراقب تغيّرات: نراقب الإضافات التي تضيف عناصر جديدة إلى DOM
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach((n) => {
              if (n instanceof Element) {
                // إذا العنصر يطابق selector أو يحتوي على عناصر تطابقها، نعلّمها
                selectors.forEach((sel) => {
                  try {
                    if ((n as Element).matches?.(sel)) markOrHideNode(n);
                  } catch {}
                  try {
                    (n as Element).querySelectorAll(sel).forEach((x) => markOrHideNode(x));
                  } catch {}
                });
              }
            });
          }
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });

      // فحص مبدئي + فحص احتياطي كل بضع ثوانٍ
      scanAndMark(document);
      const cleanupInterval = window.setInterval(() => {
        try {
          scanAndMark(document);
        } catch {}
      }, 5000);

      // تنظيف عند الخروج
      window.addEventListener(
        "beforeunload",
        () => {
          observer.disconnect();
          clearInterval(cleanupInterval);
        },
        { once: true }
      );
    } catch (e) {
      // لا نكسر الصفحة أبداً — فقط نسجل
      // eslint-disable-next-line no-console
      console.warn("[TranslateProtection] init failed:", e);
    }
  }, []);

  return null;
}
