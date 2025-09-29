// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { BRAND_NAME, BRAND_DESCRIPTION } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"] });

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // حافظ على هذا كـ Server Component
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        {/* تحذير: metadata export سيتم التعامل معه من Next.js تلقائياً */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>
      <body className={inter.className} translate="no" data-react-component>
        {/* ClientProviders هو مكوّن client يضم كل الـ providers والـ protection script */}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
