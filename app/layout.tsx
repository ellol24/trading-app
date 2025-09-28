"use client"

import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense, useEffect } from "react"
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
  // client-only helper to apply protection early
  function ProtectionScript() {
    useEffect(() => {
      try {
        document.documentElement.setAttribute("translate", "no")
        document.body.setAttribute("translate", "no")
        document.body.setAttribute("data-react-protected", "true")

        const removeGoogleNodes = (root: Node) => {
          if (!(root instanceof Element)) return
          const selectors = [
            '[class*="goog-"]',
            '[id*="goog-"]',
            '[class*="google-translate"]',
            '[id*="google-translate"]',
            '#goog-gt-tt',
            '.goog-te-banner-frame',
            '.goog-te-spinner',
          ]
          selectors.forEach((sel) => {
            root.querySelectorAll(sel).forEach((n) => {
              n.parentElement?.removeChild(n)
            })
          })
        }

        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.addedNodes) {
              m.addedNodes.forEach((n) => removeGoogleNodes(n))
            }
            if (m.type === "attributes" && m.target instanceof Element) {
              removeGoogleNodes(m.target)
            }
          }
        })

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "translate"],
        })

        const cleanupInterval = window.setInterval(() => {
          removeGoogleNodes(document)
        }, 2500)

        window.addEventListener(
          "beforeunload",
          () => {
            observer.disconnect()
            clearInterval(cleanupInterval)
          },
          { once: true }
        )
      } catch (e) {
        console.warn("[TranslateProtection] init failed:", e)
      }
    }, [])

    return null
  }

  return (
    <html lang="en">
      <head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="robots" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`} data-react-component>
        <ProtectionScript />
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  )
}
