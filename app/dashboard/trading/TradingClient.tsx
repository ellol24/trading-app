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
import { Clock, ShieldAlert, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";

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

const FOREX = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD",
  "AUD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "XAU/USD"
];

// QUICK_AMOUNTS is now dynamically populated per user

export default function TradingClient({ user, profile }: TradingClientProps) {
  const { t } = useLanguage();

  const PERIODS: { value: IntervalType; label: string }[] = [
    { value: "1min", label: `1 ${t('common.minute') || 'min'}` },
    { value: "5min", label: `5 ${t('common.minutes') || 'min'}` },
    { value: "15min", label: `15 ${t('common.minutes') || 'min'}` },
    { value: "30min", label: `30 ${t('common.minutes') || 'min'}` },
    { value: "1h", label: `1 ${t('common.hour') || 'h'}` },
  ];

  const [symbol, setSymbol] = useState("EUR/USD");
  const [amount, setAmount] = useState<number>(100);
  const [period, setPeriod] = useState<IntervalType>("5min");
  const [now, setNow] = useState(Date.now());
  const [deals, setDeals] = useState<TradeRound[]>([]);
  const [joinedRounds, setJoinedRounds] = useState<string[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [minTradeAmount, setMinTradeAmount] = useState<number>(profile?.min_trade_amount || 1);
  const [quickAmounts, setQuickAmounts] = useState<number[]>([10, 25, 50, 100, 250, 500]);

  useEffect(() => {
    if (profile?.min_trade_amount) setMinTradeAmount(profile.min_trade_amount);
    if (profile?.suggested_trade_amounts) {
      try {
        const parsed = typeof profile.suggested_trade_amounts === 'string'
          ? JSON.parse(profile.suggested_trade_amounts)
          : profile.suggested_trade_amounts;
        if (Array.isArray(parsed) && parsed.length > 0) setQuickAmounts(parsed);
      } catch (e) { console.error("Could not parse suggested amounts", e); }
    }
  }, [profile]);
  const [isTrading, setIsTrading] = useState(false);

  const userId = user?.id;

  // UI Timer every 1 second for countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("balance")
      .eq("uid", userId)
      .single();
    if (data) setBalance(data.balance || 0);
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
  }, [userId]);

  // ─── Real-time subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Subscribe to trade_rounds changes (new rounds, status updates)
    const roundsChannel = supabase
      .channel(`trading-rounds-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_rounds" }, () => {
        fetchDeals();
      })
      .subscribe();

    // Subscribe to user's trades changes
    const tradesChannel = supabase
      .channel(`trading-trades-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${userId}` },
        () => {
          fetchTrades();
          fetchBalance();
        }
      )
      .subscribe();

    // Subscribe to balance changes
    const balanceChannel = supabase
      .channel(`trading-balance-${userId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${userId}` },
        (payload) => {
          if (payload.new?.balance !== undefined) {
            setBalance(Number(payload.new.balance));
          }
          if (payload.new?.min_trade_amount !== undefined) {
            setMinTradeAmount(Number(payload.new.min_trade_amount));
          }
          if (payload.new?.suggested_trade_amounts) {
            try {
              const parsed = typeof payload.new.suggested_trade_amounts === 'string'
                ? JSON.parse(payload.new.suggested_trade_amounts)
                : payload.new.suggested_trade_amounts;
              if (Array.isArray(parsed)) setQuickAmounts(parsed);
            } catch (e) { }
          }
        }
      )
      .subscribe();

    // Subscribe to user_rounds changes
    const userRoundsChannel = supabase
      .channel(`trading-user-rounds-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "user_rounds", filter: `user_id=eq.${userId}` },
        () => { fetchJoined(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roundsChannel);
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(userRoundsChannel);
    };
  }, [userId]);

  const activeDeal = useMemo(() => deals.find((d) => d.status === "active") || null, [deals]);
  const nextDeal = useMemo(
    () => deals.find((d) => d.status === "scheduled" && new Date(d.start_time).getTime() > Date.now()) || null,
    [deals]
  );

  const secondsUntil = (time: string | number) =>
    Math.max(0, Math.floor((new Date(time).getTime() - now) / 1000));

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const joinRound = async (roundId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("user_rounds").insert({
      user_id: userId,
      trade_round_id: roundId,
    });
    if (error) {
      toast.error(`❌ ${t('trading.joinFailed')}: ${error.message}`);
    } else {
      toast.success(`✅ ${t('trading.joinSuccess')}`);
      setJoinedRounds((prev) => [...prev, roundId]);
    }
  };

  const onTrade = async (type: "CALL" | "PUT") => {
    if (!activeDeal) { toast.warning(`⚠️ ${t('trading.noActiveRound')}`); return; }
    if (!userId) { toast.error(`❌ ${t('trading.loginRequired')}`); return; }
    if (!joinedRounds.includes(activeDeal.id)) { toast.warning(`⚠️ ${t('trading.joinRequired')}`); return; }
    if (balance < amount) { toast.error(`❌ ${t('trading.insufficientBalance')}`); return; }
    if (amount < minTradeAmount) { toast.warning(`⚠️ Minimum trade amount is $${minTradeAmount}`); return; }

    setIsTrading(true);
    const { error } = await supabase.from("trades").insert([{
      user_id: userId,
      trade_round_id: activeDeal.id,
      asset: symbol,
      amount,
      duration_sec: activeDeal.duration_sec,
      roi_percentage: activeDeal.payout_percent,
      type,
    }]);

    if (error) {
      if (error.message.includes("duplicate key value") || error.code === "23505") {
        toast.warning(`⚠️ ${t('trading.alreadyEntered')}`);
      } else {
        toast.error(`❌ ${t('trading.placeTradeError')}: ${error.message}`);
      }
    } else {
      toast.success(`✅ ${t('trading.tradePlacedSuccess')} (${type} ${symbol} $${amount})`);
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
          {/* Assets */}
          <Card className="trading-card" translate="no">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-white">{t('trading.selectAsset')}</CardTitle>
              {activeDeal ? (
                <Badge className="bg-transparent border-green-400/40 text-green-300 animate-pulse">{t('trading.live')}</Badge>
              ) : (
                <Badge className="bg-transparent border-slate-400/40 text-slate-200">{t('trading.waiting')}</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {FOREX.map((s) => (
                  <Button
                    key={s}
                    variant={symbol === s ? "default" : "outline"}
                    className={`w-full text-sm transition-all ${symbol === s ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" : ""}`}
                    onClick={() => setSymbol(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Round Status */}
          <Card className="trading-card" translate="no">
            <CardContent className="py-4">
              {activeDeal ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-blue-200 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white font-semibold">{activeDeal.symbol}</span>
                    <span className="text-blue-300">{t('trading.roundLive')}</span>
                    <span className="text-sm">•</span>
                    <span className="text-blue-300">{t('trading.endsIn')}</span>
                    <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded text-sm">
                      {formatCountdown(secondsUntil(new Date(activeDeal.start_time).getTime() + activeDeal.duration_sec * 1000))}
                    </span>
                    <span className="text-sm">•</span>
                    <span className="text-green-400 font-semibold">{t('trading.payoutLabel')} {activeDeal.payout_percent}%</span>
                  </div>
                  <Clock className="w-5 h-5 text-blue-300 shrink-0" />
                </div>
              ) : nextDeal ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-blue-200 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span>{t('trading.nextRound')}</span>
                    <span className="text-white font-semibold">{nextDeal.symbol}</span>
                    <span>{t('trading.startsIn')}</span>
                    <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded text-sm">
                      {formatCountdown(secondsUntil(nextDeal.start_time))}
                    </span>
                    <span>•</span>
                    <span>{t('trading.durationSeconds').replace('{s}', String(nextDeal.duration_sec))}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-blue-200">
                  <ShieldAlert className="w-4 h-4 opacity-60" />
                  {t('trading.noScheduledRounds')}
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
                {t('trading.tradeSetup')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Balance display */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                <span className="text-blue-300 text-sm">{t('dashboard.availableBalance')}</span>
                <span className="text-white font-bold text-lg">${balance.toFixed(2)}</span>
              </div>

              {/* Quick amount selector */}
              <div className="space-y-2">
                <Label className="text-white text-sm">{t('trading.tradeAmount')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      className={`py-1.5 rounded text-sm font-medium transition-all border ${amount === q
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
                <Label className="text-white">{t('trading.period')}</Label>
                <Select value={period} onValueChange={(val: IntervalType) => setPeriod(val)}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue placeholder={t('trading.selectPeriod')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payout preview */}
              {activeDeal && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
                  <div className="flex justify-between text-green-300">
                    <span>Potential Payout</span>
                    <span className="font-bold">${(amount + amount * (activeDeal.payout_percent / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs mt-1">
                    <span>Profit</span>
                    <span>+${(amount * (activeDeal.payout_percent / 100)).toFixed(2)} ({activeDeal.payout_percent}%)</span>
                  </div>
                </div>
              )}

              {/* Join / Trade Buttons */}
              {activeDeal && !joinedRounds.includes(activeDeal.id) ? (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
                  onClick={() => joinRound(activeDeal.id)}
                >
                  {t('trading.joinRound')}
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="h-14 bg-green-600 hover:bg-green-700 text-white font-bold text-base shadow-lg shadow-green-500/20 flex flex-col gap-0.5"
                    onClick={() => onTrade("CALL")}
                    disabled={isTrading || !activeDeal}
                  >
                    <TrendingUp className="w-5 h-5" />
                    {t('trading.buy')}
                  </Button>
                  <Button
                    className="h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-lg shadow-red-500/20 flex flex-col gap-0.5"
                    onClick={() => onTrade("PUT")}
                    disabled={isTrading || !activeDeal}
                  >
                    <TrendingDown className="w-5 h-5" />
                    {t('trading.sell')}
                  </Button>
                </div>
              )}

              {!activeDeal && (
                <p className="text-center text-slate-400 text-sm">
                  {nextDeal ? "Waiting for next round..." : t('trading.noScheduledRounds')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Previous Trades */}
          <Card className="trading-card" translate="no">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-white">{t('trading.previousTrades')}</CardTitle>
              <Link href="/dashboard/portfolio?tab=history">
                <Button variant="outline" size="sm" className="text-xs border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700/60">
                  {t('dashboard.viewAll')}
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
              {trades.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">{t('trading.noTrades')}</p>
              )}
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="p-3 rounded-lg bg-slate-800/60 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {trade.asset} · <span className={trade.type === "CALL" ? "text-green-400" : "text-red-400"}>{trade.type}</span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      ${trade.amount} · {new Date(trade.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge
                    className={`shrink-0 ${trade.result === "win"
                        ? "bg-green-500/20 text-green-300 border-green-400"
                        : trade.result === "lose"
                          ? "bg-red-500/20 text-red-300 border-red-400"
                          : "bg-slate-500/20 text-slate-300 border-slate-400"
                      }`}
                  >
                    {trade.result === "win" ? `+$${(trade.profit_loss ?? 0).toFixed(2)}` :
                      trade.result === "lose" ? `-$${Math.abs(trade.profit_loss ?? 0).toFixed(2)}` :
                        t('common.pending')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
