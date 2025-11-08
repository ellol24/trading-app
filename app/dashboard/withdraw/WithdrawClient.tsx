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

// ✅ أنواع البيانات
type Props = {
  user: any;
  profile: any;
};

type WithdrawalWallet = {
  id: string;
  user_id: string;
  asset: string;
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

  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);

  const [newWallet, setNewWallet] = useState<{
    asset: string | "";
    address: string;
    label: string;
  }>({
    asset: "",
    address: "",
    label: "",
  });

  // ✅ تحميل حالة "السحب متاح أو غير متاح"
  useEffect(() => {
    const fetchSetting = async () => {
      const { data } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .single();

      setWithdrawEnabled(data?.enabled ?? true);
    };

    fetchSetting();
  }, []);

  // ✅ تحميل المحافظ
  useEffect(() => {
    async function loadWallets() {
      const { data, error } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setWallets(data);
      else toast.error("Failed to load wallets.");
    }
    loadWallets();
  }, [user.id]);

   useEffect(() => {
    const fetchWithdrawals = async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, wallet:withdrawal_wallets(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (!error && data) setWithdrawals(data)
    }
    fetchWithdrawals()
  }, [user.id])
  
  // ✅ تحميل نسبة العمولة
  useEffect(() => {
    async function loadFeeSetting() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .limit(1)
        .single();

      if (data) setFeePercentage(data.fee_percentage);
    }
    loadFeeSetting();
  }, []);

  // ✅ الحساب
  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [wallets, selectedWalletId]
  );

  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // ✅ إرسال طلب سحب — مع خصم الرصيد عبر RPC (صح 100%)
  const submitWithdrawal = async () => {
    if (!withdrawEnabled) {
      toast.error("⚠️ Withdrawals are disabled at the moment.");
      return;
    }

    if (!selectedWallet || !amount || Number(amount) < 10) {
      toast.warning("⚠️ Enter valid amount (min $10) and select wallet.");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Submitting withdrawal...");

    const { data, error } = await supabase.rpc("withdraw_funds", {
      p_user_id: user.id,
      p_wallet_id: selectedWalletId,
      p_amount: Number(amount),
      p_fee: fee,
      p_net_amount: net,
    });

    if (error) {
      toast.error(`❌ Failed: ${error.message}`);
    } else if (data?.success === false) {
      toast.error(`❌ ${data.error}`);
    } else {
      toast.success("✅ Withdrawal submitted!");
      setAmount("");
      loadWithdrawals();
    }

    toast.dismiss(loadingToast);
    setIsSubmitting(false);
  };

  // ✅ إضافة محفظة جديدة — الآن يدعم "USDT (TRC20)" و "USDT (BEP20)"
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.warning("Fill all wallet fields.");
      return;
    }

    const loadingToast = toast.loading("Adding wallet...");

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
      toast.error("❌ Error: " + error.message);
    } else {
      toast.success("✅ Wallet added!");
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (data) setWallets(data);

      setNewWallet({ asset: "", address: "", label: "" });
      setAddWalletOpen(false);
    }
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
          <Badge
            variant="outline"
            className="text-green-400 border-green-400 bg-green-400/10"
          >
            <Shield className="w-4 h-4 mr-2" /> Secure
          </Badge>
        </div>

        {!withdrawEnabled && (
          <Alert className="bg-red-500/20 border-red-500/40">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-red-400">Withdrawals Disabled</AlertTitle>
            <AlertDescription className="text-red-200">
              Withdrawals are currently disabled by administration.
            </AlertDescription>
          </Alert>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw">
              <TabsList className="grid w-full grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Withdrawal Wallets</TabsTrigger>
              </TabsList>

              {/* ✅ صفحة السحب */}
              <TabsContent value="withdraw">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" /> Request Withdrawal
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">Important</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        Fee: {feePercentage}% — deducted from sent amount.
                      </AlertDescription>
                    </Alert>

                    {/* Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Wallet selector */}
                      <div>
                        <Label className="text-white">Wallet</Label>
                        <Select
                          disabled={!withdrawEnabled}
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-slate-800">
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

                      {/* Amount */}
                      <div>
                        <Label className="text-white">Amount</Label>
                        <Input
                          disabled={!withdrawEnabled}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          type="number"
                          min={10}
                          placeholder="Enter amount"
                          className="h-12 bg-slate-800 text-white"
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-slate-800 border border-slate-700 rounded">
                      <h3 className="text-white font-semibold">Summary</h3>

                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-300">Amount</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Fee</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm mt-2 pt-2 border-t border-slate-700">
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
                        "Submit Withdrawal Request"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ✅ صفحة المحافظ */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white">Manage Wallets</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex justify-end">
                      <Dialog
                        open={addWalletOpen}
                        onOpenChange={setAddWalletOpen}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> Add Wallet
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Wallet</DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-4">
                            <div>
                              <Label>Asset</Label>
                              <Select
                                value={newWallet.asset}
                                onValueChange={(v) =>
                                  setNewWallet({
                                    ...newWallet,
                                    asset: v,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select network" />
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
                                  setNewWallet({
                                    ...newWallet,
                                    label: e.target.value,
                                  })
                                }
                                placeholder="e.g. Main Wallet"
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
                                placeholder="Enter address"
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button onClick={addWallet}>Save Wallet</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {wallets.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 border border-slate-700 rounded bg-slate-800"
                      >
                        <p className="text-white font-semibold">
                          {w.label || w.asset}
                        </p>
                        <p className="text-gray-300 text-sm break-all">
                          {w.address}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* ✅ الشريط الجانبي */}
          <div className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  Recent Withdrawals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.map((r: WithdrawalRequest) => (
                  <div
                    key={r.id}
                    className="p-3 bg-background/20 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">
                        ${r.amount}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "paid" || r.status === "approved"
                            ? "text-green-400 border-green-400 bg-green-400/10"
                            : r.status === "rejected"
                            ? "text-red-400 border-red-400 bg-red-400/10"
                            : "text-yellow-400 border-yellow-400 bg-yellow-400/10"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {r.wallet?.asset} •{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Net: ${r.net_amount}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> Safety Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 text-sm space-y-2">
                <p>• Only withdraw to wallets you own.</p>
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
