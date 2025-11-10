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

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  DollarSign,
  Shield,
  Wallet,
  Lock,
  AlertCircle,
  CheckCircle2,
  Plus,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";

export default function WithdrawClient({ user }) {
  const [wallets, setWallets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [amount, setAmount] = useState("");

  const [feePercentage, setFeePercentage] = useState(10);
  const [withdrawEnabled, setWithdrawEnabled] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);

  const [newWallet, setNewWallet] = useState({
    asset: "",
    label: "",
    address: "",
  });

  // ✅ تحميل حالة السحب
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

  // ✅ تحميل نسبة العمولة
  useEffect(() => {
    async function loadFee() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data) setFeePercentage(Number(data.fee_percentage));
    }
    loadFee();
  }, []);

  // ✅ تحميل المحافظ
  useEffect(() => {
    async function loadWallets() {
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setWallets(data);
    }
    loadWallets();
  }, [user.id]);

  // ✅ تحميل عمليات السحب يدويًا + المحافظ المرتبطة
  const loadWithdrawals = async () => {
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!data) return;

    const full = await Promise.all(
      data.map(async (w) => {
        const { data: wallet } = await supabase
          .from("withdrawal_wallets")
          .select("*")
          .eq("id", w.wallet_id)
          .single();

        return { ...w, wallet };
      })
    );

    setWithdrawals(full);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user.id]);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [selectedWalletId, wallets]
  );

  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // ✅ تحقق من مرة واحدة يوميًا
  const checkDailyLimit = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("withdrawals")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString());

    return data?.length > 0;
  };

  // ✅ تنفيذ السحب
  const submitWithdrawal = async () => {
    if (!withdrawEnabled) return toast.error("Withdrawals disabled.");

    if (!selectedWallet) return toast.error("Select wallet.");

    if (!amount || Number(amount) < 21)
      return toast.error("Minimum withdrawal is $21.");

    const daily = await checkDailyLimit();
    if (daily) return toast.error("You can withdraw once per day.");

    setIsSubmitting(true);
    const t = toast.loading("Submitting...");

    const { error } = await supabase.from("withdrawals").insert([
      {
        user_id: user.id,
        wallet_id: selectedWalletId,
        amount: Number(amount),
        fee,
        net_amount: net,
        status: "pending",
      },
    ]);

    toast.dismiss(t);

    if (error) toast.error(error.message);
    else {
      toast.success("Withdrawal submitted.");
      setAmount("");
      loadWithdrawals();
    }

    setIsSubmitting(false);
  };

  // ✅ إضافة محفظة
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address)
      return toast.error("Fill wallet info.");

    const t = toast.loading("Adding wallet...");

    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        label: newWallet.label || null,
        address: newWallet.address,
        otp_verified: true,
      },
    ]);

    toast.dismiss(t);

    if (error) toast.error(error.message);
    else {
      toast.success("Wallet added.");
      setAddWalletOpen(false);
      setNewWallet({ asset: "", label: "", address: "" });
      const w = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (w.data) setWallets(w.data);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-blue-200 mt-1">Send funds to your wallet</p>
          </div>
          <Badge className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" />
            Secure
          </Badge>
        </div>

        {/* إذا السحب مقفل */}
        {!withdrawEnabled && (
          <Alert className="bg-red-600/20 border-red-600/40 text-red-300">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Withdrawals Disabled</AlertTitle>
            <AlertDescription>
              Withdrawals are temporarily disabled.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw">
              <TabsList className="grid grid-cols-2 bg-background/20 border">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Wallets</TabsTrigger>
              </TabsList>

              {/* صفحة السحب */}
              <TabsContent value="withdraw">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" />
                      Request Withdrawal
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">

                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">Fee Notice</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        {feePercentage}% withdrawal fee.
                      </AlertDescription>
                    </Alert>

                    {/* FORM */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <div className="space-y-2">
                        <Label className="text-white">Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-background/50">
                            <SelectValue placeholder="Choose Wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 6)}...
                                {w.address.slice(-4)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">Amount</Label>
                        <Input
                          type="number"
                          min={21}
                          placeholder="Min $21"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-background/50 text-white"
                        />
                        <p className="text-gray-400 text-xs">Minimum: $21</p>
                      </div>
                    </div>

                    {/* SUMMARY */}
                    <div className="p-4 bg-background/20 rounded-lg border">
                      <h3 className="text-white font-semibold">Summary</h3>

                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-300">Requested</span>
                        <span className="text-white">${amount || "0"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Fee</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm mt-2 pt-2 border-t">
                        <span className="text-gray-300">Net</span>
                        <span className="text-green-400">${net.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      disabled={
                        !withdrawEnabled ||
                        !selectedWallet ||
                        !amount ||
                        Number(amount) < 21 ||
                        isSubmitting
                      }
                      onClick={submitWithdrawal}
                      className="w-full h-14 text-lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="animate-spin mr-2 h-5 w-5" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Withdrawal"
                      )}
                    </Button>

                  </CardContent>
                </Card>
              </TabsContent>

              {/* المحافظ */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" />
                      Withdrawal Wallets
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">

                    {/* Add Wallet */}
                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> Add Wallet
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Wallet</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-3">

                            <div>
                              <Label>Asset</Label>
                              <Select
                                value={newWallet.asset}
                               	onValueChange={(v) =>
                                  setNewWallet({ ...newWallet, asset: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select asset" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USDT (TRC20)">
                                    USDT (TRC20)
                                  </SelectItem>
                                  <SelectItem value="USDT (BEP20)">
                                    USDT (BEP20)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Label (optional)</Label>
                              <Input
                                value={newWallet.label}
                                onChange={(e) =>
                                  setNewWallet({ ...newWallet, label: e.target.value })
                                }
                              />
                            </div>

                            <div>
                              <Label>Address</Label>
                              <Input
                                value={newWallet.address}
                                onChange={(e) =>
                                  setNewWallet({
                                    ...newWallet,
                                    address: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button onClick={addWallet}>Save Wallet</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Wallet List */}
                    {wallets.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-lg bg-background/10 border"
                      >
                        <p className="text-white font-semibold">{w.label || w.asset}</p>
                        <p className="text-gray-300 text-sm break-all">{w.address}</p>

                        <Badge
                          variant="outline"
                          className={
                            w.otp_verified
                              ? "text-green-400 border-green-400"
                              : "text-yellow-400 border-yellow-400"
                          }
                        >
                          {w.otp_verified ? "Verified" : "Pending"}
                        </Badge>
                      </div>
                    ))}

                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-6">

            {/* RECENT WITHDRAWALS */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">Recent Withdrawals</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-background/20 rounded-lg border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">${r.amount}</span>

                      <Badge
                        className={
                          r.status === "paid" ||
                          r.status === "approved"
                            ? "text-green-400 border-green-400"
                            : r.status === "rejected"
                            ? "text-red-400 border-red-400"
                            : "text-yellow-400 border-yellow-400"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>

                    <p className="text-gray-300 text-xs">
                      {r.wallet?.asset || "wallet"} •{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>

                    <p className="text-gray-400 text-xs">Net: ${r.net_amount}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* SECURITY */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> Security Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 text-sm space-y-2">
                <p>• Only withdraw to wallets you control.</p>
                <p>• Keep your private keys safe.</p>
                <p>• We never ask for OTP.</p>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  );
}
