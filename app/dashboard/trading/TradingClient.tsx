"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import ForexChart from "@/components/ui/trading-chart";
import { Clock, ShieldAlert, Zap, TrendingUp, TrendingDown, Hourglass, Timer } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { TRADING_PAIRS } from "@/lib/trading-pairs";

type TradingClientProps = {
  user: any;
  profile: any;
};

type TradeRound = {
  id: string;
  symbol: string;
  start_time: string;
  duration_sec: number;
  payout_percent: number;
  forced_outcome: "win" | "lose" | "draw" | null;
  entry_window_sec: number;
  status: "scheduled" | "active" | "completed" | "canceled";
  // admin_direction is intentionally NOT included in the type to prevent accidental exposure
};

type IntervalType = "1min" | "5min" | "15min" | "30min" | "1h";

export default function TradingClient({ user, profile }: TradingClientProps) {
  const { t } = useLanguage();

  const PERIODS: { value: IntervalType; label: string }[] = [
    { value: "1min", label: `1 ${t("common.minute") || "min"}` },
    { value: "5min", label: `5 ${t("common.minutes") || "min"}` },
    { value: "15min", label: `15 ${t("common.minutes") || "min"}` },
    { value: "30min", label: `30 ${t("common.minutes") || "min"}` },
    { value: "1h", label: `1 ${t("common.hour") || "h"}` },
  ];

  const [symbol, setSymbol] = useState("EUR/USD");
  const [amount, setAmount] = useState<number>(100);
  const [period, setPeriod] = useState<IntervalType>("5min");
  const [now, setNow] = useState(Date.now());
  const [deals, setDeals] = useState<TradeRound[]>([]);
  const [joinedRounds, setJoinedRounds] = useState<string[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(Number(profile?.balance || 0));
  const [minTradeAmount, setMinTradeAmount] = useState<number>(1);
  const [quickAmounts, setQuickAmounts] = useState<number[]>([10, 25, 50, 100, 250, 500]);
  const [isTrading, setIsTrading] = useState(false);

  const userId = user?.id;

  // 1-second countdown ticker with auto-commencing when entry window concludes
  useEffect(() => {
    const id = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      // Auto-transition scheduled rounds to active when entry window ends
      deals.forEach(async (d) => {
        if (d.status === "scheduled") {
          const startMs = new Date(d.start_time).getTime();
          if (currentNow >= startMs) {
            await supabase
              .from("trade_rounds")
              .update({ status: "active" })
              .eq("id", d.id)
              .eq("status", "scheduled");
            fetchDeals();
          }
        }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [deals]);

  useEffect(() => {
    const fetchTradingLimits = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "trading_limits")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        if (v.min_trade_amount) setMinTradeAmount(Number(v.min_trade_amount));
        if (Array.isArray(v.suggested_amounts) && v.suggested_amounts.length > 0) {
          setQuickAmounts(v.suggested_amounts);
        }
      }
    };
    fetchTradingLimits();
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("balance")
      .eq("uid", userId)
      .single();
    if (data) setBalance(Number(data.balance) || 0);
  }, [userId]);

  const fetchDeals = useCallback(async () => {
    const { data } = await supabase
      .from("trade_rounds")
      // Explicitly select only safe fields — never select admin_direction
      .select("id, symbol, start_time, duration_sec, payout_percent, forced_outcome, entry_window_sec, status")
      .order("start_time", { ascending: true });
    setDeals(data || []);
  }, []);

  const fetchJoined = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("user_rounds")
      .select("trade_round_id")
      .eq("user_id", userId);
    if (data) setJoinedRounds(data.map((d) => d.trade_round_id));
  }, [userId]);

  const fetchTrades = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("trades")
      .select("id, asset, type, amount, result, profit_loss, roi_percentage, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setTrades(data || []);
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (!userId) return;
    fetchDeals();
    fetchJoined();
    fetchTrades();
    fetchBalance();
  }, [userId, fetchDeals, fetchJoined, fetchTrades, fetchBalance]);

  // Periodic polling fallback
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      fetchDeals();
      fetchTrades();
      fetchBalance();
      fetchJoined();
    }, 12000);

    return () => clearInterval(interval);
  }, [userId, fetchDeals, fetchTrades, fetchBalance, fetchJoined]);

  // ─── Round Resolution (Entry Window vs Active Trade) ─────────────────────────
  // Active Deal: live trade currently in progress
  const activeDeal = useMemo(
    () =>
      deals.find(
        (d) =>
          d.status === "active" ||
          (d.status === "scheduled" && new Date(d.start_time).getTime() <= now)
      ) || null,
    [deals, now]
  );

  // Entry Deal: round currently in its Entry Window phase
  const entryDeal = useMemo(
    () =>
      deals.find(
        (d) =>
          d.status === "scheduled" && new Date(d.start_time).getTime() > now
      ) || null,
    [deals, now]
  );

  // Next scheduled deal (future)
  const nextDeal = entryDeal || null;

  // The deal that is currently actionable for user entry
  const currentDeal = entryDeal || activeDeal;

  const secondsUntil = (time: string | number) =>
    Math.max(0, Math.floor((new Date(time).getTime() - now) / 1000));

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const joinRound = async (roundId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("user_rounds").upsert(
      {
        user_id: userId,
        trade_round_id: roundId,
      },
      { onConflict: "user_id, trade_round_id" }
    );
    if (error && error.code !== "23505" && error.code !== "409") {
      toast.error(`❌ ${t("trading.joinFailed")}: ${error.message}`);
    } else {
      toast.success(`✅ ${t("trading.joinSuccess")}`);
      setJoinedRounds((prev) => [...prev, roundId]);
    }
  };

  // ✅ Place trade: User can enter during the Entry Window or while active!
  const onTrade = async (type: "CALL" | "PUT") => {
    const targetDeal = currentDeal;
    if (!targetDeal) {
      toast.warning(`⚠️ ${t("trading.noActiveRound") || "No active round or open entry window"}`);
      return;
    }
    if (!userId) {
      toast.error(`❌ ${t("trading.loginRequired")}`);
      return;
    }
    if (balance < amount) {
      toast.error(`❌ ${t("trading.insufficientBalance")}`);
      return;
    }
    if (amount < minTradeAmount) {
      toast.warning(`⚠️ Minimum trade amount is $${minTradeAmount}`);
      return;
    }

    setIsTrading(true);

    // Auto-join round if needed
    if (!joinedRounds.includes(targetDeal.id)) {
      await supabase.from("user_rounds").upsert(
        { user_id: userId, trade_round_id: targetDeal.id },
        { onConflict: "user_id, trade_round_id" }
      );
      setJoinedRounds((prev) => [...prev, targetDeal.id]);
    }

    const { error } = await supabase.from("trades").insert([
      {
        user_id: userId,
        trade_round_id: targetDeal.id,
        asset: symbol,
        amount,
        duration_sec: targetDeal.duration_sec,
        roi_percentage: targetDeal.payout_percent,
        type,
      },
    ]);

    if (error) {
      if (error.message.includes("duplicate key value") || error.code === "23505") {
        toast.warning(`⚠️ ${t("trading.alreadyEntered") || "You have already entered this round"}`);
      } else {
        toast.error(`❌ ${t("trading.placeTradeError")}: ${error.message}`);
      }
    } else {
      toast.success(
        `✅ ${t("trading.tradePlacedSuccess")} (${type === "CALL" ? "BUY ▲" : "SELL ▼"} ${symbol} $${amount})`
      );
      // Instant local balance feedback
      setBalance((prev) => Math.max(0, prev - amount));
      fetchTrades();
      fetchBalance();
    }
    setIsTrading(false);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6"
      translate="no"
      data-react-protected
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assets Grid - Using exact TRADING_PAIRS */}
          <Card className="trading-card" translate="no">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-white">{t("trading.selectAsset")}</CardTitle>
              {activeDeal ? (
                <Badge className="bg-emerald-500/20 border-emerald-400 text-emerald-300 animate-pulse w-fit">
                  {t("trading.live") || "LIVE"}
                </Badge>
              ) : entryDeal ? (
                <Badge className="bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse w-fit">
                  ENTRY WINDOW
                </Badge>
              ) : (
                <Badge className="bg-transparent border-slate-400/40 text-slate-200 w-fit">
                  {t("trading.waiting") || "WAITING"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {TRADING_PAIRS.map((s) => (
                  <Button
                    key={s}
                    variant={symbol === s ? "default" : "outline"}
                    className={`w-full text-xs sm:text-sm font-mono transition-all ${
                      symbol === s
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 font-bold"
                        : "border-slate-700 bg-slate-800/40 text-slate-300 hover:text-white"
                    }`}
                    onClick={() => setSymbol(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Round Status Banner (Entry Window vs Live Trade) ── */}
          <Card className="trading-card" translate="no">
            <CardContent className="py-4">
              {entryDeal ? (
                // 🟡 Phase 1: Entry Window Countdown
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-amber-200 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-white font-bold">{entryDeal.symbol}</span>
                    <span className="text-amber-300 font-semibold">
                      {t("trading.entryWindowOpen") || "Entry Window Open — Trade commences in:"}
                    </span>
                    <span className="font-mono text-white bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded text-sm font-bold">
                      {formatCountdown(secondsUntil(entryDeal.start_time))}
                    </span>
                    <span className="text-sm">•</span>
                    <span className="text-slate-300">
                      Duration: {entryDeal.duration_sec}s
                    </span>
                    <span className="text-sm">•</span>
                    <span className="text-green-400 font-semibold">
                      {t("trading.payoutLabel")} {entryDeal.payout_percent}%
                    </span>
                  </div>
                  <Hourglass className="w-5 h-5 text-amber-400 shrink-0" />
                </div>
              ) : activeDeal ? (
                // 🟢 Phase 2: Live Trade in progress
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-blue-200 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-bold">{activeDeal.symbol}</span>
                    <span className="text-emerald-300 font-semibold">{t("trading.roundLive")}</span>
                    <span className="text-sm">•</span>
                    <span className="text-blue-300">{t("trading.endsIn")}</span>
                    <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded text-sm font-bold">
                      {formatCountdown(
                        secondsUntil(
                          new Date(activeDeal.start_time).getTime() + activeDeal.duration_sec * 1000
                        )
                      )}
                    </span>
                    <span className="text-sm">•</span>
                    <span className="text-slate-300">Duration: {activeDeal.duration_sec}s</span>
                    <span className="text-sm">•</span>
                    <span className="text-green-400 font-semibold">
                      {t("trading.payoutLabel")} {activeDeal.payout_percent}%
                    </span>
                  </div>
                  <Timer className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>
              ) : (
                // ⚪ No scheduled round
                <div className="flex items-center gap-2 text-blue-200">
                  <ShieldAlert className="w-4 h-4 opacity-60" />
                  {t("trading.noScheduledRounds") || "No scheduled rounds currently. Please wait for the next signal."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart */}
          <ForexChart from={symbol.split("/")[0]} to={symbol.split("/")[1]} interval={period} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Trade Setup */}
          <Card className="trading-card" translate="no">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                {t("trading.tradeSetup")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Balance display */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                <span className="text-blue-300 text-sm">{t("dashboard.availableBalance")}</span>
                <span className="text-white font-bold text-lg">${balance.toFixed(2)}</span>
              </div>

              {/* Quick amount selector */}
              <div className="space-y-2">
                <Label className="text-white text-sm">{t("trading.tradeAmount")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      className={`py-1.5 rounded text-sm font-medium transition-all border ${
                        amount === q
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "border-slate-600 text-slate-300 hover:border-blue-500 hover:text-white bg-slate-800/40"
                      }`}
                    >
                      ${q}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={minTradeAmount}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                  className="h-12 bg-slate-800/60 border-slate-600 text-white text-center text-lg font-bold"
                />
                <p className="text-xs text-slate-400">Min: ${minTradeAmount}</p>
              </div>

              {/* Period selector */}
              <div className="space-y-2">
                <Label className="text-white">{t("trading.period")}</Label>
                <Select value={period} onValueChange={(val: IntervalType) => setPeriod(val)}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue placeholder={t("trading.selectPeriod")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payout preview */}
              {currentDeal && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
                  <div className="flex justify-between text-green-300">
                    <span>Potential Payout</span>
                    <span className="font-bold">
                      ${(amount + amount * (currentDeal.payout_percent / 100)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs mt-1">
                    <span>Profit</span>
                    <span>
                      +${(amount * (currentDeal.payout_percent / 100)).toFixed(2)} ({currentDeal.payout_percent}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Buy & Sell Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-14 bg-green-600 hover:bg-green-700 text-white font-bold text-base shadow-lg shadow-green-500/20 flex flex-col gap-0.5"
                  onClick={() => onTrade("CALL")}
                  disabled={isTrading || !currentDeal}
                >
                  <TrendingUp className="w-5 h-5" />
                  {t("trading.buy")}
                </Button>
                <Button
                  className="h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-lg shadow-red-500/20 flex flex-col gap-0.5"
                  onClick={() => onTrade("PUT")}
                  disabled={isTrading || !currentDeal}
                >
                  <TrendingDown className="w-5 h-5" />
                  {t("trading.sell")}
                </Button>
              </div>

              {!currentDeal && (
                <p className="text-center text-slate-400 text-sm">
                  {t("trading.noScheduledRounds") || "Waiting for next round signal…"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Previous Trades */}
          <Card className="trading-card" translate="no">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-white truncate">{t("trading.previousTrades")}</CardTitle>
              <Link href="/dashboard/portfolio?tab=history" className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700/60"
                >
                  {t("dashboard.viewAll")}
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
              {trades.length === 0 && (
                <p className="text-slate-400 text-sm py-4 text-center">{t("trading.noTradesYet")}</p>
              )}
              {trades.map((tr) => (
                <div
                  key={tr.id}
                  className="p-3 rounded-lg bg-slate-800/40 border border-slate-700 flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-semibold text-white">{tr.asset}</span>
                    <span
                      className={`ml-2 text-xs font-bold ${
                        tr.type === "CALL" || tr.type === "BUY" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {tr.type === "CALL" || tr.type === "BUY" ? "▲ BUY" : "▼ SELL"}
                    </span>
                    <p className="text-slate-400 text-xs">
                      {new Date(tr.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">${tr.amount}</p>
                    <Badge
                      className={
                        tr.result === "win"
                          ? "bg-green-500/20 text-green-400 border-green-500/40 text-xs"
                          : tr.result === "lose"
                          ? "bg-red-500/20 text-red-400 border-red-500/40 text-xs"
                          : "bg-slate-700 text-slate-300 text-xs"
                      }
                    >
                      {tr.result ? tr.result.toUpperCase() : "PENDING"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
