// app/packages/layout.tsx
import type { ReactNode } from "react";

export default function PackagesLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        {/* ⛔️ منع الترجمة */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>
      <body translate="no" data-react-protected>
        {children}
      </body>
    </html>
  );
}
