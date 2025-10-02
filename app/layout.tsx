// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { BRAND_NAME, BRAND_DESCRIPTION } from "@/lib/brand";

// تحميل خط Inter من Google Fonts
const inter = Inter({ subsets: ["latin"] });

// بيانات الـ SEO والـ Metadata (تُعالج تلقائياً بواسطة Next.js)
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
    // الـ <html> هو الجذر لكل الصفحات
    // هنا نضيف translate="no" لمنع Google Translate من التلاعب
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        {/* ⛔️ هذه الـ meta tags تقول صراحةً لمحركات البحث وأدوات جوجل "لا تترجم" */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>

      {/* ⛔️ هنا نكرر translate="no" على مستوى <body> 
          ونضيف data-react-protected لتمييز أن المحتوى محمي من أي تلاعب DOM خارجي */}
      <body
        className={inter.className}
        translate="no"
        data-react-protected
      >
        {/* ClientProviders:
            - يحتوي على جميع الـ Providers (Theme, Auth, Language, إلخ)
            - يحتوي على ProtectionScript الذي يراقب DOM ويحذف أي عناصر
              مضافة من Google Translate (مثل البانر أو التولبار)
        */}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  ); 
}
