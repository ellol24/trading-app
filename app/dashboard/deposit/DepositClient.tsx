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

type Deposit = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

export default function DepositPage() {
  const user = useUser();
  const [amount, setAmount] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState("usdttrc20");
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ تحميل الإيداعات السابقة
  useEffect(() => {
    if (!user) return;

    const fetchDeposits = async () => {
      try {
        const res = await fetch(`/api/contact/get-deposits?user_id=${user.id}`);
        const data = await res.json();
        if (res.ok) setDeposits(data);
      } catch (err) {
        console.error("Failed to load deposits:", err);
      }
    };

    fetchDeposits();
  }, [user]);

  // ✅ تنفيذ الإيداع
  const handleDeposit = async () => {
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact/payment-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: selectedCurrency,
          user_id: user?.id,
        }),
      });

      const data = await res.json();
      console.log("💬 Payment create response:", data);

      if (res.ok && data.invoice_url) {
        toast.success("Redirecting to payment page...");
        window.location.href = data.invoice_url; // ✅ توجيه المستخدم مباشرة
      } else {
        toast.error(data.error || "Payment creation failed");
      }
    } catch (error: any) {
      console.error("❌ Payment creation error:", error);
      toast.error(error.message || "Payment creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Deposit</h2>

      {/* نموذج الإيداع */}
      <div className="bg-gradient-to-br from-blue-900/40 to-indigo-800/20 p-6 rounded-2xl shadow-lg border border-indigo-700/30">
        <h3 className="text-xl font-semibold mb-4">Deposit Information</h3>

        <div className="mb-4">
          <label className="block mb-1">Select Currency</label>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-full bg-transparent border border-gray-600 rounded-xl p-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="usdttrc20">USDT (TRC20)</option>
            <option value="usdtbsc">USDT (BSC)</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1">Deposit Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-transparent border border-gray-600 rounded-xl p-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Enter amount"
          />
        </div>

        {amount > 0 && (
          <p className="text-sm text-gray-300 mb-4">
            Network Fee (2%): ${(amount * 0.02).toFixed(2)} — You’ll receive approximately $
            {(amount * 0.98).toFixed(2)}
          </p>
        )}

        <button
          onClick={handleDeposit}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 transition-all w-full py-2 rounded-xl font-semibold"
        >
          {loading ? "Processing..." : "Deposit Now"}
        </button>
      </div>

      {/* سجل الإيداعات */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-3">Deposit History</h3>
        {deposits.length === 0 ? (
          <p className="text-gray-400">No deposits found.</p>
        ) : (
          <div className="space-y-2">
            {deposits.map((d) => (
              <div
                key={d.id}
                className="flex justify-between items-center bg-gray-800/40 border border-gray-700 rounded-xl p-3"
              >
                <div>
                  <p className="text-lg font-semibold">${d.amount}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(d.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-sm ${
                    d.status === "approved"
                      ? "bg-green-600/30 text-green-400"
                      : d.status === "pending"
                      ? "bg-yellow-600/30 text-yellow-300"
                      : "bg-red-600/30 text-red-400"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
