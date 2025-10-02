// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { BRAND_NAME, BRAND_DESCRIPTION } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"] });

/**
 * Next.js metadata API (Next سيستخدمها تلقائياً)
 * لا تضَع هنا أشياء غير قابلة للتسلسل (مثل دوال).
 */
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
    // هذا ملف Server Component (افتراضي في app/layout.tsx)
    <html lang="en" translate="no">
      {/* 
        لا تضع منطق React/JS داخل <head> هنا — Next يتعامل مع metadata. 
        إن أردت meta إضافية خاصة (غير مدعومة بالـ metadata API) أضفها هنا بحذر.
      */}
      <head>
        {/* بعض محركات البحث/عناصر الترجمة تستجيب لهذه الميتا */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>

      {/* 
        className من الخطوط، translate="no" للـ html/body، و data-react-component علامة خفيفة
        — لا تقم بتغيير DOM هنا أو تمرير عناصر React غير قابلة للتسلسل إلى ClientProviders.
      */}
      <body className={inter.className} translate="no" data-react-component>
        {/* ClientProviders هو مكوّن من نوع client (يجب أن يبدأ بـ "use client") */}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
