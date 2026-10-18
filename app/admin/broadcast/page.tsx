"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Megaphone, Users, Send, Search, RefreshCw, Bell, Settings,
  Gift, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  Trophy, Zap, Info, Edit3, Save, X, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { Badge as BadgeComp } from "@/components/ui/badge";

const NOTIFICATION_TYPES = [
  { value: "info",      label: "ℹ️ Info",      color: "text-blue-400" },
  { value: "success",   label: "✅ Success",   color: "text-green-400" },
  { value: "warning",   label: "⚠️ Warning",  color: "text-yellow-400" },
  { value: "alert",     label: "🚨 Alert",     color: "text-red-400" },
  { value: "broadcast", label: "📢 Broadcast", color: "text-purple-400" },
];

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState("broadcast");
  const [targetType, setTargetType] = useState<"all" | "user">("all");
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);

  // Welcome message editor
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [savingWelcome, setSavingWelcome] = useState(false);

  // Trading alert editor
  const [tradingAlertTitle, setTradingAlertTitle] = useState("");
  const [tradingAlertMsg, setTradingAlertMsg] = useState("");
  const [tradingAlertEnabled, setTradingAlertEnabled] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/admin/broadcast");
    if (res.ok) {
      const data = await res.json();
      setRecentBroadcasts(data.broadcasts ?? []);
      const wm = data.settings?.find((s: any) => s.key === "welcome_message");
      const ta = data.settings?.find((s: any) => s.key === "trading_alert");
      if (wm?.value) {
        setWelcomeTitle(wm.value.title ?? "");
        setWelcomeMsg(wm.value.message ?? "");
        setWelcomeEnabled(wm.value.enabled !== false);
      }
      if (ta?.value) {
        setTradingAlertTitle(ta.value.title ?? "");
        setTradingAlertMsg(ta.value.message ?? "");
        setTradingAlertEnabled(ta.value.enabled === true);
      }
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Search users
  useEffect(() => {
    if (!userSearch || targetType !== "user") { setUsers([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}&limit=8`);
      if (res.ok) { const d = await res.json(); setUsers(d.users ?? d ?? []); }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, targetType]);

  const sendBroadcast = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required."); return; }
    if (targetType === "user" && !selectedUser) { toast.error("Please select a target user."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target_type: targetType,
          target_user_id: targetType === "user" ? selectedUser?.uid : undefined,
          notification_type: notifType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`✅ Sent to ${data.sent_to} user${data.sent_to !== 1 ? "s" : ""}!`);
        setTitle(""); setMessage(""); setSelectedUser(null); setUserSearch("");
        loadData();
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch { toast.error("Network error"); }
    finally { setSending(false); }
  };

  const saveWelcomeMessage = async () => {
    setSavingWelcome(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "welcome_message",
          value: { title: welcomeTitle, message: welcomeMsg, enabled: welcomeEnabled },
        }),
      });
      if (res.ok) toast.success("Welcome message saved!");
      else toast.error("Failed to save welcome message");
    } finally { setSavingWelcome(false); }
  };

  const saveTradingAlert = async () => {
    setSavingAlert(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "trading_alert",
          value: { title: tradingAlertTitle, message: tradingAlertMsg, enabled: tradingAlertEnabled },
        }),
      });
      if (res.ok) toast.success("Trading alert saved!");
      else toast.error("Failed to save trading alert");
    } finally { setSavingAlert(false); }
  };

  const triggerTradingAlert = async () => {
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: tradingAlertTitle || "⚡ Trading Session Starting Soon!",
        message: tradingAlertMsg || "A new trading session is about to begin. Make sure your account is funded!",
        target_type: "all",
        notification_type: "trading_alert",
      }),
    });
    const data = await res.json();
    if (res.ok) toast.success(`⚡ Alert sent to ${data.sent_to} users!`);
    else toast.error(data.error ?? "Failed");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-purple-400" />
            Broadcast Center
          </h1>
          <p className="text-slate-400 mt-1">Send notifications, manage welcome messages, and trigger trading alerts.</p>
        </div>

        {/* ── Send Broadcast ── */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              Send Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target */}
            <div className="flex gap-3">
              <Button
                variant={targetType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("all")}
                className={targetType === "all" ? "bg-blue-600 text-white" : "border-slate-600 text-slate-300 bg-transparent"}
              >
                <Users className="w-4 h-4 mr-2" /> All Users
              </Button>
              <Button
                variant={targetType === "user" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("user")}
                className={targetType === "user" ? "bg-purple-600 text-white" : "border-slate-600 text-slate-300 bg-transparent"}
              >
                <Bell className="w-4 h-4 mr-2" /> Specific User
              </Button>
            </div>

            {/* User search */}
            {targetType === "user" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setSelectedUser(null); }}
                    className="pl-9 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                {users.length > 0 && !selectedUser && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
                    {users.map((u) => (
                      <div
                        key={u.uid}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/60 cursor-pointer border-b border-slate-700 last:border-0"
                        onClick={() => { setSelectedUser(u); setUserSearch(u.full_name ?? u.email); setUsers([]); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(u.full_name ?? u.email ?? "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{u.full_name ?? "Unnamed"}</p>
                          <p className="text-slate-400 text-xs">{u.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-white text-sm flex-1">Sending to: <strong>{selectedUser.full_name ?? selectedUser.email}</strong></span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400" onClick={() => { setSelectedUser(null); setUserSearch(""); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Notification type */}
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNotifType(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${notifType === t.value
                    ? "border-blue-500 bg-blue-500/20 text-white"
                    : "border-slate-600 bg-transparent text-slate-400 hover:border-slate-500"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Input
              placeholder="Notification title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
            <Textarea
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 resize-none"
            />
            <Button
              onClick={sendBroadcast}
              disabled={sending || !title || !message}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
            >
              {sending ? "Sending..." : (
                <><Send className="w-4 h-4 mr-2" />{targetType === "all" ? "Broadcast to All Users" : "Send to User"}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Welcome Message ── */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              Welcome Message
              <Badge className={welcomeEnabled ? "bg-green-500/20 text-green-400 border-green-500/30 ml-auto" : "bg-slate-500/20 text-slate-400 border-slate-500/30 ml-auto"}>
                {welcomeEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-400 text-sm">This message is shown as an in-app notification when a new user registers.</p>
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-sm">Show to new users:</span>
              <button onClick={() => setWelcomeEnabled(!welcomeEnabled)} className="text-slate-400 hover:text-white transition-colors">
                {welcomeEnabled
                  ? <ToggleRight className="w-8 h-8 text-green-400" />
                  : <ToggleLeft className="w-8 h-8 text-slate-500" />}
              </button>
            </div>
            <Input
              placeholder="Welcome message title..."
              value={welcomeTitle}
              onChange={(e) => setWelcomeTitle(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
            />
            <Textarea
              placeholder="Welcome message body (supports line breaks)..."
              value={welcomeMsg}
              onChange={(e) => setWelcomeMsg(e.target.value)}
              rows={6}
              className="bg-slate-800 border-slate-600 text-white font-mono text-sm resize-none"
            />
            <Button
              onClick={saveWelcomeMessage}
              disabled={savingWelcome}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingWelcome ? "Saving..." : "Save Welcome Message"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Trading Alert ── */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              Trading Session Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-400 text-sm">Configure and send a banner/notification alerting users of an upcoming trading session.</p>
            <Input
              placeholder="Alert title (e.g. ⚡ Trading Session Starting Soon!)"
              value={tradingAlertTitle}
              onChange={(e) => setTradingAlertTitle(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
            />
            <Textarea
              placeholder="Alert message..."
              value={tradingAlertMsg}
              onChange={(e) => setTradingAlertMsg(e.target.value)}
              rows={3}
              className="bg-slate-800 border-slate-600 text-white resize-none"
            />
            <div className="flex gap-3">
              <Button
                onClick={saveTradingAlert}
                disabled={savingAlert}
                variant="outline"
                className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingAlert ? "Saving..." : "Save Template"}
              </Button>
              <Button
                onClick={triggerTradingAlert}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Zap className="w-4 h-4 mr-2" />
                Send Alert to All Users Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Recent Broadcasts ── */}
        {recentBroadcasts.length > 0 && (
          <Card className="trading-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                Recent Broadcasts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {recentBroadcasts.map((b) => (
                <div key={b.id} className="flex gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white text-sm font-medium truncate">{b.title}</p>
                      <Badge className="text-[10px] shrink-0 bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {b.target_type === "all" ? "All" : "User"}
                      </Badge>
                    </div>
                    <p className="text-slate-400 text-xs line-clamp-1">{b.message}</p>
                    <p className="text-slate-600 text-[10px] mt-1">{new Date(b.created_at).toLocaleString()}</p>
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
