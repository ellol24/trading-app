"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { toast } from "sonner";

import {
  DollarSign,
  Shield,
  AlertCircle,
  Loader2,
  Plus,
  Lock,
} from "lucide-react";

type Props = { user: any; profile: any };

type WithdrawalWallet = {
  id: string;
  user_id: string;
  asset: string;
  address: string;
  label?: string;
  created_at: string;
};

type WithdrawalRequest = {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: "pending" | "approved" | "processing" | "paid" | "rejected";
  created_at: string;
  wallet?: WithdrawalWallet;
};

export default function WithdrawClient({ user }: Props) {
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");

  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);

  const [newWallet, setNewWallet] = useState({
    asset: "",
    address: "",
    label: "",
  });

  // ✅ load withdraw availability
  useEffect(() => {
    async function loadControl() {
      const { data } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .single();

      setWithdrawEnabled(data?.is_enabled ?? true);
    }
    loadControl();
  }, []);

  // ✅ load user wallets
  useEffect(() => {
    async function loadWallets() {
      const { data, error } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setWallets(data);
    }
    loadWallets();
  }, [user.id]);

  // ✅ load fee
  useEffect(() => {
    async function loadFee() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .limit(1)
        .single();

      if (data) setFeePercentage(data.fee_percentage);
    }
    loadFee();
  }, []);

  // ✅ load withdrawals manually
  async function loadWithdrawals() {
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setWithdrawals(data);
  }

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [wallets, selectedWalletId]
  );

  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // ✅ single withdrawal per day
  async function checkDailyLimit() {
    const { data } = await supabase
      .from("withdrawals")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    return data?.length > 0;
  }

  // ✅ submit withdrawal
  async function submitWithdrawal() {
    if (!withdrawEnabled) {
      toast.error("Withdrawals are disabled.");
      return;
    }

    if (await checkDailyLimit()) {
      toast.error("You can only submit 1 withdrawal per day.");
      return;
    }

    if (!selectedWallet || !amount || Number(amount) < 10) {
      toast.error("Invalid amount or wallet.");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Processing...");

    const { data, error } = await supabase.rpc("withdraw_funds", {
      p_user_id: user.id,
      p_wallet_id: selectedWalletId,
      p_amount: Number(amount),
      p_fee: fee,
      p_net_amount: net,
    });

    if (error) toast.error(error.message);
    else toast.success("Withdrawal submitted.");

    toast.dismiss(loadingToast);
    setIsSubmitting(false);

    setAmount("");
    loadWithdrawals();
  }

  // ✅ add wallet
  async function addWallet() {
    if (!newWallet.asset || !newWallet.address) {
      toast.error("Missing fields.");
      return;
    }

    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label || null,
      },
    ]);

    if (error) toast.error(error.message);
    else {
      toast.success("Wallet added.");
      setNewWallet({ asset: "", address: "", label: "" });
      loadWithdrawals();
    }
  }

  return (
    <div className="min-h-screen p-6 pb-24"
         style={{ backgroundColor: "#0b0f19" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw</h1>
            <p className="text-gray-400 mt-1">Send funds to your crypto wallet</p>
          </div>

          <Badge
            variant="outline"
            className="text-green-400 border-green-400 bg-green-400/10"
          >
            <Shield className="w-4 h-4 mr-2" /> Secure
          </Badge>
        </div>

        {!withdrawEnabled && (
          <Alert className="bg-red-900 border border-red-700">
            <AlertCircle className="h-4 w-4 text-red-300" />
            <AlertTitle className="text-red-300">Withdrawals Disabled</AlertTitle>
            <AlertDescription className="text-red-400">
              Withdrawals are temporarily disabled.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw">
              <TabsList className="grid w-full grid-cols-2 bg-[#0f1a2e] border border-[#1f2a3c]">
                <TabsTrigger value="withdraw" className="text-white">
                  Withdraw
                </TabsTrigger>
                <TabsTrigger value="wallets" className="text-white">
                  Wallets
                </TabsTrigger>
              </TabsList>

              {/* withdraw form */}
              <TabsContent value="withdraw">
                <Card style={{ backgroundColor: "#0f1a2e", border: "1px solid #1f2a3c" }}>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" /> Withdraw funds
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <Alert className="bg-yellow-900 border-yellow-700">
                      <AlertCircle className="h-4 w-4 text-yellow-300" />
                      <AlertTitle className="text-yellow-300">Fee</AlertTitle>
                      <AlertDescription className="text-yellow-400">
                        Withdrawal fee: {feePercentage}%.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* wallet selector */}
                      <div>
                        <Label className="text-white">Wallet</Label>
                        <Select
                          disabled={!withdrawEnabled}
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-[#0b1625] text-white">
                            <SelectValue placeholder="Select wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 8)}...
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* amount */}
                      <div>
                        <Label className="text-white">Amount</Label>
                        <Input
                          disabled={!withdrawEnabled}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          type="number"
                          min={10}
                          placeholder="Enter amount"
                          className="h-12 bg-[#0b1625] text-white"
                        />
                      </div>
                    </div>

                    {/* summary */}
                    <div className="p-4 bg-[#0b1625] border border-[#1f2a3c] rounded">
                      <h3 className="text-white font-semibold">Summary</h3>

                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-300">Amount</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Fee</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm mt-2 pt-2 border-t border-[#1f2a3c]">
                        <span className="text-gray-300">You Receive</span>
                        <span className="text-green-400 font-semibold">
                          ${net.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={submitWithdrawal}
                      disabled={
                        !withdrawEnabled ||
                        !selectedWallet ||
                        !amount ||
                        Number(amount) < 10 ||
                        isSubmitting
                      }
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        "Submit Withdrawal"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* wallets */}
              <TabsContent value="wallets">
                <Card style={{ backgroundColor: "#0f1a2e", border: "1px solid #1f2a3c" }}>
                  <CardHeader>
                    <CardTitle className="text-white">Manage Wallets</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Button
                      onClick={addWallet}
                      className="bg-blue-700 hover:bg-blue-800"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Wallet
                    </Button>

                    <div className="grid gap-3">
                      {wallets.map((w) => (
                        <div
                          key={w.id}
                          className="p-4 bg-[#0b1625] border border-[#1f2a3c] rounded"
                        >
                          <p className="text-white font-semibold">
                            {w.label || w.asset}
                          </p>
                          <p className="text-gray-300 text-sm break-all">
                            {w.address}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* recent withdrawals */}
          <div className="space-y-6">
            <Card style={{ backgroundColor: "#0f1a2e", border: "1px solid #1f2a3c" }}>
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  Recent Withdrawals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-[#0b1625] rounded-lg border border-[#1f2a3c]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">
                        ${r.amount}
                      </span>

                      <Badge
                        variant="outline"
                        className={
                          r.status === "approved" || r.status === "paid"
                            ? "text-green-400 border-green-400 bg-green-400/10"
                            : r.status === "rejected"
                            ? "text-red-400 border-red-400 bg-red-400/10"
                            : "text-yellow-400 border-yellow-400 bg-yellow-400/10"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>

                    <p className="text-gray-400 text-xs">
                      Net: ${r.net_amount}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* tips */}
            <Card style={{ backgroundColor: "#0f1a2e", border: "1px solid #1f2a3c" }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> Safety Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 text-sm space-y-2">
                <p>• Only withdraw to your own wallets.</p>
                <p>• Never share private keys.</p>
                <p>• Enable 2FA for better security.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
