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

  const [newWallet, setNewWallet] = useState<{
    asset: WithdrawalWallet["asset"] | "";
    address: string;
    label: string;
  }>({
    asset: "",
    address: "",
    label: "",
  });

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

  // ✅ تحميل السحوبات
  const loadWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*, wallet:withdrawal_wallets(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("❌ Failed to load withdrawals.");
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

  // ✅ إرسال طلب سحب
  const submitWithdrawal = async () => {
    if (!selectedWallet || !amount || Number.parseFloat(amount) < 10) {
      toast.warning("⚠️ Enter valid amount (min $10) and select wallet.");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Submitting withdrawal...");

    try {
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

      if (error) toast.error("❌ Error: " + error.message);
      else {
        toast.success("✅ Withdrawal request submitted!");
        setAmount("");
        loadWithdrawals();
      }
    } finally {
      toast.dismiss(loadingToast);
      setIsSubmitting(false);
    }
  };

  // ✅ إضافة محفظة
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.warning("⚠️ Enter asset and address.");
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

    if (error) toast.error("❌ " + error.message);
    else {
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (data) setWallets(data);

      toast.success("✅ Wallet added!");
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
            <p className="text-blue-200 mt-1">Send funds to your verified wallet</p>
          </div>
          <Badge className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" />
            SSL Secured
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-background/20 border">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Withdrawal Wallets</TabsTrigger>
              </TabsList>

              {/* ✅ صفحة السحب */}
              <TabsContent value="withdraw">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" />
                      Request Withdrawal
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">Important</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        Fee: {feePercentage}% deducted from amount sent
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Select Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-background/50">
                            <SelectValue placeholder="Choose wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 8)}...
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
                          placeholder="Enter amount"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-background/50 text-white"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-background/20 rounded-lg border space-y-2">
                      <h3 className="text-white font-semibold">Summary</h3>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Fee ({feePercentage}%)
                        </span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">You Receive</span>
                        <span className="text-green-400 font-bold">
                          ${net.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg flex items-center justify-center"
                      onClick={submitWithdrawal}
                      disabled={
                        !selectedWallet ||
                        !amount ||
                        Number.parseFloat(amount) < 10 ||
                        isSubmitting
                      }
                    >
                      {isSubmitting ? (
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" />
                      Manage Withdrawal Wallets
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> Add Wallet
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
                            <div>
                              <Label>Asset</Label>
                              <Select
                                value={newWallet.asset}
                                onValueChange={(v) =>
                                  setNewWallet((p) => ({ ...p, asset: v as any }))
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
                                  setNewWallet((p) => ({
                                    ...p,
                                    label: e.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div>
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

                    {/* ✅ قائمة المحافظ */}
                    <div className="space-y-3">
                      {wallets.map((w) => (
                        <div
                          key={w.id}
                          className="p-4 bg-background/10 rounded border"
                        >
                          <div className="flex justify-between">
                            <div>
                              <p className="text-white font-semibold">
                                {w.label || w.asset}
                              </p>
                              <p className="text-muted-foreground text-sm break-all">
                                {w.address}
                              </p>
                            </div>

                            <Badge
                              className={
                                w.otp_verified
                                  ? "text-green-400 border-green-400"
                                  : "text-yellow-400 border-yellow-400"
                              }
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {w.otp_verified ? "Verified" : "Pending"}
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

          {/* ✅ سجل السحوبات */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-white">Recent Withdrawals</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-background/20 rounded border"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-white font-semibold">${r.amount}</span>

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

                    <p className="text-muted-foreground text-xs">
                      Net: ${r.net_amount}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> Security Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Only withdraw to wallets you control.</p>
                <p>• Never share private keys.</p>
                <p>• We will never DM you asking for codes.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
