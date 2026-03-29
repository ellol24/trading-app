"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Activity, Award,
  BarChart3, Clock, Target, Zap, Loader2
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { supabase } from "@/lib/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [activeTab, setActiveTab] = useState("performance");

  const fetchData = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    const uid = authData.user.id;
    setUserId(uid);

    const [tradeRes, profRes] = await Promise.all([
      supabase.from("trades")
        .select("id, asset, type, amount, result, profit_loss, roi_percentage, created_at, duration_sec")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("balance").eq("uid", uid).single(),
    ]);
    if (tradeRes.data) setTrades(tradeRes.data);
    if (profRes.data) setBalance(Number(profRes.data.balance) || 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`analytics-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${userId}` },
        (p) => { if (p.new?.balance !== undefined) setBalance(Number(p.new.balance)); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // Derived metrics
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "lose").length;
  const pending = trades.filter((t) => !t.result).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
  const totalProfit = trades.filter((t) => t.result === "win").reduce((s, t) => s + Number(t.profit_loss ?? 0), 0);
  const totalLoss = trades.filter((t) => t.result === "lose").reduce((s, t) => s + Math.abs(Number(t.profit_loss ?? 0)), 0);
  const netPnL = totalProfit - totalLoss;
  const avgAmount = totalTrades > 0 ? trades.reduce((s, t) => s + Number(t.amount ?? 0), 0) / totalTrades : 0;

  // 30-day daily chart
  const dailyChart = (() => {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayTrades = trades.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
      const profit = dayTrades.filter(t => t.result === "win").reduce((s, t) => s + Number(t.profit_loss ?? 0), 0);
      const loss = dayTrades.filter(t => t.result === "lose").reduce((s, t) => s + Math.abs(Number(t.profit_loss ?? 0)), 0);
      result.push({
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        net: +(profit - loss).toFixed(2),
        profit: +profit.toFixed(2),
        loss: +loss.toFixed(2),
        count: dayTrades.length,
      });
    }
    return result;
  })();

  // Asset breakdown
  const assetMap: Record<string, { trades: number; profit: number }> = {};
  trades.forEach(t => {
    if (!assetMap[t.asset]) assetMap[t.asset] = { trades: 0, profit: 0 };
    assetMap[t.asset].trades++;
    assetMap[t.asset].profit += t.result === "win" ? Number(t.profit_loss ?? 0) : -(t.result === "lose" ? Math.abs(Number(t.profit_loss ?? 0)) : 0);
  });
  const assetData = Object.entries(assetMap).map(([name, v]) => ({
    name,
    trades: v.trades,
    profit: +v.profit.toFixed(2),
  })).sort((a, b) => b.trades - a.trades).slice(0, 8);

  // Pie chart: win/loss/pending breakdown
  const pieData = [
    { name: "Wins", value: wins },
    { name: "Losses", value: losses },
    { name: "Pending", value: pending },
  ].filter(d => d.value > 0);

  // Streak calculation
  let streak = 0;
  let streakType: "win" | "lose" | null = null;
  for (const t of trades) {
    if (!t.result) break;
    if (streakType === null) { streakType = t.result === "win" ? "win" : "lose"; streak = 1; }
    else if (t.result === streakType) { streak++; }
    else break;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics</h1>
            <p className="text-blue-200 mt-1">Deep dive into your trading performance</p>
          </div>
          <Badge
            variant="outline"
            className={`${netPnL >= 0 ? "text-green-400 border-green-400 bg-green-400/10" : "text-red-400 border-red-400 bg-red-400/10"}`}
          >
            {netPnL >= 0 ? <TrendingUp className="w-4 h-4 mr-1 inline" /> : <TrendingDown className="w-4 h-4 mr-1 inline" />}
            {netPnL >= 0 ? "+" : ""}${netPnL.toFixed(2)} Net P&L
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Trades", value: totalTrades, icon: <Activity className="w-5 h-5 text-blue-400" />, color: "blue", sub: `${pending} pending` },
            { label: "Win Rate", value: `${winRate}%`, icon: <Award className="w-5 h-5 text-green-400" />, color: "green", sub: `${wins}W / ${losses}L` },
            { label: "Total Profit", value: `$${totalProfit.toFixed(2)}`, icon: <TrendingUp className="w-5 h-5 text-green-400" />, color: "green", sub: `${wins} winning trades` },
            { label: "Avg Trade", value: `$${avgAmount.toFixed(2)}`, icon: <Zap className="w-5 h-5 text-yellow-400" />, color: "yellow", sub: "per trade" },
          ].map(({ label, value, icon, color, sub }) => (
            <Card key={label} className="trading-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground text-sm">{label}</p>
                  <div className={`p-2 bg-${color}-500/20 rounded-lg`}>{icon}</div>
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Current Streak */}
        {streak > 1 && (
          <Card className="trading-card border border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <Zap className="w-8 h-8 text-yellow-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">
                  {streak}-trade {streakType === "win" ? "winning" : "losing"} streak
                </p>
                <p className="text-slate-400 text-sm">
                  {streakType === "win" ? "Keep it up! You're on a hot streak." : "Stay disciplined and stick to your strategy."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/60 border border-slate-700 p-1 rounded-xl">
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-5">
              <BarChart3 className="w-4 h-4 mr-2" /> Performance
            </TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-5">
              <Target className="w-4 h-4 mr-2" /> Assets
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-5">
              <Award className="w-4 h-4 mr-2" /> Breakdown
            </TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6 mt-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">30-Day Net P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyChart}>
                    <defs>
                      <linearGradient id="netGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={4} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
                    />
                    <Area type="monotone" dataKey="net" stroke="#10b981" fill="url(#netGreen)" strokeWidth={2} name="Net P&L" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">Daily Trade Count</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={4} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Trades" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">Performance by Asset</CardTitle>
              </CardHeader>
              <CardContent>
                {assetData.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No trades yet</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={assetData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={80} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
                        />
                        <Bar dataKey="trades" fill="#3b82f6" radius={[0, 3, 3, 0]} name="Trades" />
                        <Bar dataKey="profit" radius={[0, 3, 3, 0]} name="P&L ($)">
                          {assetData.map((entry, i) => (
                            <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {assetData.map((a, i) => (
                        <div key={a.name} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-white font-medium">{a.name}</span>
                            <span className="text-slate-400 text-sm">{a.trades} trades</span>
                          </div>
                          <span className={`font-semibold ${a.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {a.profit >= 0 ? "+" : ""}${a.profit.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Breakdown Tab */}
          <TabsContent value="breakdown" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">Win / Loss Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  {totalTrades === 0 ? (
                    <p className="text-muted-foreground py-10">No trades yet</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsPie>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? "#10b981" : i === 1 ? "#ef4444" : "#64748b"} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                          <Legend formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>} />
                        </RechartsPie>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-3 gap-4 w-full mt-2">
                        <div className="text-center">
                          <p className="text-green-400 text-xl font-bold">{wins}</p>
                          <p className="text-slate-400 text-sm">Wins</p>
                        </div>
                        <div className="text-center">
                          <p className="text-red-400 text-xl font-bold">{losses}</p>
                          <p className="text-slate-400 text-sm">Losses</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-300 text-xl font-bold">{pending}</p>
                          <p className="text-slate-400 text-sm">Pending</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">Key Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Total Trades", value: totalTrades, color: "text-white" },
                    { label: "Win Rate", value: `${winRate}%`, color: "text-green-400" },
                    { label: "Total Profit", value: `$${totalProfit.toFixed(2)}`, color: "text-green-400" },
                    { label: "Total Loss", value: `$${totalLoss.toFixed(2)}`, color: "text-red-400" },
                    { label: "Net P&L", value: `${netPnL >= 0 ? "+" : ""}$${netPnL.toFixed(2)}`, color: netPnL >= 0 ? "text-green-400" : "text-red-400" },
                    { label: "Avg Trade Size", value: `$${avgAmount.toFixed(2)}`, color: "text-white" },
                    { label: "Current Balance", value: `$${balance.toFixed(2)}`, color: "text-blue-400" },
                    { label: "Current Streak", value: streak > 0 ? `${streak} ${streakType}s` : "—", color: streakType === "win" ? "text-green-400" : "text-red-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
