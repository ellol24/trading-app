import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/contexts/language-context"
import { ThemeProvider } from "@/contexts/theme-context"
import { AuthProvider } from "@/components/providers/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { BRAND_NAME, BRAND_DESCRIPTION } from "@/lib/brand"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Professional Trading Platform`,
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  generator: "v0.dev",
  openGraph: {
    title: BRAND_NAME,
    siteName: BRAND_NAME,
    description: BRAND_DESCRIPTION,
  },
  twitter: {
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    card: "summary_large_image",
  },
  appleWebApp: {
    title: BRAND_NAME,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
