import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense, useEffect } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Xspy",
  description: "Created with v0",
  generator: "Xspy",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // client-only small helper to apply protection early on client mount
  function ProtectionScript() {
    useEffect(() => {
      try {
        // 1) Mark the document and key containers to not be translated
        document.documentElement.setAttribute("translate", "no")
        document.documentElement.setAttribute("data-react-protected", "true")
        // mark existing important areas (body and direct app container)
        document.body.setAttribute("translate", "no")
        document.body.setAttribute("data-react-protected", "true")

        // 2) Utility to mark newly added nodes (recursive)
        const markProtected = (node: Node) => {
          if (!(node instanceof Element)) return
          try {
            node.setAttribute?.("translate", "no")
            node.setAttribute?.("data-react-protected", "true")
          } catch {}
          // also protect children shallowly to avoid heavy recursion cost
          for (let i = 0; i < Math.min(20, node.children.length); i++) {
            const c = node.children[i]
            try {
              c.setAttribute?.("translate", "no")
              c.setAttribute?.("data-react-protected", "true")
            } catch {}
          }
        }

        // 3) Remove any injected google translate UI / nodes immediately when observed
        const removeGoogleNodes = (root: Node) => {
          if (!(root instanceof Element)) return
          // common classes/ids used by Google translate widget
          const selectors = [
            '[class*="goog-"]',
            '[id*="goog-"]',
            '[class*="google-translate"]',
            '[id*="google-translate"]',
            '#goog-gt-tt',
            '#goog-gt-tt',
            '.goog-te-banner-frame',
            '.goog-te-spinner',
          ]
          try {
            selectors.forEach((sel) => {
              root.querySelectorAll(sel).forEach((n) => {
                // remove only nodes that are not part of our app DOM
                if (n && n.parentElement) {
                  n.parentElement.removeChild(n)
                }
              })
            })
          } catch {}
        }

        // 4) Observe additions to the document to mark protection and remove unwanted nodes
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            // mark added nodes
            if (m.addedNodes && m.addedNodes.length) {
              m.addedNodes.forEach((n) => {
                markProtected(n)
                removeGoogleNodes(n)
              })
            }
            // if attributes changed to add translate or class, ensure translate="no"
            if (m.type === "attributes" && m.target instanceof Element) {
              try {
                if (m.attributeName === "class" || m.attributeName === "id") {
                  removeGoogleNodes(m.target)
                }
                // enforce translate="no" for protected containers
                if (m.target.closest && m.target.closest("[data-react-protected]")) {
                  (m.target as Element).setAttribute("translate", "no")
                }
              } catch {}
            }
          }
        })

        observer.observe(document.documentElement || document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "translate"],
        })

        // 5) periodic cleanup as a fallback
        const cleanupInterval = window.setInterval(() => {
          try {
            removeGoogleNodes(document)
          } catch {}
        }, 2500)

        // 6) ensure when page unloads we disconnect observer & interval
        window.addEventListener(
          "beforeunload",
          () => {
            try {
              observer.disconnect()
              clearInterval(cleanupInterval)
            } catch {}
          },
          { once: true }
        )
      } catch (e) {
        // non-blocking: don't break app if protection script errors
        // eslint-disable-next-line no-console
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
        {/* Protection runs as a client React effect (avoids unsafe prototype patches) */}
        <ProtectionScript />
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  )
}
