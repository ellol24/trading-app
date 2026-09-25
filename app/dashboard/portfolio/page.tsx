"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, DollarSign, PieChart,
  BarChart3, Target, Award, Activity, Loader2,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { supabase } from "@/lib/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type Trade = {
  id: string;
  asset: string;
  type: string;
  amount: number;
  result: "win" | "lose" | "pending" | null;
  profit_loss: number | null;
  roi_percentage: number | null;
  created_at: string;
  duration_sec: number | null;
};

type Investment = {
  id: string;
  amount: number;
  status: string;
  start_date: string | null;
  created_at: string;
  investment_packages: {
    title: string;
    roi_daily_percentage: number;
    duration_days: number;
  } | null;
};

type Deposit = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

const ALLOCATION_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

function classifyAsset(asset: string): string {
  const forexCurrencies = ["EUR", "GBP", "USD", "JPY", "CHF", "CAD", "AUD"];
  if (asset?.includes("/") && forexCurrencies.some((c) => asset.startsWith(c))) return "Forex";
  if (asset?.includes("/")) return "Crypto";
  return "Other";
}

export default function PortfolioPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [balance, setBalance] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  // ─── Derived analytics (memoized) ─────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.result === "win").length;
    const losingTrades = trades.filter((t) => t.result === "lose").length;
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : "0.0";
    const totalProfit = trades
      .filter((t) => t.result === "win")
      .reduce((sum, t) => sum + Number(t.profit_loss ?? 0), 0);
    const totalLoss = trades
      .filter((t) => t.result === "lose")
      .reduce((sum, t) => sum + Math.abs(Number(t.profit_loss ?? 0)), 0);
    const netPnL = totalProfit - totalLoss;
    const avgTradeAmount =
      totalTrades > 0 ? trades.reduce((sum, t) => sum + Number(t.amount ?? 0), 0) / totalTrades : 0;
    const bestTrade = trades.reduce(
      (best, t) => (Number(t.profit_loss ?? 0) > Number(best?.profit_loss ?? -Infinity) ? t : best),
      null as Trade | null
    );
    const worstTrade = trades.reduce(
      (worst, t) => (Number(t.profit_loss ?? 0) < Number(worst?.profit_loss ?? Infinity) ? t : worst),
      null as Trade | null
    );
    return { totalTrades, winningTrades, losingTrades, winRate, totalProfit, totalLoss, netPnL, avgTradeAmount, bestTrade, worstTrade };
  }, [trades]);

  // ─── Chart data (memoized) ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    const days: { name: string; profit: number; loss: number; net: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toLocaleDateString("en-US", { weekday: "short" });
      const dayTrades = trades.filter((t) => {
        const d = new Date(t.created_at);
        return d.toDateString() === date.toDateString();
      });
      const profit = dayTrades.filter((t) => t.result === "win").reduce((s, t) => s + Number(t.profit_loss ?? 0), 0);
      const loss = dayTrades.filter((t) => t.result === "lose").reduce((s, t) => s + Math.abs(Number(t.profit_loss ?? 0)), 0);
      days.push({ name: dayStr, profit: +profit.toFixed(2), loss: +loss.toFixed(2), net: +(profit - loss).toFixed(2) });
    }
    return days;
  }, [trades]);

  const monthlyData = useMemo(() => {
    const months: { name: string; pnl: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString("en-US", { month: "short" });
      const monthTrades = trades.filter((t) => {
        const d = new Date(t.created_at);
        return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
      });
      const profit = monthTrades.filter((t) => t.result === "win").reduce((s, t) => s + Number(t.profit_loss ?? 0), 0);
      const loss = monthTrades.filter((t) => t.result === "lose").reduce((s, t) => s + Math.abs(Number(t.profit_loss ?? 0)), 0);
      months.push({ name: monthName, pnl: +(profit - loss).toFixed(2) });
    }
    return months;
  }, [trades]);

  const assetAllocation = useMemo(() => {
    const assetMap: Record<string, number> = {};
    trades.forEach((t) => {
      const cat = classifyAsset(t.asset);
      assetMap[cat] = (assetMap[cat] || 0) + Number(t.amount ?? 0);
    });
    const totalAllocated = Object.values(assetMap).reduce((s, v) => s + v, 0);
    return Object.entries(assetMap).map(([name, amount]) => ({
      name,
      amount: +amount.toFixed(2),
      percentage: totalAllocated > 0 ? Math.round((amount / totalAllocated) * 100) : 0,
    }));
  }, [trades]);

  // ─── Data fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (uid: string) => {
    try {
      const [profileRes, tradesRes, invRes, depRes] = await Promise.all([
        supabase.from("user_profiles").select("balance").eq("uid", uid).single(),
        supabase
          .from("trades")
          .select("id, asset, type, amount, result, profit_loss, roi_percentage, created_at, duration_sec")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("investments")
          .select("id, amount, status, start_date, created_at, investment_packages(title, roi_daily_percentage, duration_days)")
          .eq("user_id", uid)
          .eq("status", "active"),
        supabase
          .from("deposits")
          .select("id, amount, status, created_at")
          .eq("user_id", uid)
          .in("status", ["approved", "confirmed"]),
      ]);

      if (profileRes.data) setBalance(Number(profileRes.data.balance) || 0);
      setTrades((tradesRes.data as Trade[]) || []);
      // Supabase returns joined table as array — normalize to single object
      const invNormalized: Investment[] = (invRes.data || []).map((inv: any) => ({
        ...inv,
        investment_packages: Array.isArray(inv.investment_packages)
          ? (inv.investment_packages[0] ?? null)
          : inv.investment_packages ?? null,
      }));
      setInvestments(invNormalized);
      const deps = (depRes.data as Deposit[]) || [];
      setTotalDeposited(deps.reduce((s, d) => s + Number(d.amount || 0), 0));
    } catch (err) {
      console.error("Portfolio fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      setUserId(data.user.id);
      fetchData(data.user.id);
    });
  }, [fetchData]);

  // ─── Real-time subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Trades: full refetch (aggregations depend on all trades)
    const tradesChannel = supabase
      .channel(`portfolio-trades-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${userId}` },
        () => fetchData(userId)
      )
      .subscribe();

    // Balance: fast delta update — no round-trip needed
    const balanceChannel = supabase
      .channel(`portfolio-balance-${userId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${userId}` },
        (payload) => {
          if (payload.new?.balance !== undefined) setBalance(Number(payload.new.balance));
        }
      )
      .subscribe();

    // Investments: refetch since we need joined package data
    const investmentsChannel = supabase
      .channel(`portfolio-investments-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "investments", filter: `user_id=eq.${userId}` },
        () => fetchData(userId)
      )
      .subscribe();

    // Deposits: refetch to recalculate totalDeposited
    const depositsChannel = supabase
      .channel(`portfolio-deposits-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${userId}` },
        () => fetchData(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(investmentsChannel);
      supabase.removeChannel(depositsChannel);
    };
  }, [userId, fetchData]);

  const { totalTrades, winningTrades, losingTrades, winRate, totalProfit, netPnL, avgTradeAmount, bestTrade, worstTrade } = analytics;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p>Loading your portfolio...</p>
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
            <h1 className="text-3xl font-bold text-white">{t("portfolio.portfolioTitle")}</h1>
            <p className="text-blue-200 mt-1">{t("portfolio.trackPerformance")}</p>
          </div>
          <Badge
            variant="outline"
            className={`${netPnL >= 0 ? "text-green-400 border-green-400 bg-green-400/10" : "text-red-400 border-red-400 bg-red-400/10"}`}
          >
            {netPnL >= 0 ? <TrendingUp className="w-4 h-4 mr-2" /> : <TrendingDown className="w-4 h-4 mr-2" />}
            {netPnL >= 0 ? "+" : ""}${netPnL.toFixed(2)} Net PnL
          </Badge>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{t("dashboard.totalBalance")}</p>
                  <p className="text-2xl font-bold text-white">${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{t("dashboard.totalProfit")}</p>
                  <p className="text-2xl font-bold text-green-400">+${totalProfit.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">From {winningTrades} wins</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Net P&L</p>
                  <p className={`text-2xl font-bold ${netPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {netPnL >= 0 ? "+" : ""}${netPnL.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">{totalTrades} total trades</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{t("portfolio.winRate")}</p>
                  <p className="text-2xl font-bold text-white">{winRate}%</p>
                  <p className="text-sm text-green-400">{winningTrades}W / {losingTrades}L</p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-background/20 border border-border/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary">{t("portfolio.overview")}</TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-primary">{t("portfolio.positions")}</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary">{t("portfolio.history")}</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary">{t("portfolio.analytics")}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Asset Allocation */}
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <PieChart className="w-5 h-5" />
                    <span>{t("portfolio.assetAllocation")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assetAllocation.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No trades yet</p>
                  ) : assetAllocation.map((item, idx) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length] }} />
                          <span className="text-white font-medium">{item.name}</span>
                        </div>
                        <span className="text-muted-foreground">{item.percentage}%</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Progress value={item.percentage} className="flex-1" />
                        <span className="text-white font-semibold text-sm">${item.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 7-Day Performance Chart */}
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>{t("portfolio.performanceChart")} (7 days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Bar dataKey="profit" fill="#10b981" radius={[3, 3, 0, 0]} name="Profit" />
                      <Bar dataKey="loss" fill="#ef4444" radius={[3, 3, 0, 0]} name="Loss" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Active Positions */}
          <TabsContent value="positions" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Active Investments ({investments.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {investments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No active investments</p>
                    <p className="text-sm mt-1">Visit the Packages page to start investing</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {investments.map((inv) => {
                      const roiDaily = Number(inv.investment_packages?.roi_daily_percentage ?? 0);
                      const durationDays = Number(inv.investment_packages?.duration_days ?? 0);
                      const expectedProfit = (Number(inv.amount) * (roiDaily / 100) * durationDays).toFixed(2);
                      const startTime = new Date(inv.start_date ?? inv.created_at).getTime();
                      const durationMs = durationDays * 24 * 60 * 60 * 1000;
                      const progress = Math.min(100, Math.max(0, ((Date.now() - startTime) / durationMs) * 100));
                      return (
                        <div key={inv.id} className="p-4 bg-background/20 rounded-lg border border-border/30">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-white font-semibold">{inv.investment_packages?.title}</h3>
                              <p className="text-muted-foreground text-sm">
                                ${Number(inv.amount).toLocaleString()} · {roiDaily}%/day · {durationDays} days
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-bold">+${expectedProfit}</p>
                              <p className="text-xs text-muted-foreground">Expected profit</p>
                            </div>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% complete</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trade History */}
          <TabsContent value="history" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span>{t("portfolio.recentTrades")} ({trades.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No trades yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {trades.map((trade) => (
                      <div key={trade.id} className="p-4 bg-background/20 rounded-lg border border-border/30 hover:bg-background/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-white font-semibold">{trade.asset}</h3>
                                <Badge variant="outline" className={trade.type === "CALL" ? "text-green-400 border-green-400" : "text-red-400 border-red-400"}>
                                  {trade.type === "CALL" ? "HIGHER" : "LOWER"}
                                </Badge>
                                <Badge variant="outline" className={
                                  trade.result === "win" ? "text-green-400 border-green-400 bg-green-400/10" :
                                    trade.result === "lose" ? "text-red-400 border-red-400 bg-red-400/10" :
                                      "text-yellow-400 border-yellow-400 bg-yellow-400/10"
                                }>
                                  {trade.result?.toUpperCase() || "PENDING"}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-sm">
                                {new Date(trade.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-semibold">${trade.amount}</p>
                            <p className={`text-sm font-bold ${(trade.profit_loss ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {trade.result === "win" ? `+$${(trade.profit_loss ?? 0).toFixed(2)}` :
                                trade.result === "lose" ? `-$${Math.abs(trade.profit_loss ?? 0).toFixed(2)}` :
                                  "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">{t("portfolio.tradingStats")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: t("portfolio.totalTrades"), value: totalTrades, color: "text-white" },
                    { label: t("portfolio.winningTrades"), value: winningTrades, color: "text-green-400" },
                    { label: t("portfolio.losingTrades"), value: losingTrades, color: "text-red-400" },
                    { label: t("portfolio.winRate"), value: `${winRate}%`, color: "text-green-400" },
                    { label: t("portfolio.avgTrade"), value: `$${avgTradeAmount.toFixed(2)}`, color: "text-white" },
                    { label: t("portfolio.bestTrade"), value: bestTrade ? `+$${Number(bestTrade.profit_loss ?? 0).toFixed(2)}` : "—", color: "text-green-400" },
                    { label: t("portfolio.worstTrade"), value: worstTrade ? `-$${Math.abs(Number(worstTrade.profit_loss ?? 0)).toFixed(2)}` : "—", color: "text-red-400" },
                    { label: "Total Deposited", value: `$${totalDeposited.toFixed(2)}`, color: "text-blue-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-border/20 last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Monthly Performance Chart */}
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">{t("portfolio.monthlyPerformance")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pnl"
                        stroke="#3b82f6"
                        fill="url(#pnlGrad)"
                        strokeWidth={2}
                        name="Net P&L"
                        dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
