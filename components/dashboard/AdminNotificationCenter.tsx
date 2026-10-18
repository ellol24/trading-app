"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Gift, Info, AlertTriangle, Zap, Megaphone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  success: <Gift className="w-4 h-4 text-green-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  alert: <Zap className="w-4 h-4 text-red-400" />,
  broadcast: <Megaphone className="w-4 h-4 text-purple-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

export default function AdminNotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch the last 100 notifications across all users using admin broadcast endpoint
      const res = await fetch("/api/admin/broadcast");
      if (res.ok) {
        const data = await res.json();
        // broadcasts are admin-sent, transform them to notification-like objects
        const broadcasts = (data.broadcasts ?? []).map((b: any) => ({
          id: b.id,
          type: b.notification_type ?? "broadcast",
          title: b.title,
          message: b.message,
          read: true,
          created_at: b.created_at,
          target: b.target_type === "all" ? "All Users" : `User: ${b.target_user_id?.slice(0, 8)}...`,
          sent_count: b.sent_count,
        }));
        setNotifications(broadcasts);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const displayed = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-blue-600 text-white" : "border-slate-600 text-slate-300 bg-transparent"}
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
            className={filter === "unread" ? "bg-blue-600 text-white" : "border-slate-600 text-slate-300 bg-transparent"}
          >
            Unread ({notifications.filter((n) => !n.read).length})
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} className="border-slate-600 text-slate-300 bg-transparent">
          Refresh
        </Button>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-400">Loading notifications...</div>
        ) : displayed.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No notifications found</p>
          </div>
        ) : (
          displayed.map((n: any) => (
            <div
              key={n.id}
              className={cn(
                "flex gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800/60 transition-colors border-l-2",
                n.type === "success" ? "border-l-green-400" :
                n.type === "warning" ? "border-l-yellow-400" :
                n.type === "alert" ? "border-l-red-400" :
                n.type === "broadcast" ? "border-l-purple-400" :
                "border-l-blue-400"
              )}
            >
              <div className="mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.info}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                {n.target && (
                  <div className="mt-1 flex gap-2">
                    <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600 px-1.5 py-0">
                      → {n.target}
                    </Badge>
                    {n.sent_count !== undefined && (
                      <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30 px-1.5 py-0">
                        Sent to {n.sent_count}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
