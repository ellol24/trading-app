import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  // منع Google Translate من تعديل عناصر معينة
                  const originalInsertBefore = Node.prototype.insertBefore;
                  const originalRemoveChild = Node.prototype.removeChild;
                  const originalReplaceChild = Node.prototype.replaceChild;
                  
                  // تتبع العمليات المشبوهة
                  let suspiciousOperations = 0;
                  const MAX_SUSPICIOUS = 10;
                  
                  Node.prototype.insertBefore = function(newNode, referenceNode) {
                    try {
                      // فحص إذا كان التعديل من Google Translate
                      if (this.closest && this.closest('[data-react-component]') && 
                          (newNode.className && newNode.className.includes('goog-te'))) {
                        return newNode;
                      }
                      
                      // فحص العمليات المشبوهة
                      if (newNode.nodeType === Node.TEXT_NODE && 
                          this.hasAttribute && this.hasAttribute('data-react-protected')) {
                        suspiciousOperations++;
                        if (suspiciousOperations > MAX_SUSPICIOUS) {
                          console.warn('[GoogleTranslate] Too many suspicious operations, blocking');
                          return newNode;
                        }
                      }
                      
                      return originalInsertBefore.call(this, newNode, referenceNode);
                    } catch (e) {
                      console.warn('[GoogleTranslate] DOM manipulation prevented:', e);
                      return newNode;
                    }
                  };
                  
                  Node.prototype.removeChild = function(child) {
                    try {
                      // فحص إذا كان التعديل من Google Translate
                      if (this.closest && this.closest('[data-react-component]') && 
                          (child.className && child.className.includes('goog-te'))) {
                        return child;
                      }
                      
                      // حماية العناصر المحمية
                      if (child.hasAttribute && child.hasAttribute('data-react-protected')) {
                        console.warn('[GoogleTranslate] Preventing removal of protected element');
                        return child;
                      }
                      
                      return originalRemoveChild.call(this, child);
                    } catch (e) {
                      console.warn('[GoogleTranslate] DOM removal prevented:', e);
                      return child;
                    }
                  };
                  
                  Node.prototype.replaceChild = function(newChild, oldChild) {
                    try {
                      // حماية العناصر المحمية من الاستبدال
                      if (oldChild.hasAttribute && oldChild.hasAttribute('data-react-protected')) {
                        console.warn('[GoogleTranslate] Preventing replacement of protected element');
                        return oldChild;
                      }
                      
                      return originalReplaceChild.call(this, newChild, oldChild);
                    } catch (e) {
                      console.warn('[GoogleTranslate] DOM replacement prevented:', e);
                      return oldChild;
                    }
                  };
                  
                  // إعادة تعيين العداد كل 5 ثوان
                  setInterval(() => {
                    suspiciousOperations = Math.max(0, suspiciousOperations - 1);
                  }, 5000);
                }
              })();
            `,
          }}
        />
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  )
}
