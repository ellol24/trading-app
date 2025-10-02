// components/ClientProviders.tsx
"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/theme-context";        // يجب أن يبدأ هذا الملف بـ "use client"
import { LanguageProvider } from "@/contexts/language-context"; // يجب أن يبدأ هذا الملف بـ "use client"
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import ProtectionScript from "@/components/ProtectionScript";

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
