"use client";

import { useEffect } from "react";

export default function ProtectionScript() {
  useEffect(() => {
    // 1. وظيفة تحمي العناصر من الترجمة
    const protectElements = () => {
      document.querySelectorAll("body *").forEach((el) => {
        if (el instanceof HTMLElement) {
          if (el.getAttribute("translate") !== "no") {
            el.setAttribute("translate", "no");
            el.setAttribute("data-react-protected", "");
          }
        }
      });

      // إزالة أي إطارات أو بانرات تابعة لـ Google Translate
      const googleEls = document.querySelectorAll(
        ".goog-te-banner-frame, .goog-te-gadget, .goog-te-balloon-frame, #goog-gt-tt"
      );
      googleEls.forEach((el) => el.remove());
    };

    // 2. تنفيذ فوري عند التحميل
    protectElements();

    // 3. مراقبة أي تغييرات في الـ DOM
    const observer = new MutationObserver(() => {
      protectElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 4. تنظيف عند إزالة الكومبوننت
    return () => observer.disconnect();
  }, []);

  return null; // لا يعرض أي شيء في الواجهة
}
