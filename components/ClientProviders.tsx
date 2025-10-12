"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "sonner";
import ProtectionScript from "@/components/ProtectionScript";
import BottomNavigation from "@/components/bottom-navigation";
import { ImpersonationProvider } from "@/contexts/impersonation-context"; // ✅ أضفنا مزود الانتحال

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ImpersonationProvider>
            {/* ✅ سكربت الحماية */}
            <ProtectionScript />

              

            {/* ✅ المحتوى الرئيسي */}
            <main className="min-h-screen">{children}</main>

          {/* ✅ الشريط السفلي */}
            <BottomNavigation />

            {/* ✅ إشعارات Sonner */}
            <Toaster
              position="top-center"
              theme="dark"
              richColors
              closeButton
              expand
            />
          </ImpersonationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}



