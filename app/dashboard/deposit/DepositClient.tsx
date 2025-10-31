"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

// 🧩 بيانات العملات
const SUPPORTED_COINS = [
  { code: "USDTTRC20", name: "USDT (TRC20)" },
  { code: "USDTBEP20", name: "USDT (BEP20)" },
];

export default function DepositClient({ user, profile }: any) {
  const [coin, setCoin] = useState<string>("USDTTRC20");
  const [amount, setAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 🧠 تحميل السجل من قاعدة البيانات
  async function loadDeposits() {
    if (!user?.id) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("deposits")
      .select("id, amount, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Failed to load deposits");
    else setDeposits(data || []);
    setLoadingHistory(false);
  }

  useEffect(() => {
    loadDeposits();
  }, [user?.id]);

  // 🚀 إنشاء دفعة جديدة عبر NOWPayments
  const createPayment = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.warning("Enter a valid amount");
      return;
    }

    try {
      setIsProcessing(true);

      const response = await fetch("https://api.nowpayments.io/v1/payment", {
        method: "POST",
        headers: {
          "x-api-key": process.env.NOWPAYMENTS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: Number(amount),
          price_currency: "usd",
          pay_currency: coin,
          order_id: `${user.id}-${Date.now()}`,
          order_description: "Deposit to XSPY Account",
          ipn_callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/deposit`, // نفس الصفحة
        }),
      });

      const data = await response.json();

      if (data.invoice_url) {
        toast.success("Redirecting to payment page...");
        window.location.href = data.invoice_url;
      } else {
        toast.error("Failed to create payment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Payment creation failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🧩 استقبال إشعارات الدفع IPN مباشرة (من NOWPayments)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("payment_status");
    const orderId = urlParams.get("order_id");
    const amountReceived = urlParams.get("actually_paid");

    if (status === "finished" && orderId && amountReceived) {
      toast.success("✅ Payment confirmed, updating your balance...");
      // تحديث قاعدة البيانات
      const [userId] = orderId.split("-");
      supabase.from("deposits").insert({
        user_id: userId,
        amount: Number(amountReceived),
        status: "approved",
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Deposit</h1>
            <p className="text-blue-200 mt-1">Make instant deposits using crypto</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Auto
          </Badge>
        </div>

        {/* نموذج الإيداع */}
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
            </div>

            <Button
              onClick={createPayment}
              className="w-full h-12 font-semibold text-lg bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Deposit Now"}
            </Button>
          </CardContent>
        </Card>

        {/* سجل الإيداعات */}
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
                    <p className="text-white font-semibold">${dep.amount}</p>
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
