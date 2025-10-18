"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner"; // ✅ استخدم مكتبة Sonner مباشرة
import ForexChart from "@/components/ui/trading-chart";
import { Clock, ShieldAlert } from "lucide-react";

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
  forced_outcome: "win" | "loss" | "draw";
  entry_window_sec: number;
  status: "scheduled" | "active" | "completed" | "canceled";
  admin_direction: "buy" | "sell" | null;
};

type IntervalType = "1min" | "5min" | "15min" | "30min" | "1h";

const PERIODS: { value: IntervalType; label: string }[] = [
  { value: "1min", label: "1 minute" },
  { value: "5min", label: "5 minutes" },
  { value: "15min", label: "15 minutes" },
  { value: "30min", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
];

const FOREX = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD",
  "AUD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "XAU/USD"
];

export default function TradingClient({ user, profile }: TradingClientProps) {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [amount, setAmount] = useState<number>(100);
  const [period, setPeriod] = useState<IntervalType>("5min");
  const [heartbeat, setHeartbeat] = useState(0);
  const [deals, setDeals] = useState<TradeRound[]>([]);
  const [joinedRounds, setJoinedRounds] = useState<string[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const userId = user?.id;

  useEffect(() => {
    const id = setInterval(() => setHeartbeat((n) => (n + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchDeals = async () => {
    const { data } = await supabase.from("trade_rounds").select("*").order("start_time", { ascending: true });
    setDeals(data || []);
  };

  const fetchJoined = async () => {
    if (!userId) return;
    const { data } = await supabase.from("user_rounds").select("trade_round_id").eq("user_id", userId);
    if (data) setJoinedRounds(data.map((d) => d.trade_round_id));
  };

  const fetchTrades = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setTrades(data || []);
  };

  useEffect(() => {
    fetchDeals();
    fetchJoined();
    fetchTrades();
  }, [heartbeat, userId]);

  const activeDeal = useMemo(() => deals.find((d) => d.status === "active") || null, [deals]);
  const nextDeal = useMemo(
    () => deals.find((d) => d.status === "scheduled" && new Date(d.start_time).getTime() > Date.now()) || null,
    [deals]
  );

  const secondsUntil = (time: string | number) =>
    Math.max(0, Math.floor((new Date(time).getTime() - Date.now()) / 1000));

  const joinRound = async (roundId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("user_rounds").insert({
      user_id: userId,
      trade_round_id: roundId,
    });
    if (error) {
      toast.error(`❌ Failed to join round: ${error.message}`);
    } else {
      toast.success("✅ You joined this round successfully.");
      setJoinedRounds([...joinedRounds, roundId]);
    }
  };

  const onTrade = async (type: "CALL" | "PUT") => {
    if (!activeDeal) {
      toast.error("⚠️ No active trading round available.");
      return;
    }
    if (!userId) {
      toast.error("❌ You must be logged in to trade.");
      return;
    }
    if (!joinedRounds.includes(activeDeal.id)) {
      toast.warning("⚠️ You must join this round before trading.");
      return;
    }

    const { error } = await supabase.from("trades").insert([
      {
        user_id: userId,
        trade_round_id: activeDeal.id,
        asset: symbol,
        amount,
        duration_sec: activeDeal.duration_sec,
        roi_percentage: activeDeal.payout_percent,
        type,
      },
    ]);

    if (error) {
      toast.error(`❌ Error placing trade: ${error.message}`);
      return;
    }

    toast.success(`✅ Trade placed: ${type} on ${symbol} with $${amount}`);
    fetchTrades();
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
              <CardTitle className="text-white">Select Asset</CardTitle>
              {activeDeal ? (
                <Badge className="bg-transparent border-green-400/40 text-green-300">Live</Badge>
              ) : (
                <Badge className="bg-transparent border-slate-400/40 text-slate-200">Waiting</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {FOREX.map((s) => (
                  <Button
                    key={s}
                    variant={symbol === s ? "default" : "outline"}
                    className="w-full text-sm"
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-blue-200">
                  <div>
                    <span className="text-white font-semibold">{activeDeal.symbol}</span>{" "}
                    round is live • Ends in{" "}
                    <span className="font-mono text-white">
                      {secondsUntil(new Date(activeDeal.start_time).getTime() + activeDeal.duration_sec * 1000)}s
                    </span>{" "}
                    • Admin Direction:{" "}
                    <span className="uppercase">{activeDeal.admin_direction}</span>{" "}
                    • Payout {activeDeal.payout_percent}%
                  </div>
                  <Clock className="w-5 h-5 text-blue-300 mt-2 sm:mt-0" />
                </div>
              ) : nextDeal ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-blue-200">
                  <div>
                    Next round{" "}
                    <span className="text-white font-semibold">{nextDeal.symbol}</span>{" "}
                    starts in{" "}
                    <span className="font-mono text-white">{secondsUntil(nextDeal.start_time)}s</span>{" "}
                    • Duration {nextDeal.duration_sec}s • Entry window ±{nextDeal.entry_window_sec}s
                  </div>
                  <ShieldAlert className="w-5 h-5 text-blue-300 mt-2 sm:mt-0" />
                </div>
              ) : (
                <div className="text-blue-200">No scheduled rounds yet.</div>
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
              <CardTitle className="text-white">Trade Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white">Trade Amount ($)</Label>
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Period</Label>
                <Select value={period} onValueChange={(val: IntervalType) => setPeriod(val)}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue placeholder="Select period" />
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
              {activeDeal && !joinedRounds.includes(activeDeal.id) ? (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => joinRound(activeDeal.id)}
                >
                  Join Round
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-12 bg-green-600 hover:bg-green-700 text-white" onClick={() => onTrade("CALL")}>
                    BUY
                  </Button>
                  <Button className="h-12 bg-red-600 hover:bg-red-700 text-white" onClick={() => onTrade("PUT")}>
                    SELL
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Previous Trades */}
          <Card className="trading-card" translate="no">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-white">Previous Trades</CardTitle>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {trades.length === 0 && <p className="text-slate-300 text-sm">No trades yet.</p>}
              {trades.map((t) => (
                <div key={t.id} className="p-3 rounded-lg bg-slate-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">
                      {t.asset} • {t.type}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {new Date(t.created_at).toLocaleString()} • ${t.amount}
                    </p>
                    <p className="text-slate-400 text-xs">
                      ROI: {t.roi_percentage}% • P/L: {t.profit_loss || 0}
                    </p>
                  </div>
                  <Badge
                    className={`${
                      t.result === "win"
                        ? "bg-green-500/20 text-green-300 border-green-400"
                        : t.result === "lose"
                        ? "bg-red-500/20 text-red-300 border-red-400"
                        : "bg-slate-500/20 text-slate-200 border-slate-400"
                    }`}
                  >
                    {t.result || "pending"}
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
