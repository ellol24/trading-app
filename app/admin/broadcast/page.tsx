"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Megaphone,
  Users,
  Send,
  Search,
  RefreshCw,
  Bell,
  Settings,
  Gift,
  AlertTriangle,
  CheckCircle,
  Zap,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/language-context";

type SupportedLang = "en" | "ar" | "fr" | "de";

const LANG_CONFIG: { code: SupportedLang; label: string; flag: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", dir: "ltr" },
];

const NOTIFICATION_TYPES = [
  { value: "broadcast", label: "📢 Broadcast", color: "text-purple-400" },
  { value: "info", label: "ℹ️ Info", color: "text-blue-400" },
  { value: "trading_alert", label: "⚡ Trading Alert", color: "text-amber-400" },
  { value: "success", label: "🎁 Reward", color: "text-green-400" },
  { value: "warning", label: "⚠️ Warning", color: "text-yellow-400" },
];

export default function AdminBroadcastPage() {
  const { t, language } = useLanguage();

  // Active editor language tabs
  const [broadcastLang, setBroadcastLang] = useState<SupportedLang>("en");
  const [welcomeLang, setWelcomeLang] = useState<SupportedLang>("en");
  const [alertLang, setAlertLang] = useState<SupportedLang>("en");

  // Broadcast state with multi-language translations
  const [broadcastData, setBroadcastData] = useState<
    Record<SupportedLang, { title: string; message: string }>
  >({
    en: { title: "", message: "" },
    ar: { title: "", message: "" },
    fr: { title: "", message: "" },
    de: { title: "", message: "" },
  });

  const [notifType, setNotifType] = useState("broadcast");
  const [targetType, setTargetType] = useState<"all" | "user">("all");
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [translatingBroadcast, setTranslatingBroadcast] = useState(false);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);

  // Welcome message state with multi-language translations
  const [welcomeData, setWelcomeData] = useState<
    Record<SupportedLang, { title: string; message: string }>
  >({
    en: { title: "Welcome to Xspy Trader! 🚀", message: "Start earning today through trading sessions and investment packages." },
    ar: { title: "مرحباً بك في إكس سباي تريدر! 🚀", message: "ابدأ جني الأرباح اليوم من خلال جلسات التداول وباقات الاستثمار." },
    fr: { title: "Bienvenue sur Xspy Trader ! 🚀", message: "Commencez à gagner dès aujourd'hui avec nos sessions de trading et nos packages." },
    de: { title: "Willkommen bei Xspy Trader! 🚀", message: "Starten Sie noch heute mit Trading-Runden und Investitionspaketen." },
  });
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [translatingWelcome, setTranslatingWelcome] = useState(false);

  // Trading alert state with multi-language translations
  const [alertData, setAlertData] = useState<
    Record<SupportedLang, { title: string; message: string }>
  >({
    en: { title: "⚡ Trading Session Starting Soon!", message: "A new trading session is about to begin. Ensure your account is ready!" },
    ar: { title: "⚡ جلسة تداول جديدة تبدأ قريباً!", message: "جلسة تداول حية على وشك البدء. تأكد من جاهزية حسابك للمشاركة!" },
    fr: { title: "⚡ Nouvelle session de trading imminente !", message: "Une nouvelle session de trading va débuter. Préparez votre compte !" },
    de: { title: "⚡ Trading-Sitzung beginnt in Kürze!", message: "Eine neue Trading-Runde steht bevor. Bereiten Sie Ihr Konto vor!" },
  });
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [savingAlert, setSavingAlert] = useState(false);
  const [translatingAlert, setTranslatingAlert] = useState(false);

  // Initial load
  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/broadcast");
      if (res.ok) {
        const data = await res.json();
        setRecentBroadcasts(data.broadcasts ?? []);
        const wm = data.settings?.find((s: any) => s.key === "welcome_message");
        const ta = data.settings?.find((s: any) => s.key === "trading_alert");

        if (wm?.value) {
          setWelcomeEnabled(wm.value.enabled !== false);
          if (wm.value.translations) {
            setWelcomeData((prev) => ({ ...prev, ...wm.value.translations }));
          } else if (wm.value.title || wm.value.message) {
            setWelcomeData((prev) => ({
              ...prev,
              en: { title: wm.value.title ?? "", message: wm.value.message ?? "" },
            }));
          }
        }

        if (ta?.value) {
          setAlertEnabled(ta.value.enabled !== false);
          if (ta.value.translations) {
            setAlertData((prev) => ({ ...prev, ...ta.value.translations }));
          } else if (ta.value.title || ta.value.message) {
            setAlertData((prev) => ({
              ...prev,
              en: { title: ta.value.title ?? "", message: ta.value.message ?? "" },
            }));
          }
        }
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync default tab with active language
  useEffect(() => {
    if (language && ["en", "ar", "fr", "de"].includes(language)) {
      setBroadcastLang(language as SupportedLang);
      setWelcomeLang(language as SupportedLang);
      setAlertLang(language as SupportedLang);
    }
  }, [language]);

  // User search
  useEffect(() => {
    if (!userSearch || targetType !== "user") {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users?search=${encodeURIComponent(userSearch)}&limit=8`
        );
        if (res.ok) {
          const d = await res.json();
          setUsers(d.users ?? d ?? []);
        }
      } catch {
        // silently fail
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, targetType]);

  // ── Auto-Translate Helpers ──
  const autoTranslateBroadcast = async () => {
    const active = broadcastData[broadcastLang];
    if (!active.title.trim() && !active.message.trim()) {
      toast.error("Please enter a title or message first.");
      return;
    }
    setTranslatingBroadcast(true);
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: active.title,
          message: active.message,
          sourceLang: broadcastLang,
        }),
      });
      const data = await res.json();
      if (res.ok && data.translations) {
        setBroadcastData(data.translations);
        toast.success(
          t("admin.autoTranslateSuccess") ||
            "Translated successfully to English, Arabic, French, and German!"
        );
      } else {
        toast.error(data.error || "Translation failed");
      }
    } catch {
      toast.error("Translation request failed");
    } finally {
      setTranslatingBroadcast(false);
    }
  };

  const autoTranslateWelcome = async () => {
    const active = welcomeData[welcomeLang];
    if (!active.title.trim() && !active.message.trim()) {
      toast.error("Please enter a title or message first.");
      return;
    }
    setTranslatingWelcome(true);
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: active.title,
          message: active.message,
          sourceLang: welcomeLang,
        }),
      });
      const data = await res.json();
      if (res.ok && data.translations) {
        setWelcomeData(data.translations);
        toast.success(
          t("admin.autoTranslateSuccess") ||
            "Welcome message translated to all languages!"
        );
      } else {
        toast.error(data.error || "Translation failed");
      }
    } catch {
      toast.error("Translation request failed");
    } finally {
      setTranslatingWelcome(false);
    }
  };

  const autoTranslateAlert = async () => {
    const active = alertData[alertLang];
    if (!active.title.trim() && !active.message.trim()) {
      toast.error("Please enter a title or message first.");
      return;
    }
    setTranslatingAlert(true);
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: active.title,
          message: active.message,
          sourceLang: alertLang,
        }),
      });
      const data = await res.json();
      if (res.ok && data.translations) {
        setAlertData(data.translations);
        toast.success(
          t("admin.autoTranslateSuccess") ||
            "Trading alert translated to all languages!"
        );
      } else {
        toast.error(data.error || "Translation failed");
      }
    } catch {
      toast.error("Translation request failed");
    } finally {
      setTranslatingAlert(false);
    }
  };

  // ── Submit Actions ──
  const sendBroadcast = async () => {
    const cur = broadcastData[broadcastLang];
    if (!cur.title.trim() || !cur.message.trim()) {
      toast.error("Title and message are required in the active tab.");
      return;
    }
    if (targetType === "user" && !selectedUser) {
      toast.error("Please select a target user.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cur.title.trim(),
          message: cur.message.trim(),
          target_type: targetType,
          target_user_id: targetType === "user" ? selectedUser?.uid : undefined,
          notification_type: notifType,
          translations: broadcastData,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          (t("admin.broadcastSuccess") || "Broadcast sent to {n} users!").replace(
            "{n}",
            data.sent_to
          )
        );
        setBroadcastData({
          en: { title: "", message: "" },
          ar: { title: "", message: "" },
          fr: { title: "", message: "" },
          de: { title: "", message: "" },
        });
        setSelectedUser(null);
        setUserSearch("");
        loadData();
      } else {
        toast.error(data.error ?? "Failed to send broadcast");
      }
    } catch {
      toast.error("Network error sending broadcast");
    } finally {
      setSending(false);
    }
  };

  const saveWelcomeMessage = async () => {
    const cur = welcomeData[welcomeLang];
    setSavingWelcome(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "welcome_message",
          value: {
            title: cur.title,
            message: cur.message,
            enabled: welcomeEnabled,
            translations: welcomeData,
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.statusUpdated") || "Welcome message saved!");
      } else {
        toast.error("Failed to save welcome message");
      }
    } finally {
      setSavingWelcome(false);
    }
  };

  const saveTradingAlert = async () => {
    const cur = alertData[alertLang];
    setSavingAlert(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "trading_alert",
          value: {
            title: cur.title,
            message: cur.message,
            enabled: alertEnabled,
            translations: alertData,
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.statusUpdated") || "Trading alert saved!");
      } else {
        toast.error("Failed to save trading alert");
      }
    } finally {
      setSavingAlert(false);
    }
  };

  const triggerTradingAlertNow = async () => {
    const cur = alertData[alertLang];
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cur.title || "⚡ Trading Session Starting Soon!",
        message: cur.message || "A new live trading session is about to begin.",
        target_type: "all",
        notification_type: "trading_alert",
        translations: alertData,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`⚡ Alert broadcasted to ${data.sent_to} users!`);
      loadData();
    } else {
      toast.error(data.error ?? "Failed to trigger alert");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-purple-400" />
            {t("admin.broadcastCenter") || "Broadcast Center"}
          </h1>
          <p className="text-slate-400 mt-1">
            Send multilingual broadcast notifications, configure welcome messages, and alert users about trading sessions.
          </p>
        </div>

        {/* ── CARD 1: Send Broadcast Notification ── */}
        <Card className="trading-card border-slate-700/80 bg-slate-900/90 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-400" />
                <span>{t("admin.newBroadcast") || "New Broadcast Notification"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={autoTranslateBroadcast}
                disabled={translatingBroadcast}
                className="border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs gap-1.5"
              >
                {translatingBroadcast ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("admin.autoTranslating") || "Translating..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t("admin.autoTranslateBtn") || "✨ Auto-Translate to All Languages"}</span>
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Selection */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant={targetType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("all")}
                className={
                  targetType === "all"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "border-slate-600 text-slate-300 bg-transparent"
                }
              >
                <Users className="w-4 h-4 mr-2" />
                {t("admin.allUsers") || "All Users"}
              </Button>
              <Button
                type="button"
                variant={targetType === "user" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("user")}
                className={
                  targetType === "user"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                    : "border-slate-600 text-slate-300 bg-transparent"
                }
              >
                <Bell className="w-4 h-4 mr-2" />
                {t("admin.specificUser") || "Specific User"}
              </Button>
            </div>

            {/* Target user search */}
            {targetType === "user" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search user by name or email..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setSelectedUser(null);
                    }}
                    className="pl-9 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                {users.length > 0 && !selectedUser && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden shadow-xl max-h-56 overflow-y-auto">
                    {users.map((u) => (
                      <div
                        key={u.uid}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/60 cursor-pointer border-b border-slate-700 last:border-0 transition-colors"
                        onClick={() => {
                          setSelectedUser(u);
                          setUserSearch(u.full_name ?? u.email);
                          setUsers([]);
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(u.full_name ?? u.email ?? "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {u.full_name ?? "Unnamed"}
                          </p>
                          <p className="text-slate-400 text-xs">{u.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-purple-500/15 border border-purple-500/40">
                    <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-white text-sm flex-1">
                      Target: <strong>{selectedUser.full_name ?? selectedUser.email}</strong>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                      onClick={() => {
                        setSelectedUser(null);
                        setUserSearch("");
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Notification Type */}
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setNotifType(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    notifType === item.value
                      ? "border-blue-500 bg-blue-500/20 text-white shadow-sm"
                      : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Language Editor Tabs */}
            <div className="border border-slate-700/80 rounded-xl bg-slate-800/40 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Languages & Translations:
                </span>
                <div className="flex gap-1">
                  {LANG_CONFIG.map((lang) => {
                    const hasContent =
                      !!broadcastData[lang.code].title.trim() ||
                      !!broadcastData[lang.code].message.trim();
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setBroadcastLang(lang.code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                          broadcastLang === lang.code
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold"
                            : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                        {hasContent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title input */}
              <Input
                placeholder={`Notification title (${LANG_CONFIG.find((l) => l.code === broadcastLang)?.label})...`}
                value={broadcastData[broadcastLang].title}
                dir={LANG_CONFIG.find((l) => l.code === broadcastLang)?.dir}
                onChange={(e) =>
                  setBroadcastData((prev) => ({
                    ...prev,
                    [broadcastLang]: {
                      ...prev[broadcastLang],
                      title: e.target.value,
                    },
                  }))
                }
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 font-medium"
              />

              {/* Message input */}
              <Textarea
                placeholder={`Write message here in ${LANG_CONFIG.find((l) => l.code === broadcastLang)?.label} (or type in your language and click Auto-Translate)...`}
                value={broadcastData[broadcastLang].message}
                dir={LANG_CONFIG.find((l) => l.code === broadcastLang)?.dir}
                onChange={(e) =>
                  setBroadcastData((prev) => ({
                    ...prev,
                    [broadcastLang]: {
                      ...prev[broadcastLang],
                      message: e.target.value,
                    },
                  }))
                }
                rows={4}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 resize-none text-sm leading-relaxed"
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={sendBroadcast}
              disabled={
                sending ||
                !broadcastData[broadcastLang].title.trim() ||
                !broadcastData[broadcastLang].message.trim()
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 shadow-lg shadow-blue-500/20"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("admin.sendingBroadcast") || "Sending Broadcast..."}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {targetType === "all"
                    ? t("admin.sendBroadcastBtn") || "Broadcast to All Users"
                    : "Send to Selected User"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── CARD 2: Welcome Message (Multi-Language) ── */}
        <Card className="trading-card border-slate-700/80 bg-slate-900/90 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-green-400" />
                <span>{t("admin.welcomeTitle") || "Welcome Message for New Registrations"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={autoTranslateWelcome}
                disabled={translatingWelcome}
                className="border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 text-xs gap-1.5"
              >
                {translatingWelcome ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-green-400" />
                    <span>Auto-Translate Welcome</span>
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-xs max-w-lg">
                {t("admin.welcomeSubtitle") ||
                  "This message is automatically displayed to every newly registered user upon signup."}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-xs font-medium">Status:</span>
                <button
                  type="button"
                  onClick={() => setWelcomeEnabled(!welcomeEnabled)}
                  className="transition-colors"
                >
                  {welcomeEnabled ? (
                    <ToggleRight className="w-8 h-8 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Language tabs for Welcome Message */}
            <div className="border border-slate-700/80 rounded-xl bg-slate-800/40 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-green-400" />
                  Languages:
                </span>
                <div className="flex gap-1">
                  {LANG_CONFIG.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setWelcomeLang(lang.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        welcomeLang === lang.code
                          ? "bg-green-600 text-white font-bold shadow-sm"
                          : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Input
                placeholder="Welcome title..."
                value={welcomeData[welcomeLang].title}
                dir={LANG_CONFIG.find((l) => l.code === welcomeLang)?.dir}
                onChange={(e) =>
                  setWelcomeData((prev) => ({
                    ...prev,
                    [welcomeLang]: {
                      ...prev[welcomeLang],
                      title: e.target.value,
                    },
                  }))
                }
                className="bg-slate-900 border-slate-700 text-white font-medium"
              />

              <Textarea
                placeholder="Welcome message body (supports paragraphs, bullet points)..."
                value={welcomeData[welcomeLang].message}
                dir={LANG_CONFIG.find((l) => l.code === welcomeLang)?.dir}
                onChange={(e) =>
                  setWelcomeData((prev) => ({
                    ...prev,
                    [welcomeLang]: {
                      ...prev[welcomeLang],
                      message: e.target.value,
                    },
                  }))
                }
                rows={5}
                className="bg-slate-900 border-slate-700 text-white text-xs leading-relaxed resize-none font-sans"
              />
            </div>

            <Button
              onClick={saveWelcomeMessage}
              disabled={savingWelcome}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingWelcome ? "Saving..." : t("admin.saveSettings") || "Save Welcome Message"}
            </Button>
          </CardContent>
        </Card>

        {/* ── CARD 3: Trading Alert (Multi-Language) ── */}
        <Card className="trading-card border-slate-700/80 bg-slate-900/90 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-400" />
                <span>{t("admin.tradingAlertTitle") || "Upcoming Trading Session Alert"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={autoTranslateAlert}
                disabled={translatingAlert}
                className="border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 text-xs gap-1.5"
              >
                {translatingAlert ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    <span>Auto-Translate Alert</span>
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-400 text-xs">
              {t("admin.tradingAlertSubtitle") ||
                "Alert users with a notification and banner about scheduled trading rounds."}
            </p>

            {/* Language tabs for Trading Alert */}
            <div className="border border-slate-700/80 rounded-xl bg-slate-800/40 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-orange-400" />
                  Languages:
                </span>
                <div className="flex gap-1">
                  {LANG_CONFIG.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setAlertLang(lang.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        alertLang === lang.code
                          ? "bg-orange-600 text-white font-bold shadow-sm"
                          : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Input
                placeholder="Alert title..."
                value={alertData[alertLang].title}
                dir={LANG_CONFIG.find((l) => l.code === alertLang)?.dir}
                onChange={(e) =>
                  setAlertData((prev) => ({
                    ...prev,
                    [alertLang]: {
                      ...prev[alertLang],
                      title: e.target.value,
                    },
                  }))
                }
                className="bg-slate-900 border-slate-700 text-white font-medium"
              />

              <Textarea
                placeholder="Alert message..."
                value={alertData[alertLang].message}
                dir={LANG_CONFIG.find((l) => l.code === alertLang)?.dir}
                onChange={(e) =>
                  setAlertData((prev) => ({
                    ...prev,
                    [alertLang]: {
                      ...prev[alertLang],
                      message: e.target.value,
                    },
                  }))
                }
                rows={3}
                className="bg-slate-900 border-slate-700 text-white text-xs leading-relaxed resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={saveTradingAlert}
                disabled={savingAlert}
                variant="outline"
                className="border-slate-700 text-slate-300 bg-transparent hover:bg-slate-800"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingAlert ? "Saving..." : "Save Alert Template"}
              </Button>

              <Button
                onClick={triggerTradingAlertNow}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold"
              >
                <Zap className="w-4 h-4 mr-2" />
                Broadcast Alert to All Users Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── CARD 4: Recent Broadcast History ── */}
        {recentBroadcasts.length > 0 && (
          <Card className="trading-card border-slate-700/80 bg-slate-900/90 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                <span>{t("admin.broadcastHistoryTab") || "Broadcast History"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {recentBroadcasts.map((b) => (
                <div
                  key={b.id}
                  className="flex gap-3 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 hover:border-slate-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-semibold truncate">{b.title}</p>
                      <Badge className="text-[10px] shrink-0 bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {b.target_type === "all" ? "All Users" : "Single User"}
                      </Badge>
                      <Badge className="text-[10px] shrink-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {b.notification_type}
                      </Badge>
                    </div>
                    <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                      {b.message}
                    </p>
                    <p className="text-slate-500 text-[10px] mt-1.5">
                      {new Date(b.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
