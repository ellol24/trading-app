"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "sonner"; // ✅ استخدم toasts الخاصة بـ sonner
import ProtectionScript from "@/components/ProtectionScript";
import BottomNavigation from "@/components/bottom-navigation";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProtectionScript />
          <main className="min-h-screen">{children}</main>

          {/* ✅ الشريط السفلي */}
          <bottom-navigation />

          {/* ✅ الـ Toaster الخاص بـ sonner */}
          <Toaster
            position="top-center"
            theme="dark"
            richColors
            closeButton
            expand
          />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

