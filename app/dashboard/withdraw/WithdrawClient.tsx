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
import { toast } from "sonner"; // ✅ إشعارات أنيقة

type Props = {
  user: any;
  profile: any;
};

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
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true); // ✅ تعديل جديد

  const [newWallet, setNewWallet] = useState<{
    asset: WithdrawalWallet["asset"] | "";
    address: string;
    label: string;
  }>({
    asset: "",
    address: "",
    label: "",
  });

  // ✅ تحميل حالة السحب من الإعدادات
  useEffect(() => {
    const loadWithdrawSetting = async () => {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("withdraw_enabled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setWithdrawEnabled(data.withdraw_enabled);
      }
    };

    loadWithdrawSetting();
  }, []);

  // ✅ تحميل المحافظ
  useEffect(() => {
    const fetchWallets = async () => {
      const { data, error } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        toast.error("❌ Failed to load wallets.");
      } else if (data) setWallets(data);
    };
    fetchWallets();
  }, [user.id]);

  // ✅ تحميل عمليات السحب
  const loadWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*, wallet:withdrawal_wallets(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("❌ Failed to load withdrawals history.");
    } else if (data) setWithdrawals(data);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user.id]);

  // ✅ تحميل إعدادات العمولة
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) setFeePercentage(Number(data.fee_percentage));
    };
    fetchSettings();
  }, []);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [wallets, selectedWalletId]
  );

  const fee = amount
    ? Math.max(0, Number.parseFloat(amount) * (feePercentage / 100))
    : 0;
  const net = amount ? Math.max(0, Number.parseFloat(amount) - fee) : 0;

  // ✅ إرسال طلب سحب + منع السحب عند التعطيل
  const submitWithdrawal = async () => {
    if (!withdrawEnabled) {
      toast.error("🚫 Withdrawals are currently disabled by the administration.");
      return;
    }

    if (!selectedWallet || !amount || Number.parseFloat(amount) < 10) {
      toast.warning("⚠️ Please select wallet and enter valid amount (min $10).");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("⏳ Submitting your withdrawal request...");

    try {
      const { error } = await supabase.from("withdrawals").insert([
        {
          user_id: user.id,
          wallet_id: selectedWalletId,
          amount: Number(amount),
          fee: fee,
          net_amount: net,
          status: "pending",
        },
      ]);

      if (error) {
        toast.error("❌ Error submitting withdrawal: " + error.message);
      } else {
        setAmount("");
        toast.success("✅ Withdrawal request submitted successfully!");
        await loadWithdrawals();
      }
    } catch (err) {
      toast.error("❌ Unexpected error. Please try again later.");
      console.error(err);
    } finally {
      toast.dismiss(loadingToast);
      setIsSubmitting(false);
    }
  };

  // ✅ إضافة محفظة جديدة
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.warning("⚠️ Please fill wallet asset and address.");
      return;
    }

    const loadingToast = toast.loading("🔗 Adding new wallet...");
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
    } else {
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (data) setWallets(data);
      toast.success("✅ Wallet added successfully!");
      setNewWallet({ asset: "", address: "", label: "" });
      setAddWalletOpen(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24"
      translate="no"
      data-react-protected
    >
      <div className="max-w-6xl mx-auto space-y-6" translate="no">
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
            <Shield className="w-4 h-4 mr-2" />
            SSL Secured
          </Badge>
        </div>

        {/* ✅ رسالة السحب متوقف */}
        {!withdrawEnabled && (
          <Alert className="bg-red-600/20 border-red-600/40 text-red-300">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Withdrawals Disabled</AlertTitle>
            <AlertDescription>
              Withdrawals are temporarily disabled by the administration.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" translate="no">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger
                  value="withdraw"
                  className="data-[state=active]:bg-primary"
                >
                  Withdraw
                </TabsTrigger>
                <TabsTrigger
                  value="wallets"
                  className="data-[state=active]:bg-primary"
                >
                  Withdrawal Wallets
                </TabsTrigger>
              </TabsList>

              {/* ✅ صفحة السحب */}
              <TabsContent value="withdraw">
                <Card className="trading-card" translate="no">
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
                        A {feePercentage}% withdrawal fee is deducted from the
                        amount sent, not from your platform balance.
                      </AlertDescription>
                    </Alert>

                    {/* form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Select Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-background/50 border-border/50">
                            <SelectValue placeholder="Choose wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || `${w.asset} Wallet`} —{" "}
                                {w.address.slice(0, 8)}...{w.address.slice(-4)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!wallets.length && (
                          <p className="text-sm text-red-400">
                            Add a withdrawal wallet first.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Amount (USD)</Label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 text-white"
                          min={10}
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum withdrawal: $10
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-background/20 rounded-lg border border-border/30 space-y-2">
                      <h3 className="text-white font-semibold">Summary</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Requested Amount
                        </span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Fee ({feePercentage}%)
                        </span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border/30 pt-2">
                        <span className="text-muted-foreground">
                          You Will Receive
                        </span>
                        <span className="text-green-400 font-bold">
                          ${net.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-semibold professional-gradient flex items-center justify-center"
                      onClick={submitWithdrawal}
                      disabled={
                        !withdrawEnabled || // ✅ منع السحب أثناء الإيقاف
                        !selectedWallet ||
                        !amount ||
                        Number.parseFloat(amount) < 10 ||
                        isSubmitting
                      }
                    >
                      {!withdrawEnabled ? (
                        "Withdrawals Disabled"
                      ) : isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Withdrawal Request"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ✅ المحافظ */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" /> Manage Withdrawal Wallets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* إضافة محفظة */}
                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> Add New Wallet
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Withdrawal Wallet</DialogTitle>
                            <DialogDescription>
                              Temporarily added without email verification ✅
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 py-3">
                            <div className="space-y-2">
                              <Label>Asset</Label>
                              <Select
                                value={newWallet.asset}
                                onValueChange={(v) =>
                                  setNewWallet((prev) => ({
                                    ...prev,
                                    asset: v as any,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select asset" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USDT" data-network="TRC20">USDT (TRC20)</SelectItem>
                                  <SelectItem value="USDT" data-network="BSC">USDT (BEP20)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Label (optional)</Label>
                              <Input
                                placeholder="e.g. Primary USDT (TRC20)"
                                value={newWallet.label}
                                onChange={(e) =>
                                  setNewWallet((prev) => ({
                                    ...prev,
                                    label: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Address</Label>
                              <Input
                                placeholder="Paste withdrawal address"
                                value={newWallet.address}
                                onChange={(e) =>
                                  setNewWallet((prev) => ({
                                    ...prev,
                                    address: e.target.value,
                                  }))
                                }
                              />
                            </div>
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

                    {/* قائمة المحافظ */}
                    <div className="space-y-3">
                      {wallets.map((w) => (
                        <div
                          key={w.id}
                          className="p-4 rounded-lg bg-background/10 border border-border/30"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-semibold">
                                {w.label || `${w.asset} Wallet`}
                              </p>
                              <p className="text-muted-foreground text-sm break-all">
                                {w.address}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                w.otp_verified
                                  ? "text-green-400 border-green-400"
                                  : "text-yellow-400 border-yellow-400"
                              }
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {w.otp_verified
                                ? "Verified"
                                : "Pending Verification"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
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
                {withdrawals.map((r) => (
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
                <CardTitle className="text-white text-lg flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> Security Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Only withdraw to wallets you control.</p> 
                <p>• We will never DM you asking for your OTP.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
