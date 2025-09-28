export interface Translation {
  // Navigation
  nav: {
    home: string
    trading: string
    packages: string
    referrals: string
    profile: string
  }
  
  // Common
  common: {
    loading: string
    save: string
    cancel: string
    edit: string
    delete: string
    confirm: string
    back: string
    next: string
    submit: string
    search: string
    filter: string
    amount: string
    balance: string
    status: string
    date: string
    actions: string
    success: string
    error: string
    warning: string
    info: string
  }
  
  // Authentication
  auth: {
    login: string
    register: string
    email: string
    password: string
    confirmPassword: string
    username: string
    phone: string
    country: string
    firstName: string
    lastName: string
    forgotPassword: string
    rememberMe: string
    signIn: string
    signUp: string
    createAccount: string
    alreadyHaveAccount: string
    dontHaveAccount: string
    welcomeBack: string
    joinPlatform: string
    agreeToTerms: string
    termsOfService: string
    privacyPolicy: string
  }
  
  // Dashboard
  dashboard: {
    welcome: string
    totalBalance: string
    availableBalance: string
    investedAmount: string
    totalProfit: string
    successRate: string
    marketOverview: string
    quickActions: string
    recentTrades: string
    startTrading: string
    viewPortfolio: string
    analytics: string
    depositFunds: string
  }
  
  // Trading
  trading: {
    liveTrading: string
    selectAsset: string
    tradeSetup: string
    investmentAmount: string
    tradeDuration: string
    expectedReturn: string
    totalIfWin: string
    payoutRate: string
    higher: string
    lower: string
    executeTrade: string
    tradeActive: string
    livechart: string
    currentPrice: string
    minimumAmount: string
  }
  
  // Packages
  packages: {
    miningPackages: string
    availablePackages: string
    subscribeNow: string
    comingSoon: string
    duration: string
    roi: string
    investmentRange: string
    activePackages: string
    totalEarnings: string
    avgROI: string
    daysActive: string
  }
  
  // Referrals
  referrals: {
    referralProgram: string
    earnCommissions: string
    yourReferralLink: string
    totalInvites: string
    activeReferrals: string
    thisMonth: string
    lifetime: string
    commissionStructure: string
    howItWorks: string
    shareLink: string
    theyJoin: string
    youEarn: string
    referralNetwork: string
    leaderboard: string
    topReferrers: string
    referralHistory: string
  }
  
  // Profile
  profile: {
    profileSettings: string
    personalInformation: string
    security: string
    notifications: string
    activity: string
    editProfile: string
    saveChanges: string
    changePassword: string
    currentPassword: string
    newPassword: string
    twoFactorAuth: string
    emailNotifications: string
    smsNotifications: string
    tradingAlerts: string
    marketUpdates: string
    securityActivity: string
    kycStatus: string
    memberSince: string
  }
  
  // Admin
  admin: {
    adminDashboard: string
    userManagement: string
    packageManagement: string
    tradingControls: string
    depositManagement: string
    withdrawalManagement: string
    walletManagement: string
    platformControls: string
    systemHealth: string
    pendingActions: string
    systemAlerts: string
    totalUsers: string
    activeUsers: string
    totalDeposits: string
    platformRevenue: string
  }
}

// English translations
export const en: Translation = {
  nav: {
    home: "Home",
    trading: "Trading",
    packages: "Packages",
    referrals: "Referrals",
    profile: "Profile"
  },
  common: {
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    submit: "Submit",
    search: "Search",
    filter: "Filter",
    amount: "Amount",
    balance: "Balance",
    status: "Status",
    date: "Date",
    actions: "Actions",
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info"
  },
  auth: {
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    username: "Username",
    phone: "Phone",
    country: "Country",
    firstName: "First Name",
    lastName: "Last Name",
    forgotPassword: "Forgot Password?",
    rememberMe: "Remember Me",
    signIn: "Sign In",
    signUp: "Sign Up",
    createAccount: "Create Account",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    welcomeBack: "Welcome Back",
    joinPlatform: "Join the Platform",
    agreeToTerms: "I agree to the",
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy"
  },
  dashboard: {
    welcome: "Welcome back! Here's your trading overview",
    totalBalance: "Total Balance",
    availableBalance: "Available",
    investedAmount: "Invested",
    totalProfit: "Total Profit",
    successRate: "Success Rate",
    marketOverview: "Market Overview",
    quickActions: "Quick Actions",
    recentTrades: "Recent Trades",
    startTrading: "Start Trading",
    viewPortfolio: "View Portfolio",
    analytics: "Analytics",
    depositFunds: "Deposit Funds"
  },
  trading: {
    liveTrading: "Live Trading",
    selectAsset: "Select Trading Asset",
    tradeSetup: "Trade Setup",
    investmentAmount: "Investment Amount",
    tradeDuration: "Trade Duration",
    expectedReturn: "Expected Return",
    totalIfWin: "Total if Win",
    payoutRate: "Payout Rate",
    higher: "HIGHER",
    lower: "LOWER",
    executeTrade: "Execute Trade",
    tradeActive: "Trade Active",
    livechart: "Live Chart",
    currentPrice: "Current Price",
    minimumAmount: "Minimum amount"
  },
  packages: {
    miningPackages: "Mining Packages",
    availablePackages: "Available Packages",
    subscribeNow: "Subscribe Now",
    comingSoon: "Coming Soon",
    duration: "Duration",
    roi: "ROI",
    investmentRange: "Investment Range",
    activePackages: "Active Packages",
    totalEarnings: "Total Earnings",
    avgROI: "Avg ROI",
    daysActive: "Days Active"
  },
  referrals: {
    referralProgram: "Referral Program",
    earnCommissions: "Earn lifetime commissions from your referrals",
    yourReferralLink: "Your Referral Link",
    totalInvites: "Total Invites",
    activeReferrals: "Active",
    thisMonth: "This Month",
    lifetime: "Lifetime",
    commissionStructure: "Commission Structure",
    howItWorks: "How It Works",
    shareLink: "1. Share Your Link",
    theyJoin: "2. They Join & Trade",
    youEarn: "3. You Earn Commission",
    referralNetwork: "Your Referral Network",
    leaderboard: "Leaderboard",
    topReferrers: "Top Referrers Leaderboard",
    referralHistory: "Referral History"
  },
  profile: {
    profileSettings: "Profile Settings",
    personalInformation: "Personal Information",
    security: "Security",
    notifications: "Notifications",
    activity: "Activity",
    editProfile: "Edit Profile",
    saveChanges: "Save Changes",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    twoFactorAuth: "Two-Factor Authentication",
    emailNotifications: "Email Notifications",
    smsNotifications: "SMS Notifications",
    tradingAlerts: "Trading Alerts",
    marketUpdates: "Market Updates",
    securityActivity: "Security Activity",
    kycStatus: "KYC Status",
    memberSince: "Member Since"
  },
  admin: {
    adminDashboard: "Admin Dashboard",
    userManagement: "User Management",
    packageManagement: "Package Management",
    tradingControls: "Trading Controls",
    depositManagement: "Deposit Management",
    withdrawalManagement: "Withdrawal Management",
    walletManagement: "Wallet Management",
    platformControls: "Platform Controls",
    systemHealth: "System Health",
    pendingActions: "Pending Actions",
    systemAlerts: "System Alerts",
    totalUsers: "Total Users",
    activeUsers: "Active Users",
    totalDeposits: "Total Deposits",
    platformRevenue: "Platform Revenue"
  }
}

// Arabic translations (RTL)
export const ar: Translation = {
  nav: {
    home: "الرئيسية",
    trading: "التداول",
    packages: "الباقات",
    referrals: "الإحالات",
    profile: "الملف الشخصي"
  },
  common: {
    loading: "جاري التحميل...",
    save: "حفظ",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    confirm: "تأكيد",
    back: "رجوع",
    next: "التالي",
    submit: "إرسال",
    search: "بحث",
    filter: "تصفية",
    amount: "المبلغ",
    balance: "الرصيد",
    status: "الحالة",
    date: "التاريخ",
    actions: "الإجراءات",
    success: "نجح",
    error: "خطأ",
    warning: "تحذير",
    info: "معلومات"
  },
  auth: {
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    username: "اسم المستخدم",
    phone: "رقم الهاتف",
    country: "البلد",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    forgotPassword: "نسيت كلمة المرور؟",
    rememberMe: "تذكرني",
    signIn: "دخول",
    signUp: "إنشاء حساب",
    createAccount: "إنشاء حساب جديد",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    dontHaveAccount: "ليس لديك حساب؟",
    welcomeBack: "مرحباً بعودتك",
    joinPlatform: "انضم إلى المنصة",
    agreeToTerms: "أوافق على",
    termsOfService: "شروط الخدمة",
    privacyPolicy: "سياسة الخصوصية"
  },
  dashboard: {
    welcome: "مرحباً بعودتك! إليك نظرة عامة على تداولك",
    totalBalance: "إجمالي الرصيد",
    availableBalance: "متاح",
    investedAmount: "مستثمر",
    totalProfit: "إجمالي الربح",
    successRate: "معدل النجاح",
    marketOverview: "نظرة عامة على السوق",
    quickActions: "إجراءات سريعة",
    recentTrades: "التداولات الأخيرة",
    startTrading: "ابدأ التداول",
    viewPortfolio: "عرض المحفظة",
    analytics: "التحليلات",
    depositFunds: "إيداع الأموال"
  },
  trading: {
    liveTrading: "التداول المباشر",
    selectAsset: "اختر أصل التداول",
    tradeSetup: "إعداد التداول",
    investmentAmount: "مبلغ الاستثمار",
    tradeDuration: "مدة التداول",
    expectedReturn: "العائد المتوقع",
    totalIfWin: "المجموع في حالة الفوز",
    payoutRate: "معدل الدفع",
    higher: "أعلى",
    lower: "أقل",
    executeTrade: "تنفيذ التداول",
    tradeActive: "التداول نشط",
    livechart: "الرسم البياني المباشر",
    currentPrice: "السعر الحالي",
    minimumAmount: "الحد الأدنى للمبلغ"
  },
  packages: {
    miningPackages: "باقات التعدين",
    availablePackages: "الباقات المتاحة",
    subscribeNow: "اشترك الآن",
    comingSoon: "قريباً",
    duration: "المدة",
    roi: "العائد على الاستثمار",
    investmentRange: "نطاق الاستثمار",
    activePackages: "الباقات النشطة",
    totalEarnings: "إجمالي الأرباح",
    avgROI: "متوسط العائد",
    daysActive: "الأيام النشطة"
  },
  referrals: {
    referralProgram: "برنامج الإحالة",
    earnCommissions: "احصل على عمولات مدى الحياة من إحالاتك",
    yourReferralLink: "رابط الإحالة الخاص بك",
    totalInvites: "إجمالي الدعوات",
    activeReferrals: "نشط",
    thisMonth: "هذا الشهر",
    lifetime: "مدى الحياة",
    commissionStructure: "هيكل العمولة",
    howItWorks: "كيف يعمل",
    shareLink: "1. شارك رابطك",
    theyJoin: "2. ينضمون ويتداولون",
    youEarn: "3. تحصل على عمولة",
    referralNetwork: "شبكة الإحالة الخاصة بك",
    leaderboard: "لوحة المتصدرين",
    topReferrers: "أفضل المحيلين",
    referralHistory: "تاريخ الإحالات"
  },
  profile: {
    profileSettings: "إعدادات الملف الشخصي",
    personalInformation: "المعلومات الشخصية",
    security: "الأمان",
    notifications: "الإشعارات",
    activity: "النشاط",
    editProfile: "تعديل الملف الشخصي",
    saveChanges: "حفظ التغييرات",
    changePassword: "تغيير كلمة المرور",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    twoFactorAuth: "المصادقة الثنائية",
    emailNotifications: "إشعارات البريد الإلكتروني",
    smsNotifications: "إشعارات الرسائل النصية",
    tradingAlerts: "تنبيهات التداول",
    marketUpdates: "تحديثات السوق",
    securityActivity: "نشاط الأمان",
    kycStatus: "حالة التحقق من الهوية",
    memberSince: "عضو منذ"
  },
  admin: {
    adminDashboard: "لوحة تحكم المدير",
    userManagement: "إدارة المستخدمين",
    packageManagement: "إدارة الباقات",
    tradingControls: "ضوابط التداول",
    depositManagement: "إدارة الودائع",
    withdrawalManagement: "إدارة السحوبات",
    walletManagement: "إدارة المحافظ",
    platformControls: "ضوابط المنصة",
    systemHealth: "صحة النظام",
    pendingActions: "الإجراءات المعلقة",
    systemAlerts: "تنبيهات النظام",
    totalUsers: "إجمالي المستخدمين",
    activeUsers: "المستخدمون النشطون",
    totalDeposits: "إجمالي الودائع",
    platformRevenue: "إيرادات المنصة"
  }
}

// French translations
export const fr: Translation = {
  nav: {
    home: "Accueil",
    trading: "Trading",
    packages: "Packages",
    referrals: "Parrainages",
    profile: "Profil"
  },
  common: {
    loading: "Chargement...",
    save: "Enregistrer",
    cancel: "Annuler",
    edit: "Modifier",
    delete: "Supprimer",
    confirm: "Confirmer",
    back: "Retour",
    next: "Suivant",
    submit: "Soumettre",
    search: "Rechercher",
    filter: "Filtrer",
    amount: "Montant",
    balance: "Solde",
    status: "Statut",
    date: "Date",
    actions: "Actions",
    success: "Succès",
    error: "Erreur",
    warning: "Avertissement",
    info: "Info"
  },
  auth: {
    login: "Connexion",
    register: "S'inscrire",
    email: "Email",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    username: "Nom d'utilisateur",
    phone: "Téléphone",
    country: "Pays",
    firstName: "Prénom",
    lastName: "Nom de famille",
    forgotPassword: "Mot de passe oublié?",
    rememberMe: "Se souvenir de moi",
    signIn: "Se connecter",
    signUp: "S'inscrire",
    createAccount: "Créer un compte",
    alreadyHaveAccount: "Vous avez déjà un compte?",
    dontHaveAccount: "Vous n'avez pas de compte?",
    welcomeBack: "Bon retour",
    joinPlatform: "Rejoindre la plateforme",
    agreeToTerms: "J'accepte les",
    termsOfService: "Conditions de service",
    privacyPolicy: "Politique de confidentialité"
  },
  dashboard: {
    welcome: "Bon retour! Voici votre aperçu de trading",
    totalBalance: "Solde total",
    availableBalance: "Disponible",
    investedAmount: "Investi",
    totalProfit: "Profit total",
    successRate: "Taux de réussite",
    marketOverview: "Aperçu du marché",
    quickActions: "Actions rapides",
    recentTrades: "Trades récents",
    startTrading: "Commencer le trading",
    viewPortfolio: "Voir le portefeuille",
    analytics: "Analyses",
    depositFunds: "Déposer des fonds"
  },
  trading: {
    liveTrading: "Trading en direct",
    selectAsset: "Sélectionner l'actif de trading",
    tradeSetup: "Configuration du trade",
    investmentAmount: "Montant d'investissement",
    tradeDuration: "Durée du trade",
    expectedReturn: "Retour attendu",
    totalIfWin: "Total si victoire",
    payoutRate: "Taux de paiement",
    higher: "PLUS HAUT",
    lower: "PLUS BAS",
    executeTrade: "Exécuter le trade",
    tradeActive: "Trade actif",
    livechart: "Graphique en direct",
    currentPrice: "Prix actuel",
    minimumAmount: "Montant minimum"
  },
  packages: {
    miningPackages: "Packages de minage",
    availablePackages: "Packages disponibles",
    subscribeNow: "S'abonner maintenant",
    comingSoon: "Bientôt disponible",
    duration: "Durée",
    roi: "ROI",
    investmentRange: "Gamme d'investissement",
    activePackages: "Packages actifs",
    totalEarnings: "Gains totaux",
    avgROI: "ROI moyen",
    daysActive: "Jours actifs"
  },
  referrals: {
    referralProgram: "Programme de parrainage",
    earnCommissions: "Gagnez des commissions à vie de vos parrainages",
    yourReferralLink: "Votre lien de parrainage",
    totalInvites: "Total des invitations",
    activeReferrals: "Actif",
    thisMonth: "Ce mois",
    lifetime: "À vie",
    commissionStructure: "Structure de commission",
    howItWorks: "Comment ça marche",
    shareLink: "1. Partagez votre lien",
    theyJoin: "2. Ils rejoignent et tradent",
    youEarn: "3. Vous gagnez une commission",
    referralNetwork: "Votre réseau de parrainage",
    leaderboard: "Classement",
    topReferrers: "Top des parrains",
    referralHistory: "Historique des parrainages"
  },
  profile: {
    profileSettings: "Paramètres du profil",
    personalInformation: "Informations personnelles",
    security: "Sécurité",
    notifications: "Notifications",
    activity: "Activité",
    editProfile: "Modifier le profil",
    saveChanges: "Enregistrer les modifications",
    changePassword: "Changer le mot de passe",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    twoFactorAuth: "Authentification à deux facteurs",
    emailNotifications: "Notifications par email",
    smsNotifications: "Notifications SMS",
    tradingAlerts: "Alertes de trading",
    marketUpdates: "Mises à jour du marché",
    securityActivity: "Activité de sécurité",
    kycStatus: "Statut KYC",
    memberSince: "Membre depuis"
  },
  admin: {
    adminDashboard: "Tableau de bord admin",
    userManagement: "Gestion des utilisateurs",
    packageManagement: "Gestion des packages",
    tradingControls: "Contrôles de trading",
    depositManagement: "Gestion des dépôts",
    withdrawalManagement: "Gestion des retraits",
    walletManagement: "Gestion des portefeuilles",
    platformControls: "Contrôles de la plateforme",
    systemHealth: "Santé du système",
    pendingActions: "Actions en attente",
    systemAlerts: "Alertes système",
    totalUsers: "Total des utilisateurs",
    activeUsers: "Utilisateurs actifs",
    totalDeposits: "Total des dépôts",
    platformRevenue: "Revenus de la plateforme"
  }
}

// German translations
export const de: Translation = {
  nav: {
    home: "Startseite",
    trading: "Trading",
    packages: "Pakete",
    referrals: "Empfehlungen",
    profile: "Profil"
  },
  common: {
    loading: "Laden...",
    save: "Speichern",
    cancel: "Abbrechen",
    edit: "Bearbeiten",
    delete: "Löschen",
    confirm: "Bestätigen",
    back: "Zurück",
    next: "Weiter",
    submit: "Senden",
    search: "Suchen",
    filter: "Filtern",
    amount: "Betrag",
    balance: "Guthaben",
    status: "Status",
    date: "Datum",
    actions: "Aktionen",
    success: "Erfolg",
    error: "Fehler",
    warning: "Warnung",
    info: "Info"
  },
  auth: {
    login: "Anmelden",
    register: "Registrieren",
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    username: "Benutzername",
    phone: "Telefon",
    country: "Land",
    firstName: "Vorname",
    lastName: "Nachname",
    forgotPassword: "Passwort vergessen?",
    rememberMe: "Angemeldet bleiben",
    signIn: "Anmelden",
    signUp: "Registrieren",
    createAccount: "Konto erstellen",
    alreadyHaveAccount: "Haben Sie bereits ein Konto?",
    dontHaveAccount: "Haben Sie kein Konto?",
    welcomeBack: "Willkommen zurück",
    joinPlatform: "Der Plattform beitreten",
    agreeToTerms: "Ich stimme den",
    termsOfService: "Nutzungsbedingungen",
    privacyPolicy: "Datenschutzrichtlinie"
  },
  dashboard: {
    welcome: "Willkommen zurück! Hier ist Ihre Trading-Übersicht",
    totalBalance: "Gesamtguthaben",
    availableBalance: "Verfügbar",
    investedAmount: "Investiert",
    totalProfit: "Gesamtgewinn",
    successRate: "Erfolgsrate",
    marketOverview: "Marktübersicht",
    quickActions: "Schnellaktionen",
    recentTrades: "Aktuelle Trades",
    startTrading: "Trading starten",
    viewPortfolio: "Portfolio anzeigen",
    analytics: "Analysen",
    depositFunds: "Geld einzahlen"
  },
  trading: {
    liveTrading: "Live Trading",
    selectAsset: "Trading-Asset auswählen",
    tradeSetup: "Trade-Setup",
    investmentAmount: "Investitionsbetrag",
    tradeDuration: "Trade-Dauer",
    expectedReturn: "Erwartete Rendite",
    totalIfWin: "Gesamt bei Gewinn",
    payoutRate: "Auszahlungsrate",
    higher: "HÖHER",
    lower: "NIEDRIGER",
    executeTrade: "Trade ausführen",
    tradeActive: "Trade aktiv",
    livechart: "Live-Chart",
    currentPrice: "Aktueller Preis",
    minimumAmount: "Mindestbetrag"
  },
  packages: {
    miningPackages: "Mining-Pakete",
    availablePackages: "Verfügbare Pakete",
    subscribeNow: "Jetzt abonnieren",
    comingSoon: "Demnächst",
    duration: "Dauer",
    roi: "ROI",
    investmentRange: "Investitionsbereich",
    activePackages: "Aktive Pakete",
    totalEarnings: "Gesamteinnahmen",
    avgROI: "Durchschnittlicher ROI",
    daysActive: "Aktive Tage"
  },
  referrals: {
    referralProgram: "Empfehlungsprogramm",
    earnCommissions: "Verdienen Sie lebenslange Provisionen von Ihren Empfehlungen",
    yourReferralLink: "Ihr Empfehlungslink",
    totalInvites: "Gesamte Einladungen",
    activeReferrals: "Aktiv",
    thisMonth: "Diesen Monat",
    lifetime: "Lebenslang",
    commissionStructure: "Provisionsstruktur",
    howItWorks: "Wie es funktioniert",
    shareLink: "1. Teilen Sie Ihren Link",
    theyJoin: "2. Sie treten bei und handeln",
    youEarn: "3. Sie verdienen Provision",
    referralNetwork: "Ihr Empfehlungsnetzwerk",
    leaderboard: "Bestenliste",
    topReferrers: "Top-Empfehler",
    referralHistory: "Empfehlungshistorie"
  },
  profile: {
    profileSettings: "Profileinstellungen",
    personalInformation: "Persönliche Informationen",
    security: "Sicherheit",
    notifications: "Benachrichtigungen",
    activity: "Aktivität",
    editProfile: "Profil bearbeiten",
    saveChanges: "Änderungen speichern",
    changePassword: "Passwort ändern",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    twoFactorAuth: "Zwei-Faktor-Authentifizierung",
    emailNotifications: "E-Mail-Benachrichtigungen",
    smsNotifications: "SMS-Benachrichtigungen",
    tradingAlerts: "Trading-Warnungen",
    marketUpdates: "Markt-Updates",
    securityActivity: "Sicherheitsaktivität",
    kycStatus: "KYC-Status",
    memberSince: "Mitglied seit"
  },
  admin: {
    adminDashboard: "Admin-Dashboard",
    userManagement: "Benutzerverwaltung",
    packageManagement: "Paketverwaltung",
    tradingControls: "Trading-Kontrollen",
    depositManagement: "Einzahlungsverwaltung",
    withdrawalManagement: "Abhebungsverwaltung",
    walletManagement: "Wallet-Verwaltung",
    platformControls: "Plattform-Kontrollen",
    systemHealth: "Systemgesundheit",
    pendingActions: "Ausstehende Aktionen",
    systemAlerts: "Systemwarnungen",
    totalUsers: "Gesamte Benutzer",
    activeUsers: "Aktive Benutzer",
    totalDeposits: "Gesamte Einzahlungen",
    platformRevenue: "Plattform-Einnahmen"
  }
}

export const translations = {
  en,
  ar,
  fr,
  de
}

export type Language = keyof typeof translations
