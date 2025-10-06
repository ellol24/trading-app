"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import ProtectionScript from "@/components/ProtectionScript";
import BottomNavigation from "@/components/bottom-navigation.tsx";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProtectionScript />
          <main>{children}</main>
          <BottomNavigation />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

