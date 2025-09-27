"use client"

import React from "react"

export class GoogleTranslateFix {
  private static observer: MutationObserver | null = null
  private static isGoogleTranslateActive = false

  // فحص إذا كان Google Translate نشط
  static checkGoogleTranslate(): boolean {
    if (typeof window === "undefined") return false

    // فحص وجود عناصر Google Translate
    const gtElements = document.querySelectorAll('[class*="goog-te"], [id*="google_translate"], .skiptranslate')
    const gtScripts = document.querySelectorAll('script[src*="translate.google"]')

    this.isGoogleTranslateActive = gtElements.length > 0 || gtScripts.length > 0
    return this.isGoogleTranslateActive
  }

  // حماية العناصر من Google Translate
  static protectElement(element: HTMLElement): void {
    if (!element) return

    // إضافة class لتجاهل الترجمة
    element.classList.add("notranslate", "skiptranslate")
    element.setAttribute("translate", "no")

    // حماية العناصر الفرعية المهمة
    const criticalElements = element.querySelectorAll('button, input, select, textarea, [role="button"]')
    criticalElements.forEach((el) => {
      el.classList.add("notranslate", "skiptranslate")
      el.setAttribute("translate", "no")
    })
  }

  // مراقبة تغييرات DOM من Google Translate
  static startDOMProtection(): void {
    if (typeof window === "undefined" || this.observer) return

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // تجاهل التغييرات من Google Translate
        if (mutation.target && (mutation.target as Element).closest?.('[class*="goog-te"]')) {
          return
        }

        // إعادة حماية العناصر الجديدة
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (element.hasAttribute("data-react-component")) {
              this.protectElement(element)
            }
          }
        })
      })
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id"],
    })
  }

  // إيقاف المراقبة
  static stopDOMProtection(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  }

  // تنظيف آثار Google Translate
  static cleanupGoogleTranslateArtifacts(): void {
    if (typeof window === "undefined") return

    // إزالة العناصر المضافة من Google Translate
    const gtArtifacts = document.querySelectorAll(".goog-te-banner-frame, .goog-te-menu-frame")
    gtArtifacts.forEach((el) => el.remove())

    // تنظيف الـ styles المضافة
    const gtStyles = document.querySelectorAll('style[id*="goog-te"]')
    gtStyles.forEach((style) => style.remove())
  }
}

// Hook للحماية من Google Translate
export function useGoogleTranslateProtection() {
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const isGTActive = GoogleTranslateFix.checkGoogleTranslate()

    let cleanupInterval: NodeJS.Timeout | null = null

    if (isGTActive) {
      GoogleTranslateFix.startDOMProtection()

      // تنظيف دوري
      cleanupInterval = setInterval(() => {
        GoogleTranslateFix.cleanupGoogleTranslateArtifacts()
      }, 5000)
    }

    return () => {
      GoogleTranslateFix.stopDOMProtection()
      if (cleanupInterval) {
        clearInterval(cleanupInterval)
      }
    }
  }, [])
}
