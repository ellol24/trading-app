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

  // إكمال الجولة مع النتيجة
  const completeRoundWithOutcome = async (roundId: string) => {
    const outcome =
      selectedOutcome[roundId] ??
      rounds.find((r) => r.id === roundId)?.forced_outcome ??
      "draw";

    // ✅ منع إكمال الجولة بـ draw إلا إذا اختارها الأدمن صراحة
    if (outcome === "draw") {
      toast({
        title: "No outcome selected",
        description: "Please select Win or Lose before completing the round.",
        variant: "destructive",
      });
      return;
    }

    console.log("Completing round:", roundId, "with outcome:", outcome);

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

    toast({
      title: "Round settled",
      description: `All trades marked as ${outcome}.`,
    });

    fetchRounds();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
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
                    {/* اختيار نتيجة الجولة */}
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
                        <SelectItem value="draw">Draw (refund only)</SelectItem>
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
