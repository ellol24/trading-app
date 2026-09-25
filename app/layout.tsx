// app/layout.tsx
import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { BRAND_NAME, BRAND_DESCRIPTION } from "@/lib/brand";

const tajawal = Tajawal({ subsets: ["latin", "arabic"], weight: ["400", "500", "700", "900"] });

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Professional Trading Platform`,
  description: BRAND_DESCRIPTION,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className={tajawal.className}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
