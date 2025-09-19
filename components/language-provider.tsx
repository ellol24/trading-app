"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

type Language = "en" | "ar" | "fr" | "de"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.trading": "Trading",
    "nav.packages": "Packages",
    "nav.referrals": "Referrals",
    "nav.profile": "Profile",

    // Auth
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.username": "Username",
    "auth.phone": "Phone Number",
    "auth.country": "Country",
    "auth.forgot_password": "Forgot Password?",

    // Home
    "home.wallet_balance": "Wallet Balance",
    "home.active_trades": "Active Trades",
    "home.package_roi": "Package ROI",
    "home.daily_profit": "Daily Profit",
    "home.trade_now": "Trade Now",
    "home.subscribe_package": "Subscribe to Package",
    "home.deposit": "Deposit",
    "home.withdraw": "Withdraw",

    // Trading
    "trading.amount": "Amount",
    "trading.duration": "Duration",
    "trading.expected_return": "Expected Return",
    "trading.buy": "Buy",
    "trading.sell": "Sell",
    "trading.confirm": "Confirm",

    // Common
    "common.loading": "Loading...",
    "common.submit": "Submit",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View",
  },
  ar: {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.trading": "التداول",
    "nav.packages": "الباقات",
    "nav.referrals": "الإحالات",
    "nav.profile": "الملف الشخصي",

    // Auth
    "auth.login": "تسجيل الدخول",
    "auth.register": "إنشاء حساب",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.username": "اسم المستخدم",
    "auth.phone": "رقم الهاتف",
    "auth.country": "البلد",
    "auth.forgot_password": "نسيت كلمة المرور؟",

    // Home
    "home.wallet_balance": "رصيد المحفظة",
    "home.active_trades": "الصفقات النشطة",
    "home.package_roi": "عائد الباقة",
    "home.daily_profit": "الربح اليومي",
    "home.trade_now": "تداول الآن",
    "home.subscribe_package": "اشترك في باقة",
    "home.deposit": "إيداع",
    "home.withdraw": "سحب",

    // Trading
    "trading.amount": "المبلغ",
    "trading.duration": "المدة",
    "trading.expected_return": "العائد المتوقع",
    "trading.buy": "شراء",
    "trading.sell": "بيع",
    "trading.confirm": "تأكيد",

    // Common
    "common.loading": "جاري التحميل...",
    "common.submit": "إرسال",
    "common.cancel": "إلغاء",
    "common.save": "حفظ",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.view": "عرض",
  },
  fr: {
    // Navigation
    "nav.home": "Accueil",
    "nav.trading": "Trading",
    "nav.packages": "Packages",
    "nav.referrals": "Parrainages",
    "nav.profile": "Profil",

    // Auth
    "auth.login": "Connexion",
    "auth.register": "S'inscrire",
    "auth.email": "Email",
    "auth.password": "Mot de passe",
    "auth.username": "Nom d'utilisateur",
    "auth.phone": "Numéro de téléphone",
    "auth.country": "Pays",
    "auth.forgot_password": "Mot de passe oublié?",

    // Home
    "home.wallet_balance": "Solde du portefeuille",
    "home.active_trades": "Trades actifs",
    "home.package_roi": "ROI du package",
    "home.daily_profit": "Profit quotidien",
    "home.trade_now": "Trader maintenant",
    "home.subscribe_package": "S'abonner au package",
    "home.deposit": "Dépôt",
    "home.withdraw": "Retrait",

    // Trading
    "trading.amount": "Montant",
    "trading.duration": "Durée",
    "trading.expected_return": "Retour attendu",
    "trading.buy": "Acheter",
    "trading.sell": "Vendre",
    "trading.confirm": "Confirmer",

    // Common
    "common.loading": "Chargement...",
    "common.submit": "Soumettre",
    "common.cancel": "Annuler",
    "common.save": "Sauvegarder",
    "common.delete": "Supprimer",
    "common.edit": "Modifier",
    "common.view": "Voir",
  },
  de: {
    // Navigation
    "nav.home": "Startseite",
    "nav.trading": "Handel",
    "nav.packages": "Pakete",
    "nav.referrals": "Empfehlungen",
    "nav.profile": "Profil",

    // Auth
    "auth.login": "Anmelden",
    "auth.register": "Registrieren",
    "auth.email": "E-Mail",
    "auth.password": "Passwort",
    "auth.username": "Benutzername",
    "auth.phone": "Telefonnummer",
    "auth.country": "Land",
    "auth.forgot_password": "Passwort vergessen?",

    // Home
    "home.wallet_balance": "Wallet-Guthaben",
    "home.active_trades": "Aktive Trades",
    "home.package_roi": "Paket ROI",
    "home.daily_profit": "Täglicher Gewinn",
    "home.trade_now": "Jetzt handeln",
    "home.subscribe_package": "Paket abonnieren",
    "home.deposit": "Einzahlung",
    "home.withdraw": "Abhebung",

    // Trading
    "trading.amount": "Betrag",
    "trading.duration": "Dauer",
    "trading.expected_return": "Erwartete Rendite",
    "trading.buy": "Kaufen",
    "trading.sell": "Verkaufen",
    "trading.confirm": "Bestätigen",

    // Common
    "common.loading": "Laden...",
    "common.submit": "Senden",
    "common.cancel": "Abbrechen",
    "common.save": "Speichern",
    "common.delete": "Löschen",
    "common.edit": "Bearbeiten",
    "common.view": "Anzeigen",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage && ["en", "ar", "fr", "de"].includes(savedLanguage)) {
      setLanguage(savedLanguage)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("language", language)
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = language
  }, [language])

  const t = (key: string): string => {
    return translations[language][key as keyof (typeof translations)[typeof language]] || key
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
