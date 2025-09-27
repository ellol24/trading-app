"use client"

import React from "react"
import { GoogleTranslateFix } from "@/lib/google-translate-fix"

interface GoogleTranslateWrapperProps {
  children: React.ReactNode
  className?: string
  protectFromTranslation?: boolean
}

export function GoogleTranslateWrapper({
  children,
  className = "",
  protectFromTranslation = true,
}: GoogleTranslateWrapperProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (protectFromTranslation && wrapperRef.current) {
      GoogleTranslateFix.protectElement(wrapperRef.current)
    }
  }, [protectFromTranslation])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    // فحص وجود Google Translate
    const checkInterval = setInterval(() => {
      if (GoogleTranslateFix.checkGoogleTranslate()) {
        GoogleTranslateFix.startDOMProtection()
        clearInterval(checkInterval)
      }
    }, 1000)

    // تنظيف بعد 10 ثوان
    const timeout = setTimeout(() => clearInterval(checkInterval), 10000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className={`google-translate-safe ${className}`}
      data-react-component="true"
      translate={protectFromTranslation ? "no" : "yes"}
    >
      {children}
    </div>
  )
}

// Hook مخصص للحماية
export function useGoogleTranslateProtection() {
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const isGTActive = GoogleTranslateFix.checkGoogleTranslate()

    if (isGTActive) {
      GoogleTranslateFix.startDOMProtection()

      const cleanupInterval = setInterval(() => {
        GoogleTranslateFix.cleanupGoogleTranslateArtifacts()
      }, 5000)

      return () => {
        GoogleTranslateFix.stopDOMProtection()
        clearInterval(cleanupInterval)
      }
    }
  }, [])
}
