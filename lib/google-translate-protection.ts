"use client"

import type React from "react"

import { useEffect, useRef, useCallback } from "react"

// حماية من تداخل Google Translate مع React DOM
export function useGoogleTranslateProtection() {
  const protectionRef = useRef<boolean>(false)
  const observerRef = useRef<MutationObserver | null>(null)

  const protectDOM = useCallback(() => {
    if (typeof window === "undefined" || protectionRef.current) return

    protectionRef.current = true

    // منع Google Translate من تعديل عناصر React المهمة
    const protectElement = (element: Element) => {
      if (element.hasAttribute("data-react-protected")) return

      element.setAttribute("data-react-protected", "true")
      element.setAttribute("translate", "no")

      // حماية الأطفال المهمين
      const importantSelectors = [
        "[data-testid]",
        '[role="button"]',
        '[role="link"]',
        ".trading-card",
        '[class*="card"]',
        '[class*="button"]',
      ]

      importantSelectors.forEach((selector) => {
        element.querySelectorAll(selector).forEach((child) => {
          child.setAttribute("translate", "no")
          child.setAttribute("data-react-protected", "true")
        })
      })
    }

    // مراقبة تغييرات DOM
    observerRef.current = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // تنظيف عقد Google Translate المشكوك فيها
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement
            if (parent && parent.hasAttribute("data-react-protected")) {
              // إزالة text nodes غير مرغوب فيها من Google Translate
              const textContent = node.textContent || ""
              if (textContent.includes("Google Translate") || parent.querySelector('[class*="goog-"]')) {
                try {
               
                } catch (e) {
                  console.warn("[GoogleTranslate] Could not remove node:", e)
                }
              }
            }
          }
        })

        // حماية العناصر الجديدة
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            protectElement(node as Element)
          }
        })
      })
    })

    // بدء المراقبة
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    })

    // حماية العناصر الموجودة
    document.querySelectorAll('[data-testid], [role], .trading-card, [class*="card"]').forEach(protectElement)
  }, [])

  useEffect(() => {
    // تأخير الحماية للسماح لـ React بالتحميل أولاً
    const timer = setTimeout(protectDOM, 100)

    return () => {
      clearTimeout(timer)
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      protectionRef.current = false
    }
  }, [protectDOM])
}

// Hook لحماية المكونات الحساسة
export function useComponentProtection(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!ref.current) return

    const element = ref.current
    element.setAttribute("translate", "no")
    element.setAttribute("data-react-protected", "true")

    // منع Google Translate من تعديل المحتوى
    const style = element.style
    style.setProperty("--google-translate-protection", "active")

    return () => {
      element.removeAttribute("data-react-protected")
      element.removeAttribute("translate")
    }
  }, [ref])
}
