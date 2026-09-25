"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

type Language = "en" | "ar" | "fr" | "de" | "es" | "zh" | "ja" | "ru"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  isRTL: boolean
}

const translations = {
  en: {
    // Navigation & Core
    "nav.dashboard": "Dashboard",
    "nav.trading": "Trading",
    "nav.portfolio": "Portfolio",
    "nav.analytics": "Analytics",
    "nav.mining": "Mining",
    "nav.referrals": "Referrals",
    "nav.profile": "Profile",
    "nav.settings": "Settings",

    // Authentication
    "auth.welcome": "Welcome to TradePro",
    "auth.subtitle": "Professional Binary Options Trading Platform",
    "auth.login": "Sign In",
    "auth.register": "Create Account",
    "auth.email": "Email Address",
    "auth.password": "Password",
    "auth.username": "Username",
    "auth.phone": "Phone Number",
    "auth.country": "Country",
    "auth.forgot_password": "Forgot Password?",
    "auth.remember_me": "Remember me",
    "auth.or_continue_with": "Or continue with",
    "auth.already_have_account": "Already have an account?",
    "auth.dont_have_account": "Don't have an account?",
    "auth.terms_agreement": "I agree to the Terms of Service and Privacy Policy",

    // Trading
    "trading.live_trading": "Live Trading",
    "trading.demo_trading": "Demo Trading",
    "trading.asset": "Asset",
    "trading.amount": "Investment Amount",
    "trading.duration": "Duration",
    "trading.payout": "Payout",
    "trading.expected_return": "Expected Return",
    "trading.buy_higher": "Buy Higher",
    "trading.buy_lower": "Buy Lower",
    "trading.confirm_trade": "Confirm Trade",
    "trading.active_trades": "Active Trades",
    "trading.trade_history": "Trade History",
    "trading.market_analysis": "Market Analysis",

    // Dashboard
    "dashboard.total_balance": "Total Balance",
    "dashboard.available_balance": "Available Balance",
    "dashboard.invested_amount": "Invested Amount",
    "dashboard.total_profit": "Total Profit",
    "dashboard.today_profit": "Today's Profit",
    "dashboard.success_rate": "Success Rate",
    "dashboard.quick_actions": "Quick Actions",
    "dashboard.recent_trades": "Recent Trades",
    "dashboard.market_overview": "Market Overview",

    // Common
    "common.loading": "Loading...",
    "common.submit": "Submit",
    "common.cancel": "Cancel",
    "common.save": "Save Changes",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View Details",
    "common.search": "Search...",
    "common.filter": "Filter",
    "common.export": "Export",
    "common.refresh": "Refresh",
  },
  ar: {
    // Navigation & Core
    "nav.dashboard": "لوحة التحكم",
    "nav.trading": "التداول",
    "nav.portfolio": "المحفظة",
    "nav.analytics": "التحليلات",
    "nav.mining": "التعدين",
    "nav.referrals": "الإحالات",
    "nav.profile": "الملف الشخصي",
    "nav.settings": "الإعدادات",

    // Authentication
    "auth.welcome": "مرحباً بك في TradePro",
    "auth.subtitle": "منصة تداول الخيارات الثنائية المهنية",
    "auth.login": "تسجيل الدخول",
    "auth.register": "إنشاء حساب",
    "auth.email": "عنوان البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.username": "اسم المستخدم",
    "auth.phone": "رقم الهاتف",
    "auth.country": "البلد",
    "auth.forgot_password": "نسيت كلمة المرور؟",
    "auth.remember_me": "تذكرني",
    "auth.or_continue_with": "أو المتابعة باستخدام",
    "auth.already_have_account": "لديك حساب بالفعل؟",
    "auth.dont_have_account": "ليس لديك حساب؟",
    "auth.terms_agreement": "أوافق على شروط الخدمة وسياسة الخصوصية",

    // Trading
    "trading.live_trading": "التداول المباشر",
    "trading.demo_trading": "التداول التجريبي",
    "trading.asset": "الأصل",
    "trading.amount": "مبلغ الاستثمار",
    "trading.duration": "المدة",
    "trading.payout": "العائد",
    "trading.expected_return": "العائد المتوقع",
    "trading.buy_higher": "شراء أعلى",
    "trading.buy_lower": "شراء أقل",
    "trading.confirm_trade": "تأكيد الصفقة",
    "trading.active_trades": "الصفقات النشطة",
    "trading.trade_history": "تاريخ التداول",
    "trading.market_analysis": "تحليل السوق",

    // Dashboard
    "dashboard.total_balance": "الرصيد الإجمالي",
    "dashboard.available_balance": "الرصيد المتاح",
    "dashboard.invested_amount": "المبلغ المستثمر",
    "dashboard.total_profit": "إجمالي الربح",
    "dashboard.today_profit": "ربح اليوم",
    "dashboard.success_rate": "معدل النجاح",
    "dashboard.quick_actions": "إجراءات سريعة",
    "dashboard.recent_trades": "الصفقات الأخيرة",
    "dashboard.market_overview": "نظرة عامة على السوق",

    // Common
    "common.loading": "جاري التحميل...",
    "common.submit": "إرسال",
    "common.cancel": "إلغاء",
    "common.save": "حفظ التغييرات",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.view": "عرض التفاصيل",
    "common.search": "بحث...",
    "common.filter": "تصفية",
    "common.export": "تصدير",
    "common.refresh": "تحديث",
  },
  // Additional languages would be added here...
  fr: {
    "nav.dashboard": "Tableau de bord",
    "nav.trading": "Trading",
    "auth.welcome": "Bienvenue sur TradePro",
    "auth.login": "Se connecter",
    // ... more translations
  },
  de: {
    "nav.dashboard": "Dashboard",
    "nav.trading": "Handel",
    "auth.welcome": "Willkommen bei TradePro",
    "auth.login": "Anmelden",
    // ... more translations
  },
  es: {
    "nav.dashboard": "Panel de Control",
    "nav.trading": "Trading",
    "auth.welcome": "Bienvenido a TradePro",
    "auth.login": "Iniciar Sesión",
    // ... more translations
  },
  zh: {
    "nav.dashboard": "仪表板",
    "nav.trading": "交易",
    "auth.welcome": "欢迎来到TradePro",
    "auth.login": "登录",
    // ... more translations
  },
  ja: {
    "nav.dashboard": "ダッシュボード",
    "nav.trading": "取引",
    "auth.welcome": "TradeProへようこそ",
    "auth.login": "ログイン",
    // ... more translations
  },
  ru: {
    "nav.dashboard": "Панель управления",
    "nav.trading": "Торговля",
    "auth.welcome": "Добро пожаловать в TradePro",
    "auth.login": "Войти",
    // ... more translations
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage && Object.keys(translations).includes(savedLanguage)) {
      setLanguage(savedLanguage)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("language", language)
    const isRTL = ["ar"].includes(language)
    document.documentElement.dir = isRTL ? "rtl" : "ltr"
    document.documentElement.lang = language
  }, [language])

  const t = (key: string): string => {
    return translations[language][key as keyof (typeof translations)[typeof language]] || key
  }

  const isRTL = ["ar"].includes(language)

  return <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
