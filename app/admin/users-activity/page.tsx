"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Activity, UserCheck, UserX, Clock, Trophy, TrendingUp,
  RefreshCw, AlertTriangle, Zap, MessageCircle, Send, ChevronDown,
  Star, Target, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/language-context";

type UserActivity = {
  uid: string;
  full_name: string;
  email: string;
  balance: number;
  status: string;
  joined: string;
  last_activity: string;
  days_since_activity: number;
  is_inactive: boolean;
  total_deposits: number;
  week_deposits: number;
  suggestion: string | null;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  new_this_week: number;
  total_deposited_this_week: number;
};

export default function AdminUsersActivityPage() {
  const { t } = useLanguage();
  const [active, setActive] = useState<UserActivity[]>([]);
  const [inactive, setInactive] = useState<UserActivity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users-activity");
      if (res.ok) {
        const data = await res.json();
        setActive(data.active ?? []);
        setInactive(data.inactive ?? []);
        setStats(data.stats ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendNotification = async (userId: string, name: string) => {
    const title = "👋 We Miss You!";
    const message = `Hi ${name}, it's been a while! Don't miss out on the latest trading sessions and investment packages. Log in now to see what's new.`;
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, target_type: "user", target_user_id: userId, notification_type: "info" }),
    });
    if (res.ok) {
      toast.success(`Re-engagement notification sent to ${name}!`);
    } else {
      toast.error("Failed to send notification");
    }
  };

  const displayed = tab === "active" ? active : inactive;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-400" />
              {t('admin.usersActivityTitle') || "User Activity Monitor"}
            </h1>
            <p className="text-slate-400 mt-1">Track active and inactive users with AI-powered re-engagement suggestions.</p>
          </div>
          <Button
            onClick={fetchData}
            disabled={loading}
            variant="outline"
            className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: t('admin.totalUsers') || "Total Users", value: stats.total, icon: <Users className="w-5 h-5 text-blue-400" />, color: "bg-blue-500/20" },
              { label: t('admin.activeUsers') || "Active Users", value: stats.active, icon: <UserCheck className="w-5 h-5 text-green-400" />, color: "bg-green-500/20" },
              { label: t('admin.dormantUsers') || "Inactive Users", value: stats.inactive, icon: <UserX className="w-5 h-5 text-red-400" />, color: "bg-red-500/20", alert: stats.inactive > 0 },
              { label: t('admin.activeThisWeek') || "New This Week", value: stats.new_this_week, icon: <TrendingUp className="w-5 h-5 text-purple-400" />, color: "bg-purple-500/20" },
              { label: "Week Deposits", value: `$${stats.total_deposited_this_week.toFixed(2)}`, icon: <Zap className="w-5 h-5 text-yellow-400" />, color: "bg-yellow-500/20" },
            ].map((s) => (
              <Card key={s.label} className={`trading-card ${s.alert ? "border-red-500/30" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
                  <div>
                    <p className="text-xs text-slate-400">{s.label}</p>
                    <p className="text-lg font-bold text-white">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === "active" ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
          >
            <UserCheck className="w-4 h-4" /> {t('admin.active') || "Active"} ({active.length})
          </button>
          <button
            onClick={() => setTab("inactive")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === "inactive" ? "bg-red-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
          >
            <UserX className="w-4 h-4" /> {t('admin.dormantUsers') || "Inactive"} ({inactive.length})
          </button>
        </div>

        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {tab === "active"
                ? <><Star className="w-5 h-5 text-yellow-400" /> Most Active Users This Week</>
                : <><AlertTriangle className="w-5 h-5 text-red-400" /> Inactive Users (14+ days)</>
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-slate-400">Loading...</div>
            ) : displayed.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-400">{tab === "active" ? "No active users yet this week." : "No inactive users — great!"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayed.map((u, idx) => (
                  <div
                    key={u.uid}
                    className={`rounded-xl border p-4 transition-colors ${
                      tab === "inactive"
                        ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10"
                        : idx < 3
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-slate-700 bg-slate-800/30 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {tab === "active" && idx < 3
                            ? ["🥇", "🥈", "🥉"][idx]
                            : (u.full_name[0] ?? "U").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold">{u.full_name}</p>
                          <p className="text-slate-400 text-xs">{u.email}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {tab === "active" ? (
                          <>
                            <p className="text-green-400 font-bold text-sm">${u.week_deposits.toFixed(2)} this week</p>
                            <p className="text-slate-400 text-xs">Total: ${u.total_deposits.toFixed(2)}</p>
                          </>
                        ) : (
                          <>
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                              {u.days_since_activity}d inactive
                            </Badge>
                            <p className="text-slate-400 text-xs mt-1">
                              Last: {new Date(u.last_activity).toLocaleDateString()}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* AI suggestion for inactive users */}
                    {tab === "inactive" && u.suggestion && (
                      <div className="mt-3">
                        <button
                          className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                          onClick={() => setExpandedSuggestion(expandedSuggestion === u.uid ? null : u.uid)}
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          AI Suggestion
                          <ChevronDown className={`w-3 h-3 transition-transform ${expandedSuggestion === u.uid ? "rotate-180" : ""}`} />
                        </button>
                        {expandedSuggestion === u.uid && (
                          <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-200 leading-relaxed">
                            {u.suggestion}
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => sendNotification(u.uid, u.full_name)}
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Send Re-engagement
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
