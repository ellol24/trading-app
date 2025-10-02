// components/ClientProviders.tsx
"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";

function ProtectionScript() {
  useEffect(() => {
    // ✅ اجبار الصفحة كلها تكون غير قابلة للترجمة
    document.documentElement.setAttribute("translate", "no");
    document.body.setAttribute("translate", "no");

    const cleanGoogleTranslate = () => {
      const googleEls = document.querySelectorAll(
        ".goog-te-banner-frame, .goog-te-gadget, .goog-te-balloon-frame, #goog-gt-tt"
      );
      googleEls.forEach((el) => {
        try {
          el.remove?.(); // أكثر أمانًا من parentNode.removeChild
        } catch (e) {
          console.warn("Failed to remove Google Translate element:", e);
        }
      });
    };

    // 🚀 تنظيف أولي
    cleanGoogleTranslate();

    // 👀 متابعة DOM لأي عناصر جديدة
    const observer = new MutationObserver(() => {
      cleanGoogleTranslate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProtectionScript />
          {children}
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
