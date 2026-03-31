// app/layout.tsx
import type { Metadata } from "next";

import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { BRAND_NAME, BRAND_DESCRIPTION } from "@/lib/brand";



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
    <html lang="en" translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
      </head>
      <body className="font-sans antialiased" translate="no">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
