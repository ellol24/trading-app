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

/**
 * Admin trading control page
 * - create rounds with admin_direction (buy/sell)
 * - start rounds
 * - complete rounds: settles each trade according to admin_direction:
 *    if admin_direction === 'buy', trades with type 'CALL' => win, 'PUT' => lose
 *    if admin_direction === 'sell', trades with type 'PUT' => win, 'CALL' => lose
 * - also allows explicitly choosing outcome (win/lose/draw) per round (keeps legacy behavior)
 */
export default function AdminTradingControlsPage() {
  const { toast } = useToast();
  const [rounds, setRounds] = useState<TradeRound[]>([]);
  const [symbol, setSymbol] = useState("EUR/USD");
  const [duration, setDuration] = useState(60);
  const [payout, setPayout] = useState(2);
  const [entryWindow, setEntryWindow] = useState(30);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<Record<string, Outcome>>({});

  // fetch rounds and poll briefly so admin sees updates
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

  // create a round
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
        // schedule 10s in future by default (you can modify)
        start_time: new Date(Date.now() + 10_000).toISOString(),
      },
    ]);
    setLoading(false);

    if (error) {
      toast({
        title: "Error creating round",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Round created", description: "New trade round scheduled" });
      fetchRounds();
    }
  };

  // activate a round immediately
  const activateRound = async (id: string) => {
    const { error } = await supabase
      .from("trade_rounds")
      .update({ status: "active", start_time: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Round started", description: "The round is now live" });
      fetchRounds();
    }
  };

  /**
   * Complete round:
   * - If admin explicitly chose selectedOutcome (win/lose/draw) use legacy behavior:
   *    - draw requires explicit choice and triggers refund behavior (handled by DB triggers if present).
   * - Otherwise: settle trades individually according to admin_direction:
   *    - determine winning type: buy -> CALL wins; sell -> PUT wins
   *    - fetch unsettled trades for round, loop and update each trade result/profit accordingly
   */
  const completeRoundWithOutcome = async (roundId: string) => {
    // find round
    const round = rounds.find((r) => r.id === roundId);
    if (!round) {
      toast({ title: "Error", description: "Round not found.", variant: "destructive" });
      return;
    }

    // If admin selected explicit uniform outcome (win/lose/draw), prefer that
    const explicit = selectedOutcome[roundId] ?? round.forced_outcome ?? null;
    if (explicit && explicit !== "draw") {
      // uniform outcome case: set forced_outcome and status to completed
      const { error: errRound } = await supabase
        .from("trade_rounds")
        .update({ status: "completed", forced_outcome: explicit })
        .eq("id", roundId);

      if (errRound) {
        toast({ title: "Error", description: errRound.message, variant: "destructive" });
        return;
      }

      toast({ title: "Round settled", description: `All trades marked as ${explicit}.` });
      fetchRounds();
      return;
    }

    // If explicit === 'draw' => admin forced draw; set forced_outcome=draw to let DB triggers handle refunds (if you rely on triggers)
    if (explicit === "draw") {
      const { error: errRound } = await supabase
        .from("trade_rounds")
        .update({ status: "completed", forced_outcome: "draw" })
        .eq("id", roundId);

      if (errRound) {
        toast({ title: "Error", description: errRound.message, variant: "destructive" });
        return;
      }
      toast({ title: "Round settled", description: `Round set to draw (refunds).` });
      fetchRounds();
      return;
    }

    // Otherwise use admin_direction to compute per-trade results
    if (!round.admin_direction) {
      toast({
        title: "No direction",
        description: "Please set the Admin Direction (buy/sell) before settling.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Settling round", description: "Computing results based on admin direction..." });

    try {
      // fetch unsettled trades for this round
      const { data: tradesToSet, error: fetchErr } = await supabase
        .from("trades")
        .select("*")
        .eq("trade_round_id", roundId)
        .eq("settled", false);

      if (fetchErr) {
        toast({ title: "Error fetching trades", description: fetchErr.message, variant: "destructive" });
        return;
      }

      const winType = round.admin_direction === "buy" ? "CALL" : "PUT";

      if (!tradesToSet || tradesToSet.length === 0) {
        // still mark the round completed
        await supabase.from("trade_rounds").update({ status: "completed", forced_outcome: null }).eq("id", roundId);
        toast({ title: "Round completed", description: "No unsettled trades to process." });
        fetchRounds();
        return;
      }

      // process each trade one by one (server-side set)
      for (const t of tradesToSet) {
        const isWin = t.type === winType;
        const result: "win" | "lose" | "draw" = isWin ? "win" : "lose";
        // calculate profit_loss: win => amount * (roi_percentage / 100), lose => -amount
        const amt = Number(t.amount || 0);
        const roi = Number(t.roi_percentage || 0);
        const profit_loss = result === "win" ? +(amt * (roi / 100)) : -amt;

        const { error: updErr } = await supabase
          .from("trades")
          .update({
            result,
            profit_loss,
            settled: true,
            settled_at: new Date().toISOString(),
          })
          .eq("id", t.id);

        if (updErr) {
          console.error("Error updating trade", t.id, updErr);
          // continue processing others but notify
          toast({ title: "Partial error", description: `Failed to settle trade ${t.id}: ${updErr.message}`, variant: "destructive" });
        }
      }

      // finally mark trade_round completed and store admin_direction as a note in forced_outcome (optional)
      await supabase
        .from("trade_rounds")
        .update({ status: "completed", forced_outcome: null })
        .eq("id", roundId);

      toast({ title: "Round settled", description: `Round completed using admin direction (${round.admin_direction}).` });
      fetchRounds();
    } catch (err: any) {
      console.error("Complete round error", err);
      toast({ title: "Error", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Create Round */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white">Create New Round</CardTitle>
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
                  <SelectItem value="XAU/USD">XAU/USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Duration (seconds)</Label>
              <Input type="number" min={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Payout % (ROI)</Label>
              <Input type="number" min={0} step="0.01" value={payout} onChange={(e) => setPayout(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Entry Window (sec)</Label>
              <Input type="number" min={5} value={entryWindow} onChange={(e) => setEntryWindow(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Admin Direction</Label>
              <Select value={direction} onValueChange={(v: "buy" | "sell") => setDirection(v)}>
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

        {/* Rounds list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-white">Rounds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rounds.length === 0 ? (
              <p className="text-blue-200">No rounds yet.</p>
            ) : (
              rounds.map((r) => (
                <div key={r.id} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-800/60 p-3 rounded-lg gap-3">
                  <div className="space-y-1">
                    <p className="text-white font-semibold">{r.symbol}</p>
                    <p className="text-blue-300 text-sm">
                      {r.status.toUpperCase()} • {r.duration_sec}s • Payout {r.payout_percent}% • Entry ±{r.entry_window_sec}s • Direction: {r.admin_direction ?? "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedOutcome[r.id] ?? r.forced_outcome ?? ""}
                      onValueChange={(v: Outcome) => setSelectedOutcome((old) => ({ ...old, [r.id]: v }))}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-[160px]">
                        <SelectValue placeholder="Select Outcome / Draw" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="win">Force Win (all)</SelectItem>
                        <SelectItem value="lose">Force Lose (all)</SelectItem>
                        <SelectItem value="draw">Draw (refunds)</SelectItem>
                      </SelectContent>
                    </Select>

                    {r.status === "scheduled" && (
                      <Button size="sm" onClick={() => activateRound(r.id)}>Start</Button>
                    )}

                    {r.status !== "completed" && (
                      <Button size="sm" variant="destructive" onClick={() => completeRoundWithOutcome(r.id)}>
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
