// components/ProtectionScript.tsx
"use client";

import { useEffect } from "react";

export default function ProtectionScript() {
  useEffect(() => {
    try {
      // منع الترجمة من الأساس
      document.documentElement.setAttribute("translate", "no");
      document.body.setAttribute("translate", "no");
      document.body.setAttribute("data-react-protected", "true");

      // ✅ قائمة أوسع لتغطية كل عناصر Google Translate
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

      // 🔒 لا نلمس عناصر داخل React root
      function isInsideReactRoot(el: Node | null) {
        if (!(el instanceof Element)) return false;
        return !!el.closest(
          "[data-react-component], [data-reactroot], #__next, #__react-root"
        );
      }

      // 🚫 إخفاء أو إزالة العنصر
      const hideOrRemoveNode = (n: Node) => {
        if (!(n instanceof Element)) return;
        try {
          if (isInsideReactRoot(n) || isInsideReactRoot(n.parentElement)) {
            // إذا داخل React → نخفي فقط
            (n as HTMLElement).style.setProperty("display", "none", "important");
            (n as HTMLElement).setAttribute("data-translate-hidden", "true");
            return;
          }

          // افتراضياً → نخفي بدلاً من الحذف (آمن أكثر)
          (n as HTMLElement).style.setProperty("display", "none", "important");
          (n as HTMLElement).setAttribute("data-translate-hidden", "true");
        } catch {
          try {
            n.parentNode?.removeChild(n); // fallback
          } catch {
            // تجاهل الأخطاء
          }
        }
      };

      // 🧹 البحث وإخفاء العناصر
      const removeGoogleNodes = (root: Node) => {
        if (!(root instanceof Element)) return;
        selectors.forEach((sel) => {
          root.querySelectorAll(sel).forEach((n) => {
            hideOrRemoveNode(n);
          });
        });
      };

      // 👀 مراقبة DOM لأي عناصر جديدة
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.addedNodes) {
            m.addedNodes.forEach((n) => removeGoogleNodes(n));
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
        attributeFilter: ["class", "id", "translate", "style"],
      });

      // ⏱️ تنظيف دوري (احتياطي) كل 3 ثوانٍ
      const cleanupInterval = window.setInterval(() => {
        removeGoogleNodes(document.documentElement);
      }, 3000);

      // 🧹 إيقاف عند إغلاق الصفحة
      window.addEventListener(
        "beforeunload",
        () => {
          observer.disconnect();
          clearInterval(cleanupInterval);
        },
        { once: true }
      );
    } catch (e) {
      console.warn("[TranslateProtection] init failed:", e);
    }
  }, []);

  return null;
}
 
