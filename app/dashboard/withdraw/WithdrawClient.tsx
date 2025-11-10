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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  status: string;
  created_at: string;
  wallet?: WithdrawalWallet;
};

export default function WithdrawClient({ user }: Props) {
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feePercentage, setFeePercentage] = useState(10);
  const [withdrawEnabled, setWithdrawEnabled] = useState(true);

  const MIN_WITHDRAW = 21; // ✅ بناءً على طلبك

  const [addWalletOpen, setAddWalletOpen] = useState(false);

  const [newWallet, setNewWallet] = useState({
    asset: "",
    address: "",
    label: "",
  });

  // ✅ تحميل حالة السحب من جدول withdrawal_settings
  useEffect(() => {
    async function fetchControl() {
      const { data } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .single();

      if (data) setWithdrawEnabled(data.is_enabled);
    }
    fetchControl();
  }, []);

  // ✅ تحميل نسبة العمولة من جدول withdrawal_settings
  useEffect(() => {
    async function fetchFee() {
      const { data } = await supabase
  .from("withdrawal_settings")
  .select("fee_percentage")
  .maybeSingle();


      if (data) setFeePercentage(Number(data.fee_percentage));
    }
    fetchFee();
  }, []);

  // ✅ تحميل المحافظ
  useEffect(() => {
    async function loadWallets() {
      const { data, error } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (error) toast.error("Failed to load wallets");
      else setWallets(data);
    }
    loadWallets();
  }, [user.id]);

  // ✅ تحميل عمليات السحب + جلب المحافظ دفعة واحدة باستخدام in()
  const loadWithdrawals = async () => {
    const { data: withdrawalsData, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error loading withdrawals");
      return;
    }

    // ✅ الحصول على wallet_ids
    const walletIds = withdrawalsData.map((w) => w.wallet_id);

    // ✅ جلب المحافظ كلها مرة واحدة فقط
    const { data: walletList } = await supabase
      .from("withdrawal_wallets")
      .select("*")
      .in("id", walletIds);

    // ✅ دمج السجلات
    const merged = withdrawalsData.map((w) => ({
      ...w,
      wallet: walletList.find((wl) => wl.id === w.wallet_id),
    }));

    setWithdrawals(merged);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user.id]);

  // ✅ الحساب
  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // ✅ طلب السحب
  const submitWithdrawal = async () => {
    if (!withdrawEnabled) {
      toast.error("Withdrawals are disabled");
      return;
    }

    if (!selectedWalletId || Number(amount) < MIN_WITHDRAW) {
      toast.error(`Minimum withdrawal is $${MIN_WITHDRAW}`);
      return;
    }

    setIsSubmitting(true);

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

    if (error) toast.error(error.message);
    else {
      toast.success("Withdrawal submitted");
      setAmount("");
      loadWithdrawals();
    }

    setIsSubmitting(false);
  };

  // ✅ إضافة محفظة
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address)
      return toast.error("Invalid wallet");

    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label || null,
        otp_verified: true,
      },
    ]);

    if (error) toast.error(error.message);
    else {
      toast.success("Wallet added");

      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      setWallets(data);
      setAddWalletOpen(false);
      setNewWallet({ asset: "", address: "", label: "" });
    }
  };

  return (
    <div className="min-h-screen p-6 pb-24 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-blue-200 mt-1">
              Send funds to your verified wallet
            </p>
          </div>
          <Badge className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" /> Secure
          </Badge>
        </div>

        {/* Alert */}
        {!withdrawEnabled && (
          <Alert className="bg-red-500/20 border-red-500/40">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-red-400">Withdrawals Disabled</AlertTitle>
            <AlertDescription className="text-red-200">
              Administration temporarily disabled withdrawals.
            </AlertDescription>
          </Alert>
        )}

        {/* Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw">
              <TabsList className="grid grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Wallets</TabsTrigger>
              </TabsList>

              {/* ✅ Withdraw tab */}
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
                      <AlertTitle className="text-yellow-400">Fee Notice</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        {feePercentage}% fee is deducted from the sent amount.
                      </AlertDescription>
                    </Alert>

                    {/* Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Wallet */}
                      <div>
                        <Label className="text-white">Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-slate-800">
                            <SelectValue placeholder="Select wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem value={w.id} key={w.id}>
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
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-slate-800 text-white"
                          min={MIN_WITHDRAW}
                        />
                        <p className="text-xs text-gray-400">
                          Minimum withdrawal: ${MIN_WITHDRAW}
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-slate-800 border border-slate-700 rounded">
                      <h3 className="text-white font-semibold">Summary</h3>

                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-300">Amount</span>
                        <span className="text-white">${amount || "0"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Fee</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm border-t border-slate-700 pt-2 mt-2">
                        <span className="text-gray-300">You Receive</span>
                        <span className="text-green-400 font-semibold">
                          ${net.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                      onClick={submitWithdrawal}
                      disabled={
                        !withdrawEnabled ||
                        !amount ||
                        Number(amount) < MIN_WITHDRAW ||
                        !selectedWalletId ||
                        isSubmitting
                      }
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        "Submit Withdrawal Request"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ✅ Wallets tab */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white">Manage Wallets</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Add wallet */}
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
                            <DialogTitle>Add Wallet</DialogTitle>
                            <DialogDescription>
                              Wallet will be added instantly.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-3 py-3">
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
                              <Label>Label</Label>
                              <Input
                                value={newWallet.label}
                                onChange={(e) =>
                                  setNewWallet({
                                    ...newWallet,
                                    label: e.target.value,
                                  })
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
                            <Button onClick={addWallet}>Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Wallet list */}
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

          {/* Right side */}
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
                    className="p-3 bg-background/20 rounded border border-border/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold">
                        ${r.amount}
                      </span>

                      <Badge
                        variant="outline"
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

                    <p className="text-gray-400 text-xs">
                      {r.wallet?.asset} •{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>

                    <p className="text-gray-400 text-xs">
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
                <p>• Withdraw only to your own wallets.</p>
                <p>• Never share private keys.</p>
                <p>• Enable 2FA for security.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
