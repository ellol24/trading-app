"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { processReferralCommissions } from "@/lib/actions/commissions";
import { useLanguage } from "@/contexts/language-context";
import { TRADING_PAIRS } from "@/lib/trading-pairs";
import {
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Timer,
  Hourglass,
  Flame,
  Radio,
} from "lucide-react";

type TradeRound = {
  id: string;
  symbol: string;
  start_time: string;
  duration_sec: number;
  payout_percent: number;
  entry_window_sec: number;
  status: "scheduled" | "active" | "completed" | "canceled";
  admin_direction: "buy" | "sell" | null;
  forced_outcome: "win" | "lose" | "draw" | null;
  created_at?: string;
};

type TradeItem = {
  id: string;
  user_id: string;
  trade_round_id: string;
  asset: string;
  amount: number;
  type: string;
  result: string | null;
  profit_loss: number | null;
  roi_percentage: number;
  created_at: string;
  user_email?: string;
  user_name?: string;
};

type Outcome = "win" | "lose" | "draw";

function formatSeconds(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export default function AdminTradingControlsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [rounds, setRounds] = useState<TradeRound[]>([]);
  const [symbol, setSymbol] = useState<string>("EUR/USD");
  const [duration, setDuration] = useState(60);
  const [payout, setPayout] = useState(2);
  const [entryWindow, setEntryWindow] = useState(30);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [signaling, setSignaling] = useState(false);
  const [autoBroadcastOnCreate, setAutoBroadcastOnCreate] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // Expandable trades state
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});
  const [roundTrades, setRoundTrades] = useState<Record<string, TradeItem[]>>({});
  const [loadingTrades, setLoadingTrades] = useState<Record<string, boolean>>({});

  const [selectedOutcome, setSelectedOutcome] = useState<
    Record<string, Outcome>
  >({});

  // Global trading limits
  const [minTradeAmount, setMinTradeAmount] = useState<number>(1);
  const [suggestedAmounts, setSuggestedAmounts] = useState<string>("10, 25, 50, 100, 250, 500");
  const [savingLimits, setSavingLimits] = useState(false);

  // 1-second countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTradingLimits = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "trading_limits")
      .maybeSingle();
    if (data?.value) {
      const v = data.value as any;
      setMinTradeAmount(Number(v.min_trade_amount) || 1);
      setSuggestedAmounts(
        Array.isArray(v.suggested_amounts)
          ? v.suggested_amounts.join(", ")
          : "10, 25, 50, 100, 250, 500"
      );
    }
  };

  const saveTradingLimits = async () => {
    setSavingLimits(true);
    const parsedAmounts = suggestedAmounts
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    const value = { min_trade_amount: minTradeAmount, suggested_amounts: parsedAmounts };
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "trading_limits", value }, { onConflict: "key" });
    setSavingLimits(false);
    if (error) {
      toast({ title: "Error saving limits", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Trading limits saved", description: "All users will see updated limits instantly." });
    }
  };

  // جلب الجولات
  const fetchRounds = useCallback(async () => {
    const { data, error } = await supabase
      .from("trade_rounds")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setRounds(data ?? []);
  }, [toast]);

  useEffect(() => {
    fetchRounds();
    fetchTradingLimits();

    const interval = setInterval(() => {
      fetchRounds();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchRounds]);

  // ✅ Auto-commence trade when entry window ends
  useEffect(() => {
    const currentNow = now;
    rounds.forEach(async (r) => {
      if (r.status === "scheduled") {
        const startMs = new Date(r.start_time).getTime();
        // If entry window countdown has concluded, immediately transition to active!
        if (currentNow >= startMs) {
          const { error } = await supabase
            .from("trade_rounds")
            .update({ status: "active" })
            .eq("id", r.id)
            .eq("status", "scheduled");
          if (!error) {
            fetchRounds();
          }
        }
      }
    });
  }, [now, rounds, fetchRounds]);

  // Fetch trades for a specific round
  const toggleExpandTrades = async (roundId: string) => {
    const nextState = !expandedRounds[roundId];
    setExpandedRounds((prev) => ({ ...prev, [roundId]: nextState }));

    if (nextState && !roundTrades[roundId]) {
      setLoadingTrades((prev) => ({ ...prev, [roundId]: true }));
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("trade_round_id", roundId);

      if (data) {
        // Fetch user profiles for these trades to display names
        const userIds = Array.from(new Set(data.map((t) => t.user_id)));
        let profileMap: Record<string, { full_name?: string; email?: string }> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("uid, full_name, email")
            .in("uid", userIds);
          (profiles || []).forEach((p) => {
            profileMap[p.uid] = p;
          });
        }

        const enriched = data.map((t) => ({
          ...t,
          user_name: profileMap[t.user_id]?.full_name || "Trader",
          user_email: profileMap[t.user_id]?.email || "",
        }));

        setRoundTrades((prev) => ({ ...prev, [roundId]: enriched }));
      }
      setLoadingTrades((prev) => ({ ...prev, [roundId]: false }));
    }
  };

  // 📢 بث إشعار صفقة تداول عبر تيليجرام
  const broadcastTradeSignal = async (roundData?: {
    symbol: string;
    duration_sec: number;
    payout_percent: number;
    direction: "buy" | "sell";
  }) => {
    setSignaling(true);
    try {
      const payload = roundData || {
        symbol,
        duration_sec: duration,
        payout_percent: payout,
        direction,
      };

      const res = await fetch("/api/admin/bots/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: "📢 إشعار التيليجرام مرسل",
          description: `تم بث إشارة التداول بنجاح إلى ${data.successCount} متداول ${data.groupBroadcast ? "والمجموعة الرسمية ✅" : ""}`,
        });
      } else {
        toast({
          title: "فشل الإرسال",
          description: data.error || "تعذر إرسال الإشعار",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSignaling(false);
    }
  };

  // ✅ إنشاء جولة جديدة مع بدء عداد نافذة الدخول فوراً
  const createRound = async () => {
    setLoading(true);
    const entrySec = Math.max(5, Number(entryWindow) || 30);
    const durSec = Math.max(10, Number(duration) || 60);
    const nowMs = Date.now();

    // يبدأ التداول الفعلي فور انتهاء نافذة الدخول
    const startTime = new Date(nowMs + entrySec * 1000).toISOString();

    const { error } = await supabase.from("trade_rounds").insert([
      {
        symbol,
        duration_sec: durSec,
        payout_percent: Number(payout) || 2,
        entry_window_sec: entrySec,
        status: "scheduled",
        admin_direction: direction,
        start_time: startTime,
        created_at: new Date(nowMs).toISOString(),
      },
    ]);
    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✅ Round Created",
        description: `Entry window started (${entrySec}s). Trade will commence automatically upon conclusion!`,
      });
      fetchRounds();

      // Auto-broadcast if enabled
      if (autoBroadcastOnCreate) {
        broadcastTradeSignal({
          symbol,
          duration_sec: durSec,
          payout_percent: Number(payout) || 2,
          direction,
        });
      }
    }
  };

  // تفعيل الجولة يدوياً (تخطي نافذة الدخول)
  const activateRoundImmediately = async (id: string) => {
    const { error } = await supabase
      .from("trade_rounds")
      .update({ status: "active", start_time: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Round started", description: "The round is now live immediately." });
      fetchRounds();
    }
  };

  // ✅ إكمال الجولة + توزيع الأرباح + العمولات
  const completeRoundWithOutcome = async (roundId: string) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;

    const outcome =
      selectedOutcome[roundId] ?? round.forced_outcome ?? "";

    if (!outcome) {
      toast({
        title: "No outcome selected",
        description: "Please select Win, Lose, or Draw before completing the round.",
        variant: "destructive",
      });
      return;
    }

    const finalOutcome = outcome as "win" | "lose" | "draw";
    const isAdminBuy = round.admin_direction === "buy";

    const { error: errRound } = await supabase
      .from("trade_rounds")
      .update({ status: "completed", forced_outcome: outcome })
      .eq("id", roundId);

    if (errRound) {
      toast({
        title: "Error",
        description: errRound.message,
        variant: "destructive",
      });
      return;
    }

    // جلب الصفقات الخاصة بالجولة
    const { data: trades, error: errTrades } = await supabase
      .from("trades")
      .select("*")
      .eq("trade_round_id", roundId);

    if (errTrades) {
      toast({
        title: "Error loading trades",
        description: errTrades.message,
        variant: "destructive",
      });
      return;
    }

    // معالجة نتائج الصفقات وتحديث الأرصدة
    for (const trade of trades || []) {
      let result: "win" | "lose" | "draw" = "lose";
      let profit = 0;

      if (finalOutcome === "draw") {
        result = "draw";
        profit = 0;
      } else {
        const userBuy = trade.type === "CALL" || trade.type === "BUY";
        const userSell = trade.type === "PUT" || trade.type === "SELL";

        if (
          (isAdminBuy && userBuy && finalOutcome === "win") ||
          (!isAdminBuy && userSell && finalOutcome === "win")
        ) {
          result = "win";
          profit = trade.amount * (trade.roi_percentage / 100);
        } else {
          result = "lose";
          profit = -trade.amount;
        }
      }

      await supabase
        .from("trades")
        .update({
          result,
          profit_loss: profit,
          settled: true,
          settled_at: new Date().toISOString(),
        })
        .eq("id", trade.id);

      if (result === "win" || result === "draw") {
        const { data: user } = await supabase
          .from("user_profiles")
          .select("uid, balance")
          .eq("uid", trade.user_id)
          .single();

        if (user) {
          let newBalance = Number(user.balance || 0);

          if (result === "win") {
            newBalance += trade.amount + profit;
          } else if (result === "draw") {
            newBalance += trade.amount;
          }

          await supabase
            .from("user_profiles")
            .update({ balance: newBalance })
            .eq("uid", user.uid);

          if (result === "win" && profit > 0) {
            await processReferralCommissions(trade.user_id, profit, "trade");
          }
        }
      }
    }

    toast({
      title: "Round settled successfully",
      description: `All trades marked as ${outcome}.`,
    });

    fetchRounds();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* 🎛️ Global Trading Configuration */}
        <Card className="bg-slate-800/60 border-blue-500/30 shadow-xl shadow-blue-900/20">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white flex items-center gap-2">
              🎛️ {t("admin.globalTradingConfig") || "Global Trading Configuration"}
            </CardTitle>
            <p className="text-sm text-slate-400">
              {t("admin.globalTradingConfigDesc") ||
                "Set the minimum entry amount and suggested quick-amounts for all users on the trading page."}
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-white font-semibold">
                {t("admin.minEntryAmount") || "Minimum Entry Amount ($)"}
              </Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                className="bg-slate-900 border-slate-700 text-white text-lg"
                value={minTradeAmount}
                onChange={(e) => setMinTradeAmount(Number(e.target.value))}
              />
              <p className="text-xs text-slate-500">
                {t("admin.minEntryAmountDesc") || "Users cannot trade below this amount."}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-white font-semibold">
                {t("admin.suggestedQuickAmounts") || "Suggested Quick Amounts (comma-separated)"}
              </Label>
              <Input
                className="bg-slate-900 border-slate-700 text-white"
                placeholder="10, 25, 50, 100, 250, 500"
                value={suggestedAmounts}
                onChange={(e) => setSuggestedAmounts(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                {t("admin.suggestedQuickAmountsDesc") ||
                  "These appear as quick-select buttons on the trading page."}
              </p>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button
                onClick={saveTradingLimits}
                disabled={savingLimits}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-2 shadow-lg shadow-blue-600/20"
              >
                {savingLimits
                  ? t("admin.saving") || "Saving..."
                  : `💾 ${t("admin.saveTradingLimits") || "Save Trading Limits"}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Create New Round ── */}
        <Card className="bg-slate-800/80 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              {t("admin.createNewRound") || "Create New Round"}
            </CardTitle>
            <p className="text-xs text-slate-400">
              When created, the entry window countdown starts immediately, and the trade commences automatically when the entry window concludes.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Symbol / Pair - Synced with User Facing pairs */}
            <div className="space-y-2">
              <Label className="text-white font-medium">{t("admin.symbol") || "Pair / Symbol"}</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-64">
                  {TRADING_PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair} className="font-mono text-sm hover:bg-slate-800">
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration (seconds) */}
            <div className="space-y-2">
              <Label className="text-white font-medium">
                {t("admin.durationSeconds") || "Trade Duration (seconds)"}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={10}
                  className="bg-slate-900 border-slate-700 text-white pr-14"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">
                  {formatSeconds(duration)}
                </span>
              </div>
            </div>

            {/* Payout % ROI */}
            <div className="space-y-2">
              <Label className="text-white font-medium">{t("admin.payoutROI") || "Payout % (ROI)"}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="bg-slate-900 border-slate-700 text-white"
                value={payout}
                onChange={(e) => setPayout(Number(e.target.value))}
              />
            </div>

            {/* Entry Window (seconds) */}
            <div className="space-y-2">
              <Label className="text-white font-medium flex items-center justify-between">
                <span>{t("admin.entryWindowSec") || "Entry Window (seconds)"}</span>
                <span className="text-xs text-amber-400 font-normal">Countdown starts upon creation</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={5}
                  className="bg-slate-900 border-slate-700 text-white pr-14"
                  value={entryWindow}
                  onChange={(e) => setEntryWindow(Number(e.target.value))}
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">
                  {formatSeconds(entryWindow)}
                </span>
              </div>
            </div>

            {/* Admin Winning Direction */}
            <div className="space-y-2">
              <Label className="text-white font-medium">{t("admin.adminDirection") || "Target Direction"}</Label>
              <Select
                value={direction}
                onValueChange={(v: "buy" | "sell") => setDirection(v)}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="buy" className="text-green-400 font-semibold">
                    ▲ {t("admin.buy") || "Buy (CALL)"}
                  </SelectItem>
                  <SelectItem value="sell" className="text-red-400 font-semibold">
                    ▼ {t("admin.sell") || "Sell (PUT)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-700/60 mt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoBroadcastOnCreate}
                  onChange={(e) => setAutoBroadcastOnCreate(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>📢 إرسال إشعار فوري لجميع المشتركين والمجموعة عبر تيليجرام عند الإنشاء</span>
              </label>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => broadcastTradeSignal()}
                  disabled={signaling}
                  className="border-blue-500/50 text-blue-300 hover:bg-blue-600/20 text-xs h-10 px-4"
                >
                  <Radio className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                  {signaling ? "جاري البث..." : "📢 بث إشارة فورية"}
                </Button>

                <Button
                  onClick={createRound}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-6 shadow-lg shadow-blue-600/20"
                >
                  {loading
                    ? t("admin.creating") || "Creating..."
                    : `🚀 ${t("admin.createRoundBtn") || "Create Round"}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Rounds List with Duration & Countdown Indicators ── */}
        <Card className="bg-slate-800/80 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white flex items-center justify-between">
              <span>{t("admin.rounds") || "Rounds & Trades"}</span>
              <span className="text-xs font-normal text-slate-400">Total: {rounds.length} rounds</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rounds.length === 0 ? (
              <p className="text-blue-200 py-6 text-center">{t("admin.noRoundsYet") || "No rounds yet."}</p>
            ) : (
              rounds.map((r) => {
                const startMs = new Date(r.start_time).getTime();
                const entryWindowMs = (r.entry_window_sec || 30) * 1000;
                const endMs = startMs + r.duration_sec * 1000;

                // Entry window countdown
                const entrySecsLeft = Math.max(0, Math.ceil((startMs - now) / 1000));
                const entryProgress = Math.min(
                  100,
                  Math.max(0, ((entryWindowMs - (startMs - now)) / entryWindowMs) * 100)
                );

                // Trade duration countdown
                const isTradeActive = r.status === "active" || (r.status === "scheduled" && entrySecsLeft === 0);
                const tradeSecsLeft = Math.max(0, Math.ceil((endMs - now) / 1000));
                const elapsedSecs = Math.min(
                  r.duration_sec,
                  Math.max(0, Math.floor((now - startMs) / 1000))
                );
                const tradeProgress = Math.min(100, Math.max(0, (elapsedSecs / r.duration_sec) * 100));

                const isCompleted = r.status === "completed";
                const isCanceled = r.status === "canceled";
                const isExpanded = !!expandedRounds[r.id];
                const tradesList = roundTrades[r.id] || [];

                return (
                  <div
                    key={r.id}
                    className="flex flex-col bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 gap-4 shadow-md transition-all"
                  >
                    {/* Top Row: Symbol, Direction, Status, Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-white text-lg font-bold font-mono">{r.symbol}</span>
                        <Badge
                          variant="outline"
                          className={
                            r.admin_direction === "buy"
                              ? "text-green-400 border-green-500/40 bg-green-500/10"
                              : "text-red-400 border-red-500/40 bg-red-500/10"
                          }
                        >
                          {r.admin_direction === "buy" ? "▲ BUY" : "▼ SELL"}
                        </Badge>
                        <Badge
                          className={
                            isCompleted
                              ? "bg-slate-700 text-slate-200"
                              : isTradeActive
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }
                        >
                          {isCompleted
                            ? "COMPLETED"
                            : isTradeActive
                            ? "ACTIVE (LIVE)"
                            : "ENTRY WINDOW"}
                        </Badge>
                      </div>

                      {/* Right Action Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Select Outcome */}
                        <Select
                          value={selectedOutcome[r.id] ?? r.forced_outcome ?? ""}
                          onValueChange={(v: Outcome) =>
                            setSelectedOutcome((old) => ({ ...old, [r.id]: v }))
                          }
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-[120px] h-9 text-xs">
                            <SelectValue placeholder={t("admin.selectOutcome") || "Outcome"} />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white text-xs">
                            <SelectItem value="win" className="text-green-400 font-semibold">
                              Win
                            </SelectItem>
                            <SelectItem value="lose" className="text-red-400 font-semibold">
                              Lose
                            </SelectItem>
                            <SelectItem value="draw" className="text-yellow-400 font-semibold">
                              Draw
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Force Start button (if in entry window) */}
                        {r.status === "scheduled" && entrySecsLeft > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30"
                            onClick={() => activateRoundImmediately(r.id)}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Start Now
                          </Button>
                        )}

                        {/* Broadcast Signal button */}
                        {!isCompleted && !isCanceled && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs border-blue-500/40 text-blue-300 hover:bg-blue-600/20"
                            onClick={() =>
                              broadcastTradeSignal({
                                symbol: r.symbol,
                                duration_sec: r.duration_sec,
                                payout_percent: r.payout_percent,
                                direction: (r.admin_direction as "buy" | "sell") || "buy",
                              })
                            }
                            disabled={signaling}
                          >
                            <Radio className="w-3.5 h-3.5 mr-1 text-blue-400" />
                            بث إشارة
                          </Button>
                        )}

                        {/* Complete Round Button */}
                        {!isCompleted && !isCanceled && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-9 text-xs"
                            onClick={() => completeRoundWithOutcome(r.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {t("admin.completeRound") || "Settle"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* ── REQUIRED INDICATOR: Duration & Live Countdown Section ── */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        {/* ⏱️ Duration Specified Indicator */}
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-md">
                            <Timer className="w-3.5 h-3.5 text-blue-400" />
                            {t("admin.durationSpecified") || "Duration"}:{" "}
                            <span className="text-white font-mono font-bold">
                              {r.duration_sec}s ({formatSeconds(r.duration_sec)})
                            </span>
                          </span>

                          <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-md">
                            <Hourglass className="w-3.5 h-3.5 text-amber-400" />
                            Entry Window: <span className="font-mono text-white">{r.entry_window_sec || 30}s</span>
                          </span>

                          <span className="text-slate-400 text-xs">
                            Payout: <span className="text-green-400 font-semibold">{r.payout_percent}%</span>
                          </span>
                        </div>

                        {/* Participant counter toggle button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpandTrades(r.id)}
                          className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                        >
                          <Users className="w-3.5 h-3.5 mr-1 text-blue-400" />
                          Participants
                          {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                        </Button>
                      </div>

                      {/* Phase Indicator Alert & Progress Bar */}
                      {r.status === "scheduled" && entrySecsLeft > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              Entry Window Counting Down — Trade commences in:
                            </span>
                            <span className="font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                              {entrySecsLeft}s remaining
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-500 h-full transition-all duration-1000 ease-linear rounded-full"
                              style={{ width: `${100 - entryProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Active Trade in Progress */}
                      {isTradeActive && !isCompleted && !isCanceled && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              {tradeSecsLeft > 0
                                ? "Trade In Progress (Live):"
                                : "Trade Duration Concluded:"}
                            </span>
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded ${
                                tradeSecsLeft > 0
                                  ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                                  : "text-blue-300 bg-blue-500/10 border border-blue-500/30"
                              }`}
                            >
                              {tradeSecsLeft > 0
                                ? `${tradeSecsLeft}s / ${r.duration_sec}s remaining`
                                : "0s — Awaiting Settlement"}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                                tradeSecsLeft > 0 ? "bg-emerald-500" : "bg-blue-500"
                              }`}
                              style={{ width: `${tradeProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Completed State */}
                      {isCompleted && (
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Completed Round (Total Duration: {r.duration_sec}s)
                          </span>
                          <span className="font-semibold text-white">
                            Outcome:{" "}
                            <span
                              className={
                                r.forced_outcome === "win"
                                  ? "text-emerald-400"
                                  : r.forced_outcome === "lose"
                                  ? "text-red-400"
                                  : "text-yellow-400"
                              }
                            >
                              {r.forced_outcome?.toUpperCase() || "N/A"}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Expandable User Trades Section */}
                    {isExpanded && (
                      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 mt-1">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
                          <span>User Trades entered during entry window</span>
                          <span>{tradesList.length} total orders</span>
                        </div>

                        {loadingTrades[r.id] && (
                          <p className="text-xs text-slate-500 py-3 text-center">Loading participants…</p>
                        )}

                        {!loadingTrades[r.id] && tradesList.length === 0 && (
                          <p className="text-xs text-slate-500 py-3 text-center">
                            No users have entered this round yet.
                          </p>
                        )}

                        {!loadingTrades[r.id] && tradesList.length > 0 && (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {tradesList.map((tr) => (
                              <div
                                key={tr.id}
                                className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-white">{tr.user_name}</span>{" "}
                                  <span className="text-slate-500 text-[11px]">({tr.user_email})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-semibold ${
                                      tr.type === "CALL" || tr.type === "BUY"
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {tr.type}
                                  </span>
                                  <span className="font-mono text-white font-bold">${tr.amount}</span>
                                  {tr.result && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] h-5 ${
                                        tr.result === "win"
                                          ? "text-green-400 border-green-500/30"
                                          : tr.result === "lose"
                                          ? "text-red-400 border-red-500/30"
                                          : "text-yellow-400 border-yellow-500/30"
                                      }`}
                                    >
                                      {tr.result.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
