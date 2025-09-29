// components/ProtectionScript.tsx
"use client";

import { useEffect } from "react";

export default function ProtectionScript() {
  useEffect(() => {
    try {
      document.documentElement.setAttribute("translate", "no");
      document.body.setAttribute("translate", "no");
      document.body.setAttribute("data-react-protected", "true");

      const selectors = [
        '[class*="goog-"]',
        '[id*="goog-"]',
        '[class*="google-translate"]',
        '[id*="google-translate"]',
        '#goog-gt-tt',
        '.goog-te-banner-frame',
        '.goog-te-spinner',
      ];

      function isInsideReactRoot(el: Node | null) {
        if (!(el instanceof Element)) return false;
        return !!el.closest("[data-react-component], [data-reactroot], #__next, #__react-root");
      }

      const hideOrRemoveNode = (n: Node) => {
        try {
          if (!(n instanceof Element)) return;
          // لا تعبث بعناصر تابعة لـ React root
          if (isInsideReactRoot(n) || isInsideReactRoot(n.parentElement)) {
            // آمن: بدلاً من الحذف، نخفي العنصر
            try {
              (n as HTMLElement).style.setProperty("display", "none", "important");
              (n as HTMLElement).setAttribute("data-translate-hidden", "true");
            } catch (e) {
              // fallback: لا تفعل شيئًا
            }
            return;
          }

          // نختفي بالافتراضي بدلاً من الحذف — أكثر أمانًا ولا يخفّف React
          try {
            (n as HTMLElement).style.setProperty("display", "none", "important");
            (n as HTMLElement).setAttribute("data-translate-hidden", "true");
            // console.debug("[TranslateProtection] hid node:", n);
          } catch (e) {
            // fallback to remove if hide impossible (wrapped safely)
            try {
              n.parentNode?.removeChild(n);
            } catch (err) {
              // swallow
            }
          }
        } catch (e) {
          // لا تدع أي خطأ يكسر الصفحة
        }
      };

      const removeGoogleNodes = (root: Node) => {
        if (!(root instanceof Element)) return;
        selectors.forEach((sel) => {
          root.querySelectorAll(sel).forEach((n) => {
            try {
              hideOrRemoveNode(n);
            } catch (e) {
              // ignore
            }
          });
        });
      };

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

      const cleanupInterval = window.setInterval(() => {
        try {
          removeGoogleNodes(document.documentElement);
        } catch (e) {}
      }, 2500);

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
