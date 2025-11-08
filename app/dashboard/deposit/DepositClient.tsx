"use client";

import { useEffect, useState } from "react";
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
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

// 🪙 العملات المدعومة
const SUPPORTED_COINS = [
  { code: "usdttrc20", name: "USDT (TRC20)" },
  { code: "usdtbsc", name: "USDT (BEP20)" },
];

export default function DepositClient({ user }: any) {
  const [coin, setCoin] = useState<string>("usdttrc20");
  const [amount, setAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [networkFee, setNetworkFee] = useState<number>(0);

  // 📥 تحميل سجل الإيداعات من Supabase
  async function loadDeposits() {
    if (!user?.id) return;
    setLoadingHistory(true);

    const { data, error } = await supabase
      .from("deposits")
      .select("id, amount, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("❌ Failed to load deposits");
    else setDeposits(data || []);

    setLoadingHistory(false);
  }

  useEffect(() => {
    loadDeposits();
  }, [user?.id]);

  // 🚀 إنشاء دفعة جديدة (الاتصال بـ API)
  const createPayment = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.warning("⚠️ Enter a valid amount");
      return;
    }

    setIsProcessing(true);
    try {
      console.log("📤 Sending payment data:", { amount, currency: coin, user_id: user.id });

      const res = await fetch("/api/contact/payment-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          currency: coin,
          user_id: user.id,
        }),
      });

      const data = await res.json();
      console.log("💬 Payment create response:", data);

      if (res.ok && data.success && data.invoice_url) {
        toast.success("Redirecting to payment page...");
        window.location.href = data.invoice_url;
      } else {
        console.error("❌ Payment creation failed:", data);
        toast.error(data.error || "Failed to create payment");
      }
    } catch (err) {
      console.error("🚨 Payment creation error:", err);
      toast.error("Payment creation failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // 💰 حساب العمولة التقديرية (2%)
  useEffect(() => {
    if (amount) {
      const fee = Number(amount) * 0.02;
      setNetworkFee(fee);
    }
  }, [amount]);

  // 🔔 التحقق من حالة الدفع بعد العودة من صفحة NOWPayments
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment_status");
    if (status === "finished") {
      toast.success("✅ Payment completed successfully!");
      loadDeposits();
    } else if (status === "waiting") {
      toast.info("⏳ Payment pending confirmation...");
    } else if (status === "failed") {
      toast.error("❌ Payment failed or cancelled.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Deposit</h1>
            <p className="text-blue-200 mt-1">Make instant deposits using crypto</p>
          </div>
          <Badge
            variant="outline"
            className="text-green-400 border-green-400 bg-green-400/10"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Auto
          </Badge>
        </div>

        {/* Deposit Form */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Deposit Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-white">Select Currency</Label>
              <Select value={coin} onValueChange={setCoin}>
                <SelectTrigger className="h-12 bg-slate-700 text-white border-slate-600">
                  <SelectValue placeholder="Choose coin" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COINS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Deposit Amount (USD)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="h-12 bg-slate-700 text-white border-slate-600"
                min={1}
              />
              {amount && (
                <p className="text-blue-300 text-sm">
                  Network Fee (0.5%): ${networkFee.toFixed(2)} — You’ll receive approximately $
                  {(Number(amount) - networkFee).toFixed(2)}
                </p>
              )}
            </div>

            <Button
              onClick={createPayment}
              className="w-full h-12 font-semibold text-lg bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Processing...
                </>
              ) : (
                "Deposit Now"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Deposit History */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Deposit History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory && <p className="text-gray-300">Loading...</p>}
            {!loadingHistory && deposits.length === 0 && (
              <p className="text-gray-400">No deposits yet.</p>
            )}
            <div className="space-y-3">
              {deposits.map((dep) => (
                <div
                  key={dep.id}
                  className="flex justify-between p-3 border border-slate-700 rounded-lg bg-slate-700/30"
                >
                  <div>
                    <p className="text-white font-semibold">${Number(dep.amount).toFixed(2)}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(dep.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    className={
                      dep.status === "approved"
                        ? "bg-green-500/20 text-green-400"
                        : dep.status === "pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }
                  >
                    {dep.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
