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
import { toast } from "sonner"; // ✅ استخدمنا مكتبة Sonner للإشعارات

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

// ✅ نفس العملات المتوفرة في صفحة المستخدم
const FOREX_PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "USD/CAD",
  "AUD/USD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
  "XAU/USD",
];

export default function AdminTradingControlsPage() {
  const [rounds, setRounds] = useState<TradeRound[]>([]);
  const [symbol, setSymbol] = useState("EUR/USD");
  const [duration, setDuration] = useState(60);
  const [payout, setPayout] = useState(2);
  const [entryWindow, setEntryWindow] = useState(30);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<Record<string, Outcome>>({});

  // 🟢 Fetch all rounds
  const fetchRounds = async () => {
    const { data, error } = await supabase
      .from("trade_rounds")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      toast.error(`❌ Failed to fetch rounds: ${error.message}`);
      return;
    }
    setRounds(data ?? []);
  };

  useEffect(() => {
    fetchRounds();
    const id = setInterval(fetchRounds, 4000);
    return () => clearInterval(id);
  }, []);

  // 🟢 Create new round
  const createRound = async () => {
    if (!symbol || duration <= 0 || payout <= 0) {
      toast.warning("⚠️ Please fill all fields correctly before creating a round.");
      return;
    }

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
      toast.error(`❌ Error creating round: ${error.message}`);
    } else {
      toast.success("✅ New trading round created successfully!");
      fetchRounds();
    }
  };

  // 🟡 Activate round
  const activateRound = async (id: string) => {
    const { error } = await supabase
      .from("trade_rounds")
      .update({ status: "active", start_time: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(`❌ Error activating round: ${error.message}`);
    } else {
      toast.success("✅ Round started successfully — it's now live!");
      fetchRounds();
    }
  };

  // 🔴 Complete round and set outcome
  const completeRoundWithOutcome = async (roundId: string) => {
    const outcome =
      selectedOutcome[roundId] ??
      rounds.find((r) => r.id === roundId)?.forced_outcome ??
      null;

    if (!outcome || outcome === "draw") {
      toast.warning("⚠️ Please select Win or Lose before completing the round.");
      return;
    }

    const { error } = await supabase
      .from("trade_rounds")
      .update({ status: "completed", forced_outcome: outcome })
      .eq("id", roundId);

    if (error) {
      toast.error(`❌ Error settling round: ${error.message}`);
      return;
    }

    toast.success(`✅ Round completed successfully — all trades marked as ${outcome.toUpperCase()}.`);
    fetchRounds();
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 md:p-6"
      translate="no"
      data-react-protected
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 🟢 Create new round */}
        <Card className="bg-slate-800/70 border border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white">
              Create New Round
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Symbol */}
            <div className="space-y-2">
              <Label className="text-white">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOREX_PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair}>
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-white">Duration (seconds)</Label>
              <Input
                type="number"
                min={10}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>

            {/* Payout */}
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

            {/* Entry window */}
            <div className="space-y-2">
              <Label className="text-white">Entry Window (seconds)</Label>
              <Input
                type="number"
                min={5}
                value={entryWindow}
                onChange={(e) => setEntryWindow(Number(e.target.value))}
              />
            </div>

            {/* Direction (Buy/Sell) */}
            <div className="space-y-2">
              <Label className="text-white">Admin Direction</Label>
              <Select
                value={direction}
                onValueChange={(v: "buy" | "sell") => setDirection(v)}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Create Button */}
            <div className="flex items-end">
              <Button
                onClick={createRound}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "Creating..." : "Create Round"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 🟣 Rounds List */}
        <Card className="bg-slate-800/70 border border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white">Active Rounds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rounds.length === 0 ? (
              <p className="text-blue-200">No rounds available yet.</p>
            ) : (
              rounds.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/80 p-3 rounded-lg gap-3 border border-slate-700"
                >
                  <div className="space-y-1">
                    <p className="text-white font-semibold">{r.symbol}</p>
                    <p className="text-blue-300 text-sm">
                      {r.status.toUpperCase()} • {r.duration_sec}s • Payout {r.payout_percent}% • Entry ±
                      {r.entry_window_sec}s • Direction:{" "}
                      <span className={r.admin_direction === "buy" ? "text-green-400" : "text-red-400"}>
                        {r.admin_direction?.toUpperCase()}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Select outcome */}
                    <Select
                      value={selectedOutcome[r.id] ?? r.forced_outcome ?? ""}
                      onValueChange={(v: Outcome) =>
                        setSelectedOutcome((old) => ({ ...old, [r.id]: v }))
                      }
                    >
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white w-[140px]">
                        <SelectValue placeholder="Select Outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="win">Win</SelectItem>
                        <SelectItem value="lose">Lose</SelectItem>
                        <SelectItem value="draw">Draw (refund)</SelectItem>
                      </SelectContent>
                    </Select>

                    {r.status === "scheduled" && (
                      <Button size="sm" onClick={() => activateRound(r.id)} className="bg-green-600 hover:bg-green-700 text-white">
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
