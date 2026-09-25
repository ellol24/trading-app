// components/ProtectionScript.tsx
"use client";

import { useEffect } from "react";

export default function ProtectionScript() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // نؤخر بداية العمل قليلاً حتى تنتهي عملية الـ hydration (تجنّب تعديل DOM قبل الهيدرِيت).
    const startTimer = window.setTimeout(() => {
      try {
        // وضع السمات الأساسية لمنع الترجمة
        document.documentElement.setAttribute("translate", "no");
        document.body.setAttribute("translate", "no");
        document.body.setAttribute("data-translate-protected", "true");

        // محددات لإيجاد عناصر Google Translate الشائعة
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

        // دالة تتحقق إذا العنصر داخل React root (لا نفعل شيئاً لأجل عناصر React)
        const isInsideReactRoot = (el: Node | null) => {
          if (!(el instanceof Element)) return false;
          return !!el.closest(
            "[data-react-component], [data-reactroot], #__next, #__react-root"
          );
        };

        // نخفي فقط العناصر *الخارجية* (خارج شجرة React) — لا نلمس عناصر داخل roots
        const hideOrRemoveNode = (n: Node) => {
          if (!(n instanceof Element)) return;
          try {
            if (isInsideReactRoot(n) || isInsideReactRoot(n.parentElement)) {
              // إذا داخل React → نتركها (عدم التعديل يمنع الـ hydration mismatch)
              return;
            }
            // إخفاء آمن خارج React
            (n as HTMLElement).style?.setProperty("display", "none", "important");
            (n as HTMLElement).setAttribute("data-translate-hidden", "true");
          } catch {
            try {
              n.parentNode?.removeChild(n);
            } catch {
              // swallow
            }
          }
        };

        const removeGoogleNodes = (root: Node) => {
          if (!(root instanceof Element)) return;
          selectors.forEach((sel) => {
            root.querySelectorAll(sel).forEach((n) => hideOrRemoveNode(n));
          });
        };

        // مراقب بسيط، لكن نحصر المراقبة ونستعمل فلاتر صفات محددة
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.addedNodes) {
              m.addedNodes.forEach((n) => {
                removeGoogleNodes(n);
              });
            }
            if (m.type === "attributes" && m.target instanceof Element) {
              removeGoogleNodes(m.target);
            }
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "translate"],
        });

        // فحص دوري احتياطي
        const cleanupInterval = window.setInterval(() => {
          try {
            removeGoogleNodes(document.documentElement);
          } catch {}
        }, 3000);

        // تنظيف عند المغادرة
        const onBeforeUnload = () => {
          observer.disconnect();
          clearInterval(cleanupInterval);
        };
        window.addEventListener("beforeunload", onBeforeUnload, { once: true });
      } catch (e) {
        console.warn("[TranslateProtection] init failed:", e);
      }
    }, 250); // 250ms تأخير لتقليل مخاطر الهيدرِيت

    return () => {
      clearTimeout(startTimer);
      // لاحظ: نَمسح متى ما انفصل المكوّن
    };
  }, []);

  return null;
}
