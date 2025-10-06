"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import ProtectionScript from "@/components/ProtectionScript";
import BottomNavigation from "@/components/bottom-navigation";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProtectionScript />

          {/* المحتوى الأساسي للصفحة */}
          <main className="min-h-screen pb-20">{children}</main>

          {/* ✅ الشريط السفلي */}
          <bottom-navigation />

          {/* ✅ إشعارات النظام */}
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
