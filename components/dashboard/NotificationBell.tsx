"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, X, Check, CheckCheck, Info, AlertTriangle, Zap, Gift, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, any>;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  success: <Gift className="w-4 h-4 text-green-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  alert: <Zap className="w-4 h-4 text-red-400" />,
  broadcast: <Megaphone className="w-4 h-4 text-purple-400" />,
  welcome: <Gift className="w-4 h-4 text-blue-400" />,
  trading_alert: <Zap className="w-4 h-4 text-orange-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

const TYPE_COLOR: Record<string, string> = {
  success: "border-l-green-400 bg-green-500/5",
  warning: "border-l-yellow-400 bg-yellow-500/5",
  alert: "border-l-red-400 bg-red-500/5",
  broadcast: "border-l-purple-400 bg-purple-500/5",
  welcome: "border-l-blue-400 bg-blue-500/5",
  trading_alert: "border-l-orange-400 bg-orange-500/5",
  info: "border-l-blue-400 bg-blue-500/5",
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Realtime subscription
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
          toast.info(n.title, { description: n.message.slice(0, 80) });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-full"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchNotifications();
        }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 md:w-96 max-h-[520px] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/80">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-white text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400 hover:text-white h-7 px-2"
                  onClick={markAllRead}
                >
                  <CheckCheck className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" className="p-1 h-7 w-7 text-slate-400 hover:text-white" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0 cursor-pointer transition-colors hover:bg-slate-800/40 border-l-2",
                    TYPE_COLOR[n.type] ?? TYPE_COLOR.info,
                    !n.read && "bg-blue-500/5"
                  )}
                  onClick={() => !n.read && markOneRead(n.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {TYPE_ICON[n.type] ?? TYPE_ICON.info}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium leading-tight", n.read ? "text-slate-300" : "text-white")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
