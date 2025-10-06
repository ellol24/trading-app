// components/ClientProviders.tsx
"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner"; // تأكد أنه من sonner إذا كنت تستخدم مكتبة sonner
import ProtectionScript from "@/components/ProtectionScript";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProtectionScript />
          {children}
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
