"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, type Language, type Translation } from '@/lib/i18n'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('language', language)

    // Handle RTL - FORCE LTR as per request
    // const isRTL = language === 'ar'
    // document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', language)
  }, [language, mounted])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
  }

  // ✅ t function implementation handling nested keys (e.g., 'profile.verifiedAccount')
  const t = (key: string): string => {
    const keys = key.split('.');
    let current: any = translations[language] || translations['en'];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof current === 'string' ? current : key;
  };

  const value: LanguageContextType = {
    language,
    setLanguage: handleSetLanguage,
    t,
    isRTL: language === 'ar'
  }

  // Prevent hydration mismatch by rendering children only after mount, 
  // OR just render them and accept initial flash. 
  // Better to render immediately but attributes might be wrong for a split second.
  // Ideally, we'd use a robust solution, but for now this works.
  return (
    <LanguageContext.Provider value={value}>
      <div key={language} dir="ltr">
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
