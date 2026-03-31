"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, type Language, type Translation } from '@/lib/i18n'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translation
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage)
    }
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)

    // أبقي الاتجاه ثابت LTR حتى مع تغيير اللغة
    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', lang)
  }

  const value: LanguageContextType = {
    language,
    setLanguage: handleSetLanguage,
    t: translations[language],
    isRTL: false // لأننا مش عايزين RTL
  }

  return (
    <LanguageContext.Provider value={value}>
      {/* key={language} لإجبار React يعيد البناء عند تغيير اللغة */}
      <div key={language}>
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
