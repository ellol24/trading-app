"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  X,
  CheckCheck,
  Info,
  AlertTriangle,
  Zap,
  Gift,
  Megaphone,
  CheckCircle,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/language-context";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
};

// Subtle Web Audio Chime on incoming realtime notifications
function playNotificationChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "broadcasts">("all");
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number }>({
    top: 60,
    right: 20,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const { language } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Localized strings dictionary for bell component
  const i18n = {
    title: {
      en: "Notifications",
      ar: "الإشعارات",
      fr: "Notifications",
      de: "Benachrichtigungen",
    },
    markAllRead: {
      en: "Mark all read",
      ar: "تحديد الكل كمقروء",
      fr: "Tout marquer lu",
      de: "Alle gelesen",
    },
    newBadge: {
      en: "new",
      ar: "جديد",
      fr: "nouveau",
      de: "neu",
    },
    allTab: {
      en: "All",
      ar: "الكل",
      fr: "Tout",
      de: "Alle",
    },
    unreadTab: {
      en: "Unread",
      ar: "غير مقروءة",
      fr: "Non lus",
      de: "Ungelesen",
    },
    announcementsTab: {
      en: "Announcements",
      ar: "الإعلانات",
      fr: "Annonces",
      de: "Mitteilungen",
    },
    emptyTitle: {
      en: "No notifications yet",
      ar: "لا توجد إشعارات حتى الآن",
      fr: "Aucune notification",
      de: "Keine Benachrichtigungen",
    },
    emptyDesc: {
      en: "We'll notify you when important trading sessions, rewards, or platform updates arrive.",
      ar: "سنقوم بتنبيهك فور اقتراب جلسات التداول، المكافآت، أو تحديثات المنصة الهامة.",
      fr: "Nous vous avertirons dès l'arrivée des sessions de trading, des récompenses ou des mises à jour.",
      de: "Wir benachrichtigen Sie bei wichtigen Trading-Runden, Prämien oder Plattform-Updates.",
    },
    loading: {
      en: "Loading notifications...",
      ar: "جاري تحميل الإشعارات...",
      fr: "Chargement des notifications...",
      de: "Benachrichtigungen laden...",
    },
    justNow: {
      en: "Just now",
      ar: "الآن",
      fr: "À l'instant",
      de: "Gerade eben",
    },
    minAgo: {
      en: "m ago",
      ar: "د مضت",
      fr: "min",
      de: "m her",
    },
    hrAgo: {
      en: "h ago",
      ar: "س مضت",
      fr: "h",
      de: "Std. her",
    },
    dayAgo: {
      en: "d ago",
      ar: "يوم مضى",
      fr: "j",
      de: "Tage her",
    },
    viewDetails: {
      en: "Tap to read full message",
      ar: "اضغط لقراءة الرسالة كاملة",
      fr: "Appuyez pour lire le message",
      de: "Tippen zum Lesen",
    },
    close: {
      en: "Close",
      ar: "إغلاق",
      fr: "Fermer",
      de: "Schließen",
    },
    goToTrading: {
      en: "Go to Live Trading",
      ar: "الانتقال إلى التداول المباشر",
      fr: "Aller au Trading en direct",
      de: "Zum Live-Trading",
    },
    goToDeposit: {
      en: "Make a Deposit",
      ar: "شحن الرصيد الآن",
      fr: "Faire un dépôt",
      de: "Einzahlung tätigen",
    },
    goToReferrals: {
      en: "Claim Referral Rewards",
      ar: "المكافآت والإحالات",
      fr: "Récompenses de parrainage",
      de: "Empfehlungsprämien ansehen",
    },
    badgeWelcome: {
      en: "Welcome",
      ar: "ترحيب",
      fr: "Bienvenue",
      de: "Willkommen",
    },
    badgeTrading: {
      en: "Trading Session",
      ar: "جلسة تداول",
      fr: "Session Trading",
      de: "Trading-Runde",
    },
    badgeBroadcast: {
      en: "Announcement",
      ar: "إعلان عام",
      fr: "Annonce",
      de: "Mitteilung",
    },
    badgeSuccess: {
      en: "Reward / Success",
      ar: "مكافأة / نجاح",
      fr: "Récompense",
      de: "Prämie / Erfolg",
    },
  };

  const getLang = () => (language && ["en", "ar", "fr", "de"].includes(language) ? language : "en") as "en" | "ar" | "fr" | "de";

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Realtime subscription with sound chime and toast
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          playNotificationChime();

          const activeLang = getLang();
          const trTitle = n.metadata?.translations?.[activeLang]?.title || n.title;
          const trMsg = n.metadata?.translations?.[activeLang]?.message || n.message;

          toast.info(trTitle, {
            description: trMsg.slice(0, 90),
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, language]);

  // Update popup position when button is clicked
  const handleOpenToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
      fetchNotifications();
    }
    setOpen((v) => !v);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = async (n: Notification) => {
    setSelectedNotif(n);
    if (!n.read) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
    }
  };

  // Content localized based on current language
  const getContent = (n: Notification) => {
    const curLang = getLang();
    const tr = n.metadata?.translations?.[curLang];
    return {
      title: tr?.title || n.title,
      message: tr?.message || n.message,
    };
  };

  const timeAgo = (iso: string) => {
    const curLang = getLang();
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return i18n.justNow[curLang];
    if (mins < 60) return `${mins}${i18n.minAgo[curLang]}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${i18n.hrAgo[curLang]}`;
    const days = Math.floor(hrs / 24);
    return `${days}${i18n.dayAgo[curLang]}`;
  };

  // Filtered notifications
  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.read;
    if (activeTab === "broadcasts")
      return ["broadcast", "trading_alert", "welcome"].includes(n.type);
    return true;
  });

  const curLang = getLang();

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "welcome":
        return {
          icon: <Gift className="w-4 h-4 text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
          glow: "from-emerald-500/20 to-transparent",
          badge: i18n.badgeWelcome[curLang],
        };
      case "trading_alert":
        return {
          icon: <Zap className="w-4 h-4 text-amber-400" />,
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
          glow: "from-amber-500/20 to-transparent",
          badge: i18n.badgeTrading[curLang],
        };
      case "broadcast":
        return {
          icon: <Megaphone className="w-4 h-4 text-purple-400" />,
          bg: "bg-purple-500/10 border-purple-500/30 text-purple-300",
          glow: "from-purple-500/20 to-transparent",
          badge: i18n.badgeBroadcast[curLang],
        };
      case "success":
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-400" />,
          bg: "bg-green-500/10 border-green-500/30 text-green-300",
          glow: "from-green-500/20 to-transparent",
          badge: i18n.badgeSuccess[curLang],
        };
      case "warning":
      case "alert":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
          glow: "from-rose-500/20 to-transparent",
          badge: "Alert",
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-blue-400" />,
          bg: "bg-blue-500/10 border-blue-500/30 text-blue-300",
          glow: "from-blue-500/20 to-transparent",
          badge: "Info",
        };
    }
  };

  return (
    <>
      {/* ── Bell Trigger Button ── */}
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        onClick={handleOpenToggle}
        className={cn(
          "relative p-2.5 rounded-full transition-all duration-200 border",
          open
            ? "bg-blue-600/25 border-blue-500/60 text-white shadow-lg shadow-blue-500/20"
            : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 text-slate-200 hover:text-white"
        )}
      >
        <Bell className="w-5 h-5 transition-transform active:scale-95" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[10px] font-bold text-white shadow-md shadow-red-500/40 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Render Portal for the Notification Panel ── */}
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col justify-end sm:justify-start items-center sm:items-end pointer-events-none">
            {/* Backdrop for mobile & dismissal */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
              onClick={() => setOpen(false)}
            />

            {/* Notification Card Container */}
            <div
              style={{
                top: window.innerWidth >= 640 ? `${position.top}px` : undefined,
                right: window.innerWidth >= 640 ? `${position.right}px` : undefined,
              }}
              className={cn(
                "pointer-events-auto flex flex-col z-[100000] border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden",
                // Mobile: Full width bottom sheet or centered card
                "w-full sm:w-[420px] max-h-[85vh] sm:max-h-[580px] rounded-t-3xl sm:rounded-2xl sm:fixed transition-all animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-200"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {i18n.title[curLang]}
                    </h3>
                  </div>
                  {unreadCount > 0 && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs px-2 py-0.5">
                      {unreadCount} {i18n.newBadge[curLang]}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllRead}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 px-2.5 rounded-lg"
                    >
                      <CheckCheck className="w-3.5 h-3.5 mr-1" />
                      {i18n.markAllRead[curLang]}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800/60 bg-slate-900/60 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-colors",
                    activeTab === "all"
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  {i18n.allTab[curLang]} ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("unread")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-colors",
                    activeTab === "unread"
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  {i18n.unreadTab[curLang]} ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("broadcasts")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-colors",
                    activeTab === "broadcasts"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  {i18n.announcementsTab[curLang]}
                </button>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                {loading && notifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    {i18n.loading[curLang]}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-14 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/10 to-purple-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-inner">
                      <Sparkles className="w-7 h-7 text-blue-400 animate-pulse" />
                    </div>
                    <h4 className="text-white font-semibold text-base mb-1">
                      {i18n.emptyTitle[curLang]}
                    </h4>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
                      {i18n.emptyDesc[curLang]}
                    </p>
                  </div>
                ) : (
                  filtered.map((n) => {
                    const st = getTypeStyle(n.type);
                    const { title, message } = getContent(n);
                    return (
                      <div
                        key={n.id}
                        onClick={() => markOneRead(n)}
                        className={cn(
                          "group relative flex items-start gap-3.5 p-4 cursor-pointer transition-all duration-150 select-none",
                          n.read
                            ? "hover:bg-slate-800/40 bg-transparent"
                            : "bg-blue-600/5 hover:bg-blue-600/10 border-l-4 border-l-blue-500"
                        )}
                      >
                        {/* Icon badge */}
                        <div
                          className={cn(
                            "shrink-0 p-2 rounded-xl border mt-0.5 transition-transform group-hover:scale-105",
                            st.bg
                          )}
                        >
                          {st.icon}
                        </div>

                        {/* Text info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              {st.badge}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-slate-500">
                                {timeAgo(n.created_at)}
                              </span>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400 animate-pulse" />
                              )}
                            </div>
                          </div>

                          <h4
                            className={cn(
                              "text-sm font-semibold leading-snug line-clamp-1",
                              n.read ? "text-slate-300" : "text-white font-bold"
                            )}
                          >
                            {title}
                          </h4>

                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {message}
                          </p>

                          <div className="mt-2 flex items-center text-[11px] text-blue-400/90 font-medium group-hover:text-blue-300 transition-colors">
                            <span>{i18n.viewDetails[curLang]}</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5 transform group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Notification Detail Modal (Full Reading View) ── */}
      {mounted &&
        selectedNotif &&
        createPortal(
          <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
            <div
              className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header & Badges */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-3 rounded-2xl border",
                      getTypeStyle(selectedNotif.type).bg
                    )}
                  >
                    {getTypeStyle(selectedNotif.type).icon}
                  </div>
                  <div>
                    <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-xs px-2 py-0.5 mb-1">
                      {getTypeStyle(selectedNotif.type).badge}
                    </Badge>
                    <p className="text-xs text-slate-400">
                      {timeAgo(selectedNotif.created_at)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNotif(null)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white leading-snug">
                {getContent(selectedNotif).title}
              </h3>

              {/* Full Message Body */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                {getContent(selectedNotif).message}
              </div>

              {/* Action Buttons based on notification type */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                {selectedNotif.type === "trading_alert" && (
                  <Link
                    href="/dashboard/trading"
                    onClick={() => {
                      setSelectedNotif(null);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {i18n.goToTrading[curLang]}
                  </Link>
                )}

                {selectedNotif.type === "welcome" && (
                  <Link
                    href="/dashboard/deposit"
                    onClick={() => {
                      setSelectedNotif(null);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {i18n.goToDeposit[curLang]}
                  </Link>
                )}

                {selectedNotif.type === "success" && (
                  <Link
                    href="/dashboard/referrals"
                    onClick={() => {
                      setSelectedNotif(null);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Gift className="w-4 h-4" />
                    {i18n.goToReferrals[curLang]}
                  </Link>
                )}

                <Button
                  variant="outline"
                  onClick={() => setSelectedNotif(null)}
                  className="border-slate-700 bg-transparent text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  {i18n.close[curLang]}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
