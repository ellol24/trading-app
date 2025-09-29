"use client"

import { useEffect } from "react"

export default function ProtectionScript() {
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
