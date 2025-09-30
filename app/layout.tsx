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
    <html
      lang="en"
      translate="no"            // ⛔️ يمنع الترجمة من Google Translate
      suppressHydrationWarning
    >
      <head>
        {/* منع الترجمة على مستوى الميتا */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>
      <body
        className={inter.className}
        translate="no"           // ⛔️ منع الترجمة على مستوى البودي
        data-react-protected     // حماية من أي تدخل DOM خارجي
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
