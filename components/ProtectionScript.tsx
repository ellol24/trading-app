// components/ProtectionScript.tsx
"use client";

import { useEffect } from "react";

export default function ProtectionScript() {
  useEffect(() => {
    if (typeof document === "undefined") return;
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
        'iframe.goog-te-menu-frame',
        '.goog-tooltip',
        '.goog-text-highlight',
      ];

      function isInsideReactRoot(el: Node | null) {
        if (!(el instanceof Element)) return false;
        return !!el.closest("[data-react-component], [data-reactroot], #__next, #__react-root");
      }

      const hideOrRemoveNode = (n: Node) => {
        if (!(n instanceof Element)) return;
        try {
          // if inside React root -> hide only
          if (isInsideReactRoot(n) || isInsideReactRoot(n.parentElement)) {
            try {
              (n as HTMLElement).style.setProperty("display", "none", "important");
              (n as HTMLElement).setAttribute("data-translate-hidden", "true");
            } catch {}
            return;
          }
          // otherwise try to remove (prefer el.remove())
          try {
            (n as HTMLElement).style.setProperty("display", "none", "important");
            (n as HTMLElement).setAttribute("data-translate-hidden", "true");
            if ((n as Element).remove) {
              (n as Element).remove();
            } else {
              n.parentNode?.removeChild(n);
            }
          } catch {
            try {
              if ((n as Element).remove) (n as Element).remove();
              else n.parentNode?.removeChild(n);
            } catch {}
          }
        } catch {}
      };

      const removeGoogleNodes = (root: Node) => {
        if (!(root instanceof Element)) return;
        selectors.forEach((sel) => {
          root.querySelectorAll(sel).forEach((n) => {
            try {
              hideOrRemoveNode(n);
            } catch {}
          });
        });
      };

      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          try {
            if (m.addedNodes) {
              m.addedNodes.forEach((n) => removeGoogleNodes(n));
            }
            if (m.type === "attributes" && m.target instanceof Element) {
              removeGoogleNodes(m.target);
            }
          } catch {}
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "id", "translate", "style"],
      });

      const cleanupInterval = window.setInterval(() => {
        try {
          removeGoogleNodes(document.documentElement);
        } catch {}
      }, 3000);

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
