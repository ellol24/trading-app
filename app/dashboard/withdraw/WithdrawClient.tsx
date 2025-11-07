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
  DialogDescription,
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

type Props = { user: any };

type WithdrawalWallet = {
  id: string;
  user_id: string;
  asset: "USDT (TRC20)" | "USDT (BEP20)";
  address: string;
  label?: string;
  otp_verified: boolean;
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
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [feePercentage, setFeePercentage] = useState<number>(10);

  const [withdrawEnabled, setWithdrawEnabled] = useState(true);

  const [newWallet, setNewWallet] = useState({
    asset: "" as WithdrawalWallet["asset"] | "",
    address: "",
    label: "",
  });

  // ✅ السحب دائمًا متاح الآن
  useEffect(() => {
    setWithdrawEnabled(true);
  }, []);

  // ✅ تحميل المحافظ
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (data) setWallets(data);
    }
    load();
  }, [user.id]);

  // ✅ تحميل السحوبات
  const loadWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*, wallet:withdrawal_wallets(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setWithdrawals(data);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user.id]);

  // ✅ تحميل نسبة العمولة
  useEffect(() => {
    async function loadFee() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .single();

      if (data) setFeePercentage(Number(data.fee_percentage));
    }
    loadFee();
  }, []);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [wallets, selectedWalletId]
  );

  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // ✅ السحب — خصم رصيد المستخدم
  const submitWithdrawal = async () => {
    if (!withdrawEnabled) {
      toast.error("❌ Withdrawals are temporarily disabled.");
      return;
    }

    if (!selectedWallet || !amount || Number(amount) < 10) {
      toast.error("⚠️ Please enter a valid amount (min $10).");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Processing withdrawal...");

    try {
      // ✅ خصم الرصيد من user_profiles
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("balance")
        .eq("uid", user.id)
        .single();

      if (!profile || profile.balance < Number(amount)) {
        toast.error("❌ Insufficient balance.");
        return;
      }

      // ✅ تحديث الرصيد
      await supabase
        .from("user_profiles")
        .update({ balance: profile.balance - Number(amount) })
        .eq("uid", user.id);

      // ✅ إدخال السحب
      await supabase.from("withdrawals").insert([
        {
          user_id: user.id,
          wallet_id: selectedWalletId,
          amount: Number(amount),
          fee: fee,
          net_amount: net,
          status: "pending",
        },
      ]);

      setAmount("");
      await loadWithdrawals();
      toast.success("✅ Withdrawal request submitted!");

    } finally {
      toast.dismiss(loadingToast);
      setIsSubmitting(false);
    }
  };

  // ✅ إضافة محفظة جديدة
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.error("⚠️ Enter wallet details.");
      return;
    }

    const loadingToast = toast.loading("Saving wallet...");

    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label || null,
        otp_verified: true,
      },
    ]);

    toast.dismiss(loadingToast);

    if (error) {
      toast.error("❌ Error adding wallet: " + error.message);
      return;
    }

    const { data } = await supabase
      .from("withdrawal_wallets")
      .select("*")
      .eq("user_id", user.id);

    if (data) setWallets(data);

    setNewWallet({ asset: "", address: "", label: "" });
    setAddWalletOpen(false);
    toast.success("✅ Wallet added!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-blue-200 mt-1">
              Send funds to your verified crypto wallet
            </p>
          </div>

          <Badge className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" />
            SSL Secured
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw">
              <TabsList className="grid grid-cols-2 bg-background/20">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Withdrawal Wallets</TabsTrigger>
              </TabsList>

              {/* ✅ صفحة السحب */}
              <TabsContent value="withdraw">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" /> Request Withdrawal
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {!withdrawEnabled && (
                      <Alert className="bg-red-500/10 border-red-500/30">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-red-400">
                          Withdrawals Disabled
                        </AlertTitle>
                        <AlertDescription className="text-red-300">
                          Withdrawals are temporarily unavailable.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white">Select Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.asset} — {w.address.slice(0, 6)}...
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-white">Amount</Label>
                        <Input
                          type="number"
                          min={10}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-background/20 rounded-lg border border-border/30 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white">Amount</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">
                          Fee ({feePercentage}%)
                        </span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between font-bold">
                        <span className="text-white">You Receive</span>
                        <span className="text-green-400">
                          ${net.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-bold"
                      onClick={submitWithdrawal}
                      disabled={
                        isSubmitting ||
                        !selectedWallet ||
                        !amount ||
                        Number(amount) < 10 ||
                        !withdrawEnabled
                      }
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin w-5 h-5" />
                      ) : (
                        "Submit Withdrawal Request"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ✅ المحافظ */}
              <TabsContent value="wallets">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" /> Withdrawal Wallets
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Wallet
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Withdrawal Wallet</DialogTitle>
                            <DialogDescription>
                              Added without email verification ✅
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-3">
                            <Label>Asset</Label>
                            <Select
                              value={newWallet.asset}
                              onValueChange={(v) =>
                                setNewWallet((p) => ({ ...p, asset: v as any }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose network" />
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

                            <Label>Label (optional)</Label>
                            <Input
                              value={newWallet.label}
                              onChange={(e) =>
                                setNewWallet((p) => ({
                                  ...p,
                                  label: e.target.value,
                                }))
                              }
                            />

                            <Label>Address</Label>
                            <Input
                              value={newWallet.address}
                              onChange={(e) =>
                                setNewWallet((p) => ({
                                  ...p,
                                  address: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <DialogFooter>
                            <Button
                              onClick={addWallet}
                              disabled={!newWallet.asset || !newWallet.address}
                            >
                              Save Wallet
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {wallets.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-lg bg-background/10 border border-border/30"
                      >
                        <p className="text-white font-semibold">
                          {w.label || w.asset}
                        </p>
                        <p className="text-muted-foreground text-sm break-all">
                          {w.address}
                        </p>

                        <Badge className="mt-2 text-green-400 border-green-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* ✅ Recent Withdrawals */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-white">Recent Withdrawals</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-background/20 rounded-lg border border-border/30"
                  >
                    <div className="flex justify-between">
                      <span className="text-white font-bold">${r.amount}</span>
                      <Badge
                        className={
                          r.status === "approved" || r.status === "paid"
                            ? "text-green-400 border-green-400"
                            : r.status === "rejected"
                            ? "text-red-400 border-red-400"
                            : "text-yellow-400 border-yellow-400"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-xs">
                      {r.wallet?.asset} •{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Net: ${r.net_amount}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-white">
                  <Lock className="w-5 h-5 mr-2" />
                  Safety Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm space-y-2">
                <p>• Only withdraw to wallets you control.</p>
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
