"use client";

import { useEffect, useState } from "react";
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
};

type Outcome = "win" | "lose" | "draw";

export default function AdminTradingControlsPage() {
  const { toast } = useToast();
  const [rounds, setRounds] = useState<TradeRound[]>([]);
  const [symbol, setSymbol] = useState("EUR/USD");
  const [duration, setDuration] = useState(60);
  const [payout, setPayout] = useState(2);
  const [entryWindow, setEntryWindow] = useState(30);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);

  const [selectedOutcome, setSelectedOutcome] = useState<
    Record<string, Outcome>
  >({});

  // Global trading limits
  const [minTradeAmount, setMinTradeAmount] = useState<number>(1);
  const [suggestedAmounts, setSuggestedAmounts] = useState<string>("10, 25, 50, 100, 250, 500");
  const [savingLimits, setSavingLimits] = useState(false);

  const fetchTradingLimits = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "trading_limits")
      .maybeSingle();
    if (data?.value) {
      const v = data.value as any;
      setMinTradeAmount(Number(v.min_trade_amount) || 1);
      setSuggestedAmounts(Array.isArray(v.suggested_amounts) ? v.suggested_amounts.join(", ") : "10, 25, 50, 100, 250, 500");
    }
  };

  const saveTradingLimits = async () => {
    setSavingLimits(true);
    const parsedAmounts = suggestedAmounts.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
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
  const fetchRounds = async () => {
    const { data, error } = await supabase
      .from("trade_rounds")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setRounds(data ?? []);
  };

  useEffect(() => {
    fetchRounds();
    fetchTradingLimits();
    const id = setInterval(fetchRounds, 3000);
    return () => clearInterval(id);
  }, []);

  // إنشاء جولة
  const createRound = async () => {
    setLoading(true);
    const { error } = await supabase.from("trade_rounds").insert([
      {
        symbol,
        duration_sec: duration,
        payout_percent: payout,
        entry_window_sec: entryWindow,
        status: "scheduled",
        admin_direction: direction,
        start_time: new Date(Date.now() + 10_000).toISOString(),
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
        title: "Round created",
        description: "New trade round scheduled",
      });
      fetchRounds();
    }
  };

  // تفعيل الجولة
  const activateRound = async (id: string) => {
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
      toast({ title: "Round started", description: "The round is now live" });
      fetchRounds();
    }
  };

  // ✅ إكمال الجولة + توزيع الأرباح + العمولات
  const completeRoundWithOutcome = async (roundId: string) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;

    const outcome =
      selectedOutcome[roundId] ?? round.forced_outcome ?? "draw";

    if (outcome === "draw") {
      toast({
        title: "No outcome selected",
        description: "Please select Win or Lose before completing the round.",
        variant: "destructive",
      });
      return;
    }

    const finalOutcome = outcome as "win" | "lose";

    // ✅ تحديد الفوز بناءً على اتجاه الأدمن
    const isAdminBuy = round.admin_direction === "buy";

    // تحديث الجولة للحالة المكتملة
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

    // ✅ جلب الصفقات الخاصة بالجولة
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

    // ✅ معالجة نتائج الصفقات وتحديث الأرصدة
    for (const trade of trades) {
      let result = "lose";
      let profit = 0;

      // تحقق من نوع الصفقة مقارنة باتجاه الأدمن
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

      // تحديث نتيجة الصفقة
      await supabase
        .from("trades")
        .update({
          result,
          profit_loss: profit,
          settled: true,
          settled_at: new Date().toISOString(),
        })
        .eq("id", trade.id);

      // ✅ تحديث رصيد المستخدم عند الفوز أو التعادل
      if (result === "win" || result === "draw") {
        const { data: user } = await supabase
          .from("user_profiles")
          .select("uid, balance, referral_code_used")
          .eq("uid", trade.user_id)
          .single();

        if (user) {
          let newBalance = user.balance;

          if (result === "win") newBalance += trade.amount + profit;
          else if (result === "draw") newBalance += trade.amount;

          await supabase
            .from("user_profiles")
            .update({ balance: newBalance })
            .eq("uid", user.uid);

          // ✅ توزيع العمولات للمحيلين حتى 3 مستويات
          if (result === "win" && profit > 0) {
            const { data: settings } = await supabase
              .from("settings")
              .select("level1_commission, level2_commission, level3_commission")
              .single();

            const lvl1 = settings?.level1_commission ?? 5;
            const lvl2 = settings?.level2_commission ?? 2;
            const lvl3 = settings?.level3_commission ?? 1;

            if (user.referral_code_used) {
              const { data: ref1 } = await supabase
                .from("user_profiles")
                .select("uid, referral_code_used, balance, referral_earnings")
                .eq("referral_code", user.referral_code_used)
                .single();

              if (ref1) {
                const commission1 = (profit * lvl1) / 100;
                await supabase
                  .from("user_profiles")
                  .update({
                    referral_earnings:
                      (ref1.referral_earnings ?? 0) + commission1,
                    balance: (ref1.balance ?? 0) + commission1,
                  })
                  .eq("uid", ref1.uid);

                if (ref1.referral_code_used) {
                  const { data: ref2 } = await supabase
                    .from("user_profiles")
                    .select("uid, referral_code_used, balance, referral_earnings")
                    .eq("referral_code", ref1.referral_code_used)
                    .single();

                  if (ref2) {
                    const commission2 = (profit * lvl2) / 100;
                    await supabase
                      .from("user_profiles")
                      .update({
                        referral_earnings:
                          (ref2.referral_earnings ?? 0) + commission2,
                        balance: (ref2.balance ?? 0) + commission2,
                      })
                      .eq("uid", ref2.uid);

                    if (ref2.referral_code_used) {
                      const { data: ref3 } = await supabase
                        .from("user_profiles")
                        .select("uid, balance, referral_earnings")
                        .eq("referral_code", ref2.referral_code_used)
                        .single();

                      if (ref3) {
                        const commission3 = (profit * lvl3) / 100;
                        await supabase
                          .from("user_profiles")
                          .update({
                            referral_earnings:
                              (ref3.referral_earnings ?? 0) + commission3,
                            balance: (ref3.balance ?? 0) + commission3,
                          })
                          .eq("uid", ref3.uid);
                      }
                    }
                  }
                }
              }
            }
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
              🎛️ Global Trading Configuration
            </CardTitle>
            <p className="text-sm text-slate-400">Set the minimum entry amount and suggested quick-amounts for all users on the trading page.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-white font-semibold">Minimum Entry Amount ($)</Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                className="bg-slate-900 border-slate-700 text-white text-lg"
                value={minTradeAmount}
                onChange={(e) => setMinTradeAmount(Number(e.target.value))}
              />
              <p className="text-xs text-slate-500">Users cannot trade below this amount.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-white font-semibold">Suggested Quick Amounts (comma-separated)</Label>
              <Input
                className="bg-slate-900 border-slate-700 text-white"
                placeholder="10, 25, 50, 100, 250, 500"
                value={suggestedAmounts}
                onChange={(e) => setSuggestedAmounts(e.target.value)}
              />
              <p className="text-xs text-slate-500">These appear as quick-select buttons on the trading page.</p>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button
                onClick={saveTradingLimits}
                disabled={savingLimits}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-2 shadow-lg shadow-blue-600/20"
              >
                {savingLimits ? "Saving..." : "💾 Save Trading Limits"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* إنشاء جولة جديدة */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white">
              Create New Round
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR/USD">EUR/USD</SelectItem>
                  <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                  <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Duration (seconds)</Label>
              <Input
                type="number"
                min={10}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Payout % (ROI)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={payout}
                onChange={(e) => setPayout(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Entry Window (sec)</Label>
              <Input
                type="number"
                min={5}
                value={entryWindow}
                onChange={(e) => setEntryWindow(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Admin Direction</Label>
              <Select
                value={direction}
                onValueChange={(v: "buy" | "sell") => setDirection(v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={createRound} disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create Round"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* لائحة الجولات */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white">
              Rounds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rounds.length === 0 ? (
              <p className="text-blue-200">No rounds yet.</p>
            ) : (
              rounds.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center justify-between bg-slate-800/60 p-3 rounded-lg gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-white font-semibold">{r.symbol}</p>
                    <p className="text-blue-300 text-sm">
                      {r.status.toUpperCase()} • {r.duration_sec}s • Payout{" "}
                      {r.payout_percent}% • Entry ±{r.entry_window_sec}s •
                      Direction: {r.admin_direction}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedOutcome[r.id] ?? r.forced_outcome ?? ""}
                      onValueChange={(v: Outcome) =>
                        setSelectedOutcome((old) => ({ ...old, [r.id]: v }))
                      }
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-[140px]">
                        <SelectValue placeholder="Select Outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="win">Win</SelectItem>
                        <SelectItem value="lose">Lose</SelectItem>
                        <SelectItem value="draw">
                          Draw (refund only)
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {r.status === "scheduled" && (
                      <Button size="sm" onClick={() => activateRound(r.id)}>
                        Start
                      </Button>
                    )}

                    {r.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => completeRoundWithOutcome(r.id)}
                      >
                        Complete & Set Outcome
                      </Button>
                    )}

                    <Badge>{r.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
